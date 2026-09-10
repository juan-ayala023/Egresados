// -----------------------------------------------------------------------------
// POST /api/webhooks/wompi
//
// El webhook es la fuente de verdad PRINCIPAL sobre si un pago se aprobo. El
// redirect del navegador no confirma nada: el usuario puede cerrar la pestana y
// el pago igual se aprueba.
//
// Pero un webhook se puede perder (nuestro servidor caido, un despliegue, un
// corte de red). Por eso NO es la unica fuente: src/servicios/reconciliacion.js
// pregunta por las ordenes que se quedaron sin respuesta. Los dos caminos
// terminan en la misma funcion, aplicarPago().
//
// Tres cosas pasan aqui, en este orden:
//   1. Validar el checksum   -> que el evento venga de verdad de la pasarela
//   2. Descartar duplicados  -> Wompi reenvia el mismo evento varias veces
//   3. Aplicar el estado     -> APPROVED emite boletas; DECLINED libera cupos
//
// Y siempre responder 200 rapido. Si respondemos error, Wompi reintenta; si
// tardamos, se agota su timeout.
// -----------------------------------------------------------------------------
import { Router } from 'express'
import { db } from '../db/index.js'
import { config } from '../config.js'
import { ahora } from '../lib/fechas.js'
import { verificarEventoEntrante, datosDelEvento } from '../pagos/index.js'
import { aplicarPago, despacharCorreo, despacharFactura } from '../servicios/pagos.js'
import { buscarPorReferencia } from '../servicios/ordenes.js'

export const rutasWebhooks = Router()

const q = {
  yaProcesado: db.prepare(`SELECT resultado FROM webhook_wompi WHERE event_id = ?`),
  guardar: db.prepare(
    `INSERT INTO webhook_wompi (event_id, payload_raw, recibido_en) VALUES (?, ?, ?)`),
  marcarProcesado: db.prepare(
    `UPDATE webhook_wompi SET procesado_en = ?, resultado = ? WHERE event_id = ?`),
}

/**
 * Identificador estable del evento, para la idempotencia.
 *
 * Wompi no siempre manda un "id" propio, asi que se arma uno con la transaccion
 * y el estado al que llego: "esta transaccion alcanzo este estado" es un hecho
 * unico, y un reintento del mismo evento produce exactamente la misma llave.
 *
 * El timestamp NO entra en la llave. Si entrara, dos entregas del mismo evento
 * separadas por un segundo se verian como eventos distintos y la deduplicacion
 * no serviria para nada. Una transaccion que avanza de PENDING a APPROVED si
 * genera dos llaves distintas, que es lo correcto.
 */
function idDelEvento(evento) {
  if (evento?.id) return String(evento.id)
  const t = evento?.data?.transaction ?? {}
  return `${t.id ?? 'sin-id'}:${t.status ?? 'sin-estado'}`
}

/**
 * Procesa un evento entrante. Devuelve { status, cuerpo } y, si hay que mandar
 * correo, el id de la orden en "correoPara".
 *
 * Esta separada de la ruta para que la simulacion de desarrollo pase por
 * exactamente el mismo codigo que corre en produccion.
 */
export function procesarEvento(evento) {
  // --- 1. autenticidad -------------------------------------------------------
  const firma = verificarEventoEntrante(evento)
  if (!firma.valido) {
    console.warn('[webhook] Evento rechazado:', firma.motivo)
    return { status: 401, cuerpo: { recibido: false, motivo: firma.motivo } }
  }

  const eventId = idDelEvento(evento)

  // --- 2. idempotencia -------------------------------------------------------
  // Se revisa Y se guarda antes de procesar nada. El INSERT va en try porque
  // dos entregas simultaneas del mismo evento chocarian contra la llave unica;
  // eso no es un error, es la deduplicacion funcionando.
  const previo = q.yaProcesado.get(eventId)
  if (previo) {
    return { status: 200, cuerpo: { recibido: true, duplicado: true, resultado: previo.resultado } }
  }
  try {
    q.guardar.run(eventId, JSON.stringify(evento), ahora())
  } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) {
      return { status: 200, cuerpo: { recibido: true, duplicado: true, resultado: 'en curso' } }
    }
    throw e
  }

  const terminar = (resultado, cuerpo) => {
    q.marcarProcesado.run(ahora(), resultado, eventId)
    return { status: 200, cuerpo: { recibido: true, ...cuerpo } }
  }

  // --- 3. aplicar ------------------------------------------------------------
  const pago = datosDelEvento(evento)
  if (!pago) {
    return terminar('ignorado: el evento no trae transaccion', { aplicado: false })
  }

  const r = aplicarPago(pago, 'webhook')
  const salida = terminar(r.motivo, {
    aplicado: r.aplicado,
    estado: r.estado,
    ...(r.codigo ? { motivo: r.codigo } : {}),
  })

  // El correo se manda despues de responder: es lento y puede fallar, y no se
  // hace esperar a Wompi por el.
  if (r.correoPara) salida.correoPara = r.correoPara
  return salida
}

// -----------------------------------------------------------------------------
rutasWebhooks.post('/webhooks/wompi', (req, res) => {
  const { status, cuerpo, correoPara } = procesarEvento(req.body ?? {})
  res.status(status).json(cuerpo)
  despacharCorreo(correoPara)
  despacharFactura(correoPara)
})

// -----------------------------------------------------------------------------
// POST /api/simulacion/pagar   (SOLO en desarrollo)
//
// Fabrica el evento que mandaria Wompi y lo pasa por procesarEvento(), es decir
// por el mismo camino de produccion. Se apaga con WOMPI_SIMULACION=false.
//
//   curl -X POST localhost:4000/api/simulacion/pagar -H "Content-Type: application/json" \
//        -d '{"referencia":"HC80-4F9K2A","aprobar":true}'
// -----------------------------------------------------------------------------
rutasWebhooks.post('/simulacion/pagar', (req, res) => {
  if (!config.wompi.simulacion) {
    return res.status(404).json({
      error: { codigo: 'NO_ENCONTRADO', mensaje: 'La simulacion esta apagada.' },
    })
  }

  // "franquicia" y "metodo" son opcionales: sirven para probar en local el caso
  // de un AMEX aprobado sin tener que esperar a Sandbox. Por ejemplo:
  //   -d '{"referencia":"HC80-4F9K2A","franquicia":"AMEX"}'
  //   -d '{"referencia":"HC80-4F9K2A","metodo":"PSE"}'
  const { referencia, aprobar = true, franquicia = null, metodo = 'CARD' } = req.body ?? {}
  const orden = buscarPorReferencia(referencia)
  if (!orden) {
    return res.status(404).json({
      error: { codigo: 'NO_ENCONTRADO', mensaje: 'Esa orden no existe.' },
    })
  }

  const evento = {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: `sim-${orden.referencia}-${aprobar ? 'ok' : 'no'}`,
        reference: orden.referencia,
        status: aprobar ? 'APPROVED' : 'DECLINED',
        amount_in_cents: orden.total_centavos,
        currency: 'COP',
        payment_method_type: metodo,
        payment_method: franquicia
          ? { type: metodo, extra: { brand: String(franquicia).toUpperCase() } }
          : { type: metodo },
      },
    },
    sent_at: ahora(),
    timestamp: Math.floor(Date.now() / 1000),
  }

  const { status, cuerpo, correoPara } = procesarEvento(evento)
  res.status(status).json({ simulado: true, ...cuerpo })
  despacharCorreo(correoPara)
  despacharFactura(correoPara)
})
