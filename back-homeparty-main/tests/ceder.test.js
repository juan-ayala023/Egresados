// -----------------------------------------------------------------------------
// CEDER UNA BOLETA A OTRA PERSONA.
//
// 26 de octubre de 2026: alguien compro, no pudo ir y el colegio le autorizo
// cederle la boleta a su hijo. Lo que tiene que pasar, y lo que NO:
//
//   1. La boleta queda a nombre de quien va a entrar. En la puerta se compara
//      con el documento original.
//   2. El QR viejo se ANULA. Si siguiera sirviendo, el primero que llegue
//      entra y el otro se queda por fuera.
//   3. La factura de SIESA NO se toca: la pago otra persona y a su nombre
//      queda. Esa es la parte que no se puede romper por un cambio de titular.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.EVENTO_NOMBRE = 'TCS Homecoming 80 Anos'
process.env.WOMPI_SIMULACION = 'true'
process.env.SIESA_ENSAYO = 'true'

const { db } = await import('../src/db/index.js')
const { crearOrden, confirmarPago, boletasDeOrden, buscarPorReferencia } =
  await import('../src/servicios/ordenes.js')
const { reemitirBoleta, validarEnPuerta } = await import('../src/servicios/boletas.js')

function compraPagada(cedula = '1020304050') {
  const { referencia } = crearOrden({
    tipoBoletaId: 'homecoming-80', cantidad: 1,
    comprador: {
      nombre: 'Carlos Mesa Uribe', tipoDocumento: 'CC', cedula,
      correo: `c${cedula}@correo.com`, celular: '3001234567',
      direccion: 'Cra 43A # 1-50', ciudad: 'Medellín, Antioquia',
      fechaNacimiento: '1975-04-12', promocion: '1993',
    },
    asistentes: [{ nombre: 'Carlos Mesa Uribe', tipoDocumento: 'CC', cedula, promocion: '1993' }],
    aceptaTratamientoDatos: true, aceptaTerminos: true,
  })
  confirmarPago(referencia, { estadoDestino: 'pagada', transactionId: `tx-${cedula}`, metodoPago: 'CARD' })
  return buscarPorReferencia(referencia)
}

// -----------------------------------------------------------------------------

test('al ceder, la boleta queda a nombre del nuevo asistente y con su correo', () => {
  const orden = compraPagada('1020304051')
  const vieja = boletasDeOrden(orden.id, 'http://x')[0]

  const r = reemitirBoleta(vieja.id, {
    nombre: 'Juan Mesa Gomez', cedula: '1098765432',
    correo: 'juan.hijo@correo.com', promocion: 'no-egresado', motivo: 'Cedida a su hijo',
  }, 'http://x')

  assert.equal(r.ok, true)
  const a = db.prepare(`SELECT * FROM asistente WHERE orden_id = ?`).get(orden.id)
  assert.equal(a.nombre, 'Juan Mesa Gomez')
  assert.equal(a.cedula, '1098765432')
  assert.equal(a.correo, 'juan.hijo@correo.com')
  assert.equal(a.correo_enviado_en, null, 'se limpia para que el reenvio no lo salte')
})

test('el QR viejo DEJA DE SERVIR y el nuevo si entra', () => {
  const orden = compraPagada('1020304052')
  const vieja = boletasDeOrden(orden.id, 'http://x')[0]

  const r = reemitirBoleta(vieja.id, {
    nombre: 'Ana Mesa Gomez', cedula: '1098765433', correo: 'ana@correo.com',
    promocion: 'no-egresado', motivo: 'Cedida',
  }, 'http://x')

  // El de antes: anulado.
  const conElViejo = validarEnPuerta(vieja.token, { puerta: 'principal' })
  assert.equal(conElViejo.cuerpo.resultado, 'INVALIDA')

  // El nuevo: entra, y una sola vez.
  const nueva = boletasDeOrden(orden.id, 'http://x').find((b) => b.id === r.boleta.id)
  assert.equal(validarEnPuerta(nueva.token, { puerta: 'principal' }).cuerpo.resultado, 'VALIDA')
  assert.equal(validarEnPuerta(nueva.token, { puerta: 'principal' }).cuerpo.resultado, 'YA_USADA')
})

