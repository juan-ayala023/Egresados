// -----------------------------------------------------------------------------
// Pruebas de las boletas de cortesia (invitados del colegio).
//
// Lo que cuidan, en orden de que tan caro es equivocarse:
//
//   1. Que una cortesia NO se facture en SIESA. No hubo pago: una factura de
//      $0 en el ERP es un documento que alguien tiene que anular a mano.
//   2. Que NO salga de las 500 boletas en venta. El comite las pidio como
//      adicionales; si descontaran, se dejarian de vender boletas pagas.
//   3. Que no se dupliquen. Mercadeo manda la lista por tandas y alguna se va
//      a repetir; dos QR para la misma persona es una entrada de mas.
//   4. Que el QR sirva en la puerta igual que cualquier otro.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.EVENTO_NOMBRE = 'Homecoming 80 Anos'
process.env.WOMPI_SIMULACION = 'true'
process.env.SIESA_ENSAYO = 'true'
process.env.EVENTO_AFORO = '10'

const { db } = await import('../src/db/index.js')
const { crearCortesia, cortesiaDe, listarCortesias } = await import('../src/servicios/cortesias.js')
const { disponibilidad } = await import('../src/servicios/aforo.js')
const { facturarOrden, pendientesDeFactura } = await import('../src/servicios/facturacion.js')
const { boletasDeOrden } = await import('../src/servicios/ordenes.js')

// Sin cedula a proposito: asi cada prueba que cambia solo el correo crea una
// persona distinta (la llave es cedula, o correo + nombre cuando no hay).
const INVITADA = {
  nombre: 'Astrid Munoz Gomez',
  correo: 'astrid@ejemplo.com',
  celular: '3001234567',
  promocion: '',
}

// -----------------------------------------------------------------------------

test('una cortesia queda pagada, en $0 y con su boleta', () => {
  const r = crearCortesia(INVITADA)
  assert.equal(r.creada, true)

  const orden = db.prepare(`SELECT * FROM orden WHERE id = ?`).get(r.ordenId)
  assert.equal(orden.estado, 'pagada')
  assert.equal(orden.es_cortesia, 1)
  assert.equal(orden.total_centavos, 0)
  assert.equal(orden.wompi_transaction_id, null)
  assert.equal(orden.metodo_pago, null)
  assert.equal(boletasDeOrden(r.ordenId, 'http://x').length, 1)
})

test('una cortesia NO se factura en SIESA', async () => {
  const { ordenId } = crearCortesia({ ...INVITADA, correo: 'profe@ejemplo.com' })

  const r = await facturarOrden(ordenId)
  assert.equal(r.facturada, false)
  assert.match(r.motivo, /cortesia/i)

  // Y tampoco aparece como pendiente: en el panel no es un fallo que atender.
  assert.ok(!pendientesDeFactura().some((o) => o.id === ordenId))
})

test('las cortesias no descuentan del aforo en venta, pero si se cuentan', () => {
  const antes = disponibilidad()
  crearCortesia({ ...INVITADA, correo: 'invitado1@ejemplo.com' })
  crearCortesia({ ...INVITADA, correo: 'invitado2@ejemplo.com' })
  const d = disponibilidad()

  assert.equal(d.vendidas, antes.vendidas, 'una cortesia no es una venta')
  assert.equal(d.disponibles, antes.disponibles, 'no le quita cupo a quien va a comprar')
  assert.equal(d.cortesias, antes.cortesias + 2)
  assert.equal(d.asistentes, d.vendidas + d.cortesias, 'logistica necesita el total de gente')
})

test('el recaudo no se mueve con las cortesias', () => {
  const antes = disponibilidad().recaudadoCop
  crearCortesia({ ...INVITADA, correo: 'invitado3@ejemplo.com' })
  assert.equal(disponibilidad().recaudadoCop, antes)
})

test('cargar dos veces la misma lista no duplica boletas', () => {
  const primera = crearCortesia({ ...INVITADA, cedula: '43999001', correo: 'repetida@ejemplo.com' })
  const segunda = crearCortesia({ ...INVITADA, cedula: '43999001', correo: 'REPETIDA@ejemplo.com' })

  assert.equal(primera.creada, true)
  assert.equal(segunda.creada, false)
  assert.equal(segunda.referencia, primera.referencia, 'devuelve la que ya tenia')
  assert.equal(cortesiaDe({ cedula: '43999001' }).id, primera.ordenId)
})

