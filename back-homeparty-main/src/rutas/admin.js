// -----------------------------------------------------------------------------
// Panel administrativo. Todo requiere token de admin:
//
//   Authorization: Bearer <ADMIN_TOKEN>
//
// GET  /api/admin/aforo                          -> vendidas, reservadas, disponibles
// GET  /api/admin/ordenes?buscar=...             -> por cedula, correo, referencia o nombre
// GET  /api/admin/ordenes/:referencia            -> ficha completa de una orden
// GET  /api/admin/ordenes.csv?estado=pagada      -> reporte para el comite
// POST /api/admin/ordenes/:referencia/reenviar   -> reenviar boletas
// POST /api/admin/ordenes/:referencia/anular     -> devolucion: libera los cupos
// POST /api/admin/boletas/:id/anular             -> anular una sola boleta
// POST /api/admin/boletas/:id/reemitir           -> transferir a otra persona
// GET  /api/admin/ingresos                       -> quien ha entrado esta noche
// -----------------------------------------------------------------------------
import { Router } from 'express'
import { db, enTransaccion } from '../db/index.js'
import { config } from '../config.js'
import { errores } from '../lib/errores.js'
import { ahora } from '../lib/fechas.js'
import { baseDeLaPeticion } from '../lib/urls.js'
import { asyncHandler, exigirToken } from '../middleware/index.js'
import { disponibilidad, estadoVenta, liberarReserva } from '../servicios/aforo.js'
import {
  buscarPorReferencia, boletasDeOrden, compradorDe, asistentesDe, enviarCorreoDeOrden,
} from '../servicios/ordenes.js'
import {
  anularBoleta, reemitirBoleta, ingresosEscaneados, conteoPuerta, tokensParaOffline,
} from '../servicios/boletas.js'
import {
  buscarOrdenes, ultimasVentas, resumenEstados, ordenesEnCsv, boletasParaLectorEnCsv,
  registrarAuditoria,
} from '../servicios/reportes.js'
import { alertas, atenderAlerta, reabrirAlerta } from '../servicios/alertas.js'

export const rutasAdmin = Router()

rutasAdmin.use('/admin', exigirToken('admin'))

const anularOrden = db.prepare(`
  UPDATE orden SET estado = 'anulada', cerrada_en = ?, motivo_cierre = ?
   WHERE id = ? AND estado IN ('pendiente','pagada')`)
const anularBoletasDeOrden = db.prepare(`
  UPDATE boleta SET estado = 'anulada', anulada_en = ?, motivo_anulacion = ?
   WHERE orden_id = ? AND estado = 'emitida'`)

// -----------------------------------------------------------------------------
// Aforo en tiempo real. El sitio publico no lo muestra (decision #5), pero el
// comite si necesita verlo.
rutasAdmin.get('/admin/aforo', (_req, res) => {
  res.json({
    ...disponibilidad(),
    estadoVenta: estadoVenta(),
    porEstado: resumenEstados(),
    puerta: conteoPuerta(),
  })
})

// -----------------------------------------------------------------------------
// Lo que se rompio y necesita que alguien haga algo.
//
// Es la pantalla que hay que mirar cada dia mientras la venta este abierta, y
// la primera que hay que mirar la noche del evento. Cada alerta trae la accion
// concreta, para no tener que adivinarla.
rutasAdmin.get('/admin/alertas', (_req, res) => {
  res.json(alertas())
})

// -----------------------------------------------------------------------------
// POST /api/admin/alertas/atender     { tipo, referencia, nota }
// POST /api/admin/alertas/reabrir     { tipo, referencia }
//
// Marcar una alerta como atendida la esconde del panel. NO arregla el problema
// ni toca la orden: es una anotacion de "ya me hice cargo".
//
// Existe porque las alertas se calculan de los datos y, sin esto, una que ya
// se resolvio por fuera (se devolvio la plata, se hablo con la persona) se
// queda para siempre. Un tablero que solo crece deja de mirarse, y entonces la
// alerta que de verdad importa se pierde entre las viejas.
//
// Queda en auditoria con quien y cuando, para poder revisarlo despues.
rutasAdmin.post('/admin/alertas/atender', (req, res) => {
  const { tipo, referencia, nota } = req.body ?? {}
  if (!tipo) throw errores.validacion({ tipo: 'Falta el tipo de alerta.' })

  const r = atenderAlerta(tipo, referencia, { por: 'admin', nota: nota ?? null })
  registrarAuditoria('admin', 'alerta_atendida', { tipo, referencia, nota: nota ?? null })
  res.json(r)
})