test('ceder NO toca la factura: sigue a nombre de quien pago', () => {
  const orden = compraPagada('1020304053')
  db.prepare(`UPDATE orden SET siesa_factura = '001-FES-9999', siesa_recibo = '001-RCV-9999' WHERE id = ?`).run(orden.id)
  const vieja = boletasDeOrden(orden.id, 'http://x')[0]

  reemitirBoleta(vieja.id, {
    nombre: 'Pedro Mesa Gomez', cedula: '1098765434', correo: 'pedro@correo.com',
    promocion: 'no-egresado', motivo: 'Cedida',
  }, 'http://x')

  const despues = buscarPorReferencia(orden.referencia)
  assert.equal(despues.siesa_factura, '001-FES-9999')
  assert.equal(despues.siesa_recibo, '001-RCV-9999')
  const c = db.prepare(`SELECT * FROM comprador WHERE orden_id = ?`).get(orden.id)
  assert.equal(c.nombre, 'Carlos Mesa Uribe', 'el comprador no cambia')
  assert.equal(c.cedula, '1020304053')
})

test('una boleta YA USADA no se puede ceder', () => {
  const orden = compraPagada('1020304054')
  const b = boletasDeOrden(orden.id, 'http://x')[0]
  validarEnPuerta(b.token, { puerta: 'principal' })

  const r = reemitirBoleta(b.id, { nombre: 'Tarde Lopez Mesa', cedula: '1', promocion: 'no-egresado' }, 'http://x')
  assert.equal(r.ok, false)
  assert.match(r.motivo, /ya se uso/i)
})

// -----------------------------------------------------------------------------
// CEDERLE LA BOLETA A OTRO EGRESADO.
//
// 12 de noviembre de 2026: una egresada de la promocion 1995 no pudo ir y le
// vendio su boleta a una COMPANERA de la misma promocion. El primer caso, en
// octubre, fue un padre cediendosela a su hijo -- ahi "no egresado" era lo
// correcto. Aqui no: la boleta tiene que decir Promocion 1995, que es lo que
// la persona quiere ver y lo que mira quien recibe en la puerta.
// -----------------------------------------------------------------------------
test('si quien recibe la boleta es egresado, conserva su promocion', () => {
  const orden = compraPagada('43626904')
  const vieja = boletasDeOrden(orden.id, 'http://x')[0]

  const r = reemitirBoleta(vieja.id, {
    nombre: 'Sandra Restrepo Posada',
    cedula: '43603104',
    correo: 'sandrarestrepop@gmail.com',
    promocion: '1995',
    motivo: 'Cedida a Sandra Restrepo Posada',
  }, 'http://x')
  assert.equal(r.ok, true)

  const a = db.prepare(`SELECT * FROM asistente WHERE orden_id = ?`).get(orden.id)
  assert.equal(a.nombre, 'Sandra Restrepo Posada')
  assert.equal(a.promocion, '1995')
  assert.equal(a.es_egresado, 1, 'queda marcada como egresada, no como acompanante')
})

test('sin promocion, quien recibe la boleta queda como no egresado', () => {
  const orden = compraPagada('43626905')
  const vieja = boletasDeOrden(orden.id, 'http://x')[0]

  reemitirBoleta(vieja.id, {
    nombre: 'Martin Palacio Zapata',
    cedula: '1125290710',
    correo: 'martinpalacio@ejemplo.com',
    promocion: 'no-egresado',
    motivo: 'Cedida a Martin Palacio Zapata',
  }, 'http://x')

  const a = db.prepare(`SELECT * FROM asistente WHERE orden_id = ?`).get(orden.id)
  assert.equal(a.es_egresado, 0)
  assert.equal(a.promocion, 'no-egresado')
})
