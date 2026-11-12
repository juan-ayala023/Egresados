// -----------------------------------------------------------------------------
// MANDARLE UN AVISO A LOS INVITADOS ESPECIALES (las cortesias).
//
//   npm run aviso                      muestra a quien le llegaria
//   npm run aviso -- --enviar          lo manda
//   npm run aviso -- --enviar --otra-vez   se lo manda tambien a quien ya lo recibio
//
// Para que existe (12 de noviembre de 2026, dos dias antes del evento):
// mercadeo preparo la pieza "Tiger Tips" -- hora de entrada, documento,
// abrigo, nada de comida de afuera, no manejar si toma, medios de pago -- y
// pidio mandarsela a todos los invitados del colegio, que son los unicos que
// no pasaron por el checkout y por tanto nunca vieron esa informacion.
//
// NO SE REPITE: quien ya lo recibio queda anotado en la auditoria y en la
// siguiente corrida se salta. Para reenviarselo a todos, --otra-vez. Esto
// importa porque es un correo de marketing, no una boleta: llegar dos veces
// molesta de verdad.
//
// LA IMAGEN VA INCRUSTADA (cid:), NO COMO data: URI ni como adjunto suelto.
// Gmail BLOQUEA las imagenes data: en el cuerpo, y como adjunto suelto queda
// un clip que casi nadie abre desde el celular. Es la misma razon por la que
// el QR de las boletas viaja asi (ver src/lib/correo.js).
// -----------------------------------------------------------------------------
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { db } from '../src/db/index.js'
import { config } from '../src/config.js'
import { listarCortesias } from '../src/servicios/cortesias.js'
import { registrarAuditoria } from '../src/servicios/reportes.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const IMAGEN = path.join(AQUI, '..', 'assets', 'tiger-tips.jpg')
const ACCION = 'aviso_invitados'

const args = process.argv.slice(2)
const enviar = args.includes('--enviar')
const otraVez = args.includes('--otra-vez')

if (!fs.existsSync(IMAGEN)) {
  console.log(`\n  No encuentro la pieza en ${IMAGEN}\n`)
  process.exit(1)
}

// --- a quien ya se le mando ----------------------------------------------------
// Se guarda en la auditoria para no crear una tabla nueva a dos dias del evento.
const yaRecibieron = new Set()
for (const f of db.prepare(`SELECT detalle FROM auditoria WHERE accion = ?`).all(ACCION)) {
  try {
    const d = JSON.parse(f.detalle)
    if (d?.correo) yaRecibieron.add(String(d.correo).toLowerCase())
  } catch { /* una fila ilegible no puede frenar el envio */ }
}

// --- destinatarios --------------------------------------------------------------
// Un correo por PERSONA, no por boleta. Dos invitados que comparten buzon
// (pasa con las parejas) reciben cada uno el suyo, que es lo correcto: el
// aviso va dirigido a cada quien.
const invitados = listarCortesias()
  .filter((c) => String(c.correo ?? '').includes('@'))
  .map((c) => ({ nombre: c.nombre, correo: String(c.correo).trim().toLowerCase(), referencia: c.referencia }))

const pendientes = otraVez ? invitados : invitados.filter((i) => !yaRecibieron.has(i.correo))

console.log('')
console.log(`  Invitados especiales con correo: ${invitados.length}`)
if (yaRecibieron.size) console.log(`  Ya recibieron el aviso:          ${yaRecibieron.size}`)
console.log(`  Les llegaria ahora:              ${pendientes.length}`)
console.log('')
for (const i of pendientes) console.log(`   ${String(i.nombre).padEnd(34)} ${i.correo}`)

if (pendientes.length === 0) {
  console.log('')
  console.log('  No hay a quien mandarle. Con --otra-vez se le reenvia a todos.')
  console.log('')
  process.exit(0)
}

if (!enviar) {
  console.log('')
  console.log('  --> Nada salio. Con --enviar se manda.')
  console.log('')
  process.exit(0)
}

// --- el correo --------------------------------------------------------------------
// Sin SMTP configurado no se manda nada: se escribe el correo a disco, igual
// que hace src/lib/correo.js. Es como se revisa el armado sin tocar la red.
const SIN_SMTP = !config.correo.host
const CARPETA = path.join(AQUI, '..', 'datos', 'correos')

