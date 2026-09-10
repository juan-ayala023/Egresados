// -----------------------------------------------------------------------------
// POST /api/ordenes                        -> reemplaza la funcion pagar() del front
// GET  /api/ordenes/:referencia            -> polling despues del redirect de Wompi
// POST /api/ordenes/:referencia/reenviar   -> boton "Reenviar al correo"
// -----------------------------------------------------------------------------
import { Router } from 'express'
import { config } from '../config.js'
import { errores } from '../lib/errores.js'
import { validarOrden } from '../lib/validaciones.js'
import { esReferenciaValida } from '../lib/referencia.js'
import { baseDeLaPeticion } from '../lib/urls.js'
import { asyncHandler, limitar } from '../middleware/index.js'
import {
  crearOrden, buscarPorReferencia, vistaPublica, enviarCorreoDeOrden, compradorDe,
} from '../servicios/ordenes.js'
import { despacharCorreo, despacharFactura } from '../servicios/pagos.js'
import { reconciliarPorRedirect } from '../servicios/reconciliacion.js'

export const rutasOrdenes = Router()

// Freno contra scripts: 10 intentos de compra por IP cada 10 minutos. Una
// persona normal no crea mas de dos o tres ordenes.
const limiteCrear = limitar({ maximo: config.limites.crearOrdenPor10Min, ventanaSegundos: 600 })

// El polling del front golpea esto cada 2-3 segundos; el limite tiene que ser
// generoso o el propio front se autobloquea.
const limiteConsulta = limitar({ maximo: config.limites.consultarOrdenPorMin, ventanaSegundos: 60 })

// Reenviar correo: sin limite seria un generador de spam gratuito.
const limiteReenvio = limitar({
  maximo: config.limites.reenviarPor15Min,
  ventanaSegundos: 900,
  llave: (req) => `reenvio:${req.params.referencia}`,
})

// -----------------------------------------------------------------------------
rutasOrdenes.post('/ordenes', limiteCrear, (req, res) => {
  // 1. Validar. Se repiten TODAS las reglas del front porque el cliente no es
  //    de fiar: cualquiera puede mandar este POST con curl.
  const { errores: fallas, datos } = validarOrden(req.body)
  if (datos === null) throw errores.validacion(fallas)

  // 2. Crear la orden, reservar los cupos y firmar la transaccion. Si no hay
  //    cupo, si la cedula llego a su limite o si la venta esta cerrada, esto
  //    lanza el error con el codigo que el front sabe pintar.
  const resultado = crearOrden(datos, req.ip)

  res.status(201).json(resultado)
})

// -----------------------------------------------------------------------------
rutasOrdenes.get('/ordenes/:referencia', limiteConsulta, (req, res) => {
  const { referencia } = req.params
  if (!esReferenciaValida(referencia)) throw errores.noEncontrado('La orden')

  const orden = buscarPorReferencia(referencia)
  if (!orden) throw errores.noEncontrado('La orden')

  // Los enlaces del QR y del PDF salen del mismo host por el que entro esta
  // peticion, para que sirvan igual por localhost o por el tunel.
  res.json(vistaPublica(orden, baseDeLaPeticion(req)))
})

// -----------------------------------------------------------------------------
// POST /api/ordenes/:referencia/verificar   { "idTransaccion": "..." }
//
// Lo llama el front al volver del redirect de Wompi, que trae ?id=<transaccion>.
//
// No es un atajo para "marcar como pagada": el id se usa para PREGUNTARLE a la
// pasarela, y la respuesta de la pasarela es la que manda. Mandar el id de otra
// compra no sirve de nada, se verifica que la transaccion sea de esta orden.
//
// Ademas guarda el id en la orden. Eso es lo que despues le permite al barrido
// proactivo preguntar por ella: sin id no hay a quien preguntarle.
rutasOrdenes.post('/ordenes/:referencia/verificar', limiteConsulta, asyncHandler(async (req, res) => {
  const { referencia } = req.params
  if (!esReferenciaValida(referencia)) throw errores.noEncontrado('La orden')

  const idTransaccion = String(req.body?.idTransaccion ?? req.query?.id ?? '').trim()
  // Los ids de Wompi son cortos y sin cosas raras; no se acepta cualquier texto.
  if (idTransaccion && !/^[\w-]{1,64}$/.test(idTransaccion)) {
    throw errores.validacion({ idTransaccion: 'Ese id de transaccion no tiene forma valida.' })
  }

  const r = await reconciliarPorRedirect(referencia, idTransaccion || null)
  if (!r.encontrada) throw errores.noEncontrado('La orden')

  despacharCorreo(r.correoPara)
  despacharFactura(r.correoPara)

  // Se responde la vista publica completa: el front ya la sabe pintar y se
  // ahorra una vuelta de polling.
  const orden = buscarPorReferencia(referencia)
  res.json(vistaPublica(orden, baseDeLaPeticion(req)))
}))

// -----------------------------------------------------------------------------
rutasOrdenes.post('/ordenes/:referencia/reenviar', limiteReenvio, asyncHandler(async (req, res) => {
  const { referencia } = req.params
  if (!esReferenciaValida(referencia)) throw errores.noEncontrado('La orden')

  const orden = buscarPorReferencia(referencia)
  if (!orden) throw errores.noEncontrado('La orden')
  if (orden.estado !== 'pagada') {
    throw errores.conflicto('ORDEN_NO_PAGADA', 'Esa orden todavia no tiene boletas emitidas.')
  }

  const resultado = await enviarCorreoDeOrden(orden.id)
  if (!resultado.enviado) {
    throw errores.conflicto('CORREO_NO_ENVIADO', 'No se pudo enviar el correo. Intenta de nuevo.')
  }

  const comprador = compradorDe(orden.id)
  // Se enmascara el correo: este endpoint es publico y no debe servir para
  // averiguar a que direccion pertenece una referencia.
  res.json({ enviado: true, correo: enmascarar(comprador.correo) })
}))

/** "maria@correo.com" -> "ma***@correo.com" */
function enmascarar(correo) {
  const [usuario, dominio] = String(correo).split('@')
  if (!dominio) return '***'
  return `${usuario.slice(0, 2)}***@${dominio}`
}
