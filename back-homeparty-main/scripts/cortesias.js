// -----------------------------------------------------------------------------
// CARGAR LAS BOLETAS DE CORTESIA DE LOS INVITADOS DEL COLEGIO.
//
//   npm run cortesias -- invitados.csv              muestra que haria
//   npm run cortesias -- invitados.csv --crear      crea las boletas (sin correo)
//   npm run cortesias -- invitados.csv --enviar     crea y manda los correos
//   npm run cortesias -- --listar                   las que ya existen
//
// El archivo es un CSV (desde Excel: "Guardar como > CSV UTF-8") con estas
// columnas en la primera fila, en cualquier orden:
//
//   nombre,correo,celular,documento,tipo_documento,promocion
//
// Solo `nombre` y `correo` son obligatorios. `promocion` se deja vacia para
// quien no es egresado (profesores, invitados).
//
// SE PUEDE CORRER VARIAS VECES: a quien ya tiene su cortesia no se le crea
// otra. Mercadeo manda la lista por tandas y alguna se va a repetir.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import fs from 'node:fs'
import { crearCortesia, listarCortesias, cortesiaDe } from '../src/servicios/cortesias.js'
import { enviarCorreoDeOrden } from '../src/servicios/ordenes.js'

const args = process.argv.slice(2)
const archivo = args.find((a) => !a.startsWith('--'))
const crear = args.includes('--crear') || args.includes('--enviar')
const enviar = args.includes('--enviar')

// --- listar lo que ya hay ------------------------------------------------------
if (args.includes('--listar')) {
  const filas = listarCortesias()
  console.log('')
  console.log(`  ${filas.length} cortesia(s) emitida(s):`)
  console.log('')
  for (const f of filas) {
    const correo = f.correo_enviado_en ? 'correo enviado' : 'SIN CORREO'
    console.log(`  ${f.referencia}  ${String(f.nombre).padEnd(34)} ${String(f.correo).padEnd(34)} ${correo}`)
  }
  console.log('')
  process.exit(0)
}

if (!archivo) {
  console.log('\n  Uso: npm run cortesias -- invitados.csv [--crear | --enviar]')
  console.log('       npm run cortesias -- --listar\n')
  process.exit(1)
}

// --- leer el CSV ---------------------------------------------------------------
// Un CSV de Excel: separador coma o punto y coma, comillas opcionales, y el
// BOM que Excel le mete adelante y que si no se quita rompe la primera columna.
function leerCsv(ruta) {
  const texto = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '')
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim())
  if (lineas.length < 2) throw new Error('El archivo no tiene filas de datos')

  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const partir = (linea) => {
    const campos = []
    let actual = ''
    let entreComillas = false
    for (let i = 0; i < linea.length; i += 1) {
      const c = linea[i]
      if (c === '"') {
        if (entreComillas && linea[i + 1] === '"') { actual += '"'; i += 1 }
        else entreComillas = !entreComillas
      } else if (c === sep && !entreComillas) { campos.push(actual); actual = '' }
      else actual += c
    }
    campos.push(actual)
    return campos.map((x) => x.trim())
  }

  const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
  const cabeceras = partir(lineas[0]).map(normalizar)

  // Nombres que puede traer el archivo de mercadeo para cada columna.
  const alias = {
    nombre: ['nombre', 'nombres', 'nombrecompleto', 'nombreyapellidos', 'invitado'],
    correo: ['correo', 'correoelectronico', 'email', 'mail'],
    celular: ['celular', 'telefono', 'movil', 'numero'],
    cedula: ['documento', 'cedula', 'numerodocumento', 'identificacion', 'nrodocumento'],
    tipoDocumento: ['tipodocumento', 'tipodedocumento', 'tipoid'],
    promocion: ['promocion', 'ano', 'anio', 'promo', 'generacion'],
  }
  const indice = {}
  for (const [campo, nombres] of Object.entries(alias)) {
    indice[campo] = cabeceras.findIndex((c) => nombres.includes(c))
  }
  if (indice.nombre < 0 || indice.correo < 0) {
    throw new Error(`El archivo necesita al menos columnas "nombre" y "correo". Encontradas: ${cabeceras.join(', ')}`)
  }

  return lineas.slice(1).map((linea) => {
    const campos = partir(linea)
    const leer = (campo) => (indice[campo] >= 0 ? (campos[indice[campo]] ?? '') : '')
    return {
      nombre: leer('nombre'),
      correo: leer('correo'),
      celular: leer('celular'),
      cedula: leer('cedula'),
      tipoDocumento: leer('tipoDocumento') || 'CC',
      promocion: leer('promocion'),
    }
  }).filter((x) => x.nombre || x.correo)
}

