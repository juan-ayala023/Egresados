// -----------------------------------------------------------------------------
// Pruebas del flujo completo:  npm test
//
// Levantan la app de verdad en un puerto libre, contra una base de datos nueva
// en un archivo temporal, y recorren la compra de punta a punta.
//
// Se corren en ORDEN: cada prueba deja el aforo en un estado del que depende la
// siguiente. Es lo que permite probar el limite por cedula y el agotamiento del
// aforo sin inventar datos a mano.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

// La configuracion se lee al importar, asi que el entorno se prepara ANTES del
// import dinamico de la app.
const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'homecoming-test-'))

process.env.NODE_ENV = 'test'
process.env.DB_PATH = path.join(CARPETA, 'prueba.db')
process.env.EVENTO_AFORO = '10'                 // aforo chiquito para poder agotarlo
process.env.EVENTO_CIERRE_VENTA = '2099-01-01T00:00:00-05:00'
// Fijado a proposito: sin esto, dotenv lo tomaria del .env del desarrollador y
// la prueba pasaria o fallaria segun la maquina.
process.env.VENTA_APERTURA = '2020-01-01T00:00:00-05:00'
process.env.VALIDAR_EGRESADO = 'apagado'
process.env.DATOS_ASISTENTE = 'completo'
process.env.EXIGIR_TIPO_DOCUMENTO = 'false'
process.env.BOLETA_PRECIO_COP = '80000'
process.env.BOLETA_TARIFA_COP = '7000'
process.env.WOMPI_SIMULACION = 'true'
process.env.WOMPI_INTEGRITY_SECRET = 'secreto-de-prueba'
process.env.QR_SECRET = 'qr-secreto-de-prueba'
process.env.ADMIN_TOKEN = 'admin-prueba'
process.env.PUERTA_TOKEN = 'puerta-prueba'
process.env.SMTP_HOST = ''                      // correos a disco, no a internet
process.env.LIMITE_CREAR_ORDEN = '1000'         // no queremos rate limit en pruebas
process.env.EXIGIR_DIRECCION_FACTURACION = 'true'

const { crearApp } = await import('../src/app.js')
const { cerrar: cerrarBaseDatos } = await import('../src/db/index.js')

const servidor = crearApp().listen(0)
const BASE = `http://127.0.0.1:${servidor.address().port}`

test.after(() => {
  servidor.close()
  // En Windows hay que cerrar SQLite antes de poder borrar el archivo.
  cerrarBaseDatos()
  try {
    fs.rmSync(CARPETA, { recursive: true, force: true })
  } catch {
    // Si el sistema todavia lo tiene tomado, no vale la pena tumbar la prueba.
  }
})

// --- ayudas -----------------------------------------------------------------

async function pedir(metodo, ruta, { cuerpo, token } = {}) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const tipo = res.headers.get('content-type') ?? ''
  const datos = tipo.includes('application/json') ? await res.json() : await res.text()
  return { status: res.status, datos, res }
}

/** Cuerpo valido de compra, con la cedula y la cantidad que se le pidan. */
function compra(cedula, cantidad) {
  const asistentes = Array.from({ length: cantidad }, (_, i) => ({
    nombre: `Asistente Numero ${i + 1} Apellido`,
    cedula: `${cedula}${i}`,
    correo: `asistente${i}.${cedula}@correo.com`,
    celular: `30012345${String(i).padStart(2, '0')}`,
    promocion: '2004',
  }))
  return {
    tipoBoletaId: 'homecoming-80',
    cantidad,
    comprador: {
      nombre: 'Maria Fernanda Restrepo Gomez',
      cedula,
      correo: `comprador.${cedula}@correo.com`,
      celular: '3001234567',
      direccion: 'Cra 43A # 1-50 Apto 902',
      ciudad: 'Medellin',
      promocion: '2004',
    },
    asistentes,
    aceptaTratamientoDatos: true,
    aceptaTerminos: true,
  }
}

