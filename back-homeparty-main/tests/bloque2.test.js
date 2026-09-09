// -----------------------------------------------------------------------------
// Pruebas del Bloque 2: Wompi real y reconciliación.
//
//   - firma de integridad: la cadena exacta y su orden
//   - checksum del webhook: se recorre signature.properties, no campos quemados
//   - un checksum inválido se rechaza con 401 (con la simulación APAGADA)
//   - reconciliación reactiva: el ?id= del redirect resuelve el pago
//   - reconciliación proactiva: el barrido rescata lo que el webhook perdió
//   - PENDING extiende la reserva en vez de expirarla (el caso PSE)
//
// Corre con WOMPI_SIMULACION=false, que es lo que activa la validación de
// firmas y la reconciliación. Las llamadas a la API de Wompi van contra un
// fetch de mentiras: no se toca la red.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'homecoming-b2-'))

const SECRETO_EVENTOS = 'events_secreto_de_prueba'
const SECRETO_INTEGRIDAD = 'integrity_secreto_de_prueba'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = path.join(CARPETA, 'prueba.db')
process.env.EVENTO_AFORO = '50'
process.env.VENTA_APERTURA = '2020-01-01T00:00:00-05:00'
process.env.EVENTO_CIERRE_VENTA = '2099-01-01T00:00:00-05:00'
process.env.BOLETA_PRECIO_COP = '80000'
process.env.BOLETA_TARIFA_COP = '0'
process.env.DATOS_ASISTENTE = 'acta'
process.env.EXIGIR_DIRECCION_FACTURACION = 'false'
process.env.VALIDAR_EGRESADO = 'apagado'
process.env.RESERVA_MINUTOS = '45'
process.env.WOMPI_SIMULACION = 'false'          // <- lo que enciende todo esto
process.env.WOMPI_PUBLIC_KEY = 'pub_test_deprueba'
process.env.WOMPI_INTEGRITY_SECRET = SECRETO_INTEGRIDAD
process.env.WOMPI_EVENTS_SECRET = SECRETO_EVENTOS
process.env.WOMPI_API_URL = 'https://sandbox.wompi.co/v1'
process.env.QR_SECRET = 'qr-secreto-de-prueba'
process.env.ADMIN_TOKEN = 'admin-prueba'
process.env.PUERTA_TOKEN = 'puerta-prueba'
process.env.SMTP_HOST = ''
process.env.LIMITE_CREAR_ORDEN = '1000'
process.env.LIMITE_CONSULTAR_ORDEN = '1000'

const { crearApp } = await import('../src/app.js')
const { db, cerrar: cerrarBaseDatos } = await import('../src/db/index.js')
const { firmaIntegridad, cadenaDelChecksum, franquiciaDe, normalizar } =
  await import('../src/pagos/wompi.js')
const { barrer } = await import('../src/servicios/reconciliacion.js')

const servidor = crearApp().listen(0)
const BASE = `http://127.0.0.1:${servidor.address().port}`

const fetchReal = globalThis.fetch

test.after(() => {
  globalThis.fetch = fetchReal
  servidor.close()
  cerrarBaseDatos()
  try { fs.rmSync(CARPETA, { recursive: true, force: true }) } catch { /* Windows */ }
})

// --- ayudas -----------------------------------------------------------------

