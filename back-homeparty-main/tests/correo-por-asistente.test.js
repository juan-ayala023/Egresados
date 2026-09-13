// -----------------------------------------------------------------------------
// CADA BOLETA A SU PROPIO DUENIO.
//
// El colegio lo pidio el 11 de septiembre de 2026, y lo afino esa misma tarde
// tras la primera prueba: cada quien recibe SOLO la suya. Quien pago recibe la
// suya mas el resumen de la compra (es su comprobante), y se le dice a quien
// se le mando el resto. La unica excepcion: un acompanante sin correo no puede
// quedarse sin boleta, asi que la suya va en el correo de quien pago.
//
// Lo que mas cuida este archivo NO es que se repartan -- es que NO SE REPITAN.
// El barrido de reintentos corre cada minuto y Wompi reenvia eventos: sin
// marcar por asistente, un reintento por UNO que fallo le volveria a mandar la
// boleta a los otros tres. Recibir cuatro veces la misma boleta hace que la
// gente deje de abrir el correo, y el QR vive ahi.
//
// COMO ESTA PROBADO: sin SMTP configurado, el envio no sale a la red -- se
// escribe un .html por destinatario en datos/correos/. Se deja correr el
// codigo de verdad y se mira que archivos aparecieron. No se simula nada, asi
// que si el armado del correo se rompe, estas pruebas tambien.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'hc80-correos-'))

process.env.NODE_ENV = 'test'
process.env.DB_PATH = path.join(CARPETA, 'prueba.db')
process.env.WOMPI_SIMULACION = 'true'
process.env.SIESA_WSDL_URL = ''
process.env.MSSQL_HOST = ''
// Sin SMTP el correo se escribe a disco en vez de enviarse. Es lo que permite
// ver A QUIEN se le mando sin tocar la red.
process.env.SMTP_HOST = ''

const { db } = await import('../src/db/index.js')
const { enviarCorreoDeOrden } = await import('../src/servicios/ordenes.js')

const BUZON = path.join(CARPETA, 'correos')

/** Los .html que se escribieron, o sea los correos que salieron. */
const buzon = () => (fs.existsSync(BUZON) ? fs.readdirSync(BUZON) : [])

/** ¿Salio un correo para esta direccion? El archivo la lleva en el nombre. */
const leLlego = (direccion) => {
  const marca = direccion.replace(/[^\w.-]/g, '_')
  return buzon().some((f) => f.includes(marca))
}

/** Cuantos correos salieron para una orden. */
const cuantos = (referencia) => buzon().filter((f) => f.startsWith(referencia)).length

function vaciarBuzon() {
  if (fs.existsSync(BUZON)) fs.rmSync(BUZON, { recursive: true, force: true })
}