rutasAdmin.post('/admin/alertas/reabrir', (req, res) => {
  const { tipo, referencia } = req.body ?? {}
  if (!tipo) throw errores.validacion({ tipo: 'Falta el tipo de alerta.' })

  const r = reabrirAlerta(tipo, referencia)
  registrarAuditoria('admin', 'alerta_reabierta', { tipo, referencia })
  res.json(r)
})

// -----------------------------------------------------------------------------
// Buscar una orden para atender a quien no recibio el correo.
rutasAdmin.get('/admin/ordenes', (req, res) => {
  const texto = req.query.buscar
  if (!texto || String(texto).trim().length < 3) {
    throw errores.validacion({ buscar: 'Escribe al menos 3 caracteres.' })
  }
  const resultados = buscarOrdenes(texto)
  res.json({ total: resultados.length, ordenes: resultados })
})

// -----------------------------------------------------------------------------
// Ficha completa: aqui SI viajan todos los datos personales, porque este
// endpoint esta detras del token de admin.
rutasAdmin.get('/admin/ordenes/:referencia', (req, res) => {
  const orden = buscarPorReferencia(req.params.referencia)
  if (!orden) throw errores.noEncontrado('La orden')

  res.json({
    orden,
    comprador: compradorDe(orden.id),
    asistentes: asistentesDe(orden.id),
    boletas: boletasDeOrden(orden.id, baseDeLaPeticion(req)),
  })
})

// -----------------------------------------------------------------------------
// GET /api/admin/ventas?limite=25
//
// Las ultimas ventas pagadas, para la tabla del panel.
//
// El panel solo tenia buscador, y para buscar hay que saber a quien: el comite
// entraba a ver como iba la venta y no veia ni una. Esto es lo que llena esa
// tabla.
rutasAdmin.get('/admin/ventas', (req, res) => {
  const ventas = ultimasVentas(req.query.limite)
  res.json({ total: ventas.length, ventas })
})

