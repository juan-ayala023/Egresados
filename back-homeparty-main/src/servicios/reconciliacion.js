// -----------------------------------------------------------------------------
// RECONCILIACION: preguntarle a la pasarela por los pagos que quedaron en el aire.
//
// El webhook es la fuente principal, pero se puede perder: el servidor estaba
// caido, hubo un despliegue en ese minuto, se cayo la red. Si eso pasa y nadie
// pregunta, la orden se queda "pendiente", la reserva vence, y el egresado pago
// y no tiene boleta. Nadie se entera hasta la puerta, el 14 de noviembre.
//
// Hay dos caminos, los dos terminan en aplicarPago():
//
//   REACTIVO   - Wompi devuelve al usuario a /pago/resultado?id=<transaccion>.
//                El front nos manda ese id y preguntamos de una. Es el camino
//                rapido: resuelve el pago en el segundo en que el usuario vuelve.
//
//   PROACTIVO  - Cada 5 minutos se revisan las ordenes pendientes de mas de 10
//                minutos y se le pregunta a la pasarela por cada una. Es la red
//                para quien cerro el navegador.
//
// LIMITACION QUE HAY QUE TENER PRESENTE: la API de Wompi solo deja consultar
// por ID de transaccion. NO hay endpoint para buscar por nuestra referencia
// (lo verifique contra la documentacion). Entonces, si nunca supimos el id
// —el usuario cerro el navegador antes del redirect Y el webhook se perdio—
// no hay a quien preguntarle. Esas ordenes se expiran por reloj y quedan
// gritadas en el log para revisarlas a mano en el panel de Wompi.
// -----------------------------------------------------------------------------
import { config } from '../config.js'
import {
  consultarPago, buscarPagoPorReferencia, ErrorPasarela, enSimulacion,
} from '../pagos/index.js'
import { enMinutos } from '../lib/fechas.js'
import { aplicarPago } from './pagos.js'
import {
  buscarPorReferencia, pendientesViejas, cerradasRecientes, guardarTransaccion, extenderReserva,
} from './ordenes.js'

/**
 * Reconcilia UNA orden contra la pasarela.
 *
 * @param {object} orden fila de la tabla orden
 * @returns {Promise<{consultada: boolean, estado: string|null, motivo: string,
 *                    correoPara: number|null}>}
 */
export async function reconciliarOrden(orden) {
  // Las cerradas (rechazada/expirada) tambien se revisan: Wompi deja
  // reintentar con la misma referencia, y ese segundo intento puede haber
  // sido aprobado sin que nos enteraramos (22 de septiembre de 2026).
  const cerrada = ['rechazada', 'expirada'].includes(orden.estado)
  if (orden.estado !== 'pendiente' && !cerrada) {
    return { consultada: false, estado: orden.estado, correoPara: null, motivo: 'ya no esta pendiente' }
  }

  /* SIN ID DE TRANSACCION NO ERA EL FINAL DEL CAMINO.
     Antes se rendia aqui, y ahi estaba el hueco: el id solo llega por el
     webhook -- que apunta a la plataforma del colegio -- o porque la persona
     vuelve al sitio. Quien pagaba y cerraba la pestana se quedaba sin boleta y
     este barrido no podia rescatarlo, porque tampoco tenia que consultar.

     La referencia SI la tenemos siempre: es nuestra. Se busca por ella. */
  // EN UNA ORDEN CERRADA SE IGNORA EL ID GUARDADO. Ese es el del intento que
  // fallo, y preguntar por el siempre dira "rechazado". Lo que hay que buscar
  // es si HAY un pago aprobado para esa referencia.
  let idTransaccion = cerrada ? null : orden.wompi_transaction_id
  if (!idTransaccion) {
    try {
      const encontrada = await buscarPagoPorReferencia(orden.referencia)
      if (!encontrada) {
        // Nadie llego a pagar: se abrio el checkout y se abandono. Normal.
        return { consultada: false, estado: null, correoPara: null, motivo: 'SIN_TRANSACCION' }
      }
      idTransaccion = encontrada.idTransaccion
    } catch (e) {
      // Si falta la llave privada o Wompi no responde, no se puede rescatar.
      // Se reporta como error, no como "sin transaccion": son cosas distintas
      // y quien lea el log tiene que poder distinguirlas.
      return {
        consultada: false, estado: null, correoPara: null,
        motivo: 'SIN_TRANSACCION', detalle: e.message,
      }
    }
  }

  let pago
  try {
    pago = await consultarPago(idTransaccion)
  } catch (e) {
    if (e instanceof ErrorPasarela && e.tipo === 'no_encontrada') {
      // La pasarela no conoce esa transaccion. Casi siempre es un id inventado
      // por alguien llamando nuestro endpoint a mano.
      return { consultada: true, estado: null, correoPara: null, motivo: 'TRANSACCION_INEXISTENTE' }
    }
    // Red, timeout, 500 de Wompi: es reintentable, el barrido vuelve en 5 min.
    console.warn(`[reconciliacion] ${orden.referencia}: ${e.message}`)
    return { consultada: false, estado: null, correoPara: null, motivo: `ERROR_PASARELA: ${e.message}` }
  }

  // Que la transaccion consultada sea de ESTA orden. Si no coincide, alguien
  // esta mandando el id de otra compra para que le emitamos boletas.
  if (pago.referencia && pago.referencia !== orden.referencia) {
    console.error(
      `[reconciliacion] La transaccion ${idTransaccion} pertenece a ${pago.referencia}, `
      + `no a ${orden.referencia}. No se aplica.`,
    )
    return { consultada: true, estado: null, correoPara: null, motivo: 'REFERENCIA_NO_COINCIDE' }
  }

  // Todavia en el banco (tipico de PSE). No se expira: se le empuja el
  // vencimiento a la reserva para que el cupo no se libere mientras el usuario
  // sigue dentro de la pasarela. Esta es la linea que evita la sobreventa
  // cobrada de la que hablamos.
  if (pago.estado === 'pendiente') {
    extenderReserva(orden.id, enMinutos(config.reservaMinutos))
    return { consultada: true, estado: 'pendiente', correoPara: null, motivo: 'sigue pendiente, reserva extendida' }
  }

  const r = aplicarPago({ ...pago, referencia: orden.referencia }, 'reconciliacion')
  return { consultada: true, estado: r.estado, correoPara: r.correoPara, motivo: r.motivo }
}

