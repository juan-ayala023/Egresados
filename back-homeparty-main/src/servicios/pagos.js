// -----------------------------------------------------------------------------
// Aplicar un pago sobre una orden.
//
// Hay DOS caminos por los que se entera el backend de que un pago se decidio:
//
//   1. El webhook, que llega solo.
//   2. La reconciliacion, que pregunta (porque el webhook se puede perder).
//
// Los dos terminan aqui. Es a proposito: si cada uno tuviera su propia version
// de "revisar el monto y emitir las boletas", tarde o temprano una de las dos
// se quedaria sin una comprobacion. Esta funcion es la unica que decide.
// -----------------------------------------------------------------------------
import { confirmarPago, buscarPorReferencia, enviarCorreoDeOrden } from './ordenes.js'
import { facturarOrden, facturacionActiva } from './facturacion.js'

/**
 * Franquicias que el comite pidio no aceptar por su costo financiero.
 *
 * No se pueden bloquear desde el codigo: el Web Checkout muestra los medios
 * habilitados para el comercio, asi que deshabilitarlas es gestion comercial
 * con Wompi. Lo que si podemos es darnos cuenta cuando entra una.
 */
const FRANQUICIAS_NO_ACEPTADAS = ['AMEX', 'AMERICAN EXPRESS', 'DINERS', 'DINERS CLUB', 'DISCOVER']

/**
 * @param {object} pago  ya normalizado por src/pagos (sin campos en ingles)
 * @param {string} origen  'webhook' | 'reconciliacion' | 'redirect', para el log
 * @returns {{aplicado: boolean, estado: string|null, ordenId: number|null,
 *            correoPara: number|null, motivo: string, codigo: string|null}}
 *   motivo -> texto para el log y la auditoria
 *   codigo -> estable, es lo que el front y las pruebas pueden mirar
 */
export function aplicarPago(pago, origen = 'webhook') {
  const { referencia, estado, montoCentavos, metodoPago, franquicia, idTransaccion } = pago ?? {}

  if (!referencia || !estado) {
    return { aplicado: false, estado: null, ordenId: null, correoPara: null,
      codigo: 'EVENTO_INCOMPLETO',
      motivo: 'ignorado: sin referencia o con estado desconocido' }
  }

  const orden = buscarPorReferencia(referencia)
  if (!orden) {
    // Pasa con eventos de otro comercio o de otro ambiente (sandbox vs prod).
    return { aplicado: false, estado: null, ordenId: null, correoPara: null,
      codigo: 'ORDEN_NO_EXISTE',
      motivo: `ignorado: no existe la orden ${referencia}` }
  }

  // Comprobacion de seguridad: el monto que aprobo la pasarela tiene que ser el
  // que nosotros cobramos. Si no coincide, no se emiten boletas.
  if (estado === 'pagada' && Number(montoCentavos) !== orden.total_centavos) {
    console.error(
      `[${origen}] Monto distinto en ${referencia}: la pasarela dice ${montoCentavos}, `
      + `la orden ${orden.total_centavos}`,
    )
    return { aplicado: false, estado: null, ordenId: orden.id, correoPara: null,
      codigo: 'MONTO_NO_COINCIDE',
      motivo: 'rechazado: el monto no coincide' }
  }

  let resultado
  try {
    resultado = confirmarPago(referencia, {
      estadoDestino: estado,
      transactionId: idTransaccion ?? null,
      metodoPago: metodoPago ?? null,
      franquicia: franquicia ?? null,
    })
  } catch (e) {
    console.error(`[${origen}] Error aplicando el pago de ${referencia}:`, e)
    return { aplicado: false, estado: null, ordenId: orden.id, correoPara: null,
      codigo: 'ERROR_INTERNO',
      motivo: `error: ${e.message}` }
  }

  alertarFranquicia({ referencia, estado, franquicia, origen })

  return {
    aplicado: resultado.cambio,
    estado: resultado.estado,
    ordenId: resultado.ordenId,
    codigo: null,
    motivo: `${resultado.estado}${resultado.cambio ? '' : ' (sin cambio)'}`,
    // El correo solo sale cuando ESTA llamada fue la que marco la orden pagada.
    // Asi ni el webhook ni el barrido mandan dos veces lo mismo.
    correoPara: resultado.cambio && resultado.estado === 'pagada' ? resultado.ordenId : null,
  }
}

/**
 * Si entra un AMEX aprobado, el dinero YA se movio. No se rechaza el pago
 * (seria dejar al egresado sin boleta habiendo pagado): se emite y se grita,
 * para que el comite lo hable con Wompi y revise por que no estaba
 * deshabilitada a nivel de comercio.
 */
function alertarFranquicia({ referencia, estado, franquicia, origen }) {
  if (estado !== 'pagada' || !franquicia) return
  if (!FRANQUICIAS_NO_ACEPTADAS.some((f) => franquicia.includes(f))) return

  console.error(
    `[franquicia] ALERTA: ${referencia} se pago con ${franquicia}, que el comite pidio `
    + `no aceptar (visto por ${origen}). La boleta SI se emite. `
    + 'Revisar la configuracion del comercio en Wompi.',
  )
}

/**
 * Manda el correo fuera del ciclo de la peticion.
 *
 * Es lento y puede fallar, y ni Wompi ni el usuario tienen por que esperarlo.
 * Nunca lanza: el pago ya paso, y el comprador ve sus QR en pantalla igual.
 */
export function despacharCorreo(ordenId) {
  if (!ordenId) return
  setImmediate(() => {
    enviarCorreoDeOrden(ordenId).catch((e) =>
      console.error('[correo] Fallo el correo de la orden', ordenId, e.message))
  })
}

/**
 * Manda la factura a SIESA fuera del ciclo de la peticion.
 *
 * Mismo trato que el correo, y por el mismo motivo: la venta ya esta hecha y
 * el egresado ya tiene sus QR. Que el ERP este caido, o que no haya VPN, o que
 * contabilidad todavia no haya prendido el interruptor, no puede afectar en
 * nada al que acaba de pagar.
 *
 * Es lo mismo que hace la plataforma del colegio con teatro y carreras: marca
 * el pago, intenta facturar, y si falla lo anota y sigue.
 *
 * Nunca lanza. facturarOrden() ya atrapa todo y guarda el error en la orden;
 * el catch de aqui es por si acaso, para que un fallo raro no tumbe el proceso.
 */
export function despacharFactura(ordenId) {
  if (!ordenId) return
  if (!facturacionActiva()) return   // sin WSDL configurado no hay nada que intentar
  setImmediate(() => {
    facturarOrden(ordenId).catch((e) =>
      console.error('[siesa] Fallo inesperado facturando la orden', ordenId, e.message))
  })
}

export { FRANQUICIAS_NO_ACEPTADAS }
