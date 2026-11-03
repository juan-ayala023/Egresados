// -----------------------------------------------------------------------------
// CORREGIR EL CORREO DE UNA COMPRA Y VOLVER A MANDAR LA BOLETA.
//
//   npm run correo -- --sospechosos                           busca mal escritos
//   npm run correo -- HC80-XXXXXX                             muestra la compra
//   npm run correo -- HC80-XXXXXX --nuevo x@y.com             dice que haria
//   npm run correo -- HC80-XXXXXX --nuevo x@y.com --aplicar   lo hace y reenvia
//
// Para que existe (3 de noviembre de 2026): Maria Mercedes Arboleda escribio
// "@hotmail.vom" en vez de "@hotmail.com". Su boleta salio hacia un dominio que
// no existe y nunca le llego. Ya habia pasado en septiembre con un correo que
// terminaba en punto. Va a volver a pasar: son 500 personas escribiendo a mano.
//
// LO QUE NO TOCA: el QR (es la misma persona y su boleta sigue valiendo) ni la
// factura de SIESA. Alla el correo quedo como ella lo escribio; cambiarlo es
// otra cosa y la decide contabilidad.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { correoSugerido } from '../src/lib/validaciones.js'
import {
  buscarPorReferencia, compradorDe, asistentesDe,
  corregirCorreo, correosSospechosos, enviarCorreoDeOrden,
} from '../src/servicios/ordenes.js'
import { registrarAuditoria } from '../src/servicios/reportes.js'

const args = process.argv.slice(2)
const valor = (bandera) => {
  const i = args.indexOf(bandera)
  return i >= 0 ? args[i + 1] : null
}
const referencia = args.find((a) => !a.startsWith('--') && /^HC80-/i.test(a))
const nuevo = valor('--nuevo')
const aplicar = args.includes('--aplicar')

// -----------------------------------------------------------------------------
// --sospechosos: repasar todas las compras pagadas.
// -----------------------------------------------------------------------------
if (args.includes('--sospechosos')) {
  const malos = correosSospechosos()
  console.log('')
  if (malos.length === 0) {
    console.log('  Ningun correo sospechoso.')
  } else {
    console.log(`  ${malos.length} correo(s) que parecen mal escritos:`)
    console.log('')
    for (const m of malos) {
      const aviso = m.sugerido ? `quiso escribir ${m.sugerido}` : 'no es un correo valido'
      console.log(`  ${m.referencia}  ${String(m.nombre).padEnd(30)} ${String(m.correo).padEnd(34)} <- ${aviso}`)
      if (!m.correo_enviado_en) {
        console.log(`              la boleta NUNCA salio: ${m.correo_ultimo_error ?? 'sin error registrado'}`)
      }
    }
    console.log('')
    console.log('  Para arreglar uno:')
    console.log('    npm run correo -- HC80-XXXXXX --nuevo elcorreo@bueno.com --aplicar')
  }
  console.log('')
  process.exit(0)
}

if (!referencia) {
  console.log('\n  Uso: npm run correo -- HC80-XXXXXX --nuevo x@y.com [--aplicar]')
  console.log('       npm run correo -- --sospechosos\n')
  process.exit(1)
}

// -----------------------------------------------------------------------------
// Una compra concreta.
// -----------------------------------------------------------------------------
const orden = buscarPorReferencia(referencia.toUpperCase())
if (!orden) {
  console.log(`\n  No existe la orden ${referencia}\n`)
  process.exit(1)
}

const comprador = compradorDe(orden.id)
const asistentes = asistentesDe(orden.id)
const viejo = String(comprador.correo ?? '').trim().toLowerCase()

console.log('')
console.log(`  Orden      ${orden.referencia}  (${orden.estado}${orden.es_cortesia ? ', cortesia' : ''})`)
console.log(`  Comprador  ${comprador.nombre} · ${comprador.cedula}`)
console.log(`  Correo     ${comprador.correo}`)
console.log(`  Celular    ${comprador.celular}`)
console.log('')
console.log(`  La boleta: ${orden.correo_enviado_en ? `salio el ${orden.correo_enviado_en} hacia ${orden.correo_enviado_a}` : 'NUNCA SALIO'}`)
if (orden.correo_ultimo_error) console.log(`  Ultimo error: ${orden.correo_ultimo_error}`)
if (orden.correo_intentos) console.log(`  Intentos:     ${orden.correo_intentos}`)

const sugerido = correoSugerido(viejo)
if (sugerido) {
  console.log('')
  console.log(`  OJO: el dominio parece mal escrito. Seguramente queria ${sugerido}`)
}

if (asistentes.length > 1 || asistentes.some((a) => a.correo && a.correo !== viejo)) {
  console.log('')
  console.log('  Asistentes:')
  for (const a of asistentes) {
    console.log(`   ${a.indice + 1}. ${String(a.nombre).padEnd(32)} ${a.correo ?? '(va al del comprador)'}`)
  }
}

if (!nuevo) {
  console.log('')
  console.log('  Para corregirlo: --nuevo elcorreo@bueno.com   (y --aplicar para que se haga)')
  if (sugerido) console.log(`  Es decir:        npm run correo -- ${orden.referencia} --nuevo ${sugerido} --aplicar`)
  console.log('')
  process.exit(0)
}

if (!aplicar) {
  console.log('')
  console.log(`  CAMBIAR  ${viejo}`)
  console.log(`      por  ${nuevo.trim().toLowerCase()}`)
  console.log(`  Y volver a mandar la boleta a ese correo.`)
  console.log('  --> Nada se toco. Con --aplicar se hace y sale el correo.')
  console.log('')
  process.exit(0)
}

const r = corregirCorreo(orden.id, nuevo)
if (!r.ok) {
  console.log(`\n  No se pudo: ${r.motivo}\n`)
  process.exit(1)
}

registrarAuditoria('admin', 'corregir_correo', {
  referencia: orden.referencia,
  de: r.de,
  a: r.a,
  asistentes: r.asistentes,
})

console.log('')
console.log(`  Corregido: ${r.de}  ->  ${r.a}`)
if (r.asistentes) console.log(`  Tambien en ${r.asistentes} asistente(s) que tenian ese mismo correo.`)
console.log('  Enviando la boleta...')

const envio = await enviarCorreoDeOrden(orden.id, { aTodos: true })
console.log(envio.enviado ? `  Correo enviado a ${r.a}.` : `  El correo fallo: ${envio.detalle}`)
console.log('')
db.close()
process.exit(envio.enviado ? 0 : 1)
