// -----------------------------------------------------------------------------
// Middlewares. Son pocos y cortos a proposito.
// -----------------------------------------------------------------------------
import crypto from 'node:crypto'
import { config } from '../config.js'
import { ErrorApi, errores } from '../lib/errores.js'
import { ahora } from '../lib/fechas.js'

/**
 * Envuelve un handler async para que sus errores lleguen al manejador de
 * errores de Express. Sin esto, un "throw" dentro de un async se pierde y la
 * peticion se queda colgada.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

/**
 * Compara dos tokens sin que el tiempo de respuesta delate cuantas letras
 * acertaron. `===` compara letra por letra y se detiene en la primera
 * distinta; con miles de intentos medidos, eso se convierte en una pista.
 * timingSafeEqual tarda lo mismo acierte o no.
 */
function tokenCoincide(recibido, esperado) {
  if (!recibido || !esperado) return false
  const a = Buffer.from(String(recibido))
  const b = Buffer.from(String(esperado))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Intentos fallidos de entrar al panel, por IP. Un token de 32 letras al azar
// no se adivina ni en un millon de anos, asi que esto no es contra un ataque
// que pueda funcionar: es para que un escaner o un curioso no pueda martillar
// el /admin miles de veces sin que nadie se entere, y para que cada fallo
// quede en el log con su IP.
const FALLOS_MAXIMOS = 10
const VENTANA_FALLOS_MS = 15 * 60_000
const fallosPorIp = new Map()

const limpiezaFallos = setInterval(() => {
  const corte = Date.now() - VENTANA_FALLOS_MS
  for (const [ip, tiempos] of fallosPorIp) {
    const vivos = tiempos.filter((t) => t > corte)
    if (vivos.length === 0) fallosPorIp.delete(ip)
    else fallosPorIp.set(ip, vivos)
  }
}, 60_000)
limpiezaFallos.unref?.()

/**
 * Exige "Authorization: Bearer <token>".
 * @param {'admin'|'puerta'} rol
 */
export function exigirToken(rol) {
  return (req, _res, next) => {
    const ip = req.ip
    const corte = Date.now() - VENTANA_FALLOS_MS
    const fallos = (fallosPorIp.get(ip) ?? []).filter((t) => t > corte)

    if (fallos.length >= FALLOS_MAXIMOS) {
      const esperar = Math.ceil((fallos[0] + VENTANA_FALLOS_MS - Date.now()) / 1000)
      return next(errores.demasiadasPeticiones(Math.max(60, esperar)))
    }

    const header = req.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    // El personal de puerta usa su token; el admin puede entrar a todo.
    const permitidos = rol === 'puerta'
      ? [config.tokens.puerta, config.tokens.admin]
      : [config.tokens.admin]

    const valido = permitidos.some((esperado) => tokenCoincide(token, esperado))
    if (!valido) {
      fallos.push(Date.now())
      fallosPorIp.set(ip, fallos)
      console.warn(`[auth] token invalido para ${rol} desde ${ip} (${fallos.length}/${FALLOS_MAXIMOS}) ${req.method} ${req.originalUrl}`)
      return next(errores.noAutorizado())
    }

    fallosPorIp.delete(ip)
    req.actor = rol
    next()
  }
}

/**
 * Limitador de peticiones en memoria: ventana deslizante por llave.
 *
 * Es suficiente para un backend de un solo proceso como este. Si algun dia
 * corre en varias instancias, hay que moverlo a Redis o al proxy de adelante.
 */
export function limitar({ maximo, ventanaSegundos, llave }) {
  const registros = new Map()

  // Limpieza periodica para que el Map no crezca sin fin.
  const limpieza = setInterval(() => {
    const corte = Date.now() - ventanaSegundos * 1000
    for (const [k, tiempos] of registros) {
      const vivos = tiempos.filter((t) => t > corte)
      if (vivos.length === 0) registros.delete(k)
      else registros.set(k, vivos)
    }
  }, 60_000)
  limpieza.unref?.()

  return (req, _res, next) => {
    const k = llave ? llave(req) : req.ip
    const ahoraMs = Date.now()
    const corte = ahoraMs - ventanaSegundos * 1000
    const tiempos = (registros.get(k) ?? []).filter((t) => t > corte)

    if (tiempos.length >= maximo) {
      const esperar = Math.ceil((tiempos[0] + ventanaSegundos * 1000 - ahoraMs) / 1000)
      return next(errores.demasiadasPeticiones(Math.max(1, esperar)))
    }

    tiempos.push(ahoraMs)
    registros.set(k, tiempos)
    next()
  }
}

// Se recuerda el ultimo host por el que entro una peticion para anunciarlo una
// sola vez. Cuando el backend se expone por un tunel, esta linea es la forma
// mas rapida de enterarse de cual es su URL publica.
const hostsVistos = new Set()

/** Una linea por peticion. Sin dependencias. */
export function registrarPeticiones(req, res, next) {
  const inicio = Date.now()

  const host = req.get('x-forwarded-host') || req.get('host')
  if (host && !hostsVistos.has(host)) {
    hostsVistos.add(host)
    console.log(`[host] Primera peticion por ${req.protocol}://${host}`)
  }

  res.on('finish', () => {
    const origen = req.get('origin')
    // La ip va en el log a proposito: es la unica forma de comprobar en
    // produccion que TRUST_PROXY esta bien y que cada comprador cuenta como
    // uno y no todos como el mismo.
    console.log(
      `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms)`
      + `  ip=${req.ip}` + (origen ? `  origin=${origen}` : ''),
    )
  })
  next()
}

/** 404 para rutas que no existen. */
export function noEncontrado(req, _res, next) {
  next(errores.noEncontrado(`La ruta ${req.method} ${req.path}`))
}

/**
 * Manejador de errores. Va SIEMPRE de ultimo en la cadena de Express y tiene
 * que recibir cuatro argumentos, aunque "next" no se use.
 */
export function manejarErrores(err, req, res, _next) {
  if (err instanceof ErrorApi) {
    return res.status(err.status).json(err.aJson())
  }

  // JSON mal formado que express.json() rechaza.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la peticion no es JSON valido.' },
    })
  }

  // Cualquier otra cosa es un bug nuestro: se registra completo y se le
  // responde al usuario algo generico, sin filtrar detalles internos.
  console.error(`[${ahora()}] Error no controlado en ${req.method} ${req.originalUrl}:`, err)
  res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Algo se rompio de nuestro lado. Intenta de nuevo.' },
  })
}