/**
 * Camino REACTIVO: el front vuelve del redirect con el id de transaccion.
 *
 * Guarda el id en la orden (aunque el pago siga pendiente) porque sin el, el
 * barrido proactivo no puede hacer nada despues.
 *
 * @param {string} referencia
 * @param {string} idTransaccion  el ?id= del redirect de Wompi
 */
export async function reconciliarPorRedirect(referencia, idTransaccion) {
  const orden = buscarPorReferencia(referencia)
  if (!orden) return { encontrada: false }

  if (idTransaccion && !orden.wompi_transaction_id) {
    guardarTransaccion(orden.id, idTransaccion)
    orden.wompi_transaction_id = idTransaccion
  }

  // En simulacion no hay a quien preguntarle: se devuelve el estado tal cual,
  // que es lo que el polling del front necesita igual.
  if (enSimulacion()) {
    return { encontrada: true, estado: orden.estado, motivo: 'simulacion', correoPara: null }
  }

  const r = await reconciliarOrden(orden)
  return { encontrada: true, ...r }
}

/**
 * Camino PROACTIVO: barrido periodico.
 *
 * Corre cada 5 minutos sobre las ordenes pendientes de mas de 10 minutos. Diez
 * minutos es el punto en que un pago normal ya se resolvio: antes de eso el
 * usuario probablemente sigue escribiendo la tarjeta.
 *
 * @returns {Promise<object>} conteo de lo que hizo, para el log y el panel
 */
export async function barrer({ minutosDeGracia = 10, limite = 50 } = {}) {
  if (enSimulacion()) return { revisadas: 0, motivo: 'simulacion' }

  // Las pendientes de siempre, MAS las cerradas de los ultimos tres dias por
  // si alguna termino pagandose en un segundo intento.
  const ordenes = [...pendientesViejas(minutosDeGracia, limite), ...cerradasRecientes(72, limite)]
  const conteo = {
    revisadas: ordenes.length,
    reabiertas: 0,
    pagadas: 0,
    rechazadas: 0,
    siguenPendientes: 0,
    sinTransaccion: 0,
    errores: 0,
    correos: [],
  }

  for (const orden of ordenes) {
    const r = await reconciliarOrden(orden)

    if (r.motivo === 'SIN_TRANSACCION') conteo.sinTransaccion++
    else if (!r.consultada) conteo.errores++
    else if (r.estado === 'pagada') { conteo.pagadas++; if (orden.estado !== 'pendiente') conteo.reabiertas++ }
    else if (r.estado === 'pagada_sin_cupo') conteo.reabiertas++
    else if (r.estado === 'rechazada') conteo.rechazadas++
    else if (r.estado === 'pendiente') conteo.siguenPendientes++

    if (r.correoPara) conteo.correos.push(r.correoPara)
  }

  return conteo
}
