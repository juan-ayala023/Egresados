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
import { dataUriDelToken } from './qr.js'
import { formatoLargo, formatoPesos } from './fechas.js'

// Junto a la base de datos: asi las pruebas escriben en su carpeta temporal y
// no ensucian el proyecto.
const CARPETA_CORREOS = path.join(path.dirname(config.baseDatos), 'correos')

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
 * Arma el HTML del correo. Los QR van embebidos como data URI, no como
 * adjuntos: es lo que pide el BACKEND.md y es lo que mas clientes de correo
 * muestran sin pedir permiso.
 */
async function armarHtml(orden, boletas) {
  const tarjetas = []
  for (const b of boletas) {
    const dataUri = await dataUriDelToken(b.token, 260)
    tarjetas.push(`
      <table role="presentation" width="100%" style="border:1px solid #e5e5e5;border-radius:12px;margin:0 0 16px;">
        <tr>
          <td align="center" style="padding:20px 16px 8px;">
            <img src="${dataUri}" width="200" height="200" alt="Codigo QR de la boleta" style="display:block;" />
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 16px 20px;font-family:Arial,sans-serif;">
            <div style="font-size:17px;font-weight:bold;color:#111;">${escapar(b.asistente)}</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">
              ${b.esEgresado ? `Promocion ${escapar(b.promocion)}` : 'Invitado / no egresado'}
            </div>
            <div style="font-size:11px;color:#999;margin-top:8px;">Boleta ${b.id}</div>
          </td>
        </tr>
      </table>`)
  }

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapar(config.evento.nombre)}</title>
</head>
<body style="margin:0;padding:24px;background:#f6f6f6;">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;font-family:Arial,sans-serif;color:#111;">
  <tr><td>
    <h1 style="margin:0 0 4px;font-size:24px;">Tus boletas estan listas</h1>
    <p style="margin:0 0 24px;color:#666;font-size:14px;">${escapar(config.evento.nombre)}</p>

    <table role="presentation" width="100%" style="background:#fafafa;border-radius:12px;padding:16px;margin-bottom:24px;font-size:14px;">
      <tr><td style="color:#666;padding:3px 0;">Numero de orden</td><td align="right"><b>${escapar(orden.referencia)}</b></td></tr>
      <tr><td style="color:#666;padding:3px 0;">Fecha</td><td align="right">${formatoLargo(config.evento.fecha)}</td></tr>
      <tr><td style="color:#666;padding:3px 0;">Lugar</td><td align="right">${escapar(config.evento.lugar)}</td></tr>
      <tr><td style="color:#666;padding:3px 0;">Boletas</td><td align="right">${boletas.length}</td></tr>
      <tr><td style="color:#666;padding:3px 0;">Total pagado</td><td align="right"><b>${formatoPesos(orden.total_centavos)}</b></td></tr>
    </table>

    <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">
      Hay <b>un codigo QR por asistente</b>. Cada quien puede entrar por su cuenta,
      sin depender de quien compro. Cada codigo sirve <b>una sola vez</b>.
    </p>

    ${tarjetas.join('')}

    <p style="font-size:12px;color:#888;line-height:1.6;margin:24px 0 0;border-top:1px solid #eee;padding-top:16px;">
      Guarda este correo o toma pantallazo de los codigos.
      Si algo no cuadra, escribenos a
      <a href="mailto:${escapar(config.correo.soporte)}" style="color:#A06E0E;">${escapar(config.correo.soporte)}</a>
      con tu numero de orden.
    </p>
  </td></tr>
</table>
</body></html>`
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
  let html
  try {
    html = await armarHtml(orden, boletas)
  } catch (e) {
    return { enviado: false, via: 'error', detalle: `No se pudo armar el correo: ${e.message}` }
  }

  const t = obtenerTransporte()

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
      // El PDF va tambien como adjunto por si alguien quiere imprimirlo.
      attachments: adjuntos,
    })
    return { enviado: true, via: 'smtp' }
  } catch (e) {
    console.error(`[correo] Fallo el envio a ${comprador.correo}:`, e.message)
    return { enviado: false, via: 'smtp', detalle: e.message }
  }
}
