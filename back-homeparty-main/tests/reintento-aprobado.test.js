// -----------------------------------------------------------------------------
// UN PAGO APROBADO DESPUES DE UN RECHAZO TIENE QUE EMITIR LA BOLETA.
//
// 22 de septiembre de 2026, reportado por contabilidad: tres personas
// aparecian pagadas en Wompi y sin recibo en SIESA. Lo que habia pasado es
// que Wompi deja REINTENTAR con la misma referencia: el primer intento les
// fue rechazado (la orden quedo 'rechazada' y el cupo se libero), y el
// segundo, segundos despues, fue aprobado. Ese pago entro al colegio y el
// sistema lo ignoro, porque solo actuaba sobre ordenes 'pendiente'.
//
// Tres personas pagaron $87.000 y no tuvieron boleta hasta que alguien lo
// noto en la conciliacion. Esto es lo que lo impide.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.EVENTO_NOMBRE = 'Homecoming 80 Anos'
process.env.WOMPI_SIMULACION = 'true'
process.env.SIESA_ENSAYO = 'true'
process.env.EVENTO_AFORO = '4'

const { db } = await import('../src/db/index.js')
const { crearOrden, confirmarPago, boletasDeOrden, buscarPorReferencia } =
  await import('../src/servicios/ordenes.js')

const compra = (cedula, cantidad = 1) => ({
  tipoBoletaId: 'homecoming-80',
  cantidad,
  comprador: {
    nombre: 'Javier Robledo Cano', tipoDocumento: 'CC', cedula,
    correo: `j${cedula}@correo.com`, celular: '3001234567',
    direccion: 'Cra 43A # 1-50', ciudad: 'Medellín, Antioquia',
    fechaNacimiento: '1980-05-10', promocion: '1998',
  },
  asistentes: Array.from({ length: cantidad }, (_, i) => ({
    nombre: i === 0 ? 'Javier Robledo Cano' : `Acompanante ${i}`,
    tipoDocumento: 'CC', cedula: String(Number(cedula) + i), promocion: '1998',
  })),
  aceptaTratamientoDatos: true,
  aceptaTerminos: true,
})

const rechazar = (referencia, tx) =>
  confirmarPago(referencia, { estadoDestino: 'rechazada', transactionId: tx, metodoPago: 'CARD' })

const aprobar = (referencia, tx) =>
  confirmarPago(referencia, {
    estadoDestino: 'pagada', transactionId: tx, metodoPago: 'CARD',
    franquicia: 'MASTERCARD', ultimosCuatro: '4170', autorizacionBanco: 'A1B2C3',
  })

// -----------------------------------------------------------------------------

test('si el segundo intento es aprobado, la orden se reabre y salen las boletas', async () => {
  const { referencia } = crearOrden(compra('98622435'))

  rechazar(referencia, 'tx-intento-1')
  assert.equal(buscarPorReferencia(referencia).estado, 'rechazada')

  const r = aprobar(referencia, 'tx-intento-2')
  assert.equal(r.cambio, true)
  assert.equal(r.estado, 'pagada')
  assert.equal(r.reabierta, true)

  const orden = buscarPorReferencia(referencia)
  assert.equal(orden.estado, 'pagada')
  assert.equal(orden.wompi_transaction_id, 'tx-intento-2', 'queda el id del intento que si se pago')
  assert.equal(orden.ultimos_cuatro, '4170')
  assert.equal(orden.autorizacion_banco, 'A1B2C3')
  assert.equal(orden.cerrada_en, null)
  assert.equal(orden.motivo_cierre, null)
  assert.equal(boletasDeOrden(orden.id, 'http://x').length, 1)
})

test('la orden reabierta vuelve a contar en el aforo', async () => {
  const { disponibilidad } = await import('../src/servicios/aforo.js')
  const antes = disponibilidad().vendidas
  const { referencia } = crearOrden(compra('71654011'))
  rechazar(referencia, 'tx-a')
  assert.equal(disponibilidad().vendidas, antes, 'rechazada no cuenta')
  aprobar(referencia, 'tx-b')
  assert.equal(disponibilidad().vendidas, antes + 1, 'reabierta si cuenta')
})

test('una orden anulada a mano NO se reabre sola', async () => {
  const { referencia } = crearOrden(compra('11111111'))
  const orden = buscarPorReferencia(referencia)
  db.prepare(`UPDATE orden SET estado = 'anulada', cerrada_en = ? WHERE id = ?`).run(new Date().toISOString(), orden.id)

  const r = aprobar(referencia, 'tx-e')
  assert.equal(r.cambio, false)
  assert.equal(buscarPorReferencia(referencia).estado, 'anulada')
})

test('un rechazo sobre una orden ya rechazada no cambia nada', async () => {
  const { referencia } = crearOrden(compra('22222222'))
  rechazar(referencia, 'tx-f')
  const r = rechazar(referencia, 'tx-g')
  assert.equal(r.cambio, false)
  assert.equal(buscarPorReferencia(referencia).wompi_transaction_id, 'tx-f')
})

test('si ya no queda cupo, el pago NO emite boletas y queda como alerta', async () => {
  // El aforo de esta prueba es 4. Se llena con lo ya vendido y se comprueba
  // que un pago tardio no mete a nadie de mas en el salon.
  const { disponibilidad } = await import('../src/servicios/aforo.js')
  const { referencia } = crearOrden(compra('43626186'))
  rechazar(referencia, 'tx-c')

  // Se llena el aforo con otras compras.
  while (disponibilidad().disponibles > 0) {
    const otra = crearOrden(compra(String(50000000 + disponibilidad().disponibles)))
    aprobar(otra.referencia, `tx-lleno-${otra.referencia}`)
  }

  const r = aprobar(referencia, 'tx-d')
  assert.equal(r.estado, 'pagada_sin_cupo')
  const orden = buscarPorReferencia(referencia)
  assert.equal(boletasDeOrden(orden.id, 'http://x').length, 0, 'no se emiten boletas sin cupo')

  const { alertas } = await import('../src/servicios/alertas.js')
  assert.ok(alertas().alertas.some((a) => a.tipo === 'PAGADA_SIN_CUPO' && a.referencia === referencia))
})
