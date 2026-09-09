// -----------------------------------------------------------------------------
// Control de ingreso la noche del evento. Todo requiere token de puerta:
//
//   Authorization: Bearer <PUERTA_TOKEN>
//
// POST /api/puerta/validar       -> escaneo en linea
// GET  /api/puerta/tokens        -> lista para trabajar SIN conexion
// POST /api/puerta/sincronizar   -> subir los escaneos hechos sin conexion
// GET  /api/puerta/estado        -> cuantos han entrado
// -----------------------------------------------------------------------------
import { Router } from 'express'
import { exigirToken } from '../middleware/index.js'
import {
  validarEnPuerta, tokensParaOffline, sincronizarEscaneos, conteoPuerta,
} from '../servicios/boletas.js'

export const rutasPuerta = Router()

rutasPuerta.use('/puerta', exigirToken('puerta'))

// -----------------------------------------------------------------------------
// Marca la boleta como usada en la MISMA operacion en que la valida. No hay un
// "consultar" separado a proposito: entre consultar y marcar cabria un segundo
// escaneo del mismo codigo.
rutasPuerta.post('/puerta/validar', (req, res) => {
  const { token, puerta, operador } = req.body ?? {}
  const { status, cuerpo } = validarEnPuerta(token, { puerta, operador })
  res.status(status).json(cuerpo)
})

// -----------------------------------------------------------------------------
// BACKEND.md seccion 7: si el wifi del sitio falla esa noche, la validacion en
// linea se cae con el. Se descarga esta lista ANTES del evento y la app de
// puerta verifica firmas sin conexion.
rutasPuerta.get('/puerta/tokens', (_req, res) => {
  const boletas = tokensParaOffline()
  res.json({ generadoEn: new Date().toISOString(), total: boletas.length, boletas })
})

// -----------------------------------------------------------------------------
// Sube en lote lo escaneado sin conexion. Cada escaneo pasa por la misma
// validacion que en linea, asi que los duplicados salen reportados como
// YA_USADA en vez de colarse.
rutasPuerta.post('/puerta/sincronizar', (req, res) => {
  const escaneos = Array.isArray(req.body?.escaneos) ? req.body.escaneos : []
  const resultados = sincronizarEscaneos(escaneos)
  const cuenta = (r) => resultados.filter((x) => x.resultado === r).length
  res.json({
    procesados: resultados.length,
    validas: cuenta('VALIDA'),
    yaUsadas: cuenta('YA_USADA'),
    invalidas: cuenta('INVALIDA'),
    resultados,
  })
})

// -----------------------------------------------------------------------------
rutasPuerta.get('/puerta/estado', (_req, res) => {
  const c = conteoPuerta()
  res.json({ emitidas: c.emitidas, ingresadas: c.ingresadas, faltantes: c.emitidas - c.ingresadas })
})