async function pedir(metodo, ruta, { cuerpo, token } = {}) {
  const res = await fetchReal(BASE + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const texto = await res.text()
  let json = null
  try { json = JSON.parse(texto) } catch { /* no era json */ }
  return { status: res.status, json }
}

let contadorCedula = 10000000
const compra = (cantidad = 1) => {
  const cedula = String(++contadorCedula)
  const asistentes = Array.from({ length: cantidad }, (_, i) => ({
    nombre: `Persona De Prueba Numero ${i}`,
    tipoDocumento: 'CC',
    cedula: String(contadorCedula * 10 + i),
    promocion: '2004',
  }))
  return {
    tipoBoletaId: 'homecoming-80',
    cantidad,
    comprador: {
      nombre: 'Maria Fernanda Restrepo Gomez',
      tipoDocumento: 'CC',
      cedula,
      correo: 'maria@correo.com',
      celular: '3001234567',
      promocion: '2004',
    },
    asistentes,
    aceptaTratamientoDatos: true,
    aceptaTerminos: true,
  }
}

const crearOrden = async (cantidad = 1) => {
  const r = await pedir('POST', '/api/ordenes', { cuerpo: compra(cantidad) })
  assert.equal(r.status, 201, JSON.stringify(r.json))
  return r.json
}

/** Reemplaza fetch para que la "API de Wompi" devuelva lo que diga la prueba. */
function fingirWompi(porId) {
  globalThis.fetch = async (url) => {
    const id = decodeURIComponent(String(url).split('/transactions/')[1] ?? '')
    const tx = porId[id]
    if (!tx) {
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }
    return { ok: true, status: 200, json: async () => ({ data: tx }) }
  }
}

const transaccion = (over = {}) => ({
  id: 'tx-1',
  reference: 'HC80-XXXXXX',
  status: 'APPROVED',
  amount_in_cents: 8000000,
  currency: 'COP',
  payment_method_type: 'CARD',
  payment_method: { type: 'CARD', extra: { brand: 'VISA' } },
  ...over,
})

/** Un evento de webhook bien firmado, como lo mandaría Wompi. */
function eventoFirmado(tx) {
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
  const timestamp = Math.floor(Date.now() / 1000)
  const valores = [tx.id, tx.status, String(tx.amount_in_cents)].join('')
  const checksum = crypto.createHash('sha256')
    .update(`${valores}${timestamp}${SECRETO_EVENTOS}`, 'utf8')
    .digest('hex')
    .toUpperCase()                       // Wompi lo publica en mayúsculas
  return { event: 'transaction.updated', data: { transaction: tx }, timestamp, signature: { properties, checksum } }
}

const ordenDe = (referencia) =>
  db.prepare('SELECT * FROM orden WHERE referencia = ?').get(referencia)

/** Envejece una orden para que el barrido la considere. */
const envejecer = (referencia, minutos) => {
  const cuando = new Date(Date.now() - minutos * 60_000).toISOString()
  db.prepare('UPDATE orden SET creada_en = ? WHERE referencia = ?').run(cuando, referencia)
}

// =============================================================================
// 1. Criptografía
// =============================================================================

test('la firma de integridad es SHA256(referencia + monto + moneda + secreto)', () => {
  const esperado = crypto.createHash('sha256')
    .update(`HC80-4F9K2A8000000COP${SECRETO_INTEGRIDAD}`, 'utf8')
    .digest('hex')

  assert.equal(firmaIntegridad('HC80-4F9K2A', 8000000), esperado)

  // El orden importa: si alguien reordena la concatenación, Wompi rechaza todo
  // con un error opaco y nadie sabe por qué.
  const alReves = crypto.createHash('sha256')
    .update(`8000000HC80-4F9K2ACOP${SECRETO_INTEGRIDAD}`, 'utf8')
    .digest('hex')
  assert.notEqual(firmaIntegridad('HC80-4F9K2A', 8000000), alReves)
})

test('un peso de más cambia la firma por completo', () => {
  assert.notEqual(firmaIntegridad('HC80-4F9K2A', 8000000), firmaIntegridad('HC80-4F9K2A', 8000100))
})

/* AVISO PARA QUIEN VENGA DESPUES:
   La documentacion de Wompi trae un ejemplo con esta cadena

     1234-1610641025-49201APPROVED44900001530291411prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z

   y publica como resultado el checksum 3476DDA5...8BD0. Ese hash NO es el
   SHA256 de esa cadena (lo verifique: da 5A18EC5E...EFBE). Es un error de su
   documentacion, no nuestro.

   Por eso aqui NO se fija el hash publicado: se fija la CADENA que se firma,
   que es el contrato real (orden de properties, luego timestamp, luego
   secreto). Si alguien "arregla" el codigo para que cuadre con ese hash, va a
   romper la validacion contra Wompi de verdad.

   La prueba definitiva es Sandbox, con llaves reales. */
test('el checksum recorre signature.properties, no campos quemados', () => {
  // Este es el punto delicado: si Wompi cambia el set de campos firmados, hay
  // que seguir funcionando. Por eso se leen del propio evento.
  const evento = {
    data: { transaction: { id: 'ABC', status: 'APPROVED', amount_in_cents: 4490000 } },
    timestamp: 1530291411,
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
    },
  }
  assert.equal(
    cadenaDelChecksum(evento, 'un_secreto'),
    'ABCAPPROVED44900001530291411un_secreto',
  )

  // Otro orden de properties => otra cadena. No se asume ninguno.
  const alReves = { ...evento, signature: { properties: ['transaction.status', 'transaction.id'] } }
  assert.equal(cadenaDelChecksum(alReves, 'un_secreto'), 'APPROVEDABC1530291411un_secreto')
})

