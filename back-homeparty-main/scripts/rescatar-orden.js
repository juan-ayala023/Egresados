// -----------------------------------------------------------------------------
// RESCATAR UNA ORDEN QUE SE PAGO Y QUEDO CERRADA.
//
//   npm run rescatar -- HC80-XXXXXX [HC80-YYYYYY ...]           muestra que haria
//   npm run rescatar -- HC80-XXXXXX --aplicar                   la rescata de verdad
//
// Para que existe (22 de septiembre de 2026): contabilidad reporto tres pagos
// aprobados en Wompi sin recibo en SIESA. Wompi deja reintentar con la misma
// referencia; a esas personas el primer intento les fue rechazado -- la orden
// quedo 'rechazada' -- y el segundo fue aprobado. El sistema ya no volvia a
// mirar esa orden, asi que no hubo boleta ni factura.
//
// El barrido periodico ya revisa las cerradas de los ultimos tres dias. Este
// script es para las mas viejas, o para forzar una en concreto.
//
// LO QUE HACE: le pregunta a Wompi POR LA REFERENCIA (no por el id guardado,
// que es el del intento fallido). Si hay un pago aprobado, reabre la orden,
// emite las boletas, manda el correo y factura en SIESA. Todo por el mismo
// camino que el automatico, para que no haya dos formas de hacer lo mismo.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import { buscarPorReferencia } from '../src/servicios/ordenes.js'
import { reconciliarOrden } from '../src/servicios/reconciliacion.js'
import { despacharCorreo, despacharFactura } from '../src/servicios/pagos.js'
import { buscarPagoPorReferencia } from '../src/pagos/index.js'
import { cerrarConexion } from '../src/siesa/config.js'

const referencias = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const aplicar = process.argv.includes('--aplicar')

if (referencias.length === 0) {
  console.log('\n  Uso: npm run rescatar -- HC80-XXXXXX [--aplicar]\n')
  process.exit(1)
}

for (const referencia of referencias) {
  console.log('')
  console.log(`=== ${referencia} ===`)
  const orden = buscarPorReferencia(referencia)
  if (!orden) {
    console.log('  No existe esa orden.')
    continue
  }
  console.log(`  Estado actual: ${orden.estado}${orden.motivo_cierre ? ` (${orden.motivo_cierre})` : ''}`)

  if (orden.estado === 'pagada') {
    console.log('  Ya esta pagada: no hay nada que rescatar.')
    continue
  }
  if (orden.estado === 'anulada') {
    console.log('  Esta ANULADA (la cerro una persona). No se toca desde aqui.')
    continue
  }

  // Que dice Wompi de esta referencia, sin tocar nada.
  let pago
  try {
    pago = await buscarPagoPorReferencia(referencia)
  } catch (e) {
    console.log(`  No se pudo consultar Wompi: ${e.message}`)
    continue
  }
  if (!pago) {
    console.log('  Wompi no tiene ninguna transaccion para esta referencia.')
    continue
  }
  console.log(`  Wompi: ${pago.estado} | ${pago.idTransaccion} | $${(pago.montoCentavos / 100).toLocaleString('es-CO')}`)

  if (pago.estado !== 'pagada') {
    console.log('  El pago NO esta aprobado: la orden se queda como esta.')
    continue
  }
  if (!aplicar) {
    console.log('  --> CON --aplicar se reabriria, saldrian las boletas y se facturaria.')
    continue
  }

  const r = await reconciliarOrden(orden)
  console.log(`  Resultado: ${r.estado ?? 'sin cambio'} (${r.motivo})`)
  if (r.correoPara) {
    despacharCorreo(r.correoPara)
    despacharFactura(r.correoPara)
    console.log('  Correo y factura despachados. Verifica en un minuto.')
  }
}

console.log('')
// Se le da un momento a los despachos, que corren fuera del ciclo de la peticion.
await new Promise((r) => setTimeout(r, 15_000))
await cerrarConexion()
process.exit(0)
