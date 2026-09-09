// -----------------------------------------------------------------------------
// Carga la base de egresados que entrega mercadeo.
//
//   npm run importar-egresados -- egresados.csv
//   npm run importar-egresados -- egresados.csv --revisar
//
// El archivo es un CSV con encabezado. Se aceptan varios nombres de columna
// porque nadie sabe todavia como va a venir el archivo:
//
//   cedula      | documento | identificacion | numero_documento | cc
//   nombre      | nombres   | nombre_completo
//   promocion   | ano       | anio | ano_grado | graduacion | promocion_ano
//
// Solo la cedula es obligatoria. Reemplaza la base completa: mercadeo entrega
// el archivo entero cada vez, no diferencias.
// -----------------------------------------------------------------------------
import fs from 'node:fs'
import path from 'node:path'
import { cargarBase, totalEgresados } from '../src/servicios/egresados.js'
import { cerrar } from '../src/db/index.js'

const ALIAS = {
  cedula: ['cedula', 'numero_documento', 'num_documento', 'documento', 'identificacion', 'cc', 'nit'],
  nombre: ['nombre', 'nombres', 'nombre_completo', 'nombrecompleto', 'apellidos_nombres'],
  promocion: ['promocion', 'ano_de_graduacion', 'ano_graduacion', 'ano_grado', 'anio_grado', 'graduacion', 'ano', 'anio'],
}

/** Quita tildes y espacios para comparar encabezados sin sorpresas. */
const normalizar = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** Separador: el que mas aparezca en el encabezado. Excel colombiano usa ";". */
function detectarSeparador(linea) {
  const candidatos = [';', ',', '\t', '|']
  return candidatos.reduce((mejor, c) =>
    (linea.split(c).length > linea.split(mejor).length ? c : mejor), ',')
}

/** Parser de CSV con comillas. Suficiente para un listado de personas. */
function partir(linea, sep) {
  const campos = []
  let actual = ''
  let entreComillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++ }
      else entreComillas = !entreComillas
    } else if (c === sep && !entreComillas) {
      campos.push(actual); actual = ''
    } else {
      actual += c
    }
  }
  campos.push(actual)
  return campos.map((s) => s.trim())
}

function leerCsv(archivo) {
  let texto = fs.readFileSync(archivo, 'utf8')
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1) // BOM de Excel

  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lineas.length < 2) throw new Error('El archivo no tiene filas de datos')

  const sep = detectarSeparador(lineas[0])
  const encabezado = partir(lineas[0], sep).map(normalizar)

  // Primero coincidencia exacta; si no, que el encabezado CONTENGA el alias.
  // Nadie sabe como va a venir el archivo de mercadeo: "Ano de Graduacion" y
  // "numero de documento" tienen que caer en su sitio sin editar el CSV.
  const indiceDe = (campo) => {
    for (const alias of ALIAS[campo]) {
      const i = encabezado.indexOf(alias)
      if (i >= 0) return i
    }
    for (const alias of ALIAS[campo]) {
      const i = encabezado.findIndex((h) => h.includes(alias))
      if (i >= 0) return i
    }
    return -1
  }

  const iCedula = indiceDe('cedula')
  if (iCedula < 0) {
    throw new Error(
      `No encuentro la columna de la cedula.\n` +
      `  Encabezado leido: ${encabezado.join(', ')}\n` +
      `  Nombres aceptados: ${ALIAS.cedula.join(', ')}`,
    )
  }
  const iNombre = indiceDe('nombre')
  const iPromocion = indiceDe('promocion')

  const filas = lineas.slice(1).map((l) => {
    const c = partir(l, sep)
    return {
      cedula: c[iCedula],
      nombre: iNombre >= 0 ? c[iNombre] : null,
      promocion: iPromocion >= 0 ? c[iPromocion] : null,
    }
  })

  return { filas, sep, encabezado, columnas: { iCedula, iNombre, iPromocion } }
}

// -----------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2)
  const archivo = args.find((a) => !a.startsWith('--'))
  const soloRevisar = args.includes('--revisar')

  if (!archivo) {
    console.error('\nUso: npm run importar-egresados -- <archivo.csv> [--revisar]\n')
    process.exit(1)
  }
  if (!fs.existsSync(archivo)) {
    console.error(`\nNo existe el archivo: ${path.resolve(archivo)}\n`)
    process.exit(1)
  }

  const { filas, sep, encabezado, columnas } = leerCsv(archivo)

  console.log('')
  console.log(`  Archivo      ${path.resolve(archivo)}`)
  console.log(`  Separador    ${sep === '\t' ? 'tabulador' : sep}`)
  console.log(`  Encabezado   ${encabezado.join(' | ')}`)
  console.log(`  Cedula       columna ${columnas.iCedula + 1}`)
  console.log(`  Nombre       ${columnas.iNombre >= 0 ? 'columna ' + (columnas.iNombre + 1) : 'no viene'}`)
  console.log(`  Promocion    ${columnas.iPromocion >= 0 ? 'columna ' + (columnas.iPromocion + 1) : 'no viene'}`)
  console.log(`  Filas        ${filas.length}`)
  console.log('')
  console.log('  Primeras 3 filas como quedarian:')
  for (const f of filas.slice(0, 3)) {
    console.log(`    ${String(f.cedula).replace(/\D/g, '')} | ${f.nombre ?? '-'} | ${f.promocion ?? '-'}`)
  }
  console.log('')

  if (soloRevisar) {
    console.log('  --revisar: no se toco la base.\n')
    return
  }

  const antes = totalEgresados()
  const { cargados, descartados } = cargarBase(filas)

  console.log(`  Antes        ${antes} egresados`)
  console.log(`  Cargados     ${cargados}`)
  if (descartados > 0) {
    console.log(`  Descartados  ${descartados} (cedula vacia o de menos de 6 digitos)`)
  }
  console.log('')
  console.log('  Listo. Ya puedes poner VALIDAR_EGRESADO=exigir en el .env.')
  console.log('')
}

try {
  main()
} finally {
  cerrar()
}
