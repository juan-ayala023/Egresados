// -----------------------------------------------------------------------------
// QUITARLES EL "BLOQUEO" A LAS SUCURSALES QUE ESTE SISTEMA CREO EL 15-SEP-2026.
//
//   npm run desbloquear-clientes             muestra cuales estan bloqueadas
//   npm run desbloquear-clientes -- --enviar las actualiza en el ERP
//
// Ese dia se crearon ~35 terceros nuevos con F201_IND_BLOQUEADO = 0, copiando
// el ejemplo del proveedor. En SIESA ese 0 significa "bloqueado": al abrir la
// sucursal sale "El cliente esta bloqueado y esta activa la seguridad que
// exige capturar motivo de bloqueo". No impidio facturar, pero el maestro no
// puede quedar asi. Los clientes normales del colegio tienen 1.
//
// LO QUE HACE: para cada compra pagada, consulta la sucursal del comprador en
// t201_mm_clientes; si la sucursal es la nuestra (SIESA_ID_SUCURSAL), esta con
// bloqueo en 0 y su fecha de ingreso es de hoy o despues de la apertura de la
// venta, reenvia el Cliente por Pangea con F_ACTUALIZA_REG=1 y el bloqueo en 1.
// Solo toca sucursales que este sistema creo. Nunca toca una de antes.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import { config } from '../src/config.js'
import { db } from '../src/db/index.js'
import { conectar, leerConfiguracionSiesa, cerrarConexion } from '../src/siesa/config.js'
import { armarCliente, paraPangea, respuestaFallo, cedulaValida, obtenerCliente } from '../src/siesa/terceros.js'

const enviar = process.argv.includes('--enviar')
const sucursalNuestra = config.siesa.sucursal
// Solo sucursales ingresadas desde que abrio la venta: las de antes no son
// nuestras. (f201_fecha_ingreso viene como fecha; se compara como AAAAMMDD.)
const desde = '20260914'

const compradores = db.prepare(`
  SELECT DISTINCT c.cedula, c.nombre, c.tipo_documento, c.correo, c.celular, c.direccion, c.ciudad, c.fecha_nacimiento
    FROM orden o JOIN comprador c ON c.orden_id = o.id
   WHERE o.estado = 'pagada'
   ORDER BY c.cedula`).all()

const conexion = await conectar()
const cia = Number(config.siesa.compania || 1)

const enlazado = config.siesa.servidorErp
const cedulas = compradores.map((c) => c.cedula).filter(cedulaValida)
const lista = cedulas.map((c) => `''${c}''`).join(',')
const r = await conexion.request().query(`
  SELECT * FROM OPENQUERY(${enlazado}, '
    SELECT t.f200_nit AS nit, c.f201_id_sucursal AS sucursal,
           c.f201_ind_estado_bloqueado AS bloqueado,
           CONVERT(varchar(8), c.f201_fecha_ingreso, 112) AS ingreso
      FROM t200_mm_terceros t
      JOIN t201_mm_clientes c ON c.f201_rowid_tercero = t.f200_rowid AND c.f201_id_cia = t.f200_id_cia
     WHERE t.f200_id_cia = ${cia}
       AND t.f200_nit IN (${lista})
       AND c.f201_id_sucursal = ''${sucursalNuestra}''
  ')`)

const bloqueadas = (r.recordset ?? []).filter((f) =>
  String(f.bloqueado ?? '').trim() === '0' && String(f.ingreso ?? '') >= desde)

console.log('')
console.log(`  Compradores pagados: ${compradores.length}`)
console.log(`  Sucursales ${sucursalNuestra} creadas por este sistema y con bloqueo: ${bloqueadas.length}`)
for (const f of bloqueadas) console.log(`    ${String(f.nit).trim()}  ingreso ${f.ingreso}`)

if (!enviar) {
  console.log('')
  console.log('  Nada se toco. Con --enviar se actualizan en el ERP (F_ACTUALIZA_REG=1, bloqueo en 1).')
  await cerrarConexion()
  process.exit(0)
}

if (config.siesa.ensayo) {
  console.log('\n  SIESA_ENSAYO=true: no se envia nada.')
  await cerrarConexion()
  process.exit(1)
}

const cfg = await leerConfiguracionSiesa()
const cli = await obtenerCliente()
let ok = 0
let mal = 0
for (const f of bloqueadas) {
  const nit = String(f.nit).trim()
  const comprador = compradores.find((c) => c.cedula === nit)
  if (!comprador) continue
  const doc = armarCliente(comprador, cfg)   // ya trae F201_IND_BLOQUEADO = '1' y F_ACTUALIZA_REG = '1'
  try {
    const resp = await cli.ClientesAsync({ Clientes: paraPangea(doc) })
    const texto = respuestaFallo(resp) ?? 'sin texto'
    console.log(`  ${nit}: ${texto.slice(0, 120)}`)
    ok += 1
  } catch (e) {
    console.log(`  ${nit}: ERROR ${e.message}`)
    mal += 1
  }
}

console.log('')
console.log(`  Actualizadas: ${ok}. Con error: ${mal}.`)
console.log('  Verifica con: npm run desbloquear-clientes  (debe decir 0 con bloqueo).')
await cerrarConexion()
process.exit(mal ? 1 : 0)
