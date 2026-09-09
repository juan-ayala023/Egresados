// -----------------------------------------------------------------------------
// Aforo y reservas de cupo.
//
// La cuenta que importa es siempre la misma:
//
//     disponibles = aforo - vendidas - reservadas_vigentes
//
//   vendidas   -> ordenes en estado "pagada". Ya no se devuelven.
//   reservadas -> ordenes "pendiente" cuya reserva todavia no vence. Son los
//                 usuarios que en este momento estan dentro de la pasarela.
//
// Sin la parte de "reservadas" se puede sobrevender: dos personas entran a
// Wompi por el ultimo cupo y las dos pagan.
// -----------------------------------------------------------------------------
import { db, enTransaccion } from '../db/index.js'
import { config } from '../config.js'
import { ahora, enMinutos } from '../lib/fechas.js'

const consultas = {
  vendidas: db.prepare(
    `SELECT COALESCE(SUM(cantidad), 0) AS n FROM orden WHERE estado = 'pagada'`,
  ),
  // Mismo criterio que `vendidas`: solo lo pagado de verdad. En CENTAVOS, que
  // es como lo guarda la base; quien lo muestre divide.
  recaudado: db.prepare(
    `SELECT COALESCE(SUM(total_centavos), 0) AS n FROM orden WHERE estado = 'pagada'`,
  ),
  reservadas: db.prepare(
    `SELECT COALESCE(SUM(cantidad), 0) AS n
       FROM reserva_cupo
      WHERE estado = 'activa' AND expira_en > ?`,
  ),
  reservasVencidas: db.prepare(
    `SELECT r.orden_id, o.referencia, o.wompi_transaction_id
       FROM reserva_cupo r
       JOIN orden o ON o.id = r.orden_id
      WHERE r.estado = 'activa' AND r.expira_en <= ?`,
  ),
  liberarReserva: db.prepare(
    `UPDATE reserva_cupo SET estado = 'liberada' WHERE orden_id = ?`,
  ),
  expirarOrden: db.prepare(
    `UPDATE orden
        SET estado = 'expirada', cerrada_en = ?, motivo_cierre = ?
      WHERE id = ? AND estado = 'pendiente'`,
  ),
  crearReserva: db.prepare(
    `INSERT INTO reserva_cupo (orden_id, cantidad, estado, creada_en, expira_en)
     VALUES (?, ?, 'activa', ?, ?)`,
  ),
  consumirReserva: db.prepare(
    `UPDATE reserva_cupo SET estado = 'consumida' WHERE orden_id = ? AND estado = 'activa'`,
  ),
}

export const vendidas = () => consultas.vendidas.get().n
export const reservadas = () => consultas.reservadas.get(ahora()).n
export const recaudado = () => consultas.recaudado.get().n

/** Foto completa del aforo. Es lo que ve el panel administrativo. */
export function disponibilidad() {
  const v = vendidas()
  const r = reservadas()
  return {
    aforo: config.evento.aforo,
    vendidas: v,
    reservadas: r,
    disponibles: Math.max(0, config.evento.aforo - v - r),
    // "disponibles" se recorta en 0 para no mostrarle numeros negativos a
    // nadie, pero eso ESCONDE una sobreventa. Se reporta aparte para que el
    // panel la vea el mismo dia y no en la puerta.
    sobreventa: Math.max(0, v - config.evento.aforo),
    // Plata efectivamente recaudada, en PESOS. Se calcula en la base sobre
    // TODAS las ordenes pagadas, no sobre las que quepan en una pantalla:
    // sumar en el navegador lo que se ve daria un total falso en cuanto haya
    // mas ventas que filas visibles, y es un numero de dinero.
    recaudadoCop: Math.round((recaudado() ?? 0) / 100),
  }
}

/**
 * Estado de la venta que consume el front para habilitar o no la compra.
 *   proxima -> todavia no abre (antes de VENTA_APERTURA)
 *   abierta -> se puede comprar
 *   agotada -> no quedan cupos (Sold Out automatico, lo que pidio el colegio)
 *   cerrada -> paso la fecha de cierre o el comite la cerro a mano
 *
 * El orden de las preguntas importa: "cerrada" a mano gana sobre todo, y
 * "proxima" se revisa antes que el aforo porque antes de abrir no tiene
 * sentido hablar de cupos.
 */
export function estadoVenta() {
  if (!config.evento.ventaHabilitada) return 'cerrada'
  if (Date.now() < new Date(config.evento.apertura).getTime()) return 'proxima'
  if (new Date(config.evento.cierreVenta).getTime() <= Date.now()) return 'cerrada'
  if (disponibilidad().disponibles <= 0) return 'agotada'
  return 'abierta'
}

/** Cuando abre la venta. El front lo usa para pintar la cuenta regresiva. */
export const aperturaVenta = () => config.evento.apertura

/**
 * Libera las reservas vencidas y expira sus ordenes.
 *
 * Corre cada minuto (ver src/server.js) y tambien justo antes de crear una
 * orden nueva, para que el ultimo cupo no se quede atrapado por alguien que
 * abandono el checkout hace media hora.
 *
 * @returns {number} cuantas reservas se liberaron
 */
export function liberarReservasVencidas() {
  return enTransaccion(() => {
    const t = ahora()
    const vencidas = consultas.reservasVencidas.all(t)
    for (const v of vencidas) {
      consultas.liberarReserva.run(v.orden_id)

      // Se distingue el caso en que SI sabiamos el id de transaccion. Si esa
      // orden llego hasta aqui, la reconciliacion tuvo 45 minutos para
      // resolverla y no pudo: o Wompi no respondia, o el pago sigue colgado.
      // Vale la pena revisarla a mano en el panel antes de darla por perdida.
      const conTransaccion = Boolean(v.wompi_transaction_id)
      consultas.expirarOrden.run(
        t,
        conTransaccion
          ? 'La reserva vencio y la pasarela nunca confirmo el pago'
          : 'La reserva vencio sin pago',
        v.orden_id,
      )

      if (conTransaccion) {
        console.warn(
          `[reservas] ${v.referencia} expiro CON transaccion ${v.wompi_transaction_id}. `
          + 'Revisar en el panel de Wompi si el pago entro.',
        )
      }
    }
    return vencidas.length
  })
}

/** Cuando vence una reserva creada en este momento. */
export const vencimientoDeReserva = () => enMinutos(config.reservaMinutos)

/**
 * Crea la reserva de una orden. Se llama DENTRO de la transaccion que crea la
 * orden, nunca por separado.
 */
export function reservarCupos(ordenId, cantidad, expiraEn) {
  consultas.crearReserva.run(ordenId, cantidad, ahora(), expiraEn)
}

/** Convierte la reserva en venta definitiva. Se llama al confirmar el pago. */
export function consumirReserva(ordenId) {
  consultas.consumirReserva.run(ordenId)
}

/** Devuelve los cupos al inventario. Se llama cuando el pago se rechaza. */
export function liberarReserva(ordenId) {
  consultas.liberarReserva.run(ordenId)
}
