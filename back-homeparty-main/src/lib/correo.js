// -----------------------------------------------------------------------------
// Envio del correo de confirmacion con las boletas.
//
// Si no hay SMTP configurado (desarrollo), NO falla: escribe el correo en
// datos/correos/ como archivo .html que se puede abrir en el navegador, y lo
// anuncia en consola. Asi se puede probar el flujo completo sin credenciales.
//
// Recordatorio del BACKEND.md seccion 1: el dominio del remitente necesita
// SPF y DKIM o los correos con QR se van derecho a spam.
// -----------------------------------------------------------------------------
import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { config } from '../config.js'
import { fileURLToPath } from 'node:url'
import { dataUriDelToken, pngDelToken } from './qr.js'
import { formatoLargo, formatoPesos } from './fechas.js'

// Junto a la base de datos: asi las pruebas escriben en su carpeta temporal y
// no ensucian el proyecto.
const CARPETA_CORREOS = path.join(path.dirname(config.baseDatos), 'correos')

// El banner que abre el correo. Vive junto a este archivo y no en el public/
// del front: el correo tiene que armarse aunque el sitio este caido, y una
// imagen enlazada por URL no se ve si el cliente bloquea remotas (Outlook lo
// hace por defecto). Va incrustada, igual que los QR.
const ENCABEZADO = path.join(path.dirname(fileURLToPath(import.meta.url)), 'correo-encabezado.png')

// Colores del manual de marca. En correo no hay variables CSS: van a mano.
const NAVY = '#004990'
const ORO = '#C88A12'
const ORO_OSCURO = '#A06E0E'

// El transporte se cachea, pero indexado por el host con el que se creo. Antes
// se cacheaba a secas: si la configuracion cambiaba, se seguia usando el
// transporte viejo para siempre.
let transporte = null
let hostDelTransporte = null

function obtenerTransporte() {
  if (transporte && hostDelTransporte === config.correo.host) return transporte
  if (!config.correo.host) {
    transporte = null
    hostDelTransporte = null
    return null
  }
  transporte = nodemailer.createTransport({
    host: config.correo.host,
    port: config.correo.puerto,
    secure: config.correo.puerto === 465,
    auth: config.correo.usuario ? { user: config.correo.usuario, pass: config.correo.clave } : undefined,
  })
  hostDelTransporte = config.correo.host
  return transporte
}

/**
 * Arma el correo: el HTML y las imagenes que van incrustadas con el.
 *
 * LOS QR VAN COMO ADJUNTO INCRUSTADO (cid:), NO COMO data: URI.
 *
 * Iban como data URI y en Gmail salia el cuadrito roto: Gmail BLOQUEA las
 * imagenes data: en el cuerpo del correo. O sea que el codigo con el que la
 * persona entra a la fiesta no se veia -- quedaba solo dentro del PDF
 * adjunto, que mucha gente no abre desde el celular.
 *
 * Con cid: la imagen viaja dentro del mensaje, se ve sin conexion y sin que
 * el cliente pida permiso, y no depende de que el servidor este arriba.
 *
 * @param {boolean} paraArchivo  en desarrollo el correo se guarda como .html
 *   suelto y ahi no hay adjuntos que valgan: para ESE caso se vuelve a los
 *   data URI, que es lo unico que se ve al abrirlo en el navegador.
 * @returns {Promise<{html:string, imagenes:Array}>}
 */
