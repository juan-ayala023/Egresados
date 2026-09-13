// -----------------------------------------------------------------------------
// Genera el PDF de una boleta (el adjunto del correo y el boton "Descargar").
//
// Se genera al vuelo cada vez que se pide: no hay archivos que guardar ni que
// limpiar, y si cambia el diseno no hay que regenerar nada de lo ya emitido.
//
// DOS PASADAS (13 de septiembre de 2026). El colegio pidio que la hoja no
// quedara con media pagina en blanco abajo. Pero un PDF fija el alto de la
// hoja ANTES de escribir en ella, y el contenido puede variar de alto (un
// lugar largo se parte en dos lineas). Asi que se dibuja una vez en una hoja
// altisima solo para medir donde termina, y despues se dibuja de verdad en
// una hoja cortada justo ahi. Es barato: son milisegundos.
// -----------------------------------------------------------------------------
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import { config } from '../config.js'
import { pngDelToken } from './qr.js'
import { formatoLargo } from './fechas.js'

const TINTA = '#111111'
const SUAVE = '#666666'
const NAVY = '#004990'

const ANCHO = 595          // A4, en puntos
const MARGEN = 50
const ALTO_BANDA = 118     // la franja azul de arriba

// El mismo cabezote del correo. Trae el fondo en el azul de la marca, asi que
// sobre la franja no se nota donde termina.
const CABEZOTE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'correo-encabezado.png')

let cabezote = null
function leerCabezote() {
  if (cabezote !== null) return cabezote
  try {
    cabezote = fs.readFileSync(CABEZOTE)
  } catch (e) {
    // Sin cabezote la boleta sale igual: el QR es lo que importa.
    console.error('[pdf] No se pudo cargar el cabezote:', e.message)
    cabezote = false
  }
  return cabezote
}

/**
 * Dibuja la boleta en el documento dado y devuelve la altura final.
 * Se usa dos veces: una para medir y otra para producir.
 */
function dibujar(doc, b, qr) {
  // --- franja azul con el cabezote ----------------------------------------------
  doc.rect(0, 0, ANCHO, ALTO_BANDA).fill(NAVY)
  const banner = leerCabezote()
  if (banner) {
    const w = 360
    // La proporcion se lee del PNG (ancho y alto van en los bytes 16-24 de la
    // cabecera IHDR). Antes iba escrita a mano para un archivo de 443x130, y
    // al cambiar el cabezote por el original en alta resolucion habria
    // quedado mal centrado.
    const anchoPng = banner.readUInt32BE(16)
    const altoPng = banner.readUInt32BE(20)
    const h = Math.round(altoPng * (w / anchoPng))
    doc.image(banner, (ANCHO - w) / 2, (ALTO_BANDA - h) / 2, { width: w })
  }
  doc.x = MARGEN
  doc.y = ALTO_BANDA + 30

  // --- encabezado ----------------------------------------------------------------
  doc.fillColor(TINTA).fontSize(24).font('Helvetica-Bold')
    .text(config.evento.nombre, { align: 'center' })
  doc.moveDown(0.3)
  doc.fontSize(11).font('Helvetica').fillColor(SUAVE)
    .text('The Columbus School · Boleta de ingreso', { align: 'center' })

  doc.moveDown(1.2)
  doc.moveTo(MARGEN, doc.y).lineTo(ANCHO - MARGEN, doc.y).strokeColor('#DDDDDD').stroke()
  doc.moveDown(1.2)

  // --- QR --------------------------------------------------------------------------
  doc.image(qr, (ANCHO - 200) / 2, doc.y, { width: 200 })
  doc.y += 212
  doc.fontSize(9).fillColor(SUAVE).font('Helvetica')
    .text('Presenta este código en el ingreso. Es válido una sola vez.', { align: 'center' })

  doc.moveDown(1.8)

  // --- datos -------------------------------------------------------------------------
  const fila = (etiqueta, valor) => {
    doc.fontSize(9).fillColor(SUAVE).font('Helvetica').text(etiqueta.toUpperCase())
    doc.fontSize(13).fillColor(TINTA).font('Helvetica-Bold').text(valor)
    doc.moveDown(0.6)
  }

  fila('Asistente', b.asistente)
  // Vacio = el acompanante no puso su ano de grado (es opcional). No se
  // afirma que no sea egresado: eso nadie lo dijo.
  fila('Promoción', b.esEgresado
    ? `Promoción ${b.promocion}`
    : b.promocion ? 'Invitado / no egresado' : 'Sin dato')
  fila('Fecha y hora', formatoLargo(config.evento.fecha))
  fila('Lugar', `${config.evento.lugar} · ${config.evento.direccion}`)
  fila('Número de orden', b.referencia)
  fila('Boleta', b.id)

  // --- pie ---------------------------------------------------------------------------
  doc.moveDown(0.6)
  doc.moveTo(MARGEN, doc.y).lineTo(ANCHO - MARGEN, doc.y).strokeColor('#DDDDDD').stroke()
  doc.moveDown(0.9)
  doc.fontSize(8).fillColor(SUAVE).font('Helvetica').text(
    'Esta boleta es personal e intransferible salvo autorización del comité organizador. ' +
    `Si tienes dudas escribe a ${config.correo.soporte}.`,
    { align: 'center' },
  )

  return doc.y
}

/** Genera un documento en un buffer. */
function producir(alto, b, qr) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [ANCHO, alto], margin: MARGEN })
    const trozos = []
    doc.on('data', (t) => trozos.push(t))
    doc.on('end', () => resolve({ pdf: Buffer.concat(trozos), fin: doc._finY }))
    doc.on('error', reject)
    doc._finY = dibujar(doc, b, qr)
    doc.end()
  })
}

/**
 * @param {object} b datos de la boleta ya armados por el servicio
 * @returns {Promise<Buffer>}
 */
export async function pdfDeBoleta(b) {
  const qr = await pngDelToken(b.token, 600)

  // 1. Medir: hoja altisima, solo para saber donde termina el contenido.
  const { fin } = await producir(3000, b, qr)

  // 2. Producir: la hoja termina un margen por debajo del ultimo texto.
  //    Nunca mas corta que una tarjeta razonable, por si algun dia el
  //    contenido se achica.
  const alto = Math.max(Math.ceil(fin + MARGEN), 500)
  const { pdf } = await producir(alto, b, qr)
  return pdf
}
