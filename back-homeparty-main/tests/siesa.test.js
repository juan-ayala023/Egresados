// -----------------------------------------------------------------------------
// Pruebas del armado de los documentos de SIESA.
//
// No tocan la red ni el ERP: le inyectan al armador la configuracion real que
// se leyo de la fila 465 el 5 de septiembre de 2026, y comprueban que los
// documentos salen con los valores correctos.
//
// Por que importa que esto este probado: la factura sale del sistema con 14
// codigos contables que nadie revisa a ojo. Un centro de operacion cambiado o
// un monto en centavos donde SIESA espera pesos no se nota mirando la pantalla
// -- se nota cuando contabilidad cuadra el mes.
//
// Lo que estas pruebas NO pueden garantizar: que SIESA acepte los documentos.
// Eso solo se sabe enviando el primero de verdad, desde la red del colegio.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.EVENTO_NOMBRE = 'Homecoming 80 Anos'
process.env.SIESA_F_CIA = '1'
process.env.SIESA_ID_SUCURSAL = '001'
process.env.SIESA_ENSAYO = 'true'

const { armarFactura, armarRecibo, limpiarTexto, medioDePago, fechaSiesa } =
  await import('../src/siesa/facturacion.js')

/* La fila 465 tal como esta en ecampus.dbo.school_services. Leida el 5 de
   septiembre de 2026 con npm run probar-siesa. */
const CONFIG_465 = {
  id_co: '001',
  siesa_service_id: 'VS35951500',
  siesa_cc: '11049',
  siesa_id_motivo: '42',
  id_tipo_cli: 'CEXT',
  id_cond_pago: '0D',
  id_auxiliar_docto_cruce: '13453005',
  id_co_docto_cruce: '001',
  id_un_docto_cruce: '99',
  id_caja: '010',
  id_fe: '1189',
  id_un: '99',
  siesa_seller_id: '007',
  siesa_seller_tercero_id: '1037577112',
}

const ORDEN = {
  referencia: 'HC80-DR2D8P',
  cantidad: 2,
  total_centavos: 17400000, // $174.000 = 2 x 87.000
  metodo_pago: 'CARD',
  wompi_transaction_id: '12026352-1788967195-78757',
  ultimos_cuatro: '4242',
}

const COMPRADOR = { nombre: 'Juan Ayala Botero', cedula: '1023626286', tipo_documento: 'CC' }

// -----------------------------------------------------------------------------

test('el tercero de la factura es la cedula del comprador', async () => {
  const f = await armarFactura(ORDEN, COMPRADOR, { configuracion: CONFIG_465 })

  // Esta es LA decision que trabo la facturacion durante dias, y sale del
  // propio codigo del colegio: el tercero es el numero de documento.
  assert.equal(f.F350_ID_TERCERO, '1023626286')
  assert.equal(f.MOVIMIENTOS.Factura_Financiera_Movimiento[0].F320_ID_TERCERO_MOVTO, '1023626286')
})

test('el valor va en PESOS, no en centavos', async () => {
  const f = await armarFactura(ORDEN, COMPRADOR, { configuracion: CONFIG_465 })

  // El sistema lleva todo en centavos; SIESA espera pesos. Mandar 17400000
  // facturaria diecisiete millones en vez de ciento setenta y cuatro mil.
  assert.equal(f.MOVIMIENTOS.Factura_Financiera_Movimiento[0].F320_VLR_BRUTO, '174000')
  assert.notEqual(f.MOVIMIENTOS.Factura_Financiera_Movimiento[0].F320_VLR_BRUTO, '17400000')
})

test('los 14 codigos contables salen de la fila 465, no quemados', async () => {
  const f = await armarFactura(ORDEN, COMPRADOR, { configuracion: CONFIG_465 })

  assert.equal(f.F350_ID_CO, '001')
  assert.equal(f.F311_ID_TIPO_CLI, 'CEXT')
  assert.equal(f.F311_ID_COND_PAGO, '0D')
  assert.equal(f.F311_ID_TERCERO_VENDEDOR, '1037577112')

  const m = f.MOVIMIENTOS.Factura_Financiera_Movimiento[0]
  assert.equal(m.F320_ID_SERVICIO, 'VS35951500')
  assert.equal(m.F320_ID_CCOSTO_MOVTO, '11049')
  assert.equal(m.F320_ID_MOTIVO, '42')
  assert.equal(m.F320_ID_UN_MOVTO, '99')
  assert.equal(m.F320_CANTIDAD, '2', 'la cantidad son las boletas de la orden')
})

test('la factura es un FES clase 22, sin consecutivo propio', async () => {
  const f = await armarFactura(ORDEN, COMPRADOR, { configuracion: CONFIG_465 })

  assert.equal(f.F350_ID_TIPO_DOCTO, 'FES')
  assert.equal(f.F350_ID_CLASE_DOCTO, '22')
  // El consecutivo lo asigna SIESA: mandarlo lleno pisaria su numeracion.
  assert.equal(f.F350_CONSEC_DOCTO, '')
  assert.equal(f.F350_FECHA, fechaSiesa())
  assert.equal(f.F311_ID_MONEDA_DOCTO, 'COP')
})

