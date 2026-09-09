// -----------------------------------------------------------------------------
// Alertas del panel: lo que se rompió y necesita un humano.
//
// Todo lo que sale aquí ya quedó gritado en el log cuando pasó, pero nadie mira
// los logs de un servidor a las 11 de la noche. Esto es la misma información
// en un sitio donde el comité sí va a mirar.
//
// La regla para agregar algo a esta lista: si pasa, ¿alguien tiene que hacer
// algo? Si la respuesta es no, va al log y no aquí.
// -----------------------------------------------------------------------------
import { db } from '../db/index.js'
import { config } from '../config.js'
import { ahora } from '../lib/fechas.js'
import { MAX_INTENTOS } from './correos.js'
import { FRANQUICIAS_NO_ACEPTADAS } from './pagos.js'
import { disponibilidad } from './aforo.js'

const q = {
  // Alertas que alguien ya marco como atendidas: no vuelven a salir.
  atendidas: db.prepare(`SELECT tipo, referencia FROM alerta_atendida`),
  atender: db.prepare(`
    INSERT INTO alerta_atendida (tipo, referencia, atendida_en, atendida_por, nota)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(tipo, referencia) DO UPDATE SET
      atendida_en = excluded.atendida_en,
      atendida_por = excluded.atendida_por,
      nota = excluded.nota`),
  reabrir: db.prepare(`DELETE FROM alerta_atendida WHERE tipo = ? AND referencia = ?`),

  // Pagó y no le ha llegado el correo. Es la alerta más importante de todas.
  pagadasSinCorreo: db.prepare(`
    SELECT o.referencia, o.pagada_en, o.correo_intentos, o.correo_ultimo_error,
           o.correo_proximo_intento, c.nombre, c.correo, c.celular
      FROM orden o
      JOIN comprador c ON c.orden_id = o.id
     WHERE o.estado = 'pagada' AND o.correo_enviado_en IS NULL
     ORDER BY o.pagada_en ASC`),

  // Expiró teniendo id de transacción: la reconciliación tuvo su ventana
  // completa y no pudo resolverla. Hay que mirar el panel de Wompi.
  expiradasConTransaccion: db.prepare(`
    SELECT o.referencia, o.wompi_transaction_id, o.cerrada_en, o.motivo_cierre,
           o.cantidad, c.nombre, c.correo
      FROM orden o
      JOIN comprador c ON c.orden_id = o.id
     WHERE o.estado = 'expirada' AND o.wompi_transaction_id IS NOT NULL
     ORDER BY o.cerrada_en DESC
     LIMIT 100`),

  // Franquicias que el comité pidió no aceptar y entraron igual.
  pagadasPorFranquicia: db.prepare(`
    SELECT referencia, franquicia, metodo_pago, pagada_en, total_centavos
      FROM orden
     WHERE estado = 'pagada' AND franquicia IS NOT NULL
     ORDER BY pagada_en DESC`),

  // Canario: una orden pagada SIEMPRE debería tener sus boletas. Si esta
  // consulta devuelve algo, hay un bug en la emisión.
  pagadasSinBoletas: db.prepare(`
    SELECT o.referencia, o.pagada_en, o.cantidad
      FROM orden o
     WHERE o.estado = 'pagada'
       AND (SELECT COUNT(*) FROM boleta b WHERE b.orden_id = o.id) = 0`),

  // Estado reservado para el pago que entra sin cupo (Bloque 4). Hoy nada lo
  // escribe; se consulta desde ya para que el día que exista aparezca solo.
  pagadasSinCupo: db.prepare(`
    SELECT referencia, pagada_en, cantidad, total_centavos
      FROM orden WHERE estado = 'pagada_sin_cupo'`),
}

const esNoAceptada = (franquicia) =>
  FRANQUICIAS_NO_ACEPTADAS.some((f) => String(franquicia).includes(f))

/**
 * Todo lo que necesita atención, con un nivel para poder ordenarlo.
 *
 *   critico -> alguien pagó y algo no le llegó, o hay plata sin respaldo
 *   aviso   -> conviene revisarlo, no es urgente
 */