async function armarCorreo(orden, boletas, { paraArchivo = false } = {}) {
  const imagenes = []

  // --- Banner de apertura ---
  let srcEncabezado = null
  try {
    if (paraArchivo) {
      srcEncabezado = `data:image/png;base64,${fs.readFileSync(ENCABEZADO).toString('base64')}`
    } else {
      imagenes.push({ filename: 'homecoming.png', path: ENCABEZADO, cid: 'encabezado' })
      srcEncabezado = 'cid:encabezado'
    }
  } catch (e) {
    // Que falte el banner no puede costar el correo: la boleta importa mas.
    console.error('[correo] No se pudo cargar el encabezado:', e.message)
  }

  // --- Una tarjeta por asistente, con su QR ---
  const tarjetas = []
  for (const [i, b] of boletas.entries()) {
    let src
    if (paraArchivo) {
      src = await dataUriDelToken(b.token, 260)
    } else {
      const cid = `qr-${i}`
      imagenes.push({
        filename: `qr-${b.id.slice(-6)}.png`,
        content: await pngDelToken(b.token, 520),
        cid,
      })
      src = `cid:${cid}`
    }

    tarjetas.push(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6;border-radius:14px;margin:0 0 14px;background:#ffffff;">
        <tr>
          <td align="center" style="padding:24px 16px 10px;">
            <img src="${src}" width="210" height="210" alt="Codigo QR de la boleta de ${escapar(b.asistente)}" style="display:block;border:0;" />
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 16px 22px;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:17px;font-weight:bold;color:${NAVY};">${escapar(b.asistente)}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:5px;">
              ${b.esEgresado ? `Promoción ${escapar(b.promocion)}` : 'Invitado / no egresado'}
            </div>
            <div style="font-size:11px;color:#9ca3af;margin-top:10px;letter-spacing:0.4px;">Boleta ${b.id}</div>
          </td>
        </tr>
      </table>`)
  }

  const fila = (etiqueta, valor, destacado = false) => `
      <tr>
        <td style="color:#6b7280;padding:6px 0;font-size:14px;">${etiqueta}</td>
        <td align="right" style="padding:6px 0;font-size:14px;color:${destacado ? NAVY : '#374151'};${destacado ? 'font-weight:bold;' : ''}">${valor}</td>
      </tr>`

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapar(config.evento.nombre)}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">

    ${srcEncabezado ? `
    <tr>
      <td style="background:${NAVY};line-height:0;">
        <img src="${srcEncabezado}" width="600" alt="${escapar(config.evento.nombre)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
      </td>
    </tr>` : ''}

    <tr><td style="padding:32px 30px 0;">

      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#374151;">
        ¡Qué emoción tenerte de vuelta en casa! Han sido 80 años de historias, risas y
        momentos inolvidables, y esta celebración no estaría completa sin ti. Prepárate
        para reencontrarte con tus amigos TCS y revivir los mejores recuerdos.
      </p>

      <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:${NAVY};font-weight:bold;">
        Te enviamos el código QR con tu boleta para que puedas ingresar a esta gran fiesta.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;border-radius:12px;margin:0 0 26px;">
        <tr><td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${fila('Número de orden', `<b style="color:${NAVY};">${escapar(orden.referencia)}</b>`)}
            ${fila('Fecha', formatoLargo(config.evento.fecha))}
            ${fila('Lugar', escapar(config.evento.lugar))}
            ${fila('Boletas', String(boletas.length))}
            ${fila('Total pagado', formatoPesos(orden.total_centavos), true)}
          </table>
        </td></tr>
      </table>

      <p style="font-size:14px;line-height:1.65;margin:0 0 18px;color:#374151;">
        Hay <b>un código QR por asistente</b>. Cada quien puede entrar por su cuenta,
        sin depender de quien compró. Cada código sirve <b>una sola vez</b>.
      </p>

      ${tarjetas.join('')}

      <p style="font-size:12.5px;color:#6b7280;line-height:1.65;margin:22px 0 0;border-top:1px solid #eceff3;padding-top:18px;">
        Guarda este correo o toma pantallazo de los códigos. También los adjuntamos en PDF
        por si prefieres imprimirlos. Si algo no cuadra, escríbenos a
        <a href="mailto:${escapar(config.correo.soporte)}" style="color:${ORO_OSCURO};font-weight:bold;">${escapar(config.correo.soporte)}</a>
        con tu número de orden.
      </p>

    </td></tr>

    <tr>
      <td style="padding:26px 30px 28px;text-align:center;">
        <div style="border-top:3px solid ${ORO};width:44px;margin:0 auto 16px;font-size:0;line-height:0;">&nbsp;</div>
        <div style="font-size:11.5px;letter-spacing:1.6px;text-transform:uppercase;color:${NAVY};font-weight:bold;">
          ${escapar(config.evento.lugar)}
        </div>
      </td>
    </tr>

  </table>

  </td></tr>
</table>
</body></html>`

  return { html, imagenes }
}

const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * Envia el correo con las boletas. Nunca lanza: si el envio falla, lo reporta
 * y devuelve { enviado: false }. Un fallo de SMTP no puede tumbar el webhook,
 * porque Wompi lo reintentaria y el pago ya esta hecho.
 *
 * @returns {Promise<{enviado: boolean, via: string, detalle?: string}>}
 */
export async function enviarBoletas(orden, comprador, boletas, adjuntos = []) {
  const asunto = `Tus boletas - ${config.evento.nombre} (${orden.referencia})`
  const t = obtenerTransporte()

  // Sin SMTP el correo se guarda como .html suelto, y ahi los cid: no existen:
  // se arma con data URI para que se vea al abrirlo en el navegador.
  let html, imagenes
  try {
    ({ html, imagenes } = await armarCorreo(orden, boletas, { paraArchivo: !t }))
  } catch (e) {
    return { enviado: false, via: 'error', detalle: `No se pudo armar el correo: ${e.message}` }
  }

  // --- modo desarrollo: guardar en disco -------------------------------------
  if (!t) {
    try {
      fs.mkdirSync(CARPETA_CORREOS, { recursive: true })
      const archivo = path.join(CARPETA_CORREOS, `${orden.referencia}.html`)
      fs.writeFileSync(archivo, html, 'utf8')
      console.log(`[correo] SMTP no configurado. Correo guardado en ${archivo}`)
      return { enviado: true, via: 'archivo', detalle: archivo }
    } catch (e) {
      return { enviado: false, via: 'archivo', detalle: e.message }
    }
  }

  // --- envio real ------------------------------------------------------------
  try {
    await t.sendMail({
      from: config.correo.remitente,
      to: comprador.correo,
      subject: asunto,
      html,
      // Gmail ofrecia "traducir del ingles": adivinaba el idioma y le erraba,
      // sobre todo cuando el nombre del evento iba sin enie. Decirselo quita
      // la banda amarilla de traduccion, que en un correo con la boleta se ve
      // como si el mensaje fuera sospechoso.
      headers: { 'Content-Language': 'es-CO' },
      // Dos clases de adjunto en la misma lista:
      //   - `imagenes`: el banner y los QR, incrustados con cid: y referenciados
      //     desde el HTML. No se ven como archivos sueltos.
      //   - `adjuntos`: los PDF de cada boleta, para quien quiera imprimirlos.
      attachments: [...imagenes, ...adjuntos],
    })
    return { enviado: true, via: 'smtp' }
  } catch (e) {
    console.error(`[correo] Fallo el envio a ${comprador.correo}:`, e.message)
    return { enviado: false, via: 'smtp', detalle: e.message }
  }
}
