// -----------------------------------------------------------------------------
// Genera el PDF de una boleta (el boton "Descargar boleta" del paso 3).
//
// Se genera al vuelo cada vez que se pide: no hay archivos que guardar ni que
// limpiar, y si cambia el diseno no hay que regenerar nada de lo ya emitido.
// -----------------------------------------------------------------------------
import PDFDocument from 'pdfkit'
import { config } from '../config.js'
import { pngDelToken } from './qr.js'
import { formatoLargo } from './fechas.js'

const TINTA = '#111111'
const SUAVE = '#666666'

/**
 * @param {object} b datos de la boleta ya armados por el servicio
 * @returns {Promise<Buffer>}
 */
export async function pdfDeBoleta(b) {
  const qr = await pngDelToken(b.token, 600)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const trozos = []
    doc.on('data', (t) => trozos.push(t))
    doc.on('end', () => resolve(Buffer.concat(trozos)))
    doc.on('error', reject)

    // --- encabezado ----------------------------------------------------------
    doc.fillColor(TINTA).fontSize(26).font('Helvetica-Bold')
      .text(config.evento.nombre, { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(11).font('Helvetica').fillColor(SUAVE)
      .text('The Columbus School - Boleta de ingreso', { align: 'center' })

    doc.moveDown(1.5)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#DDDDDD').stroke()
    doc.moveDown(1.5)

    // --- QR ------------------------------------------------------------------
    doc.image(qr, (595 - 200) / 2, doc.y, { width: 200 })
    doc.y += 215
    doc.fontSize(9).fillColor(SUAVE)
      .text('Presenta este codigo en el ingreso. Es valido una sola vez.', { align: 'center' })

    doc.moveDown(2)

    // --- datos ---------------------------------------------------------------
    const fila = (etiqueta, valor) => {
      doc.fontSize(9).fillColor(SUAVE).font('Helvetica').text(etiqueta.toUpperCase())
      doc.fontSize(13).fillColor(TINTA).font('Helvetica-Bold').text(valor)
      doc.moveDown(0.7)
    }

    fila('Asistente', b.asistente)
    fila('Promocion', b.esEgresado ? `Promocion ${b.promocion}` : 'Invitado / no egresado')
    fila('Fecha y hora', formatoLargo(config.evento.fecha))
    fila('Lugar', `${config.evento.lugar} - ${config.evento.direccion}`)
    fila('Numero de orden', b.referencia)
    fila('Boleta', b.id)

    // --- pie -----------------------------------------------------------------
    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#DDDDDD').stroke()
    doc.moveDown(1)
    doc.fontSize(8).fillColor(SUAVE).font('Helvetica').text(
      'Esta boleta es personal e intransferible salvo autorizacion del comite organizador. ' +
      `Si tienes dudas escribe a ${config.correo.soporte}.`,
      { align: 'center' },
    )

    doc.end()
  })
}
