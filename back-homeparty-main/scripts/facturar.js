// -----------------------------------------------------------------------------
// FACTURAR UNA ORDEN EN SIESA.
//
//   npm run facturar -- HC80-LSHVCE          arma los documentos y los muestra
//   npm run facturar -- HC80-LSHVCE --enviar los manda al ERP de verdad
//
// Por defecto NO TOCA EL ERP: arma la factura y el recibo, los imprime, y ahi
// se queda. Es para que contabilidad pueda revisar campo por campo lo que se
// le va a mandar a SIESA antes de que salga el primer documento real.
//
// Con --enviar sale de verdad, y para eso ademas hay que poner SIESA_ENSAYO=false
// en el .env. Son dos cerrojos a proposito: una factura emitida en un sistema
// contable no se borra, se anula, y eso lo hace una persona a mano.
//
// El script factura DE A UNA orden. No hay un "facturar todo" todavia, y es
// deliberado: hasta que no salga bien la primera contra el ERP real, procesar
// 500 de golpe es multiplicar por 500 cualquier error.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import { config } from '../src/config.js'
import { buscarPorReferencia, compradorDe } from '../src/servicios/ordenes.js'
import { leerConfiguracionSiesa, cerrarConexion } from '../src/siesa/config.js'
import { armarFactura, armarRecibo, facturar, ErrorSiesaFactura } from '../src/siesa/facturacion.js'
import { armarTercero, armarCliente, armarCriterio, consultarTercero } from '../src/siesa/terceros.js'

const referencia = process.argv[2]
const enviar = process.argv.includes('--enviar')

if (!referencia) {
  console.log('\n  Uso:  npm run facturar -- HC80-XXXXXX [--enviar]\n')
  process.exit(1)
}

const mostrar = (titulo, obj) => {
  console.log(`\n  ${titulo}`)
  console.log('  ' + '-'.repeat(titulo.length))
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'MOVIMIENTOS') continue
    console.log(`    ${k.padEnd(32)} ${v}`)
  }
  if (obj.MOVIMIENTOS) {
    console.log('\n    MOVIMIENTOS:')
    for (const [k, v] of Object.entries(obj.MOVIMIENTOS.Factura_Financiera_Movimiento[0])) {
      console.log(`      ${k.padEnd(30)} ${v}`)
    }
  }
}

try {
  const orden = buscarPorReferencia(referencia)
  if (!orden) {
    console.log(`\n  No existe la orden ${referencia}\n`)
    process.exit(1)
  }
  if (orden.estado !== 'pagada') {
    console.log(`\n  La orden ${referencia} esta en "${orden.estado}". Solo se factura lo pagado.\n`)
    process.exit(1)
  }
  if (orden.siesa_factura) {
    console.log(`\n  OJO: esta orden YA tiene la factura ${orden.siesa_factura}.`)
    console.log('  Volver a facturarla emitiria un documento duplicado en el ERP.\n')
    process.exit(1)
  }

  const comprador = compradorDe(orden.id)

  console.log('')
  console.log(`  Orden      ${orden.referencia}`)
  console.log(`  Comprador  ${comprador.nombre}  (${comprador.tipo_documento} ${comprador.cedula})`)
  console.log(`  Total      $${(orden.total_centavos / 100).toLocaleString('es-CO')}  ·  ${orden.cantidad} boleta(s)`)
  console.log(`  Wompi      ${orden.wompi_transaction_id ?? '(sin id)'}`)
  console.log('')
  console.log(`  El TERCERO en SIESA sera la cedula: ${comprador.cedula}`)
  try {
    const t = await consultarTercero(comprador.cedula)
    if (!t.existe) {
      console.log('  NO existe en t200_mm_terceros: se va a crear antes de facturar.')
    } else if (!t.sucursales.includes(config.siesa.sucursal)) {
      console.log(`  Ya existe (id ${t.tercero}) pero SIN la sucursal ${config.siesa.sucursal}: se crea solo la sucursal.`)
    } else {
      console.log(`  Ya existe en el ERP (id ${t.tercero}). No se le toca nada.`)
    }
  } catch (e) {
    console.log(`  No se pudo consultar si existe (${e.message}).`)
    console.log('  Sin esa consulta el envio real se detiene: crear a ciegas sobrescribiria a alguien.')
  }

  const configuracion = await leerConfiguracionSiesa()

  if (!enviar || config.siesa.ensayo) {
    const factura = await armarFactura(orden, comprador, { configuracion })
    const recibo = await armarRecibo(orden, comprador, 'PENDIENTE', { configuracion })

    mostrar('TERCERO - Tercero', armarTercero(comprador))
    mostrar('CLIENTE (sucursal) - Clientes', armarCliente(comprador, configuracion))
    const criterio = armarCriterio(comprador)
    if (criterio) mostrar('CRITERIO - Criterios_Clientes', criterio)
    else console.log('
  CRITERIO: apagado (SIESA_PLAN_CRITERIOS vacio).')

    mostrar('FACTURA (FES) - Financiera_Factura', factura)
    mostrar('RECIBO DE CAJA (RCV) - Recibo_de_caja', recibo)

    console.log('\n  ENSAYO: no se envio nada al ERP.')
    if (!enviar) console.log('  Para enviarla de verdad:  npm run facturar -- ' + referencia + ' --enviar')
    if (config.siesa.ensayo) console.log('  Y ademas hay que poner SIESA_ENSAYO=false en el .env.')
    console.log('')
  } else {
    console.log('\n  ENVIANDO AL ERP...\n')
    const r = await facturar(orden, comprador)
    if (r.tercero?.existia === false) console.log(`  Tercero creado:   ${r.tercero.tercero}`)
    else if (r.tercero) console.log(`  Tercero:          ${r.tercero.tercero} (ya existia)`)
    console.log(`  Factura emitida:  ${r.numeroFactura}`)
    console.log(`  Recibo emitido:   ${r.numeroRecibo}`)
    console.log('\n  Anotalos: son los consecutivos con los que contabilidad rastrea la venta.\n')
  }
} catch (e) {
  console.log(`\n  FALLO: ${e.message}`)
  if (e instanceof ErrorSiesaFactura) {
    if (e.tipo === 'sin_configurar') {
      console.log('\n  Faltan datos en el .env. Los tres salen del .env de la plataforma')
      console.log('  de eventos del colegio, que lleva meses facturando con ellos:')
      console.log('    SIESA_WSDL_URL, SIESA_F_CIA, SIESA_ID_SUCURSAL')
    }
    if (e.tipo === 'red') {
      console.log('\n  No hay salida al ERP. Esto solo funciona desde la red del colegio.')
    }
    if (e.detalle) console.log(`\n  Detalle: ${JSON.stringify(e.detalle)}`)
  }
  console.log('')
  process.exitCode = 1
} finally {
  await cerrarConexion()
}