test('el recibo cruza contra la factura emitida', async () => {
  const r = await armarRecibo(ORDEN, COMPRADOR, '001-FES-4521', { configuracion: CONFIG_465 })

  assert.equal(r.F350_ID_TIPO_DOCTO, 'RCV')
  assert.equal(r.F350_ID_CLASE_DOCTO, '13')
  // Del "001-FES-4521" SIESA solo quiere el numero.
  assert.equal(r.F353_CONSEC_DOCTO_CRUCE, '4521')
  assert.equal(r.F353_ID_TIPO_DOCTO_CRUCE, 'FES')
  assert.equal(r.F353_ID_AUXILIAR_DOCTO_CRUCE, '13453005')
  assert.equal(r.F357_ID_CAJA, '010')
  assert.equal(r.F357_ID_FE, '1189')
  assert.equal(r.F354_VALOR_CR, '174000')
})

test('una tarjeta se registra como TCD y guarda los ultimos cuatro', async () => {
  const r = await armarRecibo(ORDEN, COMPRADOR, '4521', { configuracion: CONFIG_465 })

  assert.equal(r.F358_ID_MEDIOS_PAGO, 'TCD')
  assert.equal(r.F358_NRO_CUENTA, '4242')
})

test('PSE y las billeteras se registran como CB5', async () => {
  for (const metodo of ['PSE', 'NEQUI', 'DAVIPLATA', 'BANCOLOMBIA_TRANSFER']) {
    const r = await armarRecibo({ ...ORDEN, metodo_pago: metodo }, COMPRADOR, '4521', {
      configuracion: CONFIG_465,
    })
    assert.equal(r.F358_ID_MEDIOS_PAGO, 'CB5', `${metodo} deberia ser CB5`)
    assert.equal(r.F358_NRO_CUENTA, '', 'una transferencia no tiene ultimos cuatro')
  }
})

test('los textos van sin tildes y recortados: SIESA los rechaza', () => {
  assert.equal(limpiarTexto('Homecoming 80 Años · Reunión'), 'Homecoming 80 Anos Reunion')
  assert.equal(limpiarTexto('a'.repeat(400)).length, 250)
})

test('una orden sin cedula no se factura', async () => {
  await assert.rejects(
    () => armarFactura(ORDEN, { ...COMPRADOR, cedula: '' }, { configuracion: CONFIG_465 }),
    /cedula/i,
  )
})

test('medioDePago traduce las franquicias de Wompi', () => {
  assert.equal(medioDePago('CARD'), 'TCD')
  assert.equal(medioDePago('VISA'), 'TCD')
  assert.equal(medioDePago('PSE'), 'CB5')
  assert.equal(medioDePago(null), 'CB5')
})

test('por defecto el tercero es la cedula; con generico, el generico', async () => {
  const { terceroDe } = await import('../src/siesa/facturacion.js')
  const { config } = await import('../src/config.js')

  // Sin SIESA_TERCERO_GENERICO: la cedula (lo normal).
  assert.equal(terceroDe(COMPRADOR), '1023626286')

  // Plan B: si SIESA no crea terceros solo, todo va al consumidor final.
  const antes = config.siesa.terceroGenerico
  config.siesa.terceroGenerico = '222222222222'
  try {
    assert.equal(terceroDe(COMPRADOR), '222222222222')
    const f = await armarFactura(ORDEN, COMPRADOR, { configuracion: CONFIG_465 })
    assert.equal(f.F350_ID_TERCERO, '222222222222')
    const r = await armarRecibo(ORDEN, COMPRADOR, '4521', { configuracion: CONFIG_465 })
    assert.equal(r.F358_ID_TERCERO, '222222222222')
  } finally {
    config.siesa.terceroGenerico = antes
  }
})

test('todo lo que va a Pangea sale en orden alfabetico, como los ejemplos del colegio', async () => {
  // Pangea (WCF) ignora los campos que llegan fuera de orden. Se descubrio el
  // 14 de septiembre de 2026 con la primera factura real: los F311 iban
  // despues de los F350 y llegaban vacios. El ejemplo de Clientes que mando el
  // colegio trae sus 54 campos en orden alfabetico ordinal exacto.
  const { ordenarParaPangea } = await import('../src/siesa/facturacion.js')

  const f = ordenarParaPangea(await armarFactura(ORDEN, COMPRADOR, { configuracion: CONFIG_465 }))
  const claves = Object.keys(f)
  assert.deepEqual(claves, [...claves].sort(), 'la factura no esta ordenada')
  // Los F311 (cliente) tienen que ir ANTES que los F350 (encabezado).
  assert.ok(claves.indexOf('F311_ID_COND_PAGO') < claves.indexOf('F350_ID_CO'))
  // Y el orden se aplica tambien adentro de los movimientos.
  const mov = Object.keys(f.MOVIMIENTOS.Factura_Financiera_Movimiento[0])
  assert.deepEqual(mov, [...mov].sort(), 'el movimiento no esta ordenado')

  const r = ordenarParaPangea(await armarRecibo(ORDEN, COMPRADOR, '001-FES-1234', { configuracion: CONFIG_465 }))
  const kr = Object.keys(r)
  assert.deepEqual(kr, [...kr].sort(), 'el recibo no esta ordenado')

  // Ordinal: mayusculas antes que minusculas (F_CIA antes que f015_celular),
  // como en el ejemplo de Clientes.
  const o = ordenarParaPangea({ f015_celular: 1, F_CIA: 1, F201_ID_TERCERO: 1 })
  assert.deepEqual(Object.keys(o), ['F201_ID_TERCERO', 'F_CIA', 'f015_celular'])
})
