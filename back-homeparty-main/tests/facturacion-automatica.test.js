// -----------------------------------------------------------------------------
// Pruebas de la facturacion automatica.
//
// Lo que cuidan es lo caro de arreglar despues:
//
//   1. Que una orden NO se facture dos veces. Wompi reenvia eventos y el
//      barrido corre cada minuto: sin la idempotencia, una sola venta saldria
//      con dos o tres facturas en el ERP, y esas no se borran -- se anulan a
//      mano, una por una.
//   2. Que un SIESA caido no le quite la boleta a nadie. Esa es la regla que
//      copiamos de la plataforma del colegio: el pago y el correo van primero.
//   3. Que el error quede guardado. Una factura que no salio y de la que nadie
//      se entera aparece en diciembre, cuando contabilidad cuadra cajas.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.EVENTO_NOMBRE = 'Homecoming 80 Anos'
process.env.WOMPI_SIMULACION = 'true'
process.env.SIESA_ENSAYO = 'true'
// Vacios a proposito: asi la prueba no depende del .env de quien la corra, y
// SIESA queda INALCANZABLE, que es justo el escenario que hay que probar.
process.env.SIESA_WSDL_URL = ''
process.env.MSSQL_HOST = ''

const { db } = await import('../src/db/index.js')
const { facturarOrden, pendientesDeFactura, facturacionActiva } =
  await import('../src/servicios/facturacion.js')

/** Mete una orden pagada directo en la base, sin pasar por el checkout. */
function ordenPagada({ referencia, factura = null }) {
  const r = db.prepare(`
    INSERT INTO orden (referencia, estado, tipo_boleta_id, cantidad,
      precio_unitario_centavos, tarifa_unitaria_centavos, total_centavos,
      creada_en, expira_en, pagada_en, wompi_transaction_id, metodo_pago, siesa_factura)
    VALUES (?, 'pagada', 'homecoming-80', 1, 8000000, 700000, 8700000,
      datetime('now'), datetime('now'), datetime('now'), 'tx-1', 'CARD', ?)`)
    .run(referencia, factura)

  db.prepare(`
    INSERT INTO comprador (orden_id, nombre, tipo_documento, cedula, correo,
      celular, direccion, ciudad, promocion, aceptado_en)
    VALUES (?, 'Juan Ayala Botero', 'CC', '1023626286', 'juan@ejemplo.com',
      '3001234567', 'Cra 45 # 12-30', 'Medellin', '2010', datetime('now'))`)
    .run(r.lastInsertRowid)

  return r.lastInsertRowid
}

const ordenDe = (id) => db.prepare(`SELECT * FROM orden WHERE id = ?`).get(id)

// -----------------------------------------------------------------------------

test('una orden que ya tiene factura NO se vuelve a facturar', async () => {
  const id = ordenPagada({ referencia: 'HC80-YAFACT', factura: '001-FES-4521' })

  const r = await facturarOrden(id)

  assert.equal(r.facturada, false)
  assert.match(r.motivo, /Ya tiene la factura 001-FES-4521/)
  // Y el numero sigue siendo el mismo: no se piso.
  assert.equal(ordenDe(id).siesa_factura, '001-FES-4521')
})

test('solo se factura lo que esta pagado', async () => {
  const id = ordenPagada({ referencia: 'HC80-PEND' })
  db.prepare(`UPDATE orden SET estado = 'pendiente' WHERE id = ?`).run(id)

  const r = await facturarOrden(id)
  assert.equal(r.facturada, false)
  assert.match(r.motivo, /pendiente/)
})

test('si SIESA no responde, la venta queda intacta y el error queda guardado', async () => {
  // ESTA ES LA PRUEBA QUE MAS IMPORTA. El egresado ya pago y ya tiene sus QR.
  // Que el ERP este caido, que no haya VPN, o que contabilidad no haya
  // prendido el interruptor no puede costarle la boleta a nadie.
  const id = ordenPagada({ referencia: 'HC80-SINERP' })

  const r = await facturarOrden(id)

  // No lanzo: devolvio el motivo.
  assert.equal(r.facturada, false)
  assert.ok(r.motivo)

  const orden = ordenDe(id)

  // La venta NO se toco: sigue pagada, con su transaccion de Wompi.
  assert.equal(orden.estado, 'pagada')
  assert.equal(orden.wompi_transaction_id, 'tx-1')
  assert.ok(orden.pagada_en)

  // Y el fallo quedo anotado. Sin esto, una factura que no salio es invisible
  // hasta que alguien la descubre cuadrando cajas en diciembre.
  assert.ok(orden.siesa_error)
  assert.ok(orden.siesa_intentado_en)
  assert.equal(orden.siesa_factura, null)
})