let invitados
try {
  invitados = leerCsv(archivo)
} catch (e) {
  console.log(`\n  No se pudo leer el archivo: ${e.message}\n`)
  process.exit(1)
}

console.log('')
console.log(`  Archivo: ${archivo}`)
console.log(`  Invitados en el archivo: ${invitados.length}`)
console.log('')

if (!crear) {
  // Solo revisar: se dice de cada uno que pasaria, sin tocar nada.
  let nuevos = 0
  let repetidos = 0
  let malos = 0
  for (const i of invitados) {
    const r = crearCortesiaSimulada(i)
    console.log(`  ${r.marca} ${String(i.nombre).padEnd(34)} ${i.correo}${r.nota}`)
    if (r.marca === '+') nuevos += 1
    else if (r.marca === '=') repetidos += 1
    else malos += 1
  }
  console.log('')
  console.log(`  ${nuevos} nueva(s), ${repetidos} ya existe(n), ${malos} con problema.`)
  console.log('  Nada se toco. Con --crear se emiten las boletas; con --enviar ademas sale el correo.')
  console.log('')
  process.exit(malos ? 1 : 0)
}

// --- crear de verdad -----------------------------------------------------------
const creadas = []
let repetidos = 0
let malos = 0

for (const i of invitados) {
  const r = crearCortesia(i)
  if (r.creada) {
    creadas.push({ ...r, invitado: i })
    console.log(`  + ${String(i.nombre).padEnd(34)} ${i.correo}  ->  ${r.referencia}`)
  } else if (r.motivo === 'Ya tiene cortesia') {
    repetidos += 1
    console.log(`  = ${String(i.nombre).padEnd(34)} ${i.correo}  (ya tenia ${r.referencia})`)
  } else {
    malos += 1
    console.log(`  ! ${String(i.nombre).padEnd(34)} ${i.correo}  ${r.motivo}`)
  }
}

console.log('')
console.log(`  ${creadas.length} boleta(s) creada(s), ${repetidos} ya existian, ${malos} con problema.`)

if (!enviar) {
  console.log('  NO se mandaron correos. Con --enviar salen.')
  console.log('')
  process.exit(malos ? 1 : 0)
}

// --- mandar los correos ---------------------------------------------------------
console.log('')
console.log('  Enviando correos...')
let enviados = 0
let fallidos = 0
for (const c of creadas) {
  const r = await enviarCorreoDeOrden(c.ordenId)
  if (r.enviado) { enviados += 1; console.log(`  -> ${c.invitado.correo}`) }
  else { fallidos += 1; console.log(`  !! ${c.invitado.correo}: ${r.detalle}`) }
}

console.log('')
console.log(`  ${enviados} correo(s) enviado(s), ${fallidos} fallido(s).`)
console.log('  Los fallidos se reintentan solos; se ven con: npm run cortesias -- --listar')
console.log('')
process.exit(fallidos || malos ? 1 : 0)

// -----------------------------------------------------------------------------

/** Lo mismo que crearCortesia pero sin escribir: para la vista previa. */
function crearCortesiaSimulada(invitado) {
  const nombre = String(invitado?.nombre ?? '').trim()
  const correo = String(invitado?.correo ?? '').trim().toLowerCase()
  if (!nombre || nombre.split(/\s+/).length < 2) return { marca: '!', nota: '  <- falta nombre completo' }
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/.test(correo)) return { marca: '!', nota: '  <- correo no valido' }
  const ya = cortesiaDe({ cedula: invitado?.cedula, correo, nombre })
  if (ya) return { marca: '=', nota: `  (ya tiene ${ya.referencia})` }
  return { marca: '+', nota: '' }
}
