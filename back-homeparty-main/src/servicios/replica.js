// -----------------------------------------------------------------------------
// REPLICA DE LAS VENTAS AL SQL SERVER DEL COLEGIO.
//
// Por que existe (15 de septiembre de 2026): Don Luis, que responde por la
// infraestructura, pidio que las ventas del Homecoming estuvieran en su SQL
// Server -- ahi tiene los backups y los reportes que contabilidad revisa --
// y no solo en el archivo SQLite del servidor de eventos. Tiene razon, y
// esto es lo que lo arregla sin tocar la venta que ya esta abierta.
//
// Que hace: cada minuto copia a la base EventosTCS lo que cambio en orden,
// comprador, asistente y boleta, en cuatro tablas propias con prefijo
// `homecoming_`. David (16 de septiembre de 2026): "En la base de datos de
// eventos pero tablas separadas por favor".
//
// LO QUE ESTE ARCHIVO NO HACE, Y ES LA REGLA MAS IMPORTANTE: no toca nada
// mas de esa base. No lee ni escribe las tablas de la plataforma de eventos
// (events, orders, payments...). No hace DROP ni ALTER de nada. Solo crea
// sus cuatro tablas si no existen y hace MERGE sobre ellas.
//
// COMO SABE QUE CAMBIO: SQLite no tiene "actualizado_en" en todas las tablas,
// asi que cada fila se resume en una huella (sha1 del JSON) que se guarda en
// la tabla local `replica_huella`. Solo se envia lo que tiene huella distinta.
// Con 500 boletas son unas 2.000 filas: el barrido en reposo compara 2.000
// hashes en memoria y no manda nada.
//
// LO QUE NO SE COPIA: `boleta.token_firmado`, que es el secreto del QR. En el
// SQL Server no hace falta para ningun reporte, y una copia mas de ese
// secreto es una copia mas que cuidar.
//
// Fechas: SQLite guarda ISO en UTC. Aqui se convierten a hora de Bogota
// (UTC-5, sin horario de verano) y se guardan como DATETIME2, que es la
// convencion de la plataforma de eventos (`_now_bogota`), para que los
// reportes de contabilidad no tengan que restar cinco horas.
// -----------------------------------------------------------------------------
import crypto from 'node:crypto'
import sql from 'mssql'
import { db } from '../db/index.js'
import { config } from '../config.js'
import { conectar } from '../siesa/config.js'

const BASE = () => config.replica.baseDatos
const PREFIJO = () => config.replica.prefijo

/** "EventosTCS.dbo.homecoming_orden" */
const tabla = (nombre) => `[${BASE()}].[dbo].[${PREFIJO()}${nombre}]`

// -----------------------------------------------------------------------------
// Definicion de las cuatro tablas: columnas, tipos en SQL Server, y de donde
// sale cada valor en SQLite. La clave es siempre la primera columna.
// -----------------------------------------------------------------------------
const fecha = (v) => (v ? new Date(v) : null)
const entero = (v) => (v === null || v === undefined ? null : Number(v))
const texto = (v) => (v === null || v === undefined ? null : String(v))
const booleano = (v) => (v === null || v === undefined ? null : Number(v) ? 1 : 0)

