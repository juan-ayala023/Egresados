// -----------------------------------------------------------------------------
// BOLETAS DE CORTESIA: LOS INVITADOS DEL COLEGIO.
//
// El comite pidio (6 de octubre de 2026) invitar a profesores e invitados
// especiales con boletas que el colegio regala. No pasan por el checkout ni
// por Wompi: se cargan desde un archivo que entrega mercadeo, con nombre,
// documento, correo y celular.
//
// EN QUE SE DIFERENCIAN DE UNA VENTA:
//   - `es_cortesia = 1`. Esa marca es la que las separa en todas partes.
//   - Total $0, sin metodo de pago ni transaccion de Wompi.
//   - NO se facturan en SIESA: no hubo pago, no hay nada que registrar.
//   - NO salen de las 500 en venta (ver CORTESIAS_EN_AFORO en config.js).
//
// EN QUE SON IGUALES: el QR es el mismo, vale lo mismo en la puerta, se
// anulan y se reemiten igual, y aparecen en los reportes y en la lista del
// lector. Para quien escanea esa noche no hay ninguna diferencia.
//
// IDEMPOTENTE POR CORREO: si se vuelve a cargar el mismo archivo, a quien ya
// tiene su cortesia no se le crea otra. Mercadeo va a mandar la lista por
// tandas y se le va a traspapelar alguna; eso no puede costar boletas dobles.
// -----------------------------------------------------------------------------
import { db, enTransaccion } from '../db/index.js'
import { config } from '../config.js'
import { ahora } from '../lib/fechas.js'
import { generarReferencia } from '../lib/referencia.js'
import { nuevoIdBoleta, generarToken } from '../lib/qr.js'
import { NO_EGRESADO } from '../lib/validaciones.js'

const q = {
  porCorreo: db.prepare(`
    SELECT o.id, o.referencia, o.estado, o.es_cortesia, c.correo
      FROM orden o JOIN comprador c ON c.orden_id = o.id
     WHERE o.es_cortesia = 1 AND LOWER(c.correo) = LOWER(?)
       AND o.estado = 'pagada'`),

  insertarOrden: db.prepare(`
    INSERT INTO orden (
      referencia, estado, tipo_boleta_id, cantidad,
      precio_unitario_centavos, tarifa_unitaria_centavos, total_centavos,
      creada_en, expira_en, pagada_en, es_cortesia
    ) VALUES (?, 'pagada', ?, 1, 0, 0, 0, ?, ?, ?, 1)`),

  insertarComprador: db.prepare(`
    INSERT INTO comprador (
      orden_id, nombre, tipo_documento, cedula, correo, celular,
      promocion, acepta_datos, acepta_terminos, aceptado_en, egresado_verificado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 0)`),

  insertarAsistente: db.prepare(`
    INSERT INTO asistente (
      orden_id, indice, nombre, tipo_documento, cedula, correo, celular,
      promocion, es_egresado
    ) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?)`),

  insertarBoleta: db.prepare(`
    INSERT INTO boleta (id, orden_id, asistente_id, token_firmado, estado, emitida_en)
    VALUES (?, ?, ?, ?, 'emitida', ?)`),

  listar: db.prepare(`
    SELECT o.id, o.referencia, o.pagada_en, o.correo_enviado_en,
           c.nombre, c.cedula, c.correo, c.celular, c.promocion
      FROM orden o JOIN comprador c ON c.orden_id = o.id
     WHERE o.es_cortesia = 1
     ORDER BY o.creada_en`),
}

/** ¿Esta persona ya tiene su cortesia? Se mira por correo, que es la llave real. */
export const cortesiaDe = (correo) => q.porCorreo.get(String(correo ?? '').trim()) ?? null

export const listarCortesias = () => q.listar.all()

/**
 * Crea UNA cortesia con su boleta. No manda el correo: eso lo hace quien
 * llama, para poder revisar antes de que salga nada.
 *
 * @param {{nombre:string, tipoDocumento?:string, cedula?:string, correo:string,
 *          celular?:string, promocion?:string}} invitado
 * @returns {{creada:boolean, referencia:string, ordenId:number, motivo?:string}}
 */
export function crearCortesia(invitado) {
  const correo = String(invitado?.correo ?? '').trim().toLowerCase()
  const nombre = String(invitado?.nombre ?? '').trim()

  if (!nombre || nombre.split(/\s+/).length < 2) {
    return { creada: false, motivo: 'Falta el nombre completo (nombre y apellido)' }
  }
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/.test(correo)) {
    return { creada: false, motivo: `Correo no valido: "${invitado?.correo ?? ''}"` }
  }

  const yaTiene = cortesiaDe(correo)
  if (yaTiene) {
    return { creada: false, referencia: yaTiene.referencia, ordenId: yaTiene.id, motivo: 'Ya tiene cortesia' }
  }

  // La promocion es opcional: a un profesor no se le pregunta de que ano se
  // graduo. Sin dato va la marca de no egresado, igual que un acompanante.
  const promocion = String(invitado?.promocion ?? '').trim() || NO_EGRESADO
  const esEgresado = promocion !== NO_EGRESADO ? 1 : 0
  const cedula = String(invitado?.cedula ?? '').replace(/\D/g, '') || null
  const celular = String(invitado?.celular ?? '').replace(/\D/g, '') || null
  const tipoDocumento = String(invitado?.tipoDocumento ?? 'CC').toUpperCase()

  return enTransaccion(() => {
    const momento = ahora()
    const referencia = generarReferencia()
    const r = q.insertarOrden.run(referencia, config.boleta.id, momento, momento, momento)
    const ordenId = Number(r.lastInsertRowid)

    q.insertarComprador.run(ordenId, nombre, tipoDocumento, cedula ?? '', correo, celular ?? '', promocion, momento)
    const a = q.insertarAsistente.run(ordenId, nombre, tipoDocumento, cedula, correo, celular, promocion, esEgresado)

    const idBoleta = nuevoIdBoleta()
    q.insertarBoleta.run(idBoleta, ordenId, Number(a.lastInsertRowid), generarToken(idBoleta), momento)

    return { creada: true, referencia, ordenId }
  })
}