test('dos personas que comparten correo reciben cada una su boleta', () => {
  // 8 de octubre de 2026: en el Excel del colegio la celda del correo venia
  // combinada entre marido y mujer. Con el correo como llave, al segundo de
  // la pareja no se le creaba nada.
  const ella = crearCortesia({ nombre: 'Susan Walley de Jaramillo', cedula: '1146443938', correo: 'pareja@ejemplo.com' })
  const el = crearCortesia({ nombre: 'Jesus Alfonso Jaramillo', cedula: '8255774', correo: 'pareja@ejemplo.com' })

  assert.equal(ella.creada, true)
  assert.equal(el.creada, true, 'el segundo de la pareja tambien recibe boleta')
  assert.notEqual(ella.referencia, el.referencia)
})

test('sin cedula, la llave es correo + nombre', () => {
  const uno = crearCortesia({ nombre: 'Ana Perez Lopez', correo: 'juntos@ejemplo.com' })
  const otra = crearCortesia({ nombre: 'Luis Perez Lopez', correo: 'juntos@ejemplo.com' })
  const repetido = crearCortesia({ nombre: 'Ana Perez Lopez', correo: 'juntos@ejemplo.com' })

  assert.equal(uno.creada, true)
  assert.equal(otra.creada, true, 'otra persona en el mismo correo si se crea')
  assert.equal(repetido.creada, false, 'la misma persona no se duplica')
})

test('sin nombre completo o con correo malo no se crea nada', () => {
  assert.equal(crearCortesia({ nombre: 'Pedro', correo: 'p@ejemplo.com' }).creada, false)
  assert.equal(crearCortesia({ nombre: 'Pedro Perez', correo: 'p@ejemplo' }).creada, false)
  assert.equal(crearCortesia({ nombre: 'Pedro Perez', correo: 'p@ejemplo.com.' }).creada, false)
  assert.ok(!listarCortesias().some((c) => String(c.nombre) === 'Pedro'))
})

test('el QR de una cortesia vale en la puerta igual que cualquier otro', async () => {
  const { validarEnPuerta } = await import('../src/servicios/boletas.js')
  const { ordenId } = crearCortesia({ ...INVITADA, correo: 'puerta@ejemplo.com' })
  const boleta = boletasDeOrden(ordenId, 'http://x')[0]

  const primera = validarEnPuerta(boleta.token, { puerta: 'principal', operador: 'prueba' })
  assert.equal(primera.cuerpo.resultado, 'VALIDA')

  // Y una sola vez, como todas.
  const segunda = validarEnPuerta(boleta.token, { puerta: 'principal', operador: 'prueba' })
  assert.equal(segunda.cuerpo.resultado, 'YA_USADA')
})

test('un invitado sin promocion no queda marcado como egresado', () => {
  const { ordenId } = crearCortesia({ ...INVITADA, correo: 'sinpromo@ejemplo.com' })
  const a = db.prepare(`SELECT * FROM asistente WHERE orden_id = ?`).get(ordenId)
  assert.equal(a.es_egresado, 0)
})

test('la boleta de un invitado dice "Invitado/a especial", no "no egresado"', async () => {
  // Astrid, 7 de octubre de 2026: a un profesor invitado por el colegio no se
  // le pone la etiqueta de "no egresado".
  const { buscarBoleta } = await import('../src/servicios/boletas.js')
  const { ordenId } = crearCortesia({ ...INVITADA, correo: 'etiqueta@ejemplo.com' })
  const boleta = boletasDeOrden(ordenId, 'http://x')[0]

  // La consulta que alimenta el PDF descargable tiene que traer la marca.
  assert.equal(buscarBoleta(boleta.id).es_cortesia, 1)

  // Y el PDF se genera sin reventar con esa etiqueta.
  const { pdfDeBoleta } = await import('../src/lib/pdf.js')
  const pdf = await pdfDeBoleta({
    id: boleta.id, token: boleta.token, asistente: INVITADA.nombre,
    promocion: 'no-egresado', esEgresado: false, cortesia: true, referencia: 'HC80-TEST',
  })
  assert.ok(pdf.length > 1000)
})

test('las invitaciones NO salen entre las ventas del panel', async () => {
  // Comite, 8 de octubre de 2026: una cortesia con total $0 en medio de las
  // compras parecia un error, y preguntaron si estaba descontando boletas.
  const { ultimasVentas, totalVentasPagadas, cortesiasEmitidas } =
    await import('../src/servicios/reportes.js')

  const antesVentas = totalVentasPagadas()
  const { referencia } = crearCortesia({ ...INVITADA, correo: 'panel@ejemplo.com' })

  assert.equal(totalVentasPagadas(), antesVentas, 'no suma al contador de ventas')
  assert.ok(!ultimasVentas(100).some((v) => v.referencia === referencia), 'no sale en la tabla de ventas')
  assert.ok(cortesiasEmitidas().some((c) => c.referencia === referencia), 'sale en su propia lista')
})