const transporte = SIN_SMTP ? null : nodemailer.createTransport({
  host: config.correo.host,
  port: config.correo.puerto,
  secure: config.correo.puerto === 465,
  auth: config.correo.usuario ? { user: config.correo.usuario, pass: config.correo.clave } : undefined,
  // Los mismos limites que el envio de boletas: sin esto un correo colgado
  // deja el proceso esperando para siempre (4 de noviembre de 2026).
  connectionTimeout: 30_000,
  greetingTimeout: 20_000,
  socketTimeout: 120_000,

  // UNA SOLA CONEXION Y UN CORREO POR SEGUNDO.
  //
  // 12 de noviembre de 2026: el primer intento se colgo en el correo 17 de 54.
  // Sin pool, cada sendMail abre su propia conexion SMTP: Gmail ve 54
  // conexiones nuevas con un adjunto de 237 KB cada una, lo lee como rafaga y
  // deja de responder. Con una conexion reutilizada y un ritmo de un mensaje
  // por segundo pasa sin quejarse. Tarda un minuto mas; vale la pena.
  pool: true,
  maxConnections: 1,
  maxMessages: 100,
  rateDelta: 1_000,
  rateLimit: 1,
})

const NAVY = '#004990'
const cuerpo = (nombre) => `
<div style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="padding:28px 28px 8px;">
      <p style="margin:0 0 14px;font-size:16px;color:${NAVY};">
        Hola ${nombre.split(/\s+/)[0]},
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#333;">
        Ya falta muy poco para la <strong>Homecoming Party de los 80 años</strong>.
        Te compartimos lo que necesitas tener en cuenta para esa noche.
      </p>
    </div>
    <img src="cid:tigertips" alt="Tiger Tips: todo lo que necesitas saber para la Homecoming Party"
         style="display:block;width:100%;max-width:620px;height:auto;border:0;" />
    <div style="padding:22px 28px 30px;">
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#333;">
        Recuerda llevar <strong>tu boleta y tu documento de identidad</strong>: los dos
        son obligatorios para entrar. Tu boleta te llegó en un correo anterior de
        nosotros, con un código QR.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#777;">
        Si tienes cualquier duda, escríbenos a
        <a href="mailto:${config.correo.soporte}" style="color:${NAVY};">${config.correo.soporte}</a>.
      </p>
    </div>
  </div>
  <p style="max-width:620px;margin:16px auto 0;font-size:12px;color:#9aa0a6;text-align:center;">
    The Columbus School · Alto de las Palmas, Envigado
  </p>
</div>`

const adjuntoImagen = {
  filename: 'tiger-tips.jpg',
  path: IMAGEN,
  cid: 'tigertips',
}

console.log('')
console.log('  Enviando...')

let enviados = 0
let fallidos = 0
for (const i of pendientes) {
  try {
    if (SIN_SMTP) {
      // En disco el cid: no existe: se usa data URI para poder abrirlo en el
      // navegador y ver el correo tal como quedaria.
      fs.mkdirSync(CARPETA, { recursive: true })
      const enLinea = `data:image/jpeg;base64,${fs.readFileSync(IMAGEN).toString('base64')}`
      const archivo = path.join(CARPETA, `aviso-${i.correo.replace(/[^\w.-]/g, '_')}.html`)
      fs.writeFileSync(archivo, cuerpo(i.nombre).replace('cid:tigertips', enLinea))
      console.log(`  (sin SMTP) escrito en ${archivo}`)
    } else {
      await transporte.sendMail({
        from: config.correo.remitente,
        to: i.correo,
        subject: `Lo que necesitas saber - TCS Homecoming 80 Años`,
        html: cuerpo(i.nombre),
        attachments: [adjuntoImagen],
      })
    }
    registrarAuditoria('admin', ACCION, { correo: i.correo, nombre: i.nombre, referencia: i.referencia })
    enviados += 1
    console.log(`  -> ${i.correo}`)
  } catch (e) {
    fallidos += 1
    console.log(`  !! ${i.correo}: ${e.message}`)
  }
}

// Con pool hay que cerrar la conexion o el proceso se queda vivo esperandola.
transporte?.close()

console.log('')
console.log(`  ${enviados} enviado(s), ${fallidos} fallido(s).`)
if (fallidos) console.log('  Los fallidos NO quedaron anotados: vuelve a correr el comando y solo salen esos.')
console.log('')
db.close()
process.exit(fallidos ? 1 : 0)
