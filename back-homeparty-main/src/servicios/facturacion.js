// -----------------------------------------------------------------------------
// FACTURAR UNA ORDEN PAGADA, EN AUTOMATICO.
//
// Esto es lo mismo que hace la plataforma de eventos del colegio con teatro,
// carreras y camp. Su _process_approved() dice, textual:
//
//     payment.status = "APPROVED"
//     try:
//         self._generar_documentos_siesa(payment)
//     except Exception as e:
//         logger.error(...)
//         payment.siesa_error = str(e)
//     # Email de confirmación — fallo no bloquea el pago
//
// O sea: se marca pagado, se INTENTA facturar, y si SIESA falla se guarda el
// error y se sigue con el correo. Aqui va igual, por la misma razon: el
// egresado ya pago. Que el ERP este caido no puede costarle la boleta.
//
// TRES COSAS QUE LO PROTEGEN:
//
//   1. Es IDEMPOTENTE. Una orden que ya tiene siesa_factura no se vuelve a
//      facturar nunca. Wompi reenvia eventos y el barrido corre cada minuto:
//      sin esto, una misma venta saldria facturada dos o tres veces, y una
//      factura de mas en un sistema contable no se borra, se anula a mano.
//   2. NUNCA LANZA. Se llama con setImmediate, fuera del ciclo de la peticion.
//      Un fallo aqui no toca ni el pago, ni las boletas, ni el correo.
//   3. Respeta SIESA_ENSAYO. Mientras este en true no se manda nada al ERP:
//      arma los documentos, los deja en el log y anota que fue ensayo.
// -----------------------------------------------------------------------------
import { db } from '../db/index.js'
import { config } from '../config.js'
import { ahora } from '../lib/fechas.js'
import { facturar } from '../siesa/facturacion.js'

const q = {
  porId: db.prepare(`SELECT * FROM orden WHERE id = ?`),
  compradorDe: db.prepare(`SELECT * FROM comprador WHERE orden_id = ?`),

  // El WHERE siesa_factura IS NULL es el seguro contra la doble facturacion:
  // aunque dos llamadas entren a la vez, solo una escribe.
  guardarExito: db.prepare(`
    UPDATE orden
       SET siesa_factura = ?, siesa_recibo = ?, siesa_error = NULL, siesa_intentado_en = ?
     WHERE id = ? AND siesa_factura IS NULL`),

  guardarFallo: db.prepare(`
    UPDATE orden SET siesa_error = ?, siesa_intentado_en = ? WHERE id = ?`),
}

/**
 * Emite la factura y el recibo de una orden pagada.
 *
 * No lanza: devuelve siempre un objeto que dice que paso. Quien la llama
 * normalmente no mira el resultado (despacharFactura), pero el script y las
 * pruebas si.
 *
 * @returns {Promise<{facturada:boolean, ensayo?:boolean, motivo?:string,
 *                    numeroFactura?:string, numeroRecibo?:string}>}
 */
export async function facturarOrden(ordenId) {
  const orden = q.porId.get(ordenId)
  if (!orden) return { facturada: false, motivo: 'La orden no existe' }

  if (orden.estado !== 'pagada') {
    return { facturada: false, motivo: `La orden esta en "${orden.estado}"` }
  }

  // Idempotencia. Es lo primero a proposito.
  if (orden.siesa_factura) {
    return { facturada: false, motivo: `Ya tiene la factura ${orden.siesa_factura}` }
  }

  const comprador = q.compradorDe.get(ordenId)
  if (!comprador) return { facturada: false, motivo: 'La orden no tiene comprador' }

  try {
    const r = await facturar(orden, comprador)

    if (r.ensayo) {
      // En ensayo no hay consecutivos que guardar. Se anota el intento para
      // que en el panel se vea que la orden paso por aqui y no quedo olvidada.
      q.guardarFallo.run('ENSAYO: los documentos se armaron pero no se enviaron al ERP', ahora(), ordenId)
      console.log(`[siesa] ensayo de la orden ${orden.referencia}: documentos armados, no enviados`)
      return { facturada: false, ensayo: true, motivo: 'SIESA_ENSAYO=true' }
    }

    q.guardarExito.run(r.numeroFactura, r.numeroRecibo ?? null, ahora(), ordenId)
    console.log(
      `[siesa] orden ${orden.referencia} facturada: factura ${r.numeroFactura}, recibo ${r.numeroRecibo}`,
    )
    return { facturada: true, numeroFactura: r.numeroFactura, numeroRecibo: r.numeroRecibo }
  } catch (e) {
    // Se guarda el error crudo. Sin esto, una factura que no salio queda
    // invisible y alguien tiene que descubrirla cuadrando cajas en diciembre.
    q.guardarFallo.run(String(e.message).slice(0, 500), ahora(), ordenId)
    console.error(`[siesa] fallo la factura de ${orden.referencia}: ${e.message}`)
    return { facturada: false, motivo: e.message }
  }
}

/**
 * Ordenes pagadas que todavia no tienen factura.
 * Es lo que mira el panel para saber que quedo colgado.
 */
export const pendientesDeFactura = (limite = 50) =>
  db.prepare(`
    SELECT id, referencia, pagada_en, siesa_error
      FROM orden
     WHERE estado = 'pagada' AND siesa_factura IS NULL
     ORDER BY pagada_en ASC
     LIMIT ?`).all(limite)

/**
 * ¿Esta prendida la facturacion automatica?
 *
 * Sin WSDL configurado no hay nada que intentar, y llamar a SIESA en cada
 * venta para que falle igual solo llena el log de ruido.
 */
export const facturacionActiva = () => Boolean(config.siesa.wsdl && config.siesa.servicioId)
