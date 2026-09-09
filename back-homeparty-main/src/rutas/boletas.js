// -----------------------------------------------------------------------------
// GET /api/boletas                  -> precio, tarifa y disponibilidad
// GET /api/boletas/:id/qr.png       -> imagen del QR (reemplaza CodigoQR.tsx)
// GET /api/boletas/:id/pdf          -> boton "Descargar boleta"
//
// Las dos ultimas son publicas a proposito: el id de la boleta es un ULID de 26
// caracteres imposible de adivinar, y es el enlace que le llega al comprador
// por correo. Aun asi tienen rate limit para que nadie las use de fuerza bruta.
// -----------------------------------------------------------------------------
import { Router } from 'express'
import { config } from '../config.js'
import { errores } from '../lib/errores.js'
import { asyncHandler, limitar } from '../middleware/index.js'
import { estadoVenta, disponibilidad } from '../servicios/aforo.js'
import { buscarBoleta } from '../servicios/boletas.js'
import { pngDelToken } from '../lib/qr.js'
import { pdfDeBoleta } from '../lib/pdf.js'

export const rutasBoletas = Router()

// --- catalogo ---------------------------------------------------------------
rutasBoletas.get('/boletas', (_req, res) => {
  const estado = estadoVenta()
  const d = disponibilidad()

  const boleta = {
    id: config.boleta.id,
    nombre: config.boleta.nombre,
    precioCentavos: config.boleta.precioCentavos,
    tarifaServicioCentavos: config.boleta.tarifaCentavos,
    totalCentavos: config.boleta.totalCentavos,
    maxPorCompra: config.boleta.maxPorCompra,
    // DECISION #5: por defecto solo un booleano, sin revelar el conteo.
    disponible: estado === 'abierta',
  }

  if (config.mostrarCuposRestantes) {
    boleta.disponibles = d.disponibles
    boleta.vendidas = d.vendidas
    boleta.aforo = d.aforo
  }

  res.json({ estadoVenta: estado, boletas: [boleta] })
})

// --- imagen del QR ----------------------------------------------------------
const limiteArchivos = limitar({ maximo: config.limites.archivosPorMin, ventanaSegundos: 60 })

rutasBoletas.get('/boletas/:id/qr.png', limiteArchivos, asyncHandler(async (req, res) => {
  const b = buscarBoleta(req.params.id)
  if (!b || b.estado_orden !== 'pagada') throw errores.noEncontrado('La boleta')
  if (b.estado === 'anulada') throw errores.noEncontrado('La boleta')

  const png = await pngDelToken(b.token_firmado)
  res.type('image/png')
  // Privado: que no lo cachee ningun proxy compartido.
  res.set('Cache-Control', 'private, max-age=3600')
  res.send(png)
}))

// --- PDF --------------------------------------------------------------------
rutasBoletas.get('/boletas/:id/pdf', limiteArchivos, asyncHandler(async (req, res) => {
  const b = buscarBoleta(req.params.id)
  if (!b || b.estado_orden !== 'pagada') throw errores.noEncontrado('La boleta')
  if (b.estado === 'anulada') throw errores.noEncontrado('La boleta')

  const pdf = await pdfDeBoleta({
    id: b.id,
    token: b.token_firmado,
    asistente: b.asistente_nombre,
    promocion: b.promocion,
    esEgresado: b.es_egresado === 1,
    referencia: b.referencia,
  })

  res.type('application/pdf')
  res.set('Content-Disposition', `attachment; filename="boleta-${b.referencia}-${b.id.slice(-6)}.pdf"`)
  res.send(pdf)
}))
