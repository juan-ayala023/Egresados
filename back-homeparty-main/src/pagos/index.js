// -----------------------------------------------------------------------------
// LA PASARELA, VISTA DESDE EL NEGOCIO.
//
// Todo el backend importa de aqui. Nadie mas importa ./wompi.js.
//
// La idea es simple: el resto del codigo habla de "pagos", "referencias" y
// "estados de orden". Que detras haya Wompi, PlaceToPay o un señor con una
// libreta es problema de este directorio. El colegio ya usa las dos primeras en
// su plataforma de eventos, asi que la posibilidad de cambiar no es teorica.
// -----------------------------------------------------------------------------
import { config } from '../config.js'
import {
  datosCheckout,
  verificarChecksumWebhook,
  consultarTransaccion,
  normalizar,
  ErrorPasarela,
} from './wompi.js'

export { ErrorPasarela }

/** True si estamos en modo de mentiras (pagos simulados). */
export const enSimulacion = () => config.wompi.simulacion

/**
 * Lo que el front necesita para mandar al usuario a pagar.
 * @param {string} referencia  HC80-XXXXXX
 * @param {number} montoCentavos
 */
export const firmarCheckout = (referencia, montoCentavos) =>
  datosCheckout(referencia, montoCentavos)

/**
 * ¿Este evento entrante lo mando de verdad la pasarela?
 * @returns {{valido: boolean, motivo?: string}}
 */
export const verificarEventoEntrante = (evento) => verificarChecksumWebhook(evento)

/**
 * Los datos de pago que trae un evento entrante, ya normalizados.
 * @returns {object|null} null si el evento no trae transaccion
 */
export function datosDelEvento(evento) {
  const transaccion = evento?.data?.transaction
  if (!transaccion) return null
  return normalizar(transaccion)
}

/**
 * Le pregunta a la pasarela como quedo un pago.
 *
 * Es la pieza que hace posible la reconciliacion: el webhook puede perderse,
 * pero preguntar siempre se puede.
 *
 * @param {string} idTransaccion
 * @returns {Promise<object>} { idTransaccion, referencia, estado, montoCentavos, metodoPago, franquicia }
 * @throws {ErrorPasarela}
 */
export async function consultarPago(idTransaccion) {
  const transaccion = await consultarTransaccion(idTransaccion)
  return normalizar(transaccion)
}
