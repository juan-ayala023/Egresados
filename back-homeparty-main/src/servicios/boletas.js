// -----------------------------------------------------------------------------
// Boletas: consulta, control en la puerta, anulacion y reemision.
// -----------------------------------------------------------------------------
import { db, enTransaccion } from '../db/index.js'
import { ahora } from '../lib/fechas.js'
import { verificarToken, nuevoIdBoleta, generarToken, urlQr, urlPdf } from '../lib/qr.js'

const q = {
  porId: db.prepare(`
    SELECT b.*, o.referencia, o.estado AS estado_orden,
           a.nombre AS asistente_nombre, a.promocion, a.es_egresado, a.id AS asistente_id
      FROM boleta b
      JOIN orden o ON o.id = b.orden_id
      JOIN asistente a ON a.id = b.asistente_id
     WHERE b.id = ?`),

  // Marcar como usada SOLO si sigue en "emitida". El WHERE es lo que hace la
  // operacion atomica: si dos escaneres leen el mismo QR en el mismo instante,
  // el UPDATE del segundo afecta 0 filas.
  marcarUsada: db.prepare(`
    UPDATE boleta
       SET estado = 'usada', usada_en = ?, usada_por = ?, puerta = ?
     WHERE id = ? AND estado = 'emitida'`),

  anular: db.prepare(`
    UPDATE boleta
       SET estado = 'anulada', anulada_en = ?, motivo_anulacion = ?
     WHERE id = ? AND estado != 'anulada'`),

  reemplazar: db.prepare(`UPDATE boleta SET reemplazada_por = ? WHERE id = ?`),

  insertar: db.prepare(`
    INSERT INTO boleta (id, orden_id, asistente_id, token_firmado, estado, emitida_en)
    VALUES (?, ?, ?, ?, 'emitida', ?)`),

  actualizarAsistente: db.prepare(`
    UPDATE asistente SET nombre = ?, cedula = ?, promocion = ?, es_egresado = ? WHERE id = ?`),

  // Lista para la app de puerta en modo offline.
  tokensValidos: db.prepare(`
    SELECT b.id, b.token_firmado, b.estado, a.nombre, a.promocion, a.es_egresado
      FROM boleta b
      JOIN orden o ON o.id = b.orden_id
      JOIN asistente a ON a.id = b.asistente_id
     WHERE o.estado = 'pagada' AND b.estado != 'anulada'
     ORDER BY a.nombre`),

  escaneadas: db.prepare(`
    SELECT b.id, b.usada_en, b.usada_por, b.puerta, a.nombre, a.promocion
      FROM boleta b
      JOIN asistente a ON a.id = b.asistente_id
     WHERE b.estado = 'usada'
     ORDER BY b.usada_en DESC`),

  conteoPuerta: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM boleta b JOIN orden o ON o.id = b.orden_id
        WHERE o.estado = 'pagada' AND b.estado != 'anulada') AS emitidas,
      (SELECT COUNT(*) FROM boleta WHERE estado = 'usada') AS ingresadas`),
}

export const buscarBoleta = (id) => q.porId.get(id) ?? null

/**
 * Valida un QR escaneado en la puerta y lo marca como usado en la MISMA
 * operacion. Es todo lo que hace POST /api/puerta/validar.
 *
 * @returns {{status: number, cuerpo: object}}
 */
export function validarEnPuerta(token, { puerta = null, operador = null, momento = null } = {}) {
  // 1. La firma se verifica sin tocar la base: un token fabricado ni siquiera
  //    llega a consultarse.
  const { valido, idBoleta } = verificarToken(token)
  if (!valido) {
    return { status: 404, cuerpo: { resultado: 'INVALIDA', motivo: 'La firma del codigo no es valida' } }
  }

  return enTransaccion(() => {
    const b = q.porId.get(idBoleta)
    if (!b) {
      return { status: 404, cuerpo: { resultado: 'INVALIDA', motivo: 'Ese codigo no existe' } }
    }
    if (b.estado_orden !== 'pagada') {
      return { status: 404, cuerpo: { resultado: 'INVALIDA', motivo: 'La orden de esa boleta no esta pagada' } }
    }
    if (b.estado === 'anulada') {
      return {
        status: 404,
        cuerpo: { resultado: 'INVALIDA', motivo: b.motivo_anulacion || 'La boleta fue anulada' },
      }
    }

    const usadaEn = momento ?? ahora()
    const cambio = q.marcarUsada.run(usadaEn, operador, puerta, idBoleta)

    // 0 filas afectadas = alguien la uso primero.
    if (cambio.changes === 0) {
      const actual = q.porId.get(idBoleta)
      return {
        status: 409,
        cuerpo: {
          resultado: 'YA_USADA',
          asistente: actual.asistente_nombre,
          usadaEn: actual.usada_en,
          puerta: actual.puerta,
        },
      }
    }

    return {
      status: 200,
      cuerpo: {
        resultado: 'VALIDA',
        asistente: b.asistente_nombre,
        promocion: b.es_egresado === 1 ? b.promocion : 'no-egresado',
        referencia: b.referencia,
        boletaId: b.id,
      },
    }
  })
}

/**
 * Lista de tokens validos para descargar ANTES del evento.
 *
 * BACKEND.md seccion 7: si el wifi del sitio falla esa noche, la validacion en
 * linea se cae con el. Con esta lista la app de puerta puede verificar firmas
 * sin conexion y subir los escaneos despues con /api/puerta/sincronizar.
 */
export function tokensParaOffline() {
  return q.tokensValidos.all().map((b) => ({
    id: b.id,
    token: b.token_firmado,
    estado: b.estado,
    asistente: b.nombre,
    promocion: b.es_egresado === 1 ? b.promocion : 'no-egresado',
  }))
}

/** Sube en lote los escaneos hechos sin conexion. */
export function sincronizarEscaneos(escaneos) {
  const resultados = []
  for (const e of escaneos) {
    const r = validarEnPuerta(e.token, {
      puerta: e.puerta ?? null,
      operador: e.operador ?? null,
      momento: e.momento ?? null,
    })
    resultados.push({ token: e.token, resultado: r.cuerpo.resultado, ...r.cuerpo })
  }
  return resultados
}

export const ingresosEscaneados = () => q.escaneadas.all()
export const conteoPuerta = () => q.conteoPuerta.get()

/** Anula una boleta (devolucion, error de datos, reemplazo). */
export function anularBoleta(id, motivo) {
  return enTransaccion(() => {
    const b = q.porId.get(id)
    if (!b) return { ok: false, motivo: 'La boleta no existe' }
    const r = q.anular.run(ahora(), motivo || 'Anulada por el comite', id)
    return { ok: r.changes > 0, motivo: r.changes > 0 ? null : 'La boleta ya estaba anulada' }
  })
}

/**
 * Reemite una boleta a nombre de otra persona (transferencia) o con los datos
 * corregidos. Anula la anterior y emite una nueva con token nuevo, para que el
 * QR viejo deje de servir.
 */
export function reemitirBoleta(id, nuevosDatos = {}, base) {
  return enTransaccion(() => {
    const vieja = q.porId.get(id)
    if (!vieja) return { ok: false, motivo: 'La boleta no existe' }
    if (vieja.estado === 'usada') return { ok: false, motivo: 'Esa boleta ya se uso en la puerta' }

    if (nuevosDatos.nombre) {
      q.actualizarAsistente.run(
        nuevosDatos.nombre,
        nuevosDatos.cedula ?? null,
        nuevosDatos.promocion ?? vieja.promocion,
        (nuevosDatos.promocion ?? vieja.promocion) === 'no-egresado' ? 0 : 1,
        vieja.asistente_id,
      )
    }

    q.anular.run(ahora(), nuevosDatos.motivo || 'Reemitida', id)

    const nuevoId = nuevoIdBoleta()
    q.insertar.run(nuevoId, vieja.orden_id, vieja.asistente_id, generarToken(nuevoId), ahora())
    q.reemplazar.run(nuevoId, id)

    return {
      ok: true,
      boleta: { id: nuevoId, qrUrl: urlQr(nuevoId, base), pdfUrl: urlPdf(nuevoId, base) },
    }
  })
}
