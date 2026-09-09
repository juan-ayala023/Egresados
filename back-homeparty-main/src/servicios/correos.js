// -----------------------------------------------------------------------------
// Reintento del correo con las boletas.
//
// El requisito del colegio es que a cada persona le lleguen los QR que compro.
// El envio se hace fuera del ciclo de la peticion (no se hace esperar a Wompi),
// y hasta ahora, si fallaba, se perdia: quedaba un console.error y la orden
// pagada con correo_enviado_en en NULL. Nadie se enteraba.
//
// Ahora cada fallo se cuenta, se guarda el motivo y se agenda otro intento con
// espera creciente. Cuando se acaban los intentos, la orden aparece en
// GET /api/admin/alertas para que alguien la reenvie a mano.
//
// IMPORTANTE: el correo NO es el unico canal. El comprador ve sus QR en
// pantalla en el paso 3, porque GET /api/ordenes/:referencia devuelve las
// boletas con su qrUrl. Esto es el respaldo, no la via unica.
// -----------------------------------------------------------------------------
import { enMinutos } from '../lib/fechas.js'
import {
  pendientesDeCorreo, agendarReintentoCorreo, enviarCorreoDeOrden,
} from './ordenes.js'

/**
 * Cuanto esperar antes de cada reintento, en minutos.
 *
 * Empieza corto porque la mayoria de fallos de SMTP son pasajeros, y termina
 * largo para no golpear un servidor caido cada minuto durante horas.
 * Son 5 intentos repartidos en unas 5 horas.
 */
export const ESPERAS_MINUTOS = [1, 5, 15, 60, 240]
export const MAX_INTENTOS = ESPERAS_MINUTOS.length

/**
 * Reintenta los correos que estan pendientes y ya cumplieron su espera.
 *
 * @returns {Promise<{revisadas: number, enviados: number, fallidos: number, agotados: number}>}
 */
export async function reintentarPendientes({ limite = 25 } = {}) {
  const ordenes = pendientesDeCorreo(MAX_INTENTOS, limite)
  const conteo = { revisadas: ordenes.length, enviados: 0, fallidos: 0, agotados: 0 }

  for (const orden of ordenes) {
    // enviarCorreoDeOrden cuenta el intento y guarda el error si falla.
    const r = await enviarCorreoDeOrden(orden.id)

    if (r.enviado) {
      conteo.enviados++
      console.log(`[correo] Reintento exitoso para ${orden.referencia}`)
      continue
    }

    // El intento que acaba de fallar ya quedo contado, asi que el numero de
    // intentos gastados es el que tenia mas uno.
    const gastados = orden.correo_intentos + 1

    if (gastados >= MAX_INTENTOS) {
      conteo.agotados++
      console.error(
        `[correo] ALERTA: ${orden.referencia} agoto los ${MAX_INTENTOS} intentos. `
        + `Ultimo error: ${r.detalle ?? 'sin detalle'}. `
        + 'La persona PAGO y no tiene sus boletas por correo. Reenviar desde el panel.',
      )
      continue
    }

    const espera = ESPERAS_MINUTOS[gastados] ?? ESPERAS_MINUTOS[ESPERAS_MINUTOS.length - 1]
    agendarReintentoCorreo(orden.id, enMinutos(espera))
    conteo.fallidos++
    console.warn(
      `[correo] ${orden.referencia} fallo (intento ${gastados}/${MAX_INTENTOS}), `
      + `se reintenta en ${espera} min`,
    )
  }

  return conteo
}