test('facturar nunca lanza: devuelve el motivo', async () => {
  // Una orden que no existe es el caso mas simple de "algo salio mal".
  const r = await facturarOrden(999999)
  assert.equal(r.facturada, false)
  assert.match(r.motivo, /no existe/)
})

test('las ordenes pagadas sin factura se pueden listar', () => {
  ordenPagada({ referencia: 'HC80-SINFACT1' })
  ordenPagada({ referencia: 'HC80-SINFACT2' })
  ordenPagada({ referencia: 'HC80-CONFACT', factura: '001-FES-9999' })

  const pendientes = pendientesDeFactura().map((o) => o.referencia)

  assert.ok(pendientes.includes('HC80-SINFACT1'))
  assert.ok(pendientes.includes('HC80-SINFACT2'))
  // La que ya tiene factura no aparece.
  assert.ok(!pendientes.includes('HC80-CONFACT'))
})

test('sin WSDL configurado la facturacion automatica no se intenta', () => {
  // Es lo que evita que cada venta llame a un ERP que no esta puesto y llene
  // el log de errores identicos.
  assert.equal(facturacionActiva(), false)
})

test('los ultimos cuatro de la tarjeta se guardan con el pago', async () => {
  const { crearOrden, confirmarPago } = await import('../src/servicios/ordenes.js')
  const { referencia } = crearOrden({
    tipoBoletaId: 'homecoming-80', cantidad: 1,
    comprador: {
      nombre: 'Veronica Restrepo Restrepo', tipoDocumento: 'CC', cedula: '43626286',
      correo: 'vero@ejemplo.com', celular: '3001234567', direccion: 'Cra 43 # 5-10',
      ciudad: 'Medellín, Antioquia', fechaNacimiento: '1976-03-02', promocion: '1995',
    },
    asistentes: [{ nombre: 'Veronica Restrepo Restrepo', tipoDocumento: 'CC', cedula: '43626286', promocion: '1995' }],
    aceptaTratamientoDatos: true, aceptaTerminos: true,
  })

  confirmarPago(referencia, {
    estadoDestino: 'pagada', transactionId: 'tx-4242', metodoPago: 'CARD',
    franquicia: 'VISA', ultimosCuatro: '4242',
  })

  const orden = db.prepare(`SELECT * FROM orden WHERE referencia = ?`).get(referencia)
  assert.equal(orden.estado, 'pagada')
  assert.equal(orden.ultimos_cuatro, '4242')
})

test('el reintento automatico solo toma las que fallaron por red', async () => {
  // 15 de septiembre de 2026: Pangea inalcanzable un rato dejo siete facturas
  // esperando a que alguien corriera el script. Un rechazo de SIESA no se
  // reintenta solo: ese necesita a una persona.
  const { reintentarFacturasDeRed } = await import('../src/servicios/facturacion.js')
  const red = ordenPagada({ referencia: 'HC80-RED001' })
  const siesa = ordenPagada({ referencia: 'HC80-RECHAZ' })
  const hace10 = new Date(Date.now() - 10 * 60_000).toISOString()
  db.prepare(`UPDATE orden SET siesa_error = ?, siesa_intentado_en = ? WHERE id = ?`)
    .run('SIESA rechazo la factura: read ECONNRESET', hace10, red)
  db.prepare(`UPDATE orden SET siesa_error = ?, siesa_intentado_en = ? WHERE id = ?`)
    .run('SIESA rechazo la factura: La sucursal 001 del cliente no esta activa', hace10, siesa)

  // En esta prueba SIESA esta en ensayo y sin WSDL: no reintenta nada, pero
  // tampoco revienta.
  const r = await reintentarFacturasDeRed()
  assert.equal(r.reintentadas, 0)

  // El filtro, que es lo que importa.
  const { esErrorDeRed } = await import('../src/servicios/facturacion.js')
  assert.equal(esErrorDeRed('SIESA rechazo la factura: read ECONNRESET'), true)
  assert.equal(esErrorDeRed('connect EHOSTUNREACH 10.90.11.140:8082'), true)
  assert.equal(esErrorDeRed('SIESA rechazo la factura: read ETIMEDOUT'), true)
  assert.equal(esErrorDeRed('SIESA rechazo el tercero: Error desconocido'), true)
  assert.equal(esErrorDeRed('SIESA rechazo la factura: La sucursal 001 del cliente no esta activa'), false)
  assert.equal(esErrorDeRed('SIESA rechazo el tercero: El dato es obligatorio'), false)
})