const pagar = (referencia, aprobar = true) =>
  pedir('POST', '/api/simulacion/pagar', { cuerpo: { referencia, aprobar } })

// Estado compartido entre pruebas.
const estado = {}

// =============================================================================

test('GET /api/evento devuelve el estado de la venta', async () => {
  const { status, datos } = await pedir('GET', '/api/evento')
  assert.equal(status, 200)
  assert.equal(datos.aforo, 10)
  assert.equal(datos.estadoVenta, 'abierta')
  // Decision #5: por defecto los cupos restantes NO se revelan.
  assert.equal(datos.disponibles, undefined)
})

test('GET /api/boletas devuelve el precio en centavos', async () => {
  const { status, datos } = await pedir('GET', '/api/boletas')
  assert.equal(status, 200)
  const b = datos.boletas[0]
  assert.equal(b.precioCentavos, 8_000_000)
  assert.equal(b.tarifaServicioCentavos, 700_000)
  assert.equal(b.totalCentavos, 8_700_000)   // $87.000, no 87000
  assert.equal(b.disponible, true)
  assert.equal(b.disponibles, undefined)
})

test('POST /api/ordenes rechaza datos invalidos con 422 y campo por campo', async () => {
  const malo = compra('1020304050', 1)
  malo.comprador.correo = 'esto-no-es-un-correo'
  malo.comprador.celular = '300'
  malo.asistentes[0].nombre = 'Ana'          // menos de 5 caracteres
  malo.asistentes[0].promocion = '1900'      // fuera del rango 1948..ano pasado
  malo.aceptaTratamientoDatos = false

  const { status, datos } = await pedir('POST', '/api/ordenes', { cuerpo: malo })
  assert.equal(status, 422)
  assert.equal(datos.error.codigo, 'VALIDACION')
  assert.ok(datos.error.campos['comprador.correo'])
  assert.ok(datos.error.campos['comprador.celular'])
  assert.ok(datos.error.campos['asistentes.0.nombre'])
  assert.ok(datos.error.campos['asistentes.0.promocion'])
  assert.ok(datos.error.campos.aceptaTratamientoDatos)
})

test('POST /api/ordenes crea la orden y firma la transaccion para Wompi', async () => {
  const { status, datos } = await pedir('POST', '/api/ordenes', { cuerpo: compra('1111111', 2) })
  assert.equal(status, 201)
  assert.match(datos.referencia, /^HC80-[A-Z0-9]{6}$/)
  assert.equal(datos.totalCentavos, 8_700_000 * 2)
  assert.equal(datos.wompi.amountInCents, datos.totalCentavos)

  // La firma tiene que ser SHA256(referencia + monto + moneda + secreto).
  const esperada = crypto.createHash('sha256')
    .update(`${datos.referencia}${datos.totalCentavos}COPsecreto-de-prueba`)
    .digest('hex')
  assert.equal(datos.wompi.signatureIntegrity, esperada)

  estado.referencia = datos.referencia
})

test('la orden recien creada esta pendiente y sin boletas', async () => {
  const { datos } = await pedir('GET', `/api/ordenes/${estado.referencia}`)
  assert.equal(datos.estado, 'pendiente')
  assert.deepEqual(datos.boletas, [])
})

test('el webhook aprobado emite un QR por asistente', async () => {
  const { status, datos } = await pagar(estado.referencia)
  assert.equal(status, 200)
  assert.equal(datos.aplicado, true)
  assert.equal(datos.estado, 'pagada')

  const { datos: orden } = await pedir('GET', `/api/ordenes/${estado.referencia}`)
  assert.equal(orden.estado, 'pagada')
  assert.equal(orden.boletas.length, 2)
  assert.ok(orden.pagadaEn)
  assert.ok(orden.boletas[0].qrUrl.endsWith('/qr.png'))
  // El token firmado nunca sale en la respuesta publica.
  assert.equal(orden.boletas[0].token, undefined)

  estado.boletas = orden.boletas
})

