// -----------------------------------------------------------------------------
// CEDER UNA BOLETA A OTRA PERSONA.
//
//   npm run ceder -- HC80-XXXXXX                              muestra la orden
//   npm run ceder -- HC80-XXXXXX --a "Nombre Apellido" \
//        --documento 1020304050 --correo nuevo@correo.com     muestra que haria
//
//   Si quien recibe la boleta es egresado/a, --promocion 1995 con su ano de
//   grado; sin eso sale sin promocion, como la de un acompanante.
//   ... y con --aplicar lo hace de verdad
//
//   Si la orden tiene varias boletas, se escoge con --boleta N (1, 2, 3...).
//
// Para que existe (26 de octubre de 2026): alguien compro su boleta, no pudo
// ir y el colegio autorizo cedersela a su hijo. Va a volver a pasar.
//
// QUE HACE, Y POR QUE ASI:
//   1. Cambia el asistente de esa boleta (nombre, documento y correo). En la
//      puerta se compara el nombre con el documento original, asi que tiene
//      que quedar a nombre de quien va a entrar.
//   2. ANULA el QR viejo y emite uno nuevo. Esto es lo importante: si no, el
//      PDF que ya tiene el comprador seguiria sirviendo y el primero que
//      llegue entra, dejando al otro por fuera.
//   3. Le manda la boleta nueva al correo del cesionario.
//
// LO QUE NO TOCA: la factura de SIESA. La compra la hizo y la pago otra
// persona, y la factura sigue a su nombre; eso es lo correcto contablemente y
// no cambia porque la entrada la use alguien mas.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { config } from '../src/config.js'
import { buscarPorReferencia, boletasDeOrden, compradorDe, enviarCorreoDeOrden } from '../src/servicios/ordenes.js'
import { reemitirBoleta } from '../src/servicios/boletas.js'
import { registrarAuditoria } from '../src/servicios/reportes.js'

const args = process.argv.slice(2)
const valor = (bandera) => {
  const i = args.indexOf(bandera)
  return i >= 0 ? args[i + 1] : null
}
const referencia = args.find((a) => !a.startsWith('--') && /^HC80-/i.test(a))
const nombre = valor('--a')
const documento = valor('--documento')
const correo = valor('--correo')
const cual = Number(valor('--boleta') || 1)
const aplicar = args.includes('--aplicar')

// A quien recibe la boleta se le pone "no egresado" salvo que se diga su
// promocion. En octubre el primer caso fue un padre cediendosela a su hijo, y
// ahi era lo correcto. Pero el 12 de noviembre de 2026 una egresada del 95 le
// vendio la suya a una COMPANERA del 95: sin esto, la boleta de Sandra diria
// "no egresado" en vez de "Promocion 1995".
const promocion = valor('--promocion')

if (!referencia) {
  console.log('\n  Uso: npm run ceder -- HC80-XXXXXX --a "Nombre Apellido" --documento 123 --correo x@y.com')
  console.log('       [--promocion 1995] [--boleta N] [--aplicar]\n')
  process.exit(1)
}

const orden = buscarPorReferencia(referencia.toUpperCase())
if (!orden) {
  console.log(`\n  No existe la orden ${referencia}\n`)
  process.exit(1)
}

const comprador = compradorDe(orden.id)
const boletas = boletasDeOrden(orden.id, config.urlPublica).filter((b) => b.estado !== 'anulada')

console.log('')
console.log(`  Orden      ${orden.referencia}  (${orden.estado}${orden.es_cortesia ? ', cortesia' : ''})`)
console.log(`  Compro     ${comprador?.nombre} · ${comprador?.correo}`)
console.log('')
console.log('  Boletas vigentes:')
boletas.forEach((b, i) => {
  console.log(`   ${i + 1}. ${String(b.asistente).padEnd(32)} ${b.estado}`)
})

if (!nombre) {
  console.log('')
  console.log('  Para ceder: --a "Nombre Apellido" --documento 123 --correo x@y.com')
  console.log('  Si quien la recibe es egresado/a, agrega --promocion con su ano de grado.')
  console.log('  Si hay varias boletas, agrega --boleta N con el numero de la lista.')
  console.log('')
  process.exit(0)
}

const elegida = boletas[cual - 1]
if (!elegida) {
  console.log(`\n  No hay una boleta numero ${cual} en esta orden.\n`)
  process.exit(1)
}
if (elegida.estado === 'usada') {
  console.log('\n  Esa boleta YA SE USO en la puerta: no se puede ceder.\n')
  process.exit(1)
}
if (nombre.trim().split(/\s+/).length < 2) {
  console.log('\n  El nombre tiene que ser completo (nombre y apellido).\n')
  process.exit(1)
}
if (correo && !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/.test(correo.trim())) {
  console.log(`\n  Correo no valido: "${correo}"\n`)
  process.exit(1)
}

const anio = new Date().getFullYear()
if (promocion && !(/^\d{4}$/.test(promocion.trim()) && Number(promocion) >= 1948 && Number(promocion) <= anio)) {
  console.log(`\n  Promocion no valida: "${promocion}". Es el ano de grado, entre 1948 y ${anio}.\n`)
  process.exit(1)
}

console.log('')
console.log(`  CEDER la boleta ${cual} (${elegida.asistente})`)
console.log(`         a  ${nombre}`)
console.log(`         documento ${documento || '(sin cambio)'}`)
console.log(`         correo    ${correo || '(sin cambio)'}`)
console.log(`         promocion ${promocion || 'no es egresado/a'}`)
console.log('')
console.log('  El QR actual queda ANULADO y se emite uno nuevo.')

if (!aplicar) {
  console.log('  --> Nada se toco. Con --aplicar se hace y se manda el correo.')
  console.log('')
  process.exit(0)
}

const r = reemitirBoleta(elegida.id, {
  nombre: nombre.trim(),
  cedula: documento ? String(documento).replace(/\D/g, '') : null,
  correo: correo ? correo.trim().toLowerCase() : null,
  promocion: promocion ? promocion.trim() : 'no-egresado',
  motivo: `Cedida a ${nombre.trim()}`,
}, config.urlPublica)

if (!r.ok) {
  console.log(`\n  No se pudo: ${r.motivo}\n`)
  process.exit(1)
}

registrarAuditoria('admin', 'ceder_boleta', {
  referencia: orden.referencia,
  boletaAnulada: elegida.id,
  boletaNueva: r.boleta.id,
  de: elegida.asistente,
  a: nombre.trim(),
})

console.log('')
console.log(`  Boleta nueva: ${r.boleta.id}`)
console.log('  Enviando el correo...')

const envio = await enviarCorreoDeOrden(orden.id, { aTodos: true })
console.log(envio.enviado ? '  Correo enviado.' : `  El correo fallo: ${envio.detalle}`)
console.log('')
db.close()
process.exit(envio.enviado ? 0 : 1)
