// -----------------------------------------------------------------------------
// El corazon del backend: crear ordenes, confirmarlas y emitir boletas.
//
// Regla de oro (BACKEND.md seccion 6): la confirmacion viene del WEBHOOK, nunca
// del redirect. Aqui hay una sola funcion que marca una orden como pagada
// (confirmarPago) y solo la llama el webhook.
// -----------------------------------------------------------------------------
import { db, enTransaccion } from '../db/index.js'
import { config } from '../config.js'
import { errores } from '../lib/errores.js'
import { ahora, enMinutos, formatoLargo } from '../lib/fechas.js'
import { generarReferencia } from '../lib/referencia.js'
import { firmarCheckout } from '../pagos/index.js'
import { nuevoIdBoleta, generarToken, urlQr, urlPdf } from '../lib/qr.js'
import { enviarBoletas } from '../lib/correo.js'
import { pdfDeBoleta, nombreArchivoBoleta } from '../lib/pdf.js'
import { revisarComprador } from './egresados.js'
import {
  disponibilidad, estadoVenta, liberarReservasVencidas,
  reservarCupos, vencimientoDeReserva, consumirReserva, liberarReserva,
} from './aforo.js'

// -----------------------------------------------------------------------------
// Consultas preparadas. SQLite las compila una vez y las reutiliza.
// -----------------------------------------------------------------------------
const q = {
  existeReferencia: db.prepare(`SELECT 1 FROM orden WHERE referencia = ?`),

  insertarOrden: db.prepare(`
    INSERT INTO orden (
      referencia, estado, tipo_boleta_id, cantidad,
      precio_unitario_centavos, tarifa_unitaria_centavos, total_centavos,
      creada_en, expira_en, ip
    ) VALUES (?, 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?)`),

  insertarComprador: db.prepare(`
    INSERT INTO comprador (
      orden_id, nombre, tipo_documento, cedula, correo, celular, direccion, ciudad,
      fecha_nacimiento, promocion, acepta_datos, acepta_terminos, aceptado_en, egresado_verificado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`),

  insertarAsistente: db.prepare(`
    INSERT INTO asistente (
      orden_id, indice, nombre, tipo_documento, cedula, correo, celular, promocion, es_egresado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),

  insertarBoleta: db.prepare(`
    INSERT INTO boleta (id, orden_id, asistente_id, token_firmado, estado, emitida_en)
    VALUES (?, ?, ?, ?, 'emitida', ?)`),

  porReferencia: db.prepare(`SELECT * FROM orden WHERE referencia = ?`),
  porTransaccionWompi: db.prepare(`SELECT * FROM orden WHERE wompi_transaction_id = ?`),
  porId: db.prepare(`SELECT * FROM orden WHERE id = ?`),

  compradorDe: db.prepare(`SELECT * FROM comprador WHERE orden_id = ?`),

  // Las boletas CON el correo de su dueno. Va aparte de boletasDe a proposito:
  // boletasDeOrden() alimenta la respuesta PUBLICA de la orden, y meterle ahi
  // el correo de cada acompanante lo dejaria a la vista de cualquiera que
  // tenga la referencia.
  boletasConDueno: db.prepare(`
    SELECT b.id, b.token_firmado, b.estado,
           a.id AS asistente_id, a.indice, a.nombre AS asistente_nombre,
           a.correo AS asistente_correo, a.promocion, a.es_egresado,
           a.correo_enviado_en
      FROM boleta b
      JOIN asistente a ON a.id = b.asistente_id
     WHERE b.orden_id = ?
  ORDER BY a.indice`),

  marcarCorreoAsistente: db.prepare(
    `UPDATE asistente SET correo_enviado_en = ? WHERE id = ?`),
  asistentesDe: db.prepare(`SELECT * FROM asistente WHERE orden_id = ? ORDER BY indice`),
  boletasDe: db.prepare(`
    SELECT b.*, a.nombre AS asistente_nombre, a.promocion, a.es_egresado
      FROM boleta b
      JOIN asistente a ON a.id = b.asistente_id
     WHERE b.orden_id = ?
     ORDER BY a.indice`),

  // Cuantas boletas lleva esa cedula: las ya pagadas mas las que tiene
  // reservadas en este momento.
  boletasPorCedula: db.prepare(`
    SELECT COALESCE(SUM(o.cantidad), 0) AS n
      FROM orden o
      JOIN comprador c ON c.orden_id = o.id
     WHERE c.cedula = ?
       AND (o.estado = 'pagada' OR (o.estado = 'pendiente' AND o.expira_en > ?))`),

  marcarPagada: db.prepare(`
    UPDATE orden
       SET estado = 'pagada', pagada_en = ?, wompi_transaction_id = ?,
           metodo_pago = ?, franquicia = ?, ultimos_cuatro = ?, autorizacion_banco = ?
     WHERE id = ? AND estado = 'pendiente'`),

  marcarRechazada: db.prepare(`
    UPDATE orden
       SET estado = 'rechazada', cerrada_en = ?, motivo_cierre = ?,
           wompi_transaction_id = ?, metodo_pago = ?, franquicia = ?
     WHERE id = ? AND estado = 'pendiente'`),

  // El id de transaccion se guarda apenas se conoce (vuelve en el redirect),
  // no solo al confirmar el pago: sin el no se le puede preguntar nada a la
  // pasarela, y es justo lo que necesita el barrido.
  guardarTransaccion: db.prepare(
    `UPDATE orden SET wompi_transaction_id = ? WHERE id = ? AND wompi_transaction_id IS NULL`),

  // Ordenes que llevan un rato pendientes y hay que ir a preguntar por ellas.
  pendientesViejas: db.prepare(`
    SELECT * FROM orden
     WHERE estado = 'pendiente' AND creada_en <= ?
     ORDER BY creada_en ASC
     LIMIT ?`),

  extenderReserva: db.prepare(`
    UPDATE orden SET expira_en = ? WHERE id = ? AND estado = 'pendiente'`),

  registrarCorreo: db.prepare(`
    UPDATE orden
       SET correo_enviado_a = ?, correo_enviado_en = ?, correo_ultimo_error = NULL,
           correo_proximo_intento = NULL
     WHERE id = ?`),

  // Un intento que fallo: se cuenta, se guarda el motivo y se agenda el
  // siguiente. Sin esto, un correo que falla se pierde en silencio.
  registrarFalloCorreo: db.prepare(`
    UPDATE orden
       SET correo_intentos = correo_intentos + 1,
           correo_ultimo_error = ?,
           correo_proximo_intento = ?
     WHERE id = ?`),

  // Ordenes pagadas a las que todavia no les ha salido el correo y ya toca
  // reintentar. Es lo que mira el trabajo de fondo.
  agendarProximoIntento: db.prepare(
    `UPDATE orden SET correo_proximo_intento = ? WHERE id = ?`),

  pendientesDeCorreo: db.prepare(`
    SELECT * FROM orden
     WHERE estado = 'pagada'
       AND correo_enviado_en IS NULL
       AND correo_intentos < ?
       AND (correo_proximo_intento IS NULL OR correo_proximo_intento <= ?)
     ORDER BY pagada_en ASC
     LIMIT ?`),
}

// -----------------------------------------------------------------------------
// Crear la orden
// -----------------------------------------------------------------------------

/**
 * Reemplazo directo de la funcion pagar() del front.
 *
 * Todo lo que sigue pasa dentro de UNA transaccion IMMEDIATE: revisar cupo,
 * revisar el limite por cedula, crear la orden y reservar los cupos. Si dos
 * compras entran al mismo tiempo por el ultimo cupo, la segunda ve el mundo ya
 * actualizado por la primera y recibe CUPO_INSUFICIENTE.
 *
 * @param {object} datos ya validado y normalizado por validarOrden()
 * @param {string} ip
 */
export function crearOrden(datos, ip = null) {
  // Antes de nada, devolver al inventario los cupos de quienes abandonaron el
  // checkout. Va fuera de la transaccion principal para no anidar.
  liberarReservasVencidas()

  const estado = estadoVenta()
  if (estado === 'proxima') {
    throw errores.ventaCerrada(
      `La venta abre el ${formatoLargo(config.evento.apertura)}.`,
    )
  }
  if (estado === 'cerrada') {
    throw errores.ventaCerrada('La venta ya esta cerrada.')
  }
  if (estado === 'agotada') {
    throw errores.ventaCerrada('Se agotaron las boletas.')
  }

  // El acta: para comprar hay que ser egresado. Se revisa FUERA de la
  // transaccion porque es solo una lectura, y antes de reservar cupo para no
  // quitarle un cupo a alguien mas mientras se rechaza esta compra.
  const egresado = revisarComprador(datos.comprador.cedula, datos.comprador.promocion)
  if (!egresado.permitir) {
    throw errores.noEsEgresado(egresado.motivo)
  }

  const precio = config.boleta.precioCentavos
  const tarifa = config.boleta.tarifaCentavos
  const total = (precio + tarifa) * datos.cantidad

  const resultado = enTransaccion(() => {
    // --- 1. cupo ------------------------------------------------------------
    const { disponibles } = disponibilidad()
    if (datos.cantidad > disponibles) {
      // DECISION #5: si el comite pide no revelar cupos, el numero no viaja.
      throw errores.cupoInsuficiente(config.mostrarCuposRestantes ? disponibles : null)
    }

    // --- 2. limite acumulado por cedula (DECISION #6) -----------------------
    if (config.boleta.limitePorCedulaAcumulado) {
      const yaTiene = q.boletasPorCedula.get(datos.comprador.cedula, ahora()).n
      if (yaTiene + datos.cantidad > config.boleta.maxPorCompra) {
        throw errores.limiteCedula(config.boleta.maxPorCompra, yaTiene)
      }
    }

    // --- 3. crear la orden --------------------------------------------------
    const referencia = generarReferencia((ref) => !!q.existeReferencia.get(ref))
    const creada = ahora()
    const expiraEn = vencimientoDeReserva()

    const info = q.insertarOrden.run(
      referencia, datos.tipoBoletaId, datos.cantidad,
      precio, tarifa, total,
      creada, expiraEn, ip,
    )
    const ordenId = Number(info.lastInsertRowid)

    q.insertarComprador.run(
      ordenId, datos.comprador.nombre, datos.comprador.tipoDocumento,
      datos.comprador.cedula, datos.comprador.correo, datos.comprador.celular,
      datos.comprador.direccion, datos.comprador.ciudad, datos.comprador.fechaNacimiento ?? null,
      datos.comprador.promocion, creada, egresado.verificado ? 1 : 0,
    )

    datos.asistentes.forEach((a, i) => {
      q.insertarAsistente.run(
        ordenId, i, a.nombre, a.tipoDocumento, a.cedula, a.correo, a.celular,
        a.promocion, a.esEgresado ? 1 : 0,
      )
    })

    // --- 4. reservar los cupos ---------------------------------------------
    reservarCupos(ordenId, datos.cantidad, expiraEn)

    return { referencia, expiraEn }
  })

  return {
    referencia: resultado.referencia,
    totalCentavos: total,
    expiraEn: resultado.expiraEn,
    wompi: firmarCheckout(resultado.referencia, total),
  }
}

// -----------------------------------------------------------------------------
// Consultar
// -----------------------------------------------------------------------------

export const buscarPorReferencia = (referencia) => q.porReferencia.get(referencia) ?? null
export const buscarPorTransaccionWompi = (id) => q.porTransaccionWompi.get(id) ?? null

/**
 * Boletas de una orden, ya con URLs listas para el front.
 * @param {string} [base] host por el que entro la peticion (ver lib/urls.js)
 */
export function boletasDeOrden(ordenId, base) {
  return q.boletasDe.all(ordenId).map((b) => ({
    id: b.id,
    asistente: b.asistente_nombre,
    promocion: b.promocion,
    esEgresado: b.es_egresado === 1,
    estado: b.estado,
    token: b.token_firmado,
    qrUrl: urlQr(b.id, base),
    pdfUrl: urlPdf(b.id, base),
  }))
}

/**
 * Lo que devuelve GET /api/ordenes/:referencia. El front hace polling contra
 * esto al volver de Wompi hasta que el estado deja de ser "pendiente".
 *
 * El token NUNCA sale en esta respuesta: se accede a el solo a traves de la
 * imagen del QR y del PDF.
 */
export function vistaPublica(orden, base) {
  const respuesta = {
    referencia: orden.referencia,
    estado: orden.estado,
    cantidad: orden.cantidad,
    totalCentavos: orden.total_centavos,
    creadaEn: orden.creada_en,
    expiraEn: orden.expira_en,
    pagadaEn: orden.pagada_en,
    correoEnviadoA: orden.correo_enviado_a,
    boletas: [],
  }
  if (orden.estado !== 'pagada') {
    if (orden.motivo_cierre) respuesta.motivo = orden.motivo_cierre
    return respuesta
  }
  respuesta.boletas = boletasDeOrden(orden.id, base).map(({ token, ...resto }) => resto)
  return respuesta
}

// -----------------------------------------------------------------------------
// Confirmar el pago (solo desde el webhook)
// -----------------------------------------------------------------------------

/**
 * Aplica el resultado de una transaccion de Wompi sobre la orden.
 *
 * Es idempotente: si la orden ya no esta "pendiente", no hace nada y lo
 * reporta. Wompi reenvia eventos y el usuario puede recargar; ninguna de las
 * dos cosas puede emitir boletas dos veces.
 *
 * @returns {{cambio: boolean, estado: string, ordenId: number}}
 */
export function confirmarPago(referencia, { estadoDestino, transactionId, metodoPago, franquicia = null, ultimosCuatro = null, autorizacionBanco = null }) {
  return enTransaccion(() => {
    const orden = q.porReferencia.get(referencia)
    if (!orden) throw errores.noEncontrado('La orden')

    if (orden.estado !== 'pendiente') {
      return { cambio: false, estado: orden.estado, ordenId: orden.id }
    }

    if (estadoDestino === 'pagada') {
      q.marcarPagada.run(ahora(), transactionId ?? null, metodoPago ?? null, franquicia, ultimosCuatro ?? null, autorizacionBanco ?? null, orden.id)
      consumirReserva(orden.id)      // el cupo pasa de reservado a vendido
      emitirBoletas(orden.id)        // un QR firmado por asistente
      return { cambio: true, estado: 'pagada', ordenId: orden.id }
    }

    if (estadoDestino === 'rechazada') {
      q.marcarRechazada.run(
        ahora(), 'El pago no fue aprobado', transactionId ?? null, metodoPago ?? null,
        franquicia, orden.id,
      )
      liberarReserva(orden.id)       // los cupos vuelven al inventario
      return { cambio: true, estado: 'rechazada', ordenId: orden.id }
    }

    // PENDING de Wompi: todavia no se decide nada (tipico en PSE).
    return { cambio: false, estado: 'pendiente', ordenId: orden.id }
  })
}

/**
 * Un registro de boleta por asistente. Se llama DENTRO de la transaccion de
 * confirmarPago. Si la orden ya tiene boletas, no vuelve a emitir.
 */
function emitirBoletas(ordenId) {
  if (q.boletasDe.all(ordenId).length > 0) return
  const asistentes = q.asistentesDe.all(ordenId)
  const emitida = ahora()
  for (const a of asistentes) {
    const id = nuevoIdBoleta()
    q.insertarBoleta.run(id, ordenId, a.id, generarToken(id), emitida)
  }
}

// -----------------------------------------------------------------------------
// Correo
// -----------------------------------------------------------------------------

/**
 * Envia (o reenvia) el correo con las boletas de una orden pagada.
 *
 * Es asincrono y nunca lanza hacia arriba: si el SMTP falla, el pago ya paso y
 * el usuario puede pedir el reenvio desde el paso 3 o desde el panel.
 */
/**
 * Envia (o reenvia) las boletas de una orden pagada.
 *
 * CADA BOLETA VA SOLO A SU DUENIO. Lo pidio el colegio el 11 de septiembre de
 * 2026, y lo afino esa misma tarde despues de la primera prueba: la version
 * anterior le mandaba al comprador TODAS las boletas ademas de repartirlas,
 * y el comprador recibia las de sus amigos sin necesitarlas.
 *
 * Como queda:
 *   - Cada acompanante con correo recibe la suya, y solo la suya.
 *   - Quien pago recibe la suya + el resumen de la compra (numero de orden,
 *     total), que es su comprobante. Y se le dice a quien se le mando el resto.
 *   - Un acompanante SIN correo no puede quedarse sin boleta: la suya va en el
 *     correo de quien pago. Es la unica excepcion, y es para no perder nada.
 *
 * LO QUE NO SE REPITE: el barrido de reintentos corre cada minuto. Cada
 * asistente queda marcado cuando su boleta salio (correo_enviado_en), y un
 * reintento no se la vuelve a mandar. Al comprador SI se le puede reenviar:
 * eso es lo que hace el boton del panel.
 *
 * SALVO que lo pida una persona: el boton del panel pasa `aTodos`, y ahi se
 * les reenvia tambien a los acompanantes. Se supo el 14 de septiembre de 2026
 * con la segunda compra real: la boleta del acompanante salio (Gmail la
 * acepto), pero el no la veia -- spam, seguramente -- y desde el panel no
 * habia forma de mandarsela otra vez. La marca protege del reintento
 * automatico, no de un reenvio que alguien decidio.
 *
 * El resultado del comprador es el que manda: si ESE falla, la orden queda
 * como no enviada y se reintenta. Si el SMTP esta caido, no se intenta nada
 * mas -- mandar tres individuales solo multiplicaria el fallo.
 */
export async function enviarCorreoDeOrden(ordenId, { aTodos = false } = {}) {
  const orden = q.porId.get(ordenId)
  if (!orden || orden.estado !== 'pagada') {
    return { enviado: false, detalle: 'La orden no esta pagada' }
  }

  const comprador = q.compradorDe.get(ordenId)
  const filas = q.boletasConDueno.all(ordenId).filter((b) => b.estado !== 'anulada')
  const correoComprador = String(comprador.correo ?? '').trim().toLowerCase()

  // Forma que espera el armador del correo.
  const comoBoleta = (f) => ({
    id: f.id,
    asistente: f.asistente_nombre,
    promocion: f.promocion,
    esEgresado: f.es_egresado === 1,
    estado: f.estado,
    token: f.token_firmado,
  })

  const pdfDe = async (f) => {
    try {
      return {
        filename: nombreArchivoBoleta(f.asistente_nombre),
        content: await pdfDeBoleta({ ...comoBoleta(f), referencia: orden.referencia }),
        contentType: 'application/pdf',
      }
    } catch (e) {
      console.error(`[correo] No se pudo generar el PDF de ${f.id}:`, e.message)
      return null
    }
  }

  // --- A donde va cada boleta ---------------------------------------------------
  // A su propio correo si lo dejo y no es el mismo del comprador; si no, al
  // comprador. Se agrupa por destino: si dos acompanantes pusieron el mismo
  // correo, les llega UN correo con las dos, no dos correos.
  const grupos = new Map()
  for (const f of filas) {
    const suyo = String(f.asistente_correo ?? '').trim().toLowerCase()
    const destino = suyo && suyo !== correoComprador ? suyo : correoComprador
    if (!grupos.has(destino)) grupos.set(destino, [])
    grupos.get(destino).push(f)
  }

  const delComprador = grupos.get(correoComprador) ?? []
  grupos.delete(correoComprador)

  // A quien se le mando aparte: se le cuenta al comprador en su correo, para
  // que sepa que sus amigos ya tienen la suya y no la reenvie el.
  const enviadasAparte = [...grupos.values()].flat().map((f) => f.asistente_nombre)

  // --- 1. el correo de quien pago -----------------------------------------------
  const adjuntosComprador = (await Promise.all(delComprador.map(pdfDe))).filter(Boolean)
  const resultado = await enviarBoletas(
    orden, comprador, delComprador.map(comoBoleta), adjuntosComprador, { enviadasAparte },
  )

  if (resultado.enviado) {
    q.registrarCorreo.run(comprador.correo, ahora(), ordenId)
  } else {
    // Se anota el fallo. El reintento lo agenda quien llame (ver
    // src/servicios/correos.js), que es quien conoce la espera creciente.
    q.registrarFalloCorreo.run(resultado.detalle ?? 'sin detalle', null, ordenId)
    return resultado
  }

  // --- 2. la boleta de cada acompanante, a su propio correo ---------------------
  let individuales = 0
  for (const [destino, suyas] of grupos) {
    const pendientes = aTodos ? suyas : suyas.filter((f) => !f.correo_enviado_en)
    if (pendientes.length === 0) continue   // ya se le habia mandado

    const adjuntos = (await Promise.all(pendientes.map(pdfDe))).filter(Boolean)
    const r = await enviarBoletas(orden, comprador, pendientes.map(comoBoleta), adjuntos, {
      para: destino,
      invitadoDe: comprador.nombre,
    })

    if (r.enviado) {
      for (const f of pendientes) q.marcarCorreoAsistente.run(ahora(), f.asistente_id)
      individuales += 1
    } else {
      // No tumba la orden: el reintento del barrido lo vuelve a intentar, y
      // desde el panel se puede reenviar.
      console.error(`[correo] No se le pudo mandar la boleta a ${destino}: ${r.detalle}`)
    }
  }

  return { ...resultado, individuales }
}

/** Ordenes pagadas sin correo enviado a las que ya les toca reintento. */
export const pendientesDeCorreo = (maxIntentos, limite = 25) =>
  q.pendientesDeCorreo.all(maxIntentos, ahora(), limite)

/**
 * Agenda cuando volver a intentar el correo. NO cuenta un intento nuevo: el
 * intento ya lo conto enviarCorreoDeOrden al fallar.
 */
export const agendarReintentoCorreo = (ordenId, cuando) =>
  q.agendarProximoIntento.run(cuando, ordenId)

/** Guarda el id de transaccion si la orden todavia no tenia uno. */
export const guardarTransaccion = (ordenId, idTransaccion) =>
  q.guardarTransaccion.run(idTransaccion, ordenId).changes > 0

/** Ordenes pendientes creadas hace mas de N minutos. */
export const pendientesViejas = (minutos, limite = 50) =>
  q.pendientesViejas.all(enMinutos(-minutos), limite)

/** Empuja el vencimiento de la reserva. Se usa cuando la pasarela dice PENDING. */
export const extenderReserva = (ordenId, hasta) =>
  q.extenderReserva.run(hasta, ordenId).changes > 0

export const compradorDe = (ordenId) => q.compradorDe.get(ordenId) ?? null
export const asistentesDe = (ordenId) => q.asistentesDe.all(ordenId)
