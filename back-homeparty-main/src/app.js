// -----------------------------------------------------------------------------
// Armado de la aplicacion Express. Esta separado de server.js para que las
// pruebas puedan levantar la app sin abrir un puerto.
// -----------------------------------------------------------------------------
import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { registrarPeticiones, noEncontrado, manejarErrores } from './middleware/index.js'
import { rutasEvento } from './rutas/evento.js'
import { rutasBoletas } from './rutas/boletas.js'
import { rutasOrdenes } from './rutas/ordenes.js'
import { rutasWebhooks } from './rutas/webhooks.js'
import { rutasPuerta } from './rutas/puerta.js'
import { rutasAdmin } from './rutas/admin.js'
import { estadoVenta } from './servicios/aforo.js'

/**
 * Origenes que se aceptan solo mientras se prueba (nunca en produccion):
 * cualquier localhost/127.0.0.1 y los tuneles de VS Code y GitHub Codespaces.
 */
function esOrigenDeDesarrollo(origen) {
  let host
  try {
    host = new URL(origen).hostname
  } catch {
    return false
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true
  return /\.devtunnels\.ms$/.test(host) || /\.app\.github\.dev$/.test(host)
}

export function crearApp() {
  const app = express()

  // Detras de un proxy (nginx, Railway, Render...) req.ip trae la IP real solo
  // si confiamos en la cabecera X-Forwarded-For.
  //
  // CUANTOS SALTOS HAY DELANTE IMPORTA MUCHO. Los limites por IP (10 ordenes
  // por 10 minutos, etc.) se calculan con req.ip. Si el numero es menor que
  // los proxies reales, req.ip es la IP del ULTIMO proxy para todo el mundo:
  // todos los compradores caen en el mismo balde y a la undecima compra el
  // sistema le dice "demasiadas peticiones" a toda la ciudad.
  //
  // En el servidor del colegio hay dos capas: el borde que pone el HTTPS y
  // nginx. Si el borde manda X-Forwarded-For, van 2; si no, 1. Se verifica
  // mirando el log: cada peticion imprime su ip. Si dos celulares distintos
  // salen con la misma, el numero esta corto. Ver DESPLIEGUE.md.
  app.set('trust proxy', config.trustProxy)
  app.disable('x-powered-by')

  // CORS: solo los origenes de la lista blanca. En produccion va el subdominio
  // institucional (decision #10, todavia sin elegir).
  //
  // En desarrollo se aceptan ademas cualquier localhost y cualquier dev tunnel
  // (*.devtunnels.ms): durante las pruebas el front cambia de URL cada vez que
  // se reabre el tunel, y no tiene sentido reiniciar el backend por eso.
  app.use(cors({
    origin(origen, callback) {
      // Sin origen = curl, Postman o el propio webhook de Wompi.
      if (!origen) return callback(null, true)
      if (config.origenesPermitidos.includes(origen)) return callback(null, true)
      if (config.entorno !== 'production' && esOrigenDeDesarrollo(origen)) {
        return callback(null, true)
      }
      // Se responde sin las cabeceras de CORS en vez de lanzar un error: el
      // navegador bloquea la peticion igual, y no se ensucia el log del
      // servidor con un 500 por algo que no es una falla nuestra.
      console.warn(`[cors] Origen no permitido: ${origen}`)
      callback(null, false)
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  // 200 KB alcanza de sobra para 4 asistentes. Un limite bajo es la defensa mas
  // barata contra cuerpos gigantes.
  app.use(express.json({ limit: '200kb' }))

  if (config.entorno !== 'test') app.use(registrarPeticiones)

  // --- salud (para el monitoreo del hosting) ---------------------------------
  app.get('/salud', (_req, res) => {
    res.json({ ok: true, entorno: config.entorno, estadoVenta: estadoVenta() })
  })

  // --- API -------------------------------------------------------------------
  app.use('/api', rutasEvento)
  app.use('/api', rutasBoletas)
  app.use('/api', rutasOrdenes)
  app.use('/api', rutasWebhooks)
  app.use('/api', rutasPuerta)
  app.use('/api', rutasAdmin)

  // Estos dos van SIEMPRE de ultimos y en este orden.
  app.use(noEncontrado)
  app.use(manejarErrores)

  return app
}
