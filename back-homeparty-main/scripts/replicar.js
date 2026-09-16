// -----------------------------------------------------------------------------
// REPLICA AL SQL SERVER DEL COLEGIO, A MANO.
//
//   npm run replicar              manda lo que cambio y muestra los conteos
//   npm run replicar -- --todo    reenvia TODAS las filas (primera carga, o
//                                 para reconstruir si alguien borro algo alla)
//   npm run replicar -- --estado  solo muestra los conteos, no envia nada
//
// El servidor hace esto mismo cada minuto (REPLICA_SQLSERVER=true). El script
// es para la primera carga, y para verificar contra la base de Don Luis.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import { config } from '../src/config.js'
import { db } from '../src/db/index.js'
import { replicar, conteoRemoto, asegurarTablas, replicaActiva } from '../src/servicios/replica.js'
import { cerrarConexion } from '../src/siesa/config.js'

const todo = process.argv.includes('--todo')
const soloEstado = process.argv.includes('--estado')

if (!replicaActiva()) {
  console.log('\n  La replica esta apagada: pon REPLICA_SQLSERVER=true en el .env (y MSSQL_*).\n')
  process.exit(1)
}

console.log('')
console.log(`  Destino: ${config.replica.baseDatos}.dbo.${config.replica.prefijo}{orden,comprador,asistente,boleta}`)

const local = {}
for (const t of ['orden', 'comprador', 'asistente', 'boleta']) {
  local[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
}

if (!soloEstado) {
  const r = await replicar({ todo })
  console.log(`  Revisadas ${r.revisadas} filas, enviadas ${r.enviadas}, con error ${r.errores}.`)
} else {
  await asegurarTablas()
}

const remoto = await conteoRemoto()
console.log('')
console.log('  Tabla        SQLite   SQL Server')
for (const t of ['orden', 'comprador', 'asistente', 'boleta']) {
  const ok = local[t] === remoto[t] ? '' : '   <-- distinto'
  console.log(`  ${t.padEnd(12)} ${String(local[t]).padStart(6)}   ${String(remoto[t]).padStart(10)}${ok}`)
}
console.log('')
await cerrarConexion()
process.exit(0)
