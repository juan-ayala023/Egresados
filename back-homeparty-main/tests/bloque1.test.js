// -----------------------------------------------------------------------------
// Pruebas de lo que agrego el Bloque 1:
//   - tarifa de servicio configurable (aqui se prueba con 0; el valor real,
//     7.000, se prueba en tests/tarifa.test.js)
//   - apertura automatica de la venta -> estado "proxima"
//   - tipo de documento (NIT/CC) del acta de facturacion
//   - verificacion de egresado contra la base de mercadeo
//   - franquicia de la tarjeta y alerta de AMEX/DINERS
//   - revision de configuracion al arrancar
//
// Van en archivo aparte porque el runner de node corre cada archivo en su
// propio proceso, y estas necesitan una configuracion distinta a la de
// api.test.js (tarifa 0, egresados en "exigir").
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'homecoming-b1-'))

// Se fija TODO lo que la prueba necesita. Sin esto, dotenv rellenaria los
// huecos con el .env del desarrollador y la prueba pasaria o fallaria segun
// la maquina en la que corra.
process.env.NODE_ENV = 'test'
process.env.DB_PATH = path.join(CARPETA, 'prueba.db')
process.env.EVENTO_AFORO = '50'
process.env.VENTA_APERTURA = '2020-01-01T00:00:00-05:00'
process.env.EVENTO_CIERRE_VENTA = '2099-01-01T00:00:00-05:00'
process.env.BOLETA_PRECIO_COP = '80000'
process.env.BOLETA_TARIFA_COP = '0'
process.env.DATOS_ASISTENTE = 'acta'
process.env.EXIGIR_DIRECCION_FACTURACION = 'true'
process.env.EXIGIR_TIPO_DOCUMENTO = 'false'
process.env.VALIDAR_EGRESADO = 'exigir'
process.env.WOMPI_SIMULACION = 'true'
process.env.WOMPI_PUBLIC_KEY = 'pub_test_deprueba'
process.env.WOMPI_INTEGRITY_SECRET = 'secreto-de-prueba'
process.env.WOMPI_EVENTS_SECRET = 'eventos-de-prueba'
process.env.QR_SECRET = 'qr-secreto-de-prueba'
process.env.ADMIN_TOKEN = 'admin-prueba'
process.env.PUERTA_TOKEN = 'puerta-prueba'
process.env.SMTP_HOST = ''
process.env.LIMITE_CREAR_ORDEN = '1000'
process.env.POLITICA_DATOS_URL = ''

const { crearApp } = await import('../src/app.js')
const { cerrar: cerrarBaseDatos } = await import('../src/db/index.js')
const { config, revisarConfiguracion } = await import('../src/config.js')
const { estadoVenta } = await import('../src/servicios/aforo.js')
const { cargarBase, totalEgresados } = await import('../src/servicios/egresados.js')

const servidor = crearApp().listen(0)
const BASE = `http://127.0.0.1:${servidor.address().port}`