export function alertas() {
  const lista = []

  // --- pagó y no le llegó el correo -----------------------------------------
  for (const o of q.pagadasSinCorreo.all()) {
    const agotado = o.correo_intentos >= MAX_INTENTOS
    lista.push({
      tipo: 'CORREO_NO_ENVIADO',
      nivel: agotado ? 'critico' : 'aviso',
      referencia: o.referencia,
      detalle: agotado
        ? `Se agotaron los ${MAX_INTENTOS} intentos. Hay que reenviarlo a mano.`
        : `Intento ${o.correo_intentos} de ${MAX_INTENTOS}. Reintenta solo.`,
      comprador: { nombre: o.nombre, correo: o.correo, celular: o.celular },
      intentos: o.correo_intentos,
      ultimoError: o.correo_ultimo_error,
      proximoIntento: o.correo_proximo_intento,
      pagadaEn: o.pagada_en,
      // Lo que hay que hacer, para no tener que adivinarlo.
      accion: `POST /api/admin/ordenes/${o.referencia}/reenviar`,
    })
  }

  // --- expiró con transacción conocida --------------------------------------
  for (const o of q.expiradasConTransaccion.all()) {
    lista.push({
      tipo: 'EXPIRO_CON_TRANSACCION',
      nivel: 'critico',
      referencia: o.referencia,
      detalle: 'La orden expiró y la pasarela nunca confirmó el pago. '
        + 'Si el pago sí entró, esta persona pagó y no tiene boletas.',
      idTransaccion: o.wompi_transaction_id,
      comprador: { nombre: o.nombre, correo: o.correo },
      cantidad: o.cantidad,
      cerradaEn: o.cerrada_en,
      accion: `Buscar ${o.wompi_transaction_id} en el panel de Wompi`,
    })
  }

  // --- franquicia bloqueada -------------------------------------------------
  for (const o of q.pagadasPorFranquicia.all()) {
    if (!esNoAceptada(o.franquicia)) continue
    lista.push({
      tipo: 'FRANQUICIA_NO_ACEPTADA',
      nivel: 'aviso',
      referencia: o.referencia,
      detalle: `Se pagó con ${o.franquicia}, que el comité pidió no aceptar. `
        + 'La boleta se emitió igual porque el dinero ya se movió.',
      franquicia: o.franquicia,
      pagadaEn: o.pagada_en,
      accion: 'Pedirle a Wompi que la deshabilite a nivel de comercio',
    })
  }

  // --- canarios -------------------------------------------------------------
  for (const o of q.pagadasSinBoletas.all()) {
    lista.push({
      tipo: 'PAGADA_SIN_BOLETAS',
      nivel: 'critico',
      referencia: o.referencia,
      detalle: 'La orden está pagada pero no tiene boletas emitidas. Esto no debería pasar nunca.',
      cantidad: o.cantidad,
      accion: 'Revisar el log del servidor alrededor de ' + o.pagada_en,
    })
  }

  for (const o of q.pagadasSinCupo.all()) {
    lista.push({
      tipo: 'PAGADA_SIN_CUPO',
      nivel: 'critico',
      referencia: o.referencia,
      detalle: 'Entró un pago cuando ya no quedaba cupo. No se emitieron boletas.',
      cantidad: o.cantidad,
      accion: 'Reembolsar desde el panel de Wompi, o liberar un cupo a mano',
    })
  }

  // --- sobreventa -----------------------------------------------------------
  const d = disponibilidad()
  if (d.sobreventa > 0) {
    lista.push({
      tipo: 'SOBREVENTA',
      nivel: 'critico',
      detalle: `Hay ${d.vendidas} boletas vendidas para un aforo de ${d.aforo}: `
        + `${d.sobreventa} de más.`,
      vendidas: d.vendidas,
      aforo: d.aforo,
      accion: 'Cerrar la venta (VENTA_HABILITADA=false) y revisar con el comité',
    })
  }

  // Se esconde lo ya atendido. La alerta se sigue calculando -- si el problema
  // reaparece en esa orden despues de atenderla, hay que volver a marcarla --
  // pero no ensucia el tablero. Un panel que solo crece deja de mirarse, y
  // entonces la alerta que importa se pierde entre las viejas.
  const atendidas = new Set(
    q.atendidas.all().map((a) => `${a.tipo}|${a.referencia}`),
  )
  const visibles = lista.filter((a) => !atendidas.has(`${a.tipo}|${a.referencia ?? ''}`))

  const orden = { critico: 0, aviso: 1 }
  visibles.sort((a, b) => orden[a.nivel] - orden[b.nivel])

  return {
    generadoEn: ahora(),
    total: visibles.length,
    criticas: visibles.filter((a) => a.nivel === 'critico').length,
    // Cuantas se escondieron por estar atendidas. Se muestra en el panel para
    // que nadie crea que una alerta se perdio sola.
    atendidas: lista.length - visibles.length,
    aforo: { ...d, evento: config.evento.nombre },
    alertas: visibles,
  }
}

/**
 * Marca una alerta como atendida: deja de salir en el panel.
 *
 * No borra nada ni cambia la orden. Es una anotacion de "ya me hice cargo de
 * esto", con quien y cuando, para poder auditarlo despues.
 */
export function atenderAlerta(tipo, referencia, { por = null, nota = null } = {}) {
  q.atender.run(tipo, referencia ?? '', ahora(), por, nota)
  return { tipo, referencia, atendidaEn: ahora() }
}

/** Deshace lo anterior: la alerta vuelve a salir. */
export function reabrirAlerta(tipo, referencia) {
  q.reabrir.run(tipo, referencia ?? '')
  return { tipo, referencia, reabierta: true }
}