test('la franquicia se lee tanto de payment_method.extra.brand como de .brand', () => {
  assert.equal(franquiciaDe({ payment_method: { extra: { brand: 'visa' } } }), 'VISA')
  assert.equal(franquiciaDe({ payment_method: { brand: 'Mastercard' } }), 'MASTERCARD')
  assert.equal(franquiciaDe({ payment_method: { type: 'PSE' } }), null, 'PSE no tiene franquicia')
})

test('los estados de Wompi se traducen a estados de orden', () => {
  const estado = (s) => normalizar({ id: 'x', status: s }).estado
  assert.equal(estado('APPROVED'), 'pagada')
  assert.equal(estado('DECLINED'), 'rechazada')
  assert.equal(estado('VOIDED'), 'rechazada')
  assert.equal(estado('ERROR'), 'rechazada')
  assert.equal(estado('PENDING'), 'pendiente')
  assert.equal(estado('LO_QUE_SEA'), null, 'un estado desconocido no se inventa')
})

// =============================================================================
// 2. El webhook, con la simulación apagada
// =============================================================================

test('con la simulación apagada, un checksum inválido se rechaza con 401', async () => {
  const orden = await crearOrden()
  const tx = transaccion({ id: 'tx-firma-mala', reference: orden.referencia })
  const evento = eventoFirmado(tx)
  evento.signature.checksum = 'a'.repeat(64)   // firma inventada

  const r = await pedir('POST', '/api/webhooks/wompi', { cuerpo: evento })
  assert.equal(r.status, 401)
  assert.equal(r.json.recibido, false)
  assert.equal(ordenDe(orden.referencia).estado, 'pendiente', 'no se tocó la orden')
})

test('un evento bien firmado sí se aplica', async () => {
  const orden = await crearOrden()
  const tx = transaccion({ id: 'tx-firma-buena', reference: orden.referencia })

  const r = await pedir('POST', '/api/webhooks/wompi', { cuerpo: eventoFirmado(tx) })
  assert.equal(r.status, 200)
  assert.equal(r.json.estado, 'pagada')
  assert.equal(ordenDe(orden.referencia).franquicia, 'VISA')
})

// =============================================================================
// 3. Reconciliación reactiva (el ?id= del redirect)
// =============================================================================

test('el id del redirect resuelve el pago aunque el webhook nunca llegue', async () => {
  const orden = await crearOrden()
  fingirWompi({ 'tx-redirect': transaccion({ id: 'tx-redirect', reference: orden.referencia }) })

  const r = await pedir('POST', `/api/ordenes/${orden.referencia}/verificar`, {
    cuerpo: { idTransaccion: 'tx-redirect' },
  })
  assert.equal(r.status, 200)
  assert.equal(r.json.estado, 'pagada')
  assert.equal(r.json.boletas.length, 1, 'se emitió la boleta')

  const guardada = ordenDe(orden.referencia)
  assert.equal(guardada.wompi_transaction_id, 'tx-redirect')
  assert.equal(guardada.franquicia, 'VISA')
})

test('el id de transacción se guarda aunque el pago siga pendiente', async () => {
  // Es lo que después le permite al barrido preguntar por esta orden.
  const orden = await crearOrden()
  fingirWompi({
    'tx-pse': transaccion({ id: 'tx-pse', reference: orden.referencia, status: 'PENDING' }),
  })

  const antes = ordenDe(orden.referencia).expira_en
  const r = await pedir('POST', `/api/ordenes/${orden.referencia}/verificar`, {
    cuerpo: { idTransaccion: 'tx-pse' },
  })
  assert.equal(r.status, 200)
  assert.equal(r.json.estado, 'pendiente')

  const despues = ordenDe(orden.referencia)
  assert.equal(despues.wompi_transaction_id, 'tx-pse')
  assert.ok(despues.expira_en > antes, 'PENDING tiene que EXTENDER la reserva, no dejarla vencer')
})

test('no se puede reclamar la transacción de otra orden', async () => {
  const mia = await crearOrden()
  const ajena = await crearOrden()
  fingirWompi({ 'tx-ajena': transaccion({ id: 'tx-ajena', reference: ajena.referencia }) })

  const r = await pedir('POST', `/api/ordenes/${mia.referencia}/verificar`, {
    cuerpo: { idTransaccion: 'tx-ajena' },
  })
  assert.equal(r.status, 200)
  assert.equal(r.json.estado, 'pendiente', 'la orden ajena no puede pagar la mía')
  assert.equal(ordenDe(mia.referencia).estado, 'pendiente')
})