test.after(() => {
  servidor.close()
  cerrarBaseDatos()
  try {
    fs.rmSync(CARPETA, { recursive: true, force: true })
  } catch {
    // Windows a veces sigue con el archivo tomado; no vale tumbar la prueba.
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
  const texto = await res.text()
  let json = null
  try { json = JSON.parse(texto) } catch { /* no era json */ }
  return { status: res.status, json, texto }
}

/** Compra valida de 1 boleta. Se le pueden pisar campos del comprador. */
const compra = (comprador = {}) => ({
  tipoBoletaId: 'homecoming-80',
  cantidad: 1,
  comprador: {
    nombre: 'Maria Fernanda Restrepo Gomez',
    tipoDocumento: 'CC',
    cedula: '1020304050',
    correo: 'maria@correo.com',
    celular: '3001234567',
    direccion: 'Cra 43A # 1-50 Apto 902',
    ciudad: 'Medellin',
    fechaNacimiento: '1986-05-10',
    promocion: '2004',
    ...comprador,
  },
  asistentes: [{
    nombre: comprador.nombre ?? 'Maria Fernanda Restrepo Gomez',
    tipoDocumento: 'CC',
    cedula: comprador.cedula ?? '1020304050',
    promocion: '2004',
  }],
  aceptaTratamientoDatos: true,
  aceptaTerminos: true,
})

// -----------------------------------------------------------------------------
// OJO: esta prueba fija la tarifa en 0 y comprueba que entonces el total no
// lleva nada encima. NO describe lo que se cobra hoy: el comite dejo la tarifa
// en 7.000 y el comprador paga 87.000. Ese caso, que es el real, se prueba en
// tests/tarifa.test.js.
test('con la tarifa en 0, el total es el precio pelado y no le suma nada', async () => {
  const { status, json } = await pedir('GET', '/api/boletas')
  assert.equal(status, 200)
  const b = json.boletas[0]
  assert.equal(b.precioCentavos, 8000000)
  assert.equal(b.tarifaServicioCentavos, 0)
  assert.equal(b.totalCentavos, 8000000, 'el total no puede llevar tarifa encima')
})

test('GET /api/evento expone la apertura y los enlaces legales', async () => {
  const { status, json } = await pedir('GET', '/api/evento')
  assert.equal(status, 200)
  assert.equal(json.apertura, '2020-01-01T00:00:00-05:00')
  assert.equal(json.maxPorCompra, 4)
  // Sin definir todavia: el front no debe pintar un enlace roto.
  assert.equal(json.politicaDatosUrl, null)
})

test('antes de la apertura la venta esta "proxima" y no deja comprar', async () => {
  const original = config.evento.apertura
  config.evento.apertura = '2099-09-15T00:00:00-05:00'
  try {
    assert.equal(estadoVenta(), 'proxima')

    const evento = await pedir('GET', '/api/evento')
    assert.equal(evento.json.estadoVenta, 'proxima')

    const r = await pedir('POST', '/api/ordenes', { cuerpo: compra() })
    assert.equal(r.status, 423)
    assert.equal(r.json.error.codigo, 'VENTA_CERRADA')
    assert.match(r.json.error.mensaje, /abre el/)
  } finally {
    config.evento.apertura = original
  }
  assert.equal(estadoVenta(), 'abierta')
})

test('un tipo de documento inventado se rechaza con 422', async () => {
  const r = await pedir('POST', '/api/ordenes', {
    cuerpo: compra({ tipoDocumento: 'RUT' }),
  })
  assert.equal(r.status, 422)
  assert.ok(r.json.error.campos['comprador.tipoDocumento'])
})

test('con la base de egresados vacia, "exigir" deja pasar la compra', async () => {
  // Es a proposito: rechazar al 100% de los compradores porque mercadeo no ha
  // entregado el archivo seria peor que no validar. Queda gritado en consola.
  assert.equal(config.validarEgresado, 'exigir')
  assert.equal(totalEgresados(), 0)

  const r = await pedir('POST', '/api/ordenes', { cuerpo: compra() })
  assert.equal(r.status, 201)
  assert.equal(r.json.totalCentavos, 8000000)
})

test('con la base cargada, quien no aparece recibe 409 NO_ES_EGRESADO', async () => {
  cargarBase([
    { cedula: '1020304050', nombre: 'Maria Fernanda Restrepo', promocion: '2004' },
    { cedula: '70123456', nombre: 'Andres Felipe Ossa', promocion: '2003' },
  ])
  assert.equal(totalEgresados(), 2)

  const r = await pedir('POST', '/api/ordenes', {
    cuerpo: compra({ cedula: '99999999', nombre: 'Persona Que No Estudio Aqui' }),
  })
  assert.equal(r.status, 409)
  assert.equal(r.json.error.codigo, 'NO_ES_EGRESADO')
  assert.equal(r.json.error.motivo, 'NO_APARECE')
})

test('el egresado verificado y su tipo de documento quedan guardados', async () => {
  const r = await pedir('POST', '/api/ordenes', {
    cuerpo: compra({ cedula: '70123456', nombre: 'Andres Felipe Ossa Velez', tipoDocumento: 'NIT' }),
  })
  assert.equal(r.status, 201)

  const ficha = await pedir('GET', `/api/admin/ordenes/${r.json.referencia}`, { token: 'admin-prueba' })
  assert.equal(ficha.status, 200)
  assert.equal(ficha.json.comprador.tipo_documento, 'NIT')
  assert.equal(ficha.json.comprador.egresado_verificado, 1)
  assert.equal(ficha.json.asistentes[0].tipo_documento, 'CC')
})

test('la franquicia de la tarjeta se guarda desde el webhook', async () => {
  const orden = await pedir('POST', '/api/ordenes', {
    cuerpo: compra({ cedula: '1020304050' }),
  })
  assert.equal(orden.status, 201)
  const referencia = orden.json.referencia

  const r = await pedir('POST', '/api/webhooks/wompi', {
    cuerpo: {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'tx-franquicia-1',
          reference: referencia,
          status: 'APPROVED',
          amount_in_cents: 8000000,
          currency: 'COP',
          payment_method_type: 'CARD',
          payment_method: { type: 'CARD', extra: { brand: 'VISA' } },
        },
      },
      timestamp: Math.floor(Date.now() / 1000),
    },
  })
  assert.equal(r.status, 200)
  assert.equal(r.json.estado, 'pagada')

  const ficha = await pedir('GET', `/api/admin/ordenes/${referencia}`, { token: 'admin-prueba' })
  assert.equal(ficha.json.orden.franquicia, 'VISA')
  assert.equal(ficha.json.orden.metodo_pago, 'CARD')
})

