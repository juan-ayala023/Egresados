// -----------------------------------------------------------------------------
// Pruebas de la replica al SQL Server del colegio.
//
// No hay SQL Server aqui: se pasa una conexion falsa que anota cada consulta.
// Lo que se cuida:
//   1. Que NUNCA salga un DROP, ALTER, DELETE o TRUNCATE: es la base del
//      colegio y solo se crean y se escriben nuestras cuatro tablas.
//   2. Que solo se mande lo que cambio (huellas), no toda la base cada minuto.
//   3. Que el token del QR no viaje.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.EVENTO_NOMBRE = 'Homecoming 80 Anos'
process.env.WOMPI_SIMULACION = 'true'
process.env.REPLICA_SQLSERVER = 'true'
process.env.REPLICA_BASE = 'EventosTCS'
process.env.REPLICA_PREFIJO = 'homecoming_'

const { db } = await import('../src/db/index.js')
const { replicar } = await import('../src/servicios/replica.js')

/** Conexion falsa: guarda cada SQL y sus parametros. */
function conexionFalsa() {
  const consultas = []
  return {
    consultas,
    request() {
      const params = {}
      return {
        input(nombre, _tipo, valor) { params[nombre] = valor; return this },
        async query(texto) { consultas.push({ texto, params }); return { recordset: [] } },
      }
    },
  }
}

function ordenPagada(referencia) {
  const r = db.prepare(`
    INSERT INTO orden (referencia, estado, tipo_boleta_id, cantidad,
      precio_unitario_centavos, tarifa_unitaria_centavos, total_centavos,
      creada_en, expira_en, pagada_en, wompi_transaction_id, metodo_pago)
    VALUES (?, 'pagada', 'homecoming-80', 1, 8000000, 700000, 8700000,
      '2026-09-15T14:28:00.000Z', '2026-09-15T14:43:00.000Z', '2026-09-15T14:30:00.000Z', 'tx-1', 'CARD')`)
    .run(referencia)
  const ordenId = r.lastInsertRowid
  db.prepare(`
    INSERT INTO comprador (orden_id, nombre, tipo_documento, cedula, correo, celular, direccion, ciudad, promocion, aceptado_en)
    VALUES (?, 'Ana Maria Reza Mejia', 'CC', '43626253', 'ana@ejemplo.com', '3001234567', 'Cra 1 # 2-3', 'Medellín, Antioquia', '1994', '2026-09-15T14:28:00.000Z')`)
    .run(ordenId)
  const a = db.prepare(`
    INSERT INTO asistente (orden_id, indice, nombre, tipo_documento, cedula, promocion, es_egresado)
    VALUES (?, 0, 'Ana Maria Reza Mejia', 'CC', '43626253', '1994', 1)`).run(ordenId)
  db.prepare(`
    INSERT INTO boleta (id, orden_id, asistente_id, token_firmado, estado, emitida_en)
    VALUES (?, ?, ?, ?, 'emitida', '2026-09-15T14:30:00.000Z')`)
    .run(`BOL${referencia}`, ordenId, a.lastInsertRowid, `SECRETO-${referencia}`)
  return ordenId
}

test('la primera pasada crea las cuatro tablas y manda todas las filas; la segunda no manda nada', async () => {
  ordenPagada('HC80-REP001')
  const c = conexionFalsa()
  const r = await replicar({ conexion: c })
  assert.equal(r.enviadas, 4)   // orden, comprador, asistente, boleta
  assert.equal(r.errores, 0)

  const creates = c.consultas.filter((x) => /CREATE TABLE/.test(x.texto))
  assert.equal(creates.length, 4)
  assert.ok(creates.every((x) => /IF OBJECT_ID\('EventosTCS\.dbo\.homecoming_/.test(x.texto)), 'solo crea si no existe')
  assert.ok(c.consultas.filter((x) => /MERGE/.test(x.texto)).length === 4)

  // Segunda pasada sin cambios: nada que enviar.
  const c2 = conexionFalsa()
  const r2 = await replicar({ conexion: c2 })
  assert.equal(r2.enviadas, 0)
  assert.equal(c2.consultas.filter((x) => /MERGE/.test(x.texto)).length, 0)
})

test('cuando cambia una fila, solo esa se reenvia', async () => {
  const id = ordenPagada('HC80-REP002')
  await replicar({ conexion: conexionFalsa() })

  db.prepare(`UPDATE orden SET siesa_factura = '001-FES-1', siesa_recibo = '001-RCV-1' WHERE id = ?`).run(id)
  const c = conexionFalsa()
  const r = await replicar({ conexion: c })
  assert.equal(r.enviadas, 1)
  const merge = c.consultas.find((x) => /MERGE .*homecoming_orden/.test(x.texto))
  assert.equal(merge.params.siesa_factura, '001-FES-1')
  assert.equal(merge.params.referencia, 'HC80-REP002')
})

test('NUNCA sale un DROP, ALTER, DELETE ni TRUNCATE hacia la base del colegio', async () => {
  ordenPagada('HC80-REP003')
  const c = conexionFalsa()
  await replicar({ conexion: c, todo: true })
  for (const { texto } of c.consultas) {
    assert.ok(!/\b(DROP|ALTER|DELETE|TRUNCATE)\b/i.test(texto), `consulta peligrosa: ${texto.slice(0, 80)}`)
    // Y solo toca tablas con nuestro prefijo.
    const tablas = [...texto.matchAll(/\[EventosTCS\]\.\[dbo\]\.\[(\w+)\]/g)].map((m) => m[1])
    assert.ok(tablas.every((t) => t.startsWith('homecoming_')), `toca una tabla ajena: ${tablas}`)
  }
})

test('el token del QR no viaja al SQL Server', async () => {
  ordenPagada('HC80-REP004')
  const c = conexionFalsa()
  await replicar({ conexion: c, todo: true })
  for (const { texto, params } of c.consultas) {
    assert.ok(!/token_firmado/.test(texto))
    assert.ok(!Object.values(params).some((v) => String(v).startsWith('SECRETO-')))
  }
})

test('las fechas van en hora de Bogota, como la plataforma del colegio', async () => {
  ordenPagada('HC80-REP005')
  const c = conexionFalsa()
  await replicar({ conexion: c, todo: true })
  const merge = c.consultas.find((x) => /MERGE .*homecoming_orden/.test(x.texto) && x.params.referencia === 'HC80-REP005')
  // 14:30 UTC -> 09:30 Bogota, representado como Date "naive" 5h atras.
  assert.equal(merge.params.pagada_en.toISOString(), '2026-09-15T09:30:00.000Z')
})