// -----------------------------------------------------------------------------
// Reporte completo en CSV. Se abre directo en Excel.
rutasAdmin.get('/admin/ordenes.csv', (req, res) => {
  const estado = String(req.query.estado ?? 'pagada')
  const permitidos = ['todas', 'pendiente', 'pagada', 'rechazada', 'expirada', 'anulada']
  if (!permitidos.includes(estado)) {
    throw errores.validacion({ estado: `Usa uno de: ${permitidos.join(', ')}` })
  }

  const csv = ordenesEnCsv(estado)
  const fecha = new Date().toISOString().slice(0, 10)
  res.type('text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="ordenes-${estado}-${fecha}.csv"`)
  res.send(csv)
})

// -----------------------------------------------------------------------------
// GET /api/admin/puerta.csv
//
// La lista que pide el proveedor del lector de la puerta: las boletas validas
// con el codigo que llevan impreso en el QR, para que su sistema cruce contra
// ella cuando escanee con la pistola.
//
// TRES COSAS QUE HAY QUE DECIRLE A QUIEN LO USE:
//
//   1. `codigo_qr` es EXACTAMENTE lo que lee la pistola. Su sistema tiene que
//      comparar contra esa columna y no contra la cedula ni el nombre.
//   2. Es una FOTO del momento en que se descarga. Quien compre despues no
//      esta en el archivo, asi que hay que volver a bajarlo lo mas tarde
//      posible antes del evento.
//   3. El proveedor CONFIRMO (9-sep-2026) que su sistema verifica y marca como
//      usada en la misma lectura, asi que el reingreso queda controlado de su
//      lado. Confirmo tambien que sus lectores leen 2D, y que borran los datos
//      personales cuando el colegio apruebe el informe del evento.
//
//      LO QUE SIGUE SIN RESOLVERSE es la sincronizacion: mientras la venta
//      siga abierta, cada boleta vendida despues del ultimo envio es alguien
//      con una boleta valida que su sistema no reconoce. Por eso el parametro
//      `desde`, y por eso conviene mas conectar sus lectores USB a nuestra
//      pantalla /puerta: ahi no hay envio que sincronizar.
rutasAdmin.get('/admin/puerta.csv', (req, res) => {
  /* ?desde=2026-11-10 trae SOLO lo vendido despues de esa fecha.
     El proveedor pidio el archivo antes del evento y luego los registros
     nuevos que vayan saliendo. Sin esto habria que mandarles la lista entera
     cada vez y que ellos adivinen cual es nueva; en una lista de 500 con
     reenvios diarios, ahi es donde se cuela un duplicado o se pierde una
     boleta. Sin el parametro sale todo, que es el primer envio. */
  const desde = req.query.desde ? String(req.query.desde) : null
  if (desde && Number.isNaN(Date.parse(desde))) {
    throw errores.validacion({ desde: 'Fecha no valida. Usa 2026-11-10.' })
  }

  const filas = tokensParaOffline(desde)
  const fecha = new Date().toISOString().slice(0, 10)
  const nombre = desde
    ? `boletas-nuevas-desde-${desde.slice(0, 10)}-al-${fecha}.csv`
    : `boletas-para-lector-${fecha}.csv`

  res.type('text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="${nombre}"`)
  res.send(boletasParaLectorEnCsv(filas))
})

// -----------------------------------------------------------------------------
rutasAdmin.post('/admin/ordenes/:referencia/reenviar', asyncHandler(async (req, res) => {
  const orden = buscarPorReferencia(req.params.referencia)
  if (!orden) throw errores.noEncontrado('La orden')
  if (orden.estado !== 'pagada') {
    throw errores.conflicto('ORDEN_NO_PAGADA', 'Esa orden no tiene boletas emitidas.')
  }

  const resultado = await enviarCorreoDeOrden(orden.id)
  registrarAuditoria('admin', 'reenviar_boletas', { referencia: orden.referencia, ...resultado })
  res.json(resultado)
}))

// -----------------------------------------------------------------------------
// Anular una orden completa (devolucion). Devuelve los cupos al inventario y
// anula todas sus boletas, para que ninguna sirva en la puerta.
//
// OJO: esto NO devuelve la plata. La devolucion se hace desde el panel de Wompi
// o por transferencia, segun la politica de reembolsos (decision #7, sin
// confirmar por el colegio).
rutasAdmin.post('/admin/ordenes/:referencia/anular', (req, res) => {
  const orden = buscarPorReferencia(req.params.referencia)
  if (!orden) throw errores.noEncontrado('La orden')
  if (!['pendiente', 'pagada'].includes(orden.estado)) {
    throw errores.conflicto('ORDEN_NO_ANULABLE', `Una orden ${orden.estado} no se puede anular.`)
  }

  const motivo = String(req.body?.motivo ?? '').trim() || 'Anulada por el comite'

  enTransaccion(() => {
    anularOrden.run(ahora(), motivo, orden.id)
    anularBoletasDeOrden.run(ahora(), motivo, orden.id)
    liberarReserva(orden.id)
  })

  registrarAuditoria('admin', 'anular_orden', { referencia: orden.referencia, motivo })
  res.json({ anulada: true, referencia: orden.referencia, motivo, cuposLiberados: orden.cantidad })
})

// -----------------------------------------------------------------------------
rutasAdmin.post('/admin/boletas/:id/anular', (req, res) => {
  const motivo = String(req.body?.motivo ?? '').trim()
  const r = anularBoleta(req.params.id, motivo)
  if (!r.ok) throw errores.conflicto('BOLETA_NO_ANULABLE', r.motivo)

  registrarAuditoria('admin', 'anular_boleta', { boletaId: req.params.id, motivo })
  res.json({ anulada: true, boletaId: req.params.id })
})

// -----------------------------------------------------------------------------
// Transferir una boleta a otra persona. Emite un token nuevo y mata el viejo:
// el QR que ya circulaba deja de servir en ese instante.
rutasAdmin.post('/admin/boletas/:id/reemitir', (req, res) => {
  const { nombre, cedula, promocion, motivo } = req.body ?? {}
  const r = reemitirBoleta(req.params.id, { nombre, cedula, promocion, motivo }, baseDeLaPeticion(req))
  if (!r.ok) throw errores.conflicto('BOLETA_NO_REEMITIBLE', r.motivo)

  registrarAuditoria('admin', 'reemitir_boleta', { anterior: req.params.id, nueva: r.boleta.id, nombre })
  res.json({ reemitida: true, anterior: req.params.id, boleta: r.boleta })
})

// -----------------------------------------------------------------------------
rutasAdmin.get('/admin/ingresos', (_req, res) => {
  const ingresos = ingresosEscaneados()
  res.json({ total: ingresos.length, ...conteoPuerta(), ingresos })
})

// -----------------------------------------------------------------------------
// Espejo de la configuracion vigente. Sirve para verificar de un vistazo con
// que tarifa y que decisiones esta corriendo el servidor.
rutasAdmin.get('/admin/configuracion', (_req, res) => {
  res.json({
    evento: config.evento,
    boleta: config.boleta,
    reservaMinutos: config.reservaMinutos,
    mostrarCuposRestantes: config.mostrarCuposRestantes,
    datosAsistente: config.datosAsistente,
    exigirDireccionFacturacion: config.exigirDireccionFacturacion,
    wompi: {
      publicKey: config.wompi.publicKey,
      redirectUrl: config.wompi.redirectUrl,
      simulacion: config.wompi.simulacion,
      // Los secretos NUNCA se exponen, ni siquiera al admin.
    },
    correoConfigurado: Boolean(config.correo.host),
  })
})