test('el webhook es idempotente: el mismo evento dos veces no duplica nada', async () => {
  const { datos } = await pagar(estado.referencia)
  assert.equal(datos.duplicado, true)

  const { datos: orden } = await pedir('GET', `/api/ordenes/${estado.referencia}`)
  assert.equal(orden.boletas.length, 2)   // sigue habiendo 2, no 4
})

test('el QR y el PDF de la boleta se pueden descargar', async () => {
  const id = estado.boletas[0].id

  const qr = await fetch(`${BASE}/api/boletas/${id}/qr.png`)
  assert.equal(qr.status, 200)
  assert.equal(qr.headers.get('content-type'), 'image/png')
  assert.ok((await qr.arrayBuffer()).byteLength > 100)

  const pdf = await fetch(`${BASE}/api/boletas/${id}/pdf`)
  assert.equal(pdf.status, 200)
  assert.ok(pdf.headers.get('content-type').includes('application/pdf'))
})

test('DECISION #6: el limite de 4 es acumulado por cedula, no por compra', async () => {
  // Esa cedula ya lleva 2 boletas pagadas; pedir 3 mas pasaria de 4.
  const { status, datos } = await pedir('POST', '/api/ordenes', { cuerpo: compra('1111111', 3) })
  assert.equal(status, 409)
  assert.equal(datos.error.codigo, 'LIMITE_CEDULA')
  assert.equal(datos.error.yaCompradas, 2)
})

test('la puerta valida el QR una sola vez', async () => {
  // Sin token no se entra.
  const sinToken = await pedir('POST', '/api/puerta/validar', { cuerpo: { token: 'x' } })
  assert.equal(sinToken.status, 401)

  // El token real solo se conoce desde adentro: se lee de la lista de offline.
  const { datos: lista } = await pedir('GET', '/api/puerta/tokens', { token: 'puerta-prueba' })
  const boleta = lista.boletas.find((b) => b.id === estado.boletas[0].id)
  assert.ok(boleta)

  const primera = await pedir('POST', '/api/puerta/validar', {
    token: 'puerta-prueba',
    cuerpo: { token: boleta.token, puerta: 'Ingreso 1', operador: 'ana' },
  })
  assert.equal(primera.status, 200)
  assert.equal(primera.datos.resultado, 'VALIDA')

  const segunda = await pedir('POST', '/api/puerta/validar', {
    token: 'puerta-prueba',
    cuerpo: { token: boleta.token, puerta: 'Ingreso 2' },
  })
  assert.equal(segunda.status, 409)
  assert.equal(segunda.datos.resultado, 'YA_USADA')
  assert.equal(segunda.datos.puerta, 'Ingreso 1')   // recuerda por donde entro

  const falso = await pedir('POST', '/api/puerta/validar', {
    token: 'puerta-prueba',
    cuerpo: { token: '01ABCDEFGHIJKLMNOPQRSTUVWX.firmainventada' },
  })
  assert.equal(falso.status, 404)
  assert.equal(falso.datos.resultado, 'INVALIDA')
})

test('las reservas activas descuentan del aforo', async () => {
  // Van 2 vendidas de 10. Esta orden queda pendiente y reserva 4 mas.
  const r = await pedir('POST', '/api/ordenes', { cuerpo: compra('2222222', 4) })
  assert.equal(r.status, 201)

  const { datos } = await pedir('GET', '/api/admin/aforo', { token: 'admin-prueba' })
  assert.equal(datos.vendidas, 2)
  assert.equal(datos.reservadas, 4)
  assert.equal(datos.disponibles, 4)
})

test('CUPO_INSUFICIENTE cuando se piden mas boletas de las que quedan', async () => {
  // Quedan 4. Esta compra de 3 pasa y deja 1.
  const tres = await pedir('POST', '/api/ordenes', { cuerpo: compra('3333333', 3) })
  assert.equal(tres.status, 201)

  const dos = await pedir('POST', '/api/ordenes', { cuerpo: compra('4444444', 2) })
  assert.equal(dos.status, 409)
  assert.equal(dos.datos.error.codigo, 'CUPO_INSUFICIENTE')
  // Decision #5: no se revela cuantas quedan.
  assert.equal(dos.datos.error.disponibles, undefined)
})

