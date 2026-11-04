// -----------------------------------------------------------------------------
// QUE DOS PROCESOS NO MANDEN EL MISMO CORREO.
//
// 4 de noviembre de 2026, cargando la tercera tanda de cortesias: el septimo
// correo salio y el octavo se quedo colgado esperando a Gmail. Mientras el
// script seguia pegado, el barrido del API -- que corre cada minuto -- tomo esa
// misma orden y la mando por su lado. Es lo que en octubre le hizo llegar la
// boleta dos veces a una compradora.
//
// La defensa es apartar la orden ANTES de empezar a enviar: mientras el envio
// esta en curso no aparece como pendiente, asi que nadie mas la toma. Tiene
// que apartarse de forma sincrona, antes del primer await, o la ventana sigue
// abierta.
//
// (Los timeouts del transporte, que son la otra mitad del arreglo, viven en
// src/lib/correo.js y no se pueden probar sin un servidor SMTP que se cuelgue.)
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'hc80-solape-'))

process.env.NODE_ENV = 'test'
process.env.DB_PATH = path.join(CARPETA, 'prueba.db')
process.env.WOMPI_SIMULACION = 'true'
process.env.SIESA_WSDL_URL = ''
process.env.MSSQL_HOST = ''
process.env.SMTP_HOST = ''   // sin SMTP el correo se escribe a disco

const { db } = await import('../src/db/index.js')
const { enviarCorreoDeOrden, pendientesDeCorreo } = await import('../src/servicios/ordenes.js')

let n = 0
/** Una orden pagada a la que todavia no le ha salido el correo. */
function ordenPagada() {
  n += 1
  const referencia = `HC80-SOL${n}`
  const o = db.prepare(`
    INSERT INTO orden (referencia, estado, tipo_boleta_id, cantidad,
      precio_unitario_centavos, tarifa_unitaria_centavos, total_centavos,
      creada_en, expira_en, pagada_en, wompi_transaction_id, metodo_pago)
    VALUES (?, 'pagada', 'homecoming-80', 1, 8000000, 700000, 8700000,
      datetime('now'), datetime('now'), datetime('now'), ?, 'CARD')`)
    .run(referencia, `tx-${n}`)
  const ordenId = Number(o.lastInsertRowid)

  db.prepare(`
    INSERT INTO comprador (orden_id, nombre, tipo_documento, cedula, correo,
      celular, direccion, ciudad, promocion, aceptado_en)
    VALUES (?, 'Gloria Zapata Ceron', 'CC', ?, ?, '3146526940',
      'Cra 45 # 12-30', 'Medellin', '1990', datetime('now'))`)
    .run(ordenId, String(42777450 + n), `gloria${n}@ejemplo.com`)

  const a = db.prepare(`
    INSERT INTO asistente (orden_id, indice, nombre, tipo_documento, cedula,
      correo, promocion, es_egresado)
    VALUES (?, 0, 'Gloria Zapata Ceron', 'CC', ?, NULL, '1990', 1)`)
    .run(ordenId, String(42777450 + n))

  db.prepare(`
    INSERT INTO boleta (id, orden_id, asistente_id, token_firmado, estado, emitida_en)
    VALUES (?, ?, ?, ?, 'emitida', datetime('now'))`)
    .run(`BOL-SOL${n}`, ordenId, Number(a.lastInsertRowid), `tok-sol-${n}`)

  return { id: ordenId, referencia }
}

const estaPendiente = (ordenId) => pendientesDeCorreo(5, 100).some((o) => o.id === ordenId)

// -----------------------------------------------------------------------------

test('antes de enviar, la orden esta pendiente de correo', () => {
  const orden = ordenPagada()
  assert.ok(estaPendiente(orden.id))
})

test('mientras se esta enviando, el barrido ya no la ve', async () => {
  const orden = ordenPagada()

  // Sin await a proposito: es el momento exacto en el que el barrido del
  // minuto siguiente entraba a mandar el mismo correo.
  const enviando = enviarCorreoDeOrden(orden.id)
  assert.equal(estaPendiente(orden.id), false, 'quedo libre para que otro la tome')

  await enviando
})

test('cuando el correo sale, deja de estar pendiente para siempre', async () => {
  const orden = ordenPagada()
  await enviarCorreoDeOrden(orden.id)

  const fila = db.prepare(`SELECT correo_enviado_en FROM orden WHERE id = ?`).get(orden.id)
  assert.ok(fila.correo_enviado_en, 'quedo marcado como enviado')
  assert.equal(estaPendiente(orden.id), false)
})

test('la reserva es corta: no deja la orden parada mas de unos minutos', async () => {
  const orden = ordenPagada()
  const enviando = enviarCorreoDeOrden(orden.id)

  const { correo_proximo_intento: cuando } = db
    .prepare(`SELECT correo_proximo_intento FROM orden WHERE id = ?`).get(orden.id)
  const minutos = (new Date(cuando).getTime() - Date.now()) / 60000
  assert.ok(minutos > 2, `la reserva dura ${minutos.toFixed(1)} min: tiene que pasar el timeout de 2 min del envio`)
  assert.ok(minutos < 10, `la reserva dura ${minutos.toFixed(1)} min: demasiado si el proceso se muere a mitad`)

  await enviando
})
