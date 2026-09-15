// -----------------------------------------------------------------------------
// LOS CAMPOS DEL TERCERO Y DEL CLIENTE TIENEN QUE IR EN EL NAMESPACE DEL
// CONTRATO DE DATOS (CRM.SERVICIOS), NO EN EL DE LA OPERACION (tempuri).
//
// 15 de septiembre de 2026: las primeras cinco compras de gente que no
// existia en el ERP fallaron con "Value cannot be null. Parameter name:
// String". node-soap dejaba los campos de Tercero y Clientes en tempuri
// porque el parametro se llama igual que la operacion; WCF los ignoraba y le
// llegaba todo nulo. La factura si salia bien (Financiera_Factura > Factura).
//
// Esta prueba serializa contra el WSDL real de Pangea (copia en tests/wsdl,
// sacada del proyecto SoapUI que mando el colegio) sin conectarse a nada.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import soap from 'soap'

process.env.NODE_ENV = 'test'
process.env.SIESA_ENSAYO = 'true'
process.env.SIESA_F_CIA = '1'
process.env.SIESA_ID_SUCURSAL = '001'

const WSDL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'wsdl', 'pangea.wsdl')
const CRM = 'http://schemas.datacontract.org/2004/07/CRM.SERVICIOS'

const CFG = {
  id_co: '001', siesa_service_id: 'VS', siesa_cc: '1', siesa_id_motivo: '42', id_tipo_cli: 'CEXT',
  id_cond_pago: '0D', id_auxiliar_docto_cruce: '1', id_co_docto_cruce: '001', id_un_docto_cruce: '99',
  id_caja: '010', id_fe: '1189', id_un: '99', siesa_seller_id: '007', siesa_seller_tercero_id: '1',
}
const COMPRADOR = {
  nombre: 'Alexandra Andrea Alvarez Gomez', tipo_documento: 'CC', cedula: '43743286',
  correo: 'a@b.com', celular: '3001234567', direccion: 'Km 5.5 via El Retiro', ciudad: 'Medellín', fecha_nacimiento: '1986-05-10',
}

/** Serializa una llamada sin enviarla: el endpoint no existe y solo se mira lastRequest. */
async function xmlDe(operacion, cuerpo) {
  const cli = await soap.createClientAsync(WSDL, { endpoint: 'http://127.0.0.1:1/nada' })
  try { await cli[`${operacion}Async`](cuerpo) } catch { /* no hay servidor: es lo esperado */ }
  return String(cli.lastRequest)
}

/** ¿Este campo esta declarado en el namespace CRM (por prefijo o por xmlns)? */
function campoEnCrm(xml, campo) {
  const conXmlns = new RegExp(`<${campo} xmlns="${CRM}"`)
  const conPrefijo = new RegExp('<(\\w+):' + campo + '[^>]*xmlns:\\1="' + CRM + '"')
  return conXmlns.test(xml) || conPrefijo.test(xml)
}

test('el Tercero sale con cada campo en el namespace CRM.SERVICIOS', async () => {
  const { armarTercero, paraPangea } = await import('../src/siesa/terceros.js')
  const xml = await xmlDe('Tercero', { Tercero: paraPangea(armarTercero(COMPRADOR)) })
  for (const campo of ['F200_ID', 'F200_NIT', 'F015_EMAIL', 'F_CIA']) {
    assert.ok(campoEnCrm(xml, campo), `${campo} no va en CRM.SERVICIOS`)
  }
  assert.ok(xml.includes('<Tercero xmlns="http://tempuri.org/"><Tercero>'), 'la operacion y el parametro siguen en tempuri')
})

test('el Cliente sale con cada campo en el namespace CRM.SERVICIOS', async () => {
  const { armarCliente, paraPangea } = await import('../src/siesa/terceros.js')
  const xml = await xmlDe('Clientes', { Clientes: paraPangea(armarCliente(COMPRADOR, CFG)) })
  for (const campo of ['F201_ID_TERCERO', 'F201_ID_SUCURSAL', 'F201_ID_TIPO_CLI', 'F_CIA']) {
    assert.ok(campoEnCrm(xml, campo), `${campo} no va en CRM.SERVICIOS`)
  }
})

test('sin el arreglo los campos quedaban en tempuri (documenta el bug)', async () => {
  const { armarTercero } = await import('../src/siesa/terceros.js')
  const xml = await xmlDe('Tercero', { Tercero: armarTercero(COMPRADOR) })
  assert.ok(!campoEnCrm(xml, 'F200_ID'))
})

test('la factura ya iba bien sola: sus campos tambien quedan en CRM.SERVICIOS', async () => {
  const { armarFactura, ordenarParaPangea } = await import('../src/siesa/facturacion.js')
  const orden = { cantidad: 1, total_centavos: 8700000, metodo_pago: 'CARD', wompi_transaction_id: 't' }
  const xml = await xmlDe('Financiera_Factura', { Factura: ordenarParaPangea(await armarFactura(orden, COMPRADOR, { configuracion: CFG })) })
  assert.ok(campoEnCrm(xml, 'F350_ID_TERCERO'))
})