test('VENTA_CERRADA cuando el aforo se llena', async () => {
  const ultima = await pedir('POST', '/api/ordenes', { cuerpo: compra('5555555', 1) })
  assert.equal(ultima.status, 201)   // se lleva el ultimo cupo

  const tarde = await pedir('POST', '/api/ordenes', { cuerpo: compra('6666666', 1) })
  assert.equal(tarde.status, 423)
  assert.equal(tarde.datos.error.codigo, 'VENTA_CERRADA')

  const { datos: evento } = await pedir('GET', '/api/evento')
  assert.equal(evento.estadoVenta, 'agotada')
})

test('un pago rechazado devuelve los cupos al inventario', async () => {
  const { datos: antes } = await pedir('GET', '/api/admin/aforo', { token: 'admin-prueba' })
  assert.equal(antes.disponibles, 0)

  // La orden de 4 de la cedula 2222222 se cae.
  const { datos: busqueda } = await pedir('GET', '/api/admin/ordenes?buscar=2222222', { token: 'admin-prueba' })
  const referencia = busqueda.ordenes[0].referencia

  const rechazo = await pagar(referencia, false)
  assert.equal(rechazo.datos.estado, 'rechazada')

  const { datos: despues } = await pedir('GET', '/api/admin/aforo', { token: 'admin-prueba' })
  assert.equal(despues.disponibles, 4)
  assert.equal(despues.estadoVenta, 'abierta')
})

test('el webhook rechaza un monto que no coincide con la orden', async () => {
  const { datos: orden } = await pedir('POST', '/api/ordenes', { cuerpo: compra('7777777', 1) })

  const { datos } = await pedir('POST', '/api/webhooks/wompi', {
    cuerpo: {
      data: {
        transaction: {
          id: 'txn-mentiroso',
          reference: orden.referencia,
          status: 'APPROVED',
          amount_in_cents: 100,        // alguien intento pagar $1
        },
      },
      timestamp: 1,
    },
  })
  assert.equal(datos.aplicado, false)
  assert.equal(datos.motivo, 'MONTO_NO_COINCIDE')

  const { datos: sigue } = await pedir('GET', `/api/ordenes/${orden.referencia}`)
  assert.equal(sigue.estado, 'pendiente')   // no se emitieron boletas
})

test('el admin exige token y exporta el CSV', async () => {
  const sinToken = await pedir('GET', '/api/admin/ordenes.csv')
  assert.equal(sinToken.status, 401)

  const { status, datos, res } = await pedir('GET', '/api/admin/ordenes.csv?estado=pagada', {
    token: 'admin-prueba',
  })
  assert.equal(status, 200)
  assert.ok(res.headers.get('content-type').includes('text/csv'))
  assert.ok(datos.includes('comprador_cedula'))
  assert.ok(datos.includes('acepta_tratamiento_datos'))
  assert.ok(datos.includes(estado.referencia))
})

test('el admin puede reemitir una boleta y el QR viejo deja de servir', async () => {
  const vieja = estado.boletas[1]

  const { status, datos } = await pedir('POST', `/api/admin/boletas/${vieja.id}/reemitir`, {
    token: 'admin-prueba',
    cuerpo: { nombre: 'Laura Jimenez Arango', cedula: '43987654', promocion: '2003' },
  })
  assert.equal(status, 200)
  assert.equal(datos.reemitida, true)
  assert.notEqual(datos.boleta.id, vieja.id)

  // La anterior ya no se puede descargar.
  const qr = await fetch(`${BASE}/api/boletas/${vieja.id}/qr.png`)
  assert.equal(qr.status, 404)
})