test('la reconciliación también revisa el monto', async () => {
  const orden = await crearOrden()
  fingirWompi({
    'tx-barata': transaccion({ id: 'tx-barata', reference: orden.referencia, amount_in_cents: 100 }),
  })

  const r = await pedir('POST', `/api/ordenes/${orden.referencia}/verificar`, {
    cuerpo: { idTransaccion: 'tx-barata' },
  })
  assert.equal(r.status, 200)
  assert.equal(ordenDe(orden.referencia).estado, 'pendiente', 'pagar $1 no emite boletas')
})

test('un id de transacción con forma rara se rechaza con 422', async () => {
  const orden = await crearOrden()
  const r = await pedir('POST', `/api/ordenes/${orden.referencia}/verificar`, {
    cuerpo: { idTransaccion: '../../etc/passwd' },
  })
  assert.equal(r.status, 422)
})

// =============================================================================
// 4. Reconciliación proactiva (el barrido)
// =============================================================================

test('el barrido rescata una orden pagada cuyo webhook se perdió', async () => {
  const orden = await crearOrden()
  // El usuario volvió del redirect (guardamos el id) pero el webhook nunca llegó.
  fingirWompi({
    'tx-perdida': transaccion({ id: 'tx-perdida', reference: orden.referencia, status: 'PENDING' }),
  })
  await pedir('POST', `/api/ordenes/${orden.referencia}/verificar`, {
    cuerpo: { idTransaccion: 'tx-perdida' },
  })
  assert.equal(ordenDe(orden.referencia).estado, 'pendiente')

  // Pasa el tiempo y en Wompi el pago sí quedó aprobado.
  envejecer(orden.referencia, 15)
  fingirWompi({
    'tx-perdida': transaccion({ id: 'tx-perdida', reference: orden.referencia, status: 'APPROVED' }),
  })

  const conteo = await barrer()
  assert.ok(conteo.revisadas >= 1)
  assert.equal(conteo.pagadas, 1)
  assert.equal(ordenDe(orden.referencia).estado, 'pagada')
  assert.deepEqual(conteo.correos, [ordenDe(orden.referencia).id], 'sale el correo con las boletas')
})

test('el barrido cuenta aparte las órdenes de las que no sabemos el id', async () => {
  const orden = await crearOrden()
  envejecer(orden.referencia, 15)
  fingirWompi({})

  const conteo = await barrer()
  assert.ok(conteo.sinTransaccion >= 1,
    'sin id no hay a quién preguntarle: tiene que quedar contado, no escondido')
  assert.equal(ordenDe(orden.referencia).estado, 'pendiente')
})

test('el barrido no toca las órdenes recién creadas', async () => {
  // Los 10 minutos de gracia existen para no gastarle consultas a Wompi
  // mientras el usuario todavía está escribiendo la tarjeta.
  const { pendientesViejas } = await import('../src/servicios/ordenes.js')
  const orden = await crearOrden()

  const candidatas = pendientesViejas(10).map((o) => o.referencia)
  assert.ok(
    !candidatas.includes(orden.referencia),
    'una orden de hace un segundo no puede entrar al barrido',
  )

  // Y en cuanto envejece, sí entra.
  envejecer(orden.referencia, 15)
  assert.ok(pendientesViejas(10).map((o) => o.referencia).includes(orden.referencia))
})

test('un rechazo en la pasarela libera los cupos', async () => {
  const { disponibilidad } = await import('../src/servicios/aforo.js')
  const orden = await crearOrden(2)
  const reservadasAntes = disponibilidad().reservadas

  envejecer(orden.referencia, 15)
  fingirWompi({
    'tx-rechazada': transaccion({
      id: 'tx-rechazada', reference: orden.referencia, status: 'DECLINED',
    }),
  })
  db.prepare('UPDATE orden SET wompi_transaction_id = ? WHERE referencia = ?')
    .run('tx-rechazada', orden.referencia)

  const conteo = await barrer()
  assert.equal(conteo.rechazadas, 1)
  assert.equal(ordenDe(orden.referencia).estado, 'rechazada')
  assert.equal(disponibilidad().reservadas, reservadasAntes - 2, 'los 2 cupos vuelven')
})

test('si Wompi no responde, la orden se deja quieta para el próximo barrido', async () => {
  const orden = await crearOrden()
  envejecer(orden.referencia, 15)
  db.prepare('UPDATE orden SET wompi_transaction_id = ? WHERE referencia = ?')
    .run('tx-caida', orden.referencia)

  globalThis.fetch = async () => { throw new Error('ECONNREFUSED') }

  const conteo = await barrer()
  assert.equal(conteo.errores, 1)
  assert.equal(ordenDe(orden.referencia).estado, 'pendiente',
    'un problema de red no puede rechazar el pago de nadie')
})