test('un AMEX aprobado emite la boleta igual, pero deja alerta', async () => {
  const orden = await pedir('POST', '/api/ordenes', {
    cuerpo: compra({ cedula: '70123456', nombre: 'Andres Felipe Ossa Velez' }),
  })
  assert.equal(orden.status, 201)

  const errores = []
  const original = console.error
  console.error = (...a) => errores.push(a.join(' '))
  try {
    const r = await pedir('POST', '/api/webhooks/wompi', {
      cuerpo: {
        event: 'transaction.updated',
        data: {
          transaction: {
            id: 'tx-amex-1',
            reference: orden.json.referencia,
            status: 'APPROVED',
            amount_in_cents: 8000000,
            currency: 'COP',
            payment_method_type: 'CARD',
            payment_method: { type: 'CARD', extra: { brand: 'AMEX' } },
          },
        },
        timestamp: Math.floor(Date.now() / 1000),
      },
    })
    assert.equal(r.status, 200)
    assert.equal(r.json.estado, 'pagada', 'el dinero ya se movio: la boleta se emite')
  } finally {
    console.error = original
  }

  // La plata ya se movio: no se rechaza, se alerta.
  assert.ok(
    errores.some((e) => e.includes('[franquicia]') && e.includes('AMEX')),
    'deberia haber quedado una alerta de franquicia no aceptada',
  )

  const ficha = await pedir('GET', `/api/admin/ordenes/${orden.json.referencia}`, { token: 'admin-prueba' })
  assert.equal(ficha.json.orden.franquicia, 'AMEX')
  assert.equal(ficha.json.boletas.length, 1, 'la boleta se emitio')
})

// --- revision de configuracion al arrancar ----------------------------------

test('sin llaves de Wompi y con la simulacion apagada, el servidor no arranca', () => {
  const original = { ...config.wompi }
  config.wompi.simulacion = false
  config.wompi.publicKey = 'pub_test_SIN_CONFIGURAR'
  config.wompi.integritySecret = 'integrity_SIN_CONFIGURAR'
  config.wompi.eventsSecret = 'events_SIN_CONFIGURAR'
  try {
    assert.throws(revisarConfiguracion, (e) => {
      assert.match(e.message, /WOMPI_PUBLIC_KEY/)
      assert.match(e.message, /WOMPI_INTEGRITY_SECRET/)
      assert.match(e.message, /WOMPI_EVENTS_SECRET/)
      assert.match(e.message, /SMTP_HOST/, 'sin SMTP los correos con QR no salen')
      return true
    })
  } finally {
    Object.assign(config.wompi, original)
  }
  revisarConfiguracion() // con la simulacion prendida vuelve a pasar
})

