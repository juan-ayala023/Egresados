// -----------------------------------------------------------------------------
// MANDAR UNA BOLETA YA EMITIDA A OTRA DIRECCION, PARA PROBAR EL CANAL.
//
//   npm run probar-correo -- HC80-XXXXXX --a yo@gmail.com          dice que haria
//   npm run probar-correo -- HC80-XXXXXX --a yo@gmail.com --enviar  lo manda
//
// Para que existe (4 de noviembre de 2026): ese dia el envio se quedo colgado
// esperando a Gmail y se le pusieron timeouts al transporte. Para comprobar que
// el canal quedo bien sin esperar a que entre una venta, hace falta mandar un
// correo de verdad -- con su PDF y su QR -- a una direccion de prueba.
//
// LO QUE NO TOCA, Y ES TODO EL PUNTO: no escribe NADA en la base. No marca la
// orden como enviada, no cuenta intentos, no cambia el correo de nadie, no
// emite ni anula boletas. Es el mismo correo de siempre, mandado a otra parte.
//
// Por eso tampoco sirve para reenviarle su boleta a un comprador que la
// perdio: para eso esta el panel, que si deja registro. Esto es diagnostico.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { config } from '../src/config.js'
import { esCorreoValido, limpiarCorreo } from '../src/lib/validaciones.js'
import { buscarPorReferencia, compradorDe } from '../src/servicios/ordenes.js'
import { enviarBoletas } from '../src/lib/correo.js'
import { pdfDeBoleta, nombreArchivoBoleta } from '../src/lib/pdf.js'

const args = process.argv.slice(2)
const valor = (bandera) => {
  const i = args.indexOf(bandera)
  return i >= 0 ? args[i + 1] : null
}
const referencia = args.find((a) => !a.startsWith('--') && /^HC80-/i.test(a))
const destino = limpiarCorreo(valor('--a') ?? '')
const enviar = args.includes('--enviar')

if (!referencia || !destino) {
  console.log('\n  Uso: npm run probar-correo -- HC80-XXXXXX --a tucorreo@gmail.com [--enviar]')
  console.log('\n  Manda una boleta ya emitida a otra direccion, sin tocar nada en la base.')
  console.log('  Sirve para comprobar que el canal de correo esta bien.\n')
  process.exit(1)
}

if (!esCorreoValido(destino)) {
  console.log(`\n  "${destino}" no es un correo valido.\n`)
  process.exit(1)
}

const orden = buscarPorReferencia(referencia.toUpperCase())
if (!orden) {
  console.log(`\n  No existe la orden ${referencia}\n`)
  process.exit(1)
}
if (orden.estado !== 'pagada') {
  console.log(`\n  La orden ${orden.referencia} esta ${orden.estado}: no tiene boletas que mandar.\n`)
  process.exit(1)
}

const comprador = compradorDe(orden.id)
const cortesia = orden.es_cortesia === 1

const filas = db.prepare(`
  SELECT b.id, b.token_firmado, b.estado, a.nombre AS asistente_nombre, a.promocion, a.es_egresado
    FROM boleta b JOIN asistente a ON a.id = b.asistente_id
   WHERE b.orden_id = ? AND b.estado != 'anulada'
   ORDER BY a.indice`).all(orden.id)

if (filas.length === 0) {
  console.log(`\n  La orden ${orden.referencia} no tiene boletas vigentes.\n`)
  process.exit(1)
}

const boletas = filas.map((f) => ({
  id: f.id,
  asistente: f.asistente_nombre,
  promocion: f.promocion,
  esEgresado: f.es_egresado === 1,
  cortesia,
  estado: f.estado,
  token: f.token_firmado,
}))

console.log('')
console.log(`  Orden     ${orden.referencia}  (${cortesia ? 'cortesia' : 'venta'})`)
console.log(`  A nombre  ${comprador.nombre}`)
console.log(`  Normal    iria a ${comprador.correo}`)
console.log(`  PRUEBA    se manda a ${destino}`)
console.log(`  Boletas   ${boletas.map((b) => b.asistente).join(', ')}`)
console.log('')
console.log('  En la base NO se cambia nada: ni el correo de la orden, ni la marca')
console.log('  de enviada, ni las boletas. Es solo una copia a otra direccion.')

if (!enviar) {
  console.log('')
  console.log('  --> Nada salio. Con --enviar se manda.')
  console.log('')
  process.exit(0)
}

console.log('')
console.log('  Armando los PDF...')
const adjuntos = []
for (const b of boletas) {
  try {
    adjuntos.push({
      filename: nombreArchivoBoleta(b.asistente),
      content: await pdfDeBoleta({ ...b, referencia: orden.referencia }),
      contentType: 'application/pdf',
    })
  } catch (e) {
    console.log(`  !! No se pudo generar el PDF de ${b.asistente}: ${e.message}`)
  }
}

console.log(`  Enviando a ${destino}...`)
const empezo = Date.now()
const r = await enviarBoletas(orden, comprador, boletas, adjuntos, { para: destino, cortesia })
const tardo = ((Date.now() - empezo) / 1000).toFixed(1)

console.log('')
if (r.enviado) {
  console.log(`  Enviado en ${tardo}s por ${r.via ?? 'smtp'}.`)
  console.log(`  Revisa ${destino} (y la carpeta de spam la primera vez).`)
} else {
  console.log(`  NO salio (${tardo}s): ${r.detalle}`)
  console.log('  Si tardo mas o menos 2 minutos, fue el timeout nuevo haciendo su trabajo:')
  console.log('  antes se habria quedado colgado para siempre.')
}
console.log('')
console.log(`  (La orden ${orden.referencia} quedo exactamente como estaba.)`)
console.log('')
db.close()
process.exit(r.enviado ? 0 : 1)