/** Crea una orden pagada con sus asistentes. Devuelve { id, referencia }. */
function ordenCon(asistentes, correoComprador = 'quien.paga@ejemplo.com') {
  const referencia = `HC80-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const o = db.prepare(`
    INSERT INTO orden (referencia, estado, tipo_boleta_id, cantidad,
      precio_unitario_centavos, tarifa_unitaria_centavos, total_centavos,
      creada_en, expira_en, pagada_en, wompi_transaction_id, metodo_pago)
    VALUES (?, 'pagada', 'homecoming-80', ?, 8000000, 700000, ?,
      datetime('now'), datetime('now'), datetime('now'), 'tx-1', 'CARD')`)
    .run(referencia, asistentes.length, 8700000 * asistentes.length)

  const ordenId = o.lastInsertRowid

  db.prepare(`
    INSERT INTO comprador (orden_id, nombre, tipo_documento, cedula, correo,
      celular, direccion, ciudad, promocion, aceptado_en)
    VALUES (?, 'Juan Ayala Botero', 'CC', '1023626286', ?, '3001234567',
      'Cra 45 # 12-30', 'Medellin', '2010', datetime('now'))`)
    .run(ordenId, correoComprador)

  asistentes.forEach((a, i) => {
    const r = db.prepare(`
      INSERT INTO asistente (orden_id, indice, nombre, tipo_documento, cedula,
        correo, promocion, es_egresado)
      VALUES (?, ?, ?, 'CC', ?, ?, '2010', 1)`)
      .run(ordenId, i, a.nombre, String(1000000 + i), a.correo ?? null)

    db.prepare(`
      INSERT INTO boleta (id, orden_id, asistente_id, token_firmado, estado, emitida_en)
      VALUES (?, ?, ?, ?, 'emitida', datetime('now'))`)
      .run(`BOL${ordenId}X${i}`, ordenId, r.lastInsertRowid, `tok-${ordenId}-${i}`)
  })

  return { id: ordenId, referencia }
}

const asistentesDe = (ordenId) =>
  db.prepare(`SELECT indice, correo, correo_enviado_en FROM asistente
               WHERE orden_id = ? ORDER BY indice`).all(ordenId)

test.after(() => {
  // En Windows SQLite deja el archivo abierto y el borrado revienta. Que no
  // se pueda limpiar una carpeta temporal no es un fallo de la prueba.
  try {
    db.close()
    fs.rmSync(CARPETA, { recursive: true, force: true })
  } catch { /* el sistema la recoge solo */ }
})

// -----------------------------------------------------------------------------

test('cada acompanante recibe SU boleta en SU correo', async () => {
  vaciarBuzon()
  const { id, referencia } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
    { nombre: 'Maria Gomez', correo: 'maria@ejemplo.com' },
    { nombre: 'Pedro Ruiz', correo: 'pedro@ejemplo.com' },
  ])

  await enviarCorreoDeOrden(id)

  assert.ok(leLlego('maria@ejemplo.com'), `Maria no recibio la suya. Buzon: ${buzon()}`)
  assert.ok(leLlego('pedro@ejemplo.com'), `Pedro no recibio la suya. Buzon: ${buzon()}`)
  // Tres correos: el del comprador (todas) + uno por cada acompanante.
  assert.equal(cuantos(referencia), 3)
})

test('al acompanante le llega SOLO su boleta, y dice quien se la compro', async () => {
  vaciarBuzon()
  const { id } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
    { nombre: 'Maria Gomez', correo: 'maria@ejemplo.com' },
  ])

  await enviarCorreoDeOrden(id)

  const archivo = buzon().find((f) => f.includes('maria_ejemplo.com'))
  const html = fs.readFileSync(path.join(BUZON, archivo), 'utf8')

  assert.ok(html.includes('Maria Gomez'), 'deberia traer su nombre')
  assert.ok(!html.includes('Juan Ayala Botero</div>'), 'no deberia traer la boleta del comprador')
  // A quien no pago hay que decirle POR QUE le llega una boleta.
  assert.ok(html.includes('compró tu boleta'), 'deberia decir quien se la compro')
  // Y no se le muestra cuanto se pago: no es su plata.
  assert.ok(!html.includes('Total pagado'), 'no deberia ver el total')
})

test('quien compro recibe SOLO la suya, con el resumen, y sabe a quien fue el resto', async () => {
  vaciarBuzon()
  const { id, referencia } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
    { nombre: 'Maria Gomez', correo: 'maria@ejemplo.com' },
  ])

  await enviarCorreoDeOrden(id)

  const html = fs.readFileSync(path.join(BUZON, `${referencia}.html`), 'utf8')
  // Su boleta si.
  assert.ok(html.includes('Juan Ayala Botero'))
  // La de Maria NO va como tarjeta (el </div> distingue la tarjeta de la
  // mencion en el aviso).
  assert.ok(!html.includes('Maria Gomez</div>'), 'la boleta de Maria no debe ir en el correo del comprador')
  // Pero si se le dice que a Maria le llego la suya.
  assert.ok(html.includes('se envió a su propio correo'), 'debe avisar a quien se le mando aparte')
  assert.ok(html.includes('Maria Gomez'))
  // Y el resumen de la compra: es su comprobante.
  assert.ok(html.includes('Total pagado'))
})

test('al comprador NO se le manda dos veces aunque sea tambien asistente', async () => {
  vaciarBuzon()
  const { id, referencia } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
    { nombre: 'Maria Gomez', correo: 'maria@ejemplo.com' },
  ])

  await enviarCorreoDeOrden(id)

  // Dos archivos, no tres: el del comprador y el de Maria.
  assert.equal(cuantos(referencia), 2)
})

test('un acompanante SIN correo no se queda sin boleta: la suya va en la del comprador', async () => {
  vaciarBuzon()
  const { id, referencia } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
    { nombre: 'Sin Correo Perez', correo: null },
  ])

  await enviarCorreoDeOrden(id)

  assert.equal(cuantos(referencia), 1, 'no deberia haber correo individual')
  const html = fs.readFileSync(path.join(BUZON, `${referencia}.html`), 'utf8')
  assert.ok(html.includes('Sin Correo Perez'), 'su boleta debe ir en la del comprador')
})

test('REENVIAR no le manda la boleta dos veces al acompanante', async () => {
  // La que mas importa. El barrido corre cada minuto; si esto falla, la gente
  // recibe la misma boleta una y otra vez y deja de abrir el correo.
  vaciarBuzon()
  const { id } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
    { nombre: 'Maria Gomez', correo: 'maria@ejemplo.com' },
  ])

  await enviarCorreoDeOrden(id)
  assert.ok(leLlego('maria@ejemplo.com'))

  vaciarBuzon()
  await enviarCorreoDeOrden(id)   // segundo intento, como haria el barrido

  assert.ok(!leLlego('maria@ejemplo.com'), 'a Maria le llego la boleta dos veces')
  // Al comprador SI se le reenvia: eso es lo que hace el boton del panel.
  assert.equal(buzon().length, 1)
})

test('queda anotado a quien ya se le mando', async () => {
  vaciarBuzon()
  const { id } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
    { nombre: 'Maria Gomez', correo: 'maria@ejemplo.com' },
    { nombre: 'Sin Correo Perez', correo: null },
  ])

  await enviarCorreoDeOrden(id)
  const filas = asistentesDe(id)

  assert.equal(filas[0].correo_enviado_en, null, 'el comprador no se marca aparte')
  assert.ok(filas[1].correo_enviado_en, 'Maria deberia quedar marcada')
  assert.equal(filas[2].correo_enviado_en, null, 'quien no tiene correo no se marca')
})

test('dos acompanantes con el mismo correo reciben UN correo con las dos', async () => {
  // Una pareja que pone el mismo correo no tiene por que recibir dos mensajes.
  vaciarBuzon()
  const { id, referencia } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
    { nombre: 'Maria Gomez', correo: 'pareja@ejemplo.com' },
    { nombre: 'Pedro Ruiz', correo: 'pareja@ejemplo.com' },
  ])

  await enviarCorreoDeOrden(id)

  // Dos correos en total: el del comprador y uno para la pareja.
  assert.equal(cuantos(referencia), 2)
  const archivo = buzon().find((f) => f.includes('pareja_ejemplo.com'))
  const html = fs.readFileSync(path.join(BUZON, archivo), 'utf8')
  assert.ok(html.includes('Maria Gomez'))
  assert.ok(html.includes('Pedro Ruiz'))
})

test('una orden que no esta pagada no manda nada', async () => {
  vaciarBuzon()
  const { id, referencia } = ordenCon([
    { nombre: 'Juan Ayala Botero', correo: 'quien.paga@ejemplo.com' },
  ])
  db.prepare(`UPDATE orden SET estado = 'pendiente' WHERE id = ?`).run(id)

  const r = await enviarCorreoDeOrden(id)

  assert.equal(r.enviado, false)
  assert.equal(cuantos(referencia), 0)
})
