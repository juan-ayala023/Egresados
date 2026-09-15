// -----------------------------------------------------------------------------
// Reportes del panel administrativo (BACKEND.md seccion 8).
// -----------------------------------------------------------------------------
import { db } from '../db/index.js'
import { ahora } from '../lib/fechas.js'

const q = {
  // Una fila por asistente, con los datos de facturacion del comprador
  // repetidos al lado. Es el formato que pidio el comite para el reporte.
  filasReporte: db.prepare(`
    SELECT o.referencia, o.estado, o.cantidad, o.total_centavos, o.metodo_pago,
           o.creada_en, o.pagada_en, o.wompi_transaction_id,
           c.nombre    AS comprador_nombre,
           c.cedula    AS comprador_cedula,
           c.correo    AS comprador_correo,
           c.celular   AS comprador_celular,
           c.direccion AS comprador_direccion,
           c.ciudad    AS comprador_ciudad,
           c.promocion AS comprador_promocion,
           c.acepta_datos, c.acepta_terminos, c.aceptado_en,
           a.indice, a.nombre AS asistente_nombre, a.cedula AS asistente_cedula,
           a.correo AS asistente_correo, a.celular AS asistente_celular,
           a.promocion AS asistente_promocion, a.es_egresado,
           b.id AS boleta_id, b.estado AS boleta_estado, b.usada_en
      FROM orden o
      JOIN comprador c ON c.orden_id = o.id
      JOIN asistente a ON a.orden_id = o.id
 LEFT JOIN boleta b    ON b.asistente_id = a.id AND b.estado != 'anulada'
     WHERE (? = 'todas' OR o.estado = ?)
  ORDER BY o.creada_en DESC, a.indice ASC`),

  buscar: db.prepare(`
    SELECT o.id, o.referencia, o.estado, o.cantidad, o.total_centavos,
           o.creada_en, o.pagada_en, o.correo_enviado_a,
           c.nombre, c.cedula, c.correo, c.celular
      FROM orden o
      JOIN comprador c ON c.orden_id = o.id
     WHERE c.cedula LIKE ? OR c.correo LIKE ? OR o.referencia LIKE ? OR c.nombre LIKE ?
  ORDER BY o.creada_en DESC
     LIMIT 100`),

  /* Las ultimas ventas, sin tener que buscar a nadie.
     El panel solo tenia buscador, y para usarlo hay que saber a quien buscar:
     el comite entraba a ver como va la venta y no veia ninguna. Esta consulta
     es la que llena esa tabla.

     Solo pagadas: las pendientes son carritos a medio llenar y las expiradas
     ruido. Quien necesite verlas usa el buscador o el CSV. */
  totalPagadas: db.prepare(`SELECT COUNT(*) AS n FROM orden WHERE estado = 'pagada'`),

  ultimasVentas: db.prepare(`
    SELECT o.id, o.referencia, o.estado, o.cantidad, o.total_centavos,
           o.creada_en, o.pagada_en, o.metodo_pago, o.correo_enviado_a,
           o.siesa_factura,
           c.nombre, c.cedula, c.correo, c.celular, c.promocion
      FROM orden o
      JOIN comprador c ON c.orden_id = o.id
     WHERE o.estado = 'pagada'
  ORDER BY o.pagada_en DESC
     LIMIT ?`),

  // Los asistentes de una venta, con el estado de SU boleta.
  //
  // Va aparte y no dentro de ultimasVentas a proposito: unir aqui repetiria
  // los datos del comprador una vez por acompanante, y el panel tendria que
  // volver a agruparlos. Son 25 consultas chiquitas por indice, no una tabla
  // cruzada.
  asistentesDeOrden: db.prepare(`
    SELECT a.indice, a.nombre, a.tipo_documento, a.cedula, a.promocion,
           a.es_egresado, b.id AS boleta_id, b.estado AS boleta_estado,
           b.usada_en
      FROM asistente a
      LEFT JOIN boleta b ON b.asistente_id = a.id
     WHERE a.orden_id = ?
  ORDER BY a.indice`),

  resumenEstados: db.prepare(`
    SELECT estado, COUNT(*) AS ordenes, COALESCE(SUM(cantidad), 0) AS boletas,
           COALESCE(SUM(total_centavos), 0) AS total_centavos
      FROM orden GROUP BY estado`),

  registrarAuditoria: db.prepare(
    `INSERT INTO auditoria (ocurrio_en, actor, accion, detalle) VALUES (?, ?, ?, ?)`),
}

/** Busca por cedula, correo, referencia o nombre. */
export function buscarOrdenes(texto) {
  const patron = `%${String(texto ?? '').trim()}%`
  return q.buscar.all(patron, patron, patron, patron)
}

/**
 * Las ultimas ventas pagadas, para la tabla del panel.
 * @param {number} limite cuantas traer (tope 200: mas no se lee en pantalla)
 */
/** Cuantas ventas pagadas hay en total (para el "25 de 180" del panel). */
export const totalVentasPagadas = () => q.totalPagadas.get().n

export function ultimasVentas(limite = 25) {
  // Tope 1000: el aforo es 500 boletas, asi que "todas" siempre cabe. El
  // comite pidio ver la lista completa (15 de septiembre de 2026).
  const n = Math.min(Math.max(Number(limite) || 25, 1), 1000)
  return q.ultimasVentas.all(n).map((venta) => ({
    ...venta,
    // A NOMBRE DE QUIEN VAN LAS BOLETAS. El comite necesita esto para dos
    // cosas: saber quien entra (el que compra 4 no va solo) y responderle a
    // quien llama diciendo "no me llego la de mi esposa".
    //
    // Va incluido y no en otra llamada porque son pocos por venta, y el panel
    // los muestra al desplegar la fila sin tener que volver a preguntar.
    asistentes: q.asistentesDeOrden.all(venta.id),
  }))
}

