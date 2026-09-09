// -----------------------------------------------------------------------------
// Respaldo de la base de datos.
//
//   npm run respaldo
//   npm run respaldo -- --carpeta D:/respaldos
//
// NO copia el archivo con `cp`. Con WAL activado, la base son TRES archivos
// (.db, .db-wal, .db-shm) y copiar solo el primero mientras el servidor escribe
// deja un respaldo corrupto o incompleto — que es peor que no tener respaldo,
// porque uno cree que está cubierto.
//
// Se usa la API de backup en línea de SQLite, que es segura con el servidor
// corriendo: hace una copia consistente sin bloquear las ventas.
// -----------------------------------------------------------------------------
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from '../src/config.js'

const CUANTOS_GUARDAR = 30

function sello() {
  // 2026-11-14-1930. Sin dos puntos: Windows no los acepta en nombres.
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2)

async function main() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--carpeta')
  const destino = i >= 0 && args[i + 1]
    ? args[i + 1]
    : path.join(path.dirname(config.baseDatos), 'respaldos')

  if (!fs.existsSync(config.baseDatos)) {
    console.error(`\nNo existe la base: ${path.resolve(config.baseDatos)}\n`)
    process.exit(1)
  }

  fs.mkdirSync(destino, { recursive: true })
  const archivo = path.join(destino, `homecoming-${sello()}.db`)

  // readonly: un respaldo nunca debería poder modificar nada.
  const db = new Database(config.baseDatos, { readonly: true })
  try {
    await db.backup(archivo)
  } finally {
    db.close()
  }

  // Se abre el respaldo y se cuentan las órdenes: un archivo que no se puede
  // abrir no es un respaldo, es un archivo.
  const copia = new Database(archivo, { readonly: true })
  let ordenes = 0
  let boletas = 0
  try {
    ordenes = copia.prepare(`SELECT COUNT(*) n FROM orden`).get().n
    boletas = copia.prepare(`SELECT COUNT(*) n FROM boleta`).get().n
  } finally {
    copia.close()
  }

  // Abrir la copia crea sus propios -wal y -shm. Se borran: un respaldo tiene
  // que ser UN archivo que se pueda copiar a una USB sin pensar.
  for (const sufijo of ['-wal', '-shm']) {
    fs.rmSync(archivo + sufijo, { force: true })
  }

  const tam = fs.statSync(archivo).size

  console.log('')
  console.log(`  Respaldo     ${archivo}`)
  console.log(`  Tamano       ${mb(tam)} MB`)
  console.log(`  Verificado   ${ordenes} orden(es), ${boletas} boleta(s)`)

  // Se conservan los ultimos N y se borran los mas viejos.
  const viejos = fs.readdirSync(destino)
    .filter((f) => f.startsWith('homecoming-') && f.endsWith('.db'))
    .sort()
    .reverse()
    .slice(CUANTOS_GUARDAR)

  for (const f of viejos) fs.rmSync(path.join(destino, f), { force: true })
  if (viejos.length) console.log(`  Limpieza     ${viejos.length} respaldo(s) viejo(s) borrado(s)`)

  console.log('')
  console.log('  Para restaurar: apaga el servidor, reemplaza el archivo de DB_PATH')
  console.log('  por este, y borra los .db-wal y .db-shm que hubiera al lado.')
  console.log('')
}

main().catch((e) => {
  console.error('\nFallo el respaldo:', e.message, '\n')
  process.exit(1)
})
