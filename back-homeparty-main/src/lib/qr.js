// -----------------------------------------------------------------------------
// Token del QR.
//
// Reglas que impone el BACKEND.md seccion 7:
//   - NADA de datos personales adentro. Un QR se fotografia y se comparte.
//   - Identificador opaco y FIRMADO: imposible fabricar uno valido sin la llave.
//   - Uno por asistente.
//   - Un solo uso.
//
// Formato del token:  <ULID>.<HMAC-SHA256 en base64url, 16 bytes>
// Ejemplo:            01J9XYZ...ABC.k3Jd9_2mQ1x8LpZv
//
// El ULID identifica la boleta; el HMAC prueba que lo emitimos nosotros. En la
// puerta se puede verificar la firma SIN base de datos (util si el wifi falla),
// y luego consultar el estado para saber si ya se uso.
// -----------------------------------------------------------------------------
import crypto from 'node:crypto'
import QRCode from 'qrcode'
import { ulid } from 'ulid'
import { config } from '../config.js'

const LARGO_FIRMA = 16 // bytes; 128 bits es de sobra y mantiene el QR pequeno

export const nuevoIdBoleta = () => ulid()

function firmar(idBoleta) {
  return crypto
    .createHmac('sha256', config.qrSecret)
    .update(idBoleta)
    .digest()
    .subarray(0, LARGO_FIRMA)
    .toString('base64url')
}

/** Token que se imprime dentro del QR. */
export function generarToken(idBoleta) {
  return `${idBoleta}.${firmar(idBoleta)}`
}

/**
 * Verifica la firma de un token escaneado.
 * @returns {{valido: boolean, idBoleta: string|null}}
 */
export function verificarToken(token) {
  const partes = String(token ?? '').trim().split('.')
  if (partes.length !== 2) return { valido: false, idBoleta: null }

  const [idBoleta, firmaRecibida] = partes
  const esperada = firmar(idBoleta)

  const a = Buffer.from(esperada, 'utf8')
  const b = Buffer.from(firmaRecibida, 'utf8')
  const valido = a.length === b.length && crypto.timingSafeEqual(a, b)

  return { valido, idBoleta: valido ? idBoleta : null }
}

/** PNG del QR como Buffer, para servirlo por HTTP o meterlo en el PDF. */
export function pngDelToken(token, ancho = 512) {
  return QRCode.toBuffer(token, {
    type: 'png',
    width: ancho,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  })
}

/**
 * QR como data URI (data:image/png;base64,...).
 *
 * OJO: NO SIRVE PARA CORREO. Esto se creyo durante meses y era falso -- Gmail
 * BLOQUEA las imagenes data: en el cuerpo del mensaje, asi que el QR salia
 * como cuadrito roto. Se descubrio el 10 de septiembre de 2026 mirando un
 * correo de prueba de verdad.
 *
 * El correo usa pngDelToken() de arriba y lo manda como adjunto incrustado
 * (cid:), que es lo que si se ve. Esta funcion queda para el .html que se
 * guarda en disco cuando no hay SMTP: ahi no hay adjuntos y el navegador si
 * muestra los data URI.
 */
export function dataUriDelToken(token, ancho = 320) {
  return QRCode.toDataURL(token, { width: ancho, margin: 2, errorCorrectionLevel: 'M' })
}

// URLs publicas que el front consume.
//
// "base" permite que los enlaces salgan del host por el que entro la peticion
// (ver src/lib/urls.js). Si no se pasa, se usa PUBLIC_URL.
export const urlQr = (idBoleta, base = config.urlPublica) =>
  `${base}/api/boletas/${idBoleta}/qr.png`

export const urlPdf = (idBoleta, base = config.urlPublica) =>
  `${base}/api/boletas/${idBoleta}/pdf`