/** Cuantas ordenes y cuanta plata hay en cada estado. */
export const resumenEstados = () => q.resumenEstados.all()

export function registrarAuditoria(actor, accion, detalle) {
  q.registrarAuditoria.run(ahora(), actor, accion, typeof detalle === 'string' ? detalle : JSON.stringify(detalle))
}

// -----------------------------------------------------------------------------
// CSV
// -----------------------------------------------------------------------------

const COLUMNAS = [
  ['referencia', (f) => f.referencia],
  ['estado_orden', (f) => f.estado],
  ['creada_en', (f) => f.creada_en],
  ['pagada_en', (f) => f.pagada_en],
  ['metodo_pago', (f) => f.metodo_pago],
  ['transaccion_wompi', (f) => f.wompi_transaction_id],
  ['boletas_en_la_orden', (f) => f.cantidad],
  ['total_pagado_cop', (f) => (f.total_centavos / 100).toFixed(0)],
  ['comprador_nombre', (f) => f.comprador_nombre],
  ['comprador_cedula', (f) => f.comprador_cedula],
  ['comprador_correo', (f) => f.comprador_correo],
  ['comprador_celular', (f) => f.comprador_celular],
  ['comprador_direccion', (f) => f.comprador_direccion],
  ['comprador_ciudad', (f) => f.comprador_ciudad],
  ['comprador_promocion', (f) => f.comprador_promocion],
  ['acepta_tratamiento_datos', (f) => (f.acepta_datos ? 'si' : 'no')],
  ['acepta_terminos', (f) => (f.acepta_terminos ? 'si' : 'no')],
  ['aceptado_en', (f) => f.aceptado_en],
  ['asistente_numero', (f) => f.indice + 1],
  ['asistente_nombre', (f) => f.asistente_nombre],
  ['asistente_cedula', (f) => f.asistente_cedula],
  ['asistente_correo', (f) => f.asistente_correo],
  ['asistente_celular', (f) => f.asistente_celular],
  ['asistente_promocion', (f) => f.asistente_promocion],
  ['es_egresado', (f) => (f.es_egresado ? 'si' : 'no')],
  ['boleta_id', (f) => f.boleta_id],
  ['boleta_estado', (f) => f.boleta_estado],
  ['ingreso_registrado_en', (f) => f.usada_en],
]

// -----------------------------------------------------------------------------
// LISTADO PARA EL LECTOR DE LA PUERTA.
//
// El colegio contrato un proveedor externo que va a escanear con pistola y
// cruzar contra "la base de venta de boletas que ustedes nos compartan". Este
// es ese archivo.
//
// La columna que importa es `codigo_qr`: es EXACTAMENTE lo que la pistola va a
// leer del codigo impreso, caracter por caracter. Si su sistema compara contra
// cualquier otra columna, no va a coincidir nunca.
//
// OJO CON LO QUE ESTE ARCHIVO NO HACE: es una foto del momento en que se
// descarga. No sabe quien entro ni impide que el mismo codigo pase dos veces
// -- eso lo tiene que hacer el sistema del proveedor. Y toda boleta vendida
// despues de la descarga NO esta aqui.
// -----------------------------------------------------------------------------

/* Consume lo que devuelve tokensParaOffline(): { id, token, estado,
   asistente, promocion }. Se reusa esa consulta a proposito, para que la
   lista que se le entrega al proveedor y la que usa nuestra propia puerta
   sin conexion sean siempre la misma y no puedan desincronizarse. */
const COLUMNAS_LECTOR = [
  ['codigo_qr', (b) => b.token],
  ['asistente_nombre', (b) => b.asistente],
  ['promocion', (b) => b.promocion],
  ['boleta_id', (b) => b.id],
  ['estado', (b) => b.estado],
]

/** Boletas validas, con el codigo que lleva impreso el QR. */
export function boletasParaLectorEnCsv(filas) {
  const lineas = [COLUMNAS_LECTOR.map(([nombre]) => nombre).join(',')]
  for (const b of filas) {
    lineas.push(COLUMNAS_LECTOR.map(([, leer]) => escaparCsv(leer(b))).join(','))
  }
  // BOM al inicio para que Excel en Windows abra las tildes bien.
  return '﻿' + lineas.join('\r\n') + '\r\n'
}

/**
 * Escapa un valor para CSV.
 *
 * Ademas del escape normal de comillas, se antepone un apostrofe a los valores
 * que empiezan por = + - @: sin eso, Excel los interpreta como formula. Una
 * cedula no puede volverse una formula en el reporte del colegio.
 */
function escaparCsv(valor) {
  if (valor === null || valor === undefined) return ''
  let s = String(valor)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Reporte completo en CSV.
 * @param {string} estado 'todas' o uno de los estados de la orden
 */
export function ordenesEnCsv(estado = 'todas') {
  const filas = q.filasReporte.all(estado, estado)
  const lineas = [COLUMNAS.map(([nombre]) => nombre).join(',')]
  for (const f of filas) {
    lineas.push(COLUMNAS.map(([, leer]) => escaparCsv(leer(f))).join(','))
  }
  // BOM al inicio para que Excel en Windows abra las tildes bien.
  return '﻿' + lineas.join('\r\n') + '\r\n'
}