test('llaves de produccion con NODE_ENV distinto de production no arrancan', () => {
  const original = { ...config.wompi }
  const correoOriginal = config.correo.host
  const urlOriginal = config.urlPublica
  config.wompi.simulacion = false
  config.wompi.publicKey = 'pub_prod_algo'
  config.wompi.integritySecret = 'integrity_real'
  config.wompi.eventsSecret = 'events_real'
  config.correo.host = 'smtp.colegio.edu.co'
  // Se fija aqui y no se hereda del .env: la prueba comprueba que un
  // PUBLIC_URL sin https se reclama, y si depende del .env de quien la corra
  // pasa o falla segun la maquina. Paso justo eso el 10 de septiembre de 2026
  // al apuntar el .env a un tunel https para una prueba con gente.
  config.urlPublica = 'http://localhost:4000'
  try {
    assert.throws(revisarConfiguracion, (e) => {
      assert.match(e.message, /llaves de PRODUCCION con NODE_ENV=test/)
      assert.match(e.message, /PUBLIC_URL tiene que ser https/)
      return true
    })
  } finally {
    Object.assign(config.wompi, original)
    config.correo.host = correoOriginal
    config.urlPublica = urlOriginal
  }
})

test('un VALIDAR_EGRESADO mal escrito no deja arrancar', () => {
  const original = config.validarEgresado
  config.validarEgresado = 'si'
  try {
    assert.throws(revisarConfiguracion, /validarEgresado/)
  } finally {
    config.validarEgresado = original
  }
})

test('una apertura posterior al cierre no deja arrancar', () => {
  const original = config.evento.apertura
  config.evento.apertura = '2099-12-31T00:00:00-05:00'
  try {
    assert.throws(revisarConfiguracion, /VENTA_APERTURA es posterior al cierre/)
  } finally {
    config.evento.apertura = original
  }
})

test('llaves de Wompi MEZCLADAS (dos de produccion, dos del sandbox) no arrancan', () => {
  // Paso el 13 de septiembre de 2026: llegaron pub_test_ y prv_test_ junto a
  // prod_integrity_ y prod_events_. Con eso Wompi rechaza todos los pagos.
  const original = { ...config.wompi }
  const entornoOriginal = config.entorno
  const urlOriginal = config.urlPublica
  const adminOriginal = config.tokens.admin
  config.entorno = 'production'
  config.urlPublica = 'https://homecomingtcs.columbus.edu.co'
  config.tokens.admin = 'x'.repeat(32)
  config.wompi.simulacion = false
  config.wompi.publicKey = 'pub_prod_abc'
  config.wompi.privateKey = 'prv_test_abc'          // <- del sandbox
  config.wompi.integritySecret = 'prod_integrity_abc'
  config.wompi.eventsSecret = 'events_test_abc'      // <- del sandbox
  config.wompi.apiUrl = 'https://sandbox.wompi.co/v1' // <- sandbox
  try {
    assert.throws(revisarConfiguracion, (e) => {
      assert.match(e.message, /WOMPI_PRIVATE_KEY no \(prv_prod_\)/)
      assert.match(e.message, /WOMPI_EVENTS_SECRET no \(prod_events_\)/)
      assert.match(e.message, /contra el sandbox/)
      return true
    })
  } finally {
    Object.assign(config.wompi, original)
    config.entorno = entornoOriginal
    config.urlPublica = urlOriginal
    config.tokens.admin = adminOriginal
  }
})

test('un ADMIN_TOKEN corto no arranca en produccion', () => {
  const original = { ...config.wompi }
  const entornoOriginal = config.entorno
  const urlOriginal = config.urlPublica
  const adminOriginal = config.tokens.admin
  config.entorno = 'production'
  config.urlPublica = 'https://homecomingtcs.columbus.edu.co'
  config.wompi.simulacion = false
  config.wompi.publicKey = 'pub_prod_abc'
  config.wompi.privateKey = 'prv_prod_abc'
  config.wompi.integritySecret = 'prod_integrity_abc'
  config.wompi.eventsSecret = 'prod_events_abc'
  config.wompi.apiUrl = 'https://production.wompi.co/v1'
  config.tokens.admin = 'admin123'
  try {
    assert.throws(revisarConfiguracion, /ADMIN_TOKEN es demasiado corto/)
  } finally {
    Object.assign(config.wompi, original)
    config.entorno = entornoOriginal
    config.urlPublica = urlOriginal
    config.tokens.admin = adminOriginal
  }
})
