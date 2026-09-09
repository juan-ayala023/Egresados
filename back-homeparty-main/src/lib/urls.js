// -----------------------------------------------------------------------------
// De donde salen las URLs absolutas (qrUrl, pdfUrl).
//
// El problema que resuelve: durante las pruebas el mismo backend se alcanza por
// varias direcciones a la vez — http://localhost:4000 desde este PC, y una URL
// https://...devtunnels.ms desde el celular o desde el front tunelizado. Si las
// URLs salieran de una constante, la mitad de los QR apuntarian al lugar
// equivocado.
//
// Por eso se arman con el host por el que ENTRO la peticion. Cada cliente recibe
// enlaces que le sirven a el.
//
// El correo es la excepcion: se manda una vez y se lee despues, quizas en otro
// dispositivo, asi que usa PUBLIC_URL, que es una direccion estable.
// -----------------------------------------------------------------------------
import { config } from '../config.js'

/**
 * URL base segun la peticion. Detras de un tunel o un proxy, el host real viene
 * en X-Forwarded-Host y el esquema en X-Forwarded-Proto (Express ya los lee
 * porque la app tiene "trust proxy" activado).
 *
 * @param {import('express').Request} req
 * @returns {string} por ejemplo "https://abc-4000.use2.devtunnels.ms"
 */
export function baseDeLaPeticion(req) {
  const host = req?.get?.('x-forwarded-host') || req?.get?.('host')
  if (!host) return config.urlPublica

  // req.protocol ya tiene en cuenta X-Forwarded-Proto con trust proxy activado.
  const esquema = req.protocol || 'http'
  return `${esquema}://${host}`
}

/**
 * URL base estable, para lo que se lee fuera del momento de la peticion
 * (correos, PDF adjuntos). Sale de PUBLIC_URL.
 */
export const baseEstable = () => config.urlPublica