const TABLAS = {
  orden: {
    clave: 'id',
    consulta: `SELECT * FROM orden`,
    columnas: [
      ['id', 'INT NOT NULL', entero],
      ['referencia', 'NVARCHAR(20) NOT NULL', texto],
      ['estado', 'NVARCHAR(20) NOT NULL', texto],
      ['tipo_boleta_id', 'NVARCHAR(40)', texto],
      ['cantidad', 'INT NOT NULL', entero],
      ['precio_unitario_centavos', 'BIGINT', entero],
      ['tarifa_unitaria_centavos', 'BIGINT', entero],
      ['total_centavos', 'BIGINT NOT NULL', entero],
      ['metodo_pago', 'NVARCHAR(30)', texto],
      ['franquicia', 'NVARCHAR(30)', texto],
      ['ultimos_cuatro', 'NVARCHAR(4)', texto],
      ['autorizacion_banco', 'NVARCHAR(30)', texto],
      ['wompi_transaction_id', 'NVARCHAR(60)', texto],
      ['creada_en', 'DATETIME2(0)', fecha],
      ['expira_en', 'DATETIME2(0)', fecha],
      ['pagada_en', 'DATETIME2(0)', fecha],
      ['cerrada_en', 'DATETIME2(0)', fecha],
      ['motivo_cierre', 'NVARCHAR(200)', texto],
      ['correo_enviado_a', 'NVARCHAR(120)', texto],
      ['correo_enviado_en', 'DATETIME2(0)', fecha],
      ['correo_ultimo_error', 'NVARCHAR(500)', texto],
      ['siesa_factura', 'NVARCHAR(30)', texto],
      ['siesa_recibo', 'NVARCHAR(30)', texto],
      ['siesa_error', 'NVARCHAR(500)', texto],
      ['siesa_intentado_en', 'DATETIME2(0)', fecha],
    ],
  },
  comprador: {
    clave: 'orden_id',
    consulta: `SELECT * FROM comprador`,
    columnas: [
      ['orden_id', 'INT NOT NULL', entero],
      ['nombre', 'NVARCHAR(150) NOT NULL', texto],
      ['tipo_documento', 'NVARCHAR(5)', texto],
      ['cedula', 'NVARCHAR(20) NOT NULL', texto],
      ['correo', 'NVARCHAR(120)', texto],
      ['celular', 'NVARCHAR(20)', texto],
      ['direccion', 'NVARCHAR(200)', texto],
      ['ciudad', 'NVARCHAR(100)', texto],
      // Al mediodia UTC a proposito: un DATE a medianoche se corre un dia si
      // el driver lo pasa por otra zona horaria.
      ['fecha_nacimiento', 'DATE', (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`) : null)],
      ['promocion', 'NVARCHAR(10)', texto],
      ['egresado_verificado', 'BIT', booleano],
      ['acepta_datos', 'BIT', booleano],
      ['acepta_terminos', 'BIT', booleano],
      ['aceptado_en', 'DATETIME2(0)', fecha],
    ],
  },
  asistente: {
    clave: 'id',
    consulta: `SELECT * FROM asistente`,
    columnas: [
      ['id', 'INT NOT NULL', entero],
      ['orden_id', 'INT NOT NULL', entero],
      ['indice', 'INT NOT NULL', entero],
      ['nombre', 'NVARCHAR(150) NOT NULL', texto],
      ['tipo_documento', 'NVARCHAR(5)', texto],
      ['cedula', 'NVARCHAR(20)', texto],
      ['correo', 'NVARCHAR(120)', texto],
      ['celular', 'NVARCHAR(20)', texto],
      ['promocion', 'NVARCHAR(10)', texto],
      ['es_egresado', 'BIT', booleano],
      ['correo_enviado_en', 'DATETIME2(0)', fecha],
    ],
  },
  boleta: {
    clave: 'id',
    // Sin token_firmado, a proposito (ver cabecera).
    consulta: `SELECT id, orden_id, asistente_id, estado, emitida_en, usada_en, usada_por, puerta,
                      anulada_en, motivo_anulacion, reemplazada_por
                 FROM boleta`,
    columnas: [
      ['id', 'NVARCHAR(30) NOT NULL', texto],
      ['orden_id', 'INT NOT NULL', entero],
      ['asistente_id', 'INT NOT NULL', entero],
      ['estado', 'NVARCHAR(20) NOT NULL', texto],
      ['emitida_en', 'DATETIME2(0)', fecha],
      ['usada_en', 'DATETIME2(0)', fecha],
      ['usada_por', 'NVARCHAR(80)', texto],
      ['puerta', 'NVARCHAR(40)', texto],
      ['anulada_en', 'DATETIME2(0)', fecha],
      ['motivo_anulacion', 'NVARCHAR(200)', texto],
      ['reemplazada_por', 'NVARCHAR(30)', texto],
    ],
  },
}

const ORDEN_DE_CARGA = ['orden', 'comprador', 'asistente', 'boleta']

// -----------------------------------------------------------------------------
// Huellas locales: que se mando ya, y con que contenido.
// -----------------------------------------------------------------------------
const q = {
  huella: db.prepare(`SELECT huella FROM replica_huella WHERE tabla = ? AND clave = ?`),
  huellas: db.prepare(`SELECT clave, huella FROM replica_huella WHERE tabla = ?`),
  guardarHuella: db.prepare(`
    INSERT INTO replica_huella (tabla, clave, huella, enviada_en) VALUES (?, ?, ?, ?)
    ON CONFLICT(tabla, clave) DO UPDATE SET huella = excluded.huella, enviada_en = excluded.enviada_en`),
  borrarHuellas: db.prepare(`DELETE FROM replica_huella`),
}

const huellaDe = (fila) => crypto.createHash('sha1').update(JSON.stringify(fila)).digest('hex')

/** Hora de Bogota como DATETIME2 "naive", igual que la plataforma del colegio. */
function aBogota(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  return new Date(d.getTime() - 5 * 3600 * 1000)
}

const tipoSql = (definicion) => {
  if (definicion.startsWith('INT')) return sql.Int
  if (definicion.startsWith('BIGINT')) return sql.BigInt
  if (definicion.startsWith('BIT')) return sql.Bit
  if (definicion.startsWith('DATE ')) return sql.Date
  if (definicion.startsWith('DATE')) return sql.DateTime2
  const m = /NVARCHAR\((\d+)\)/.exec(definicion)
  return sql.NVarChar(m ? Number(m[1]) : 200)
}

// -----------------------------------------------------------------------------
// Tablas: se crean si no existen. Nunca se alteran ni se borran.
// -----------------------------------------------------------------------------
export async function asegurarTablas(conexion = null) {
  conexion = conexion ?? (await conectar())
  for (const nombre of ORDEN_DE_CARGA) {
    const t = TABLAS[nombre]
    const columnas = t.columnas.map(([c, tipo]) => `[${c}] ${tipo}`).join(',\n      ')
    const nombreCompleto = `${PREFIJO()}${nombre}`
    await conexion.request().query(`
      IF OBJECT_ID('${BASE()}.dbo.${nombreCompleto}', 'U') IS NULL
      CREATE TABLE ${tabla(nombre)} (
        ${columnas},
        [replicada_en] DATETIME2(0) NOT NULL,
        CONSTRAINT [PK_${nombreCompleto}] PRIMARY KEY ([${t.clave}])
      )`)
  }
}

// -----------------------------------------------------------------------------
// Una fila -> MERGE. Una a la vez: son pocas por minuto, y asi un error en
// una no tumba a las demas.
// -----------------------------------------------------------------------------
async function enviarFila(conexion, nombre, fila) {
  const t = TABLAS[nombre]
  const req = conexion.request()
  const nombres = []
  for (const [columna, tipo, leer] of t.columnas) {
    let valor = leer(fila[columna])
    if (valor instanceof Date && !tipo.startsWith('DATE ')) valor = aBogota(valor)
    req.input(columna, tipoSql(tipo), valor)
    nombres.push(columna)
  }
  req.input('replicada_en', sql.DateTime2, aBogota(new Date()))

  const setActualizar = nombres.filter((c) => c !== t.clave).map((c) => `[${c}] = @${c}`).join(', ')
  const insertar = [...nombres, 'replicada_en'].map((c) => `[${c}]`).join(', ')
  const valores = [...nombres, 'replicada_en'].map((c) => `@${c}`).join(', ')

  await req.query(`
    MERGE ${tabla(nombre)} AS destino
    USING (SELECT @${t.clave} AS clave) AS origen ON destino.[${t.clave}] = origen.clave
    WHEN MATCHED THEN UPDATE SET ${setActualizar}, [replicada_en] = @replicada_en
    WHEN NOT MATCHED THEN INSERT (${insertar}) VALUES (${valores});`)
}

// -----------------------------------------------------------------------------
// El barrido.
// -----------------------------------------------------------------------------
let corriendo = false

/**
 * Copia al SQL Server lo que cambio desde la ultima vez.
 *
 * @param {{todo?: boolean, conexion?: object}} opciones  todo=true reenvia todas
 *   las filas (ignora las huellas): primera carga o reconstruccion. `conexion`
 *   es para las pruebas (una falsa que anota lo que se enviaria).
 * @returns {Promise<{enviadas:number, errores:number, revisadas:number}>}
 */
export async function replicar({ todo = false, conexion = null } = {}) {
  if (!conexion && !replicaActiva()) return { enviadas: 0, errores: 0, revisadas: 0, apagada: true }
  if (corriendo) return { enviadas: 0, errores: 0, revisadas: 0, ocupada: true }
  corriendo = true
  try {
    conexion = conexion ?? (await conectar())
    await asegurarTablas(conexion)
    if (todo) q.borrarHuellas.run()

    let enviadas = 0
    let errores = 0
    let revisadas = 0
    for (const nombre of ORDEN_DE_CARGA) {
      const t = TABLAS[nombre]
      const filas = db.prepare(t.consulta).all()
      const conocidas = new Map(q.huellas.all(nombre).map((h) => [h.clave, h.huella]))
      for (const fila of filas) {
        revisadas += 1
        const clave = String(fila[t.clave])
        const huella = huellaDe(fila)
        if (conocidas.get(clave) === huella) continue
        try {
          await enviarFila(conexion, nombre, fila)
          q.guardarHuella.run(nombre, clave, huella, new Date().toISOString())
          enviadas += 1
        } catch (e) {
          errores += 1
          console.error(`[replica] ${nombre} ${clave}: ${e.message}`)
        }
      }
    }
    return { enviadas, errores, revisadas }
  } finally {
    corriendo = false
  }
}

/** Cuantas filas hay en cada tabla del SQL Server (para el script). */
export async function conteoRemoto() {
  const conexion = await conectar()
  const resultado = {}
  for (const nombre of ORDEN_DE_CARGA) {
    const r = await conexion.request().query(`SELECT COUNT(*) AS n FROM ${tabla(nombre)}`)
    resultado[nombre] = r.recordset[0].n
  }
  return resultado
}

export const replicaActiva = () =>
  Boolean(config.replica.activa && config.replica.baseDatos && config.siesa.host)
