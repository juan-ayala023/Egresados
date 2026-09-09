// -----------------------------------------------------------------------------
// Pruebas de entrega y alertas:
//
//   - un correo que falla se cuenta, guarda el error y se reagenda
//   - la espera creciente se respeta (no se reintenta antes de tiempo)
//   - cuando se agotan los intentos queda una alerta CRÍTICA
//   - GET /api/admin/alertas junta todo lo que necesita un humano
//   - la sobreventa deja de estar escondida por Math.max(0, ...)
//   - las migraciones se pueden correr dos veces sin romper nada
//
// El SMTP de mentiras es 127.0.0.1:1, que rechaza la conexión al instante: así
// el fallo es inmediato y la prueba no se queda esperando un timeout.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'homecoming-b3-'))

process.env.NODE_ENV = 'test'
process.env.DB_PATH = path.join(CARPETA, 'prueba.db')
process.env.EVENTO_AFORO = '10'
process.env.VENTA_APERTURA = '2020-01-01T00:00:00-05:00'
process.env.EVENTO_CIERRE_VENTA = '2099-01-01T00:00:00-05:00'
process.env.BOLETA_PRECIO_COP = '80000'
process.env.BOLETA_TARIFA_COP = '0'
process.env.DATOS_ASISTENTE = 'acta'
process.env.EXIGIR_DIRECCION_FACTURACION = 'false'
process.env.VALIDAR_EGRESADO = 'apagado'
process.env.WOMPI_SIMULACION = 'true'
process.env.WOMPI_INTEGRITY_SECRET = 'secreto-de-prueba'
process.env.QR_SECRET = 'qr-secreto-de-prueba'
process.env.ADMIN_TOKEN = 'admin-prueba'
process.env.PUERTA_TOKEN = 'puerta-prueba'
process.env.SMTP_HOST = ''
process.env.LIMITE_CREAR_ORDEN = '1000'
process.env.LIMITE_CONSULTAR_ORDEN = '1000'

const { crearApp } = await import('../src/app.js')
const { db, cerrar: cerrarBaseDatos } = await import('../src/db/index.js')
const { config } = await import('../src/config.js')
const { correrMigraciones } = await import('../src/db/migraciones.js')
const { reintentarPendientes, MAX_INTENTOS, ESPERAS_MINUTOS } =
  await import('../src/servicios/correos.js')
const { alertas } = await import('../src/servicios/alertas.js')
const { disponibilidad } = await import('../src/servicios/aforo.js')

const servidor = crearApp().listen(0)
const BASE = `http://127.0.0.1:${servidor.address().port}`

test.after(() => {
  servidor.close()
  cerrarBaseDatos()
  try { fs.rmSync(CARPETA, { recursive: true, force: true }) } catch { /* Windows */ }
})

// --- ayudas -----------------------------------------------------------------

async function pedir(metodo, ruta, { cuerpo, token } = {}) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const texto = await res.text()
  let json = null
  try { json = JSON.parse(texto) } catch { /* no era json */ }
  return { status: res.status, json }
}

let n = 20000000
async function comprarYPagar() {
  const cedula = String(++n)
  const r = await pedir('POST', '/api/ordenes', {
    cuerpo: {
      tipoBoletaId: 'homecoming-80',
      cantidad: 1,
      comprador: {
        nombre: 'Persona De Prueba Numero Uno', tipoDocumento: 'CC', cedula,
        correo: `p${cedula}@correo.com`, celular: '3001234567', promocion: '2004',
      },
      asistentes: [{
        nombre: 'Persona De Prueba Numero Uno', tipoDocumento: 'CC', cedula, promocion: '2004',
      }],
      aceptaTratamientoDatos: true, aceptaTerminos: true,
    },
  })
  assert.equal(r.status, 201, JSON.stringify(r.json))
  const pago = await pedir('POST', '/api/simulacion/pagar', {
    cuerpo: { referencia: r.json.referencia },
  })
  assert.equal(pago.json.estado, 'pagada')

  // El correo del pago sale en segundo plano (setImmediate). Hay que esperarlo:
  // si no, se cuela en medio de la prueba y suma un intento que no es nuestro.
  await esperarCorreo(r.json.referencia)
  return r.json.referencia
}

/** Espera a que el envio de fondo termine (salga o falle). */
async function esperarCorreo(ref, ms = 3000) {
  const limite = Date.now() + ms
  while (Date.now() < limite) {
    const o = db.prepare(
      'SELECT correo_enviado_en, correo_intentos FROM orden WHERE referencia = ?').get(ref)
    if (o.correo_enviado_en || o.correo_intentos > 0) return
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error(`El correo de ${ref} no salio ni fallo en ${ms}ms`)
}

const ordenDe = (ref) => db.prepare('SELECT * FROM orden WHERE referencia = ?').get(ref)

/** Deja la orden como si el correo nunca hubiera salido. */
const olvidarCorreo = (ref) => db.prepare(`
  UPDATE orden SET correo_enviado_en = NULL, correo_enviado_a = NULL,
                   correo_intentos = 0, correo_ultimo_error = NULL,
                   correo_proximo_intento = NULL
   WHERE referencia = ?`).run(ref)

/** SMTP que rechaza la conexión al instante. */
const romperSmtp = () => { config.correo.host = '127.0.0.1'; config.correo.puerto = 1 }
const arreglarSmtp = () => { config.correo.host = '' }

// =============================================================================
test('un correo que falla se cuenta y guarda el motivo', async () => {
  const ref = await comprarYPagar()
  olvidarCorreo(ref)
  romperSmtp()
  try {
    const c = await reintentarPendientes()
    assert.equal(c.revisadas, 1)
    assert.equal(c.enviados, 0)
    assert.equal(c.fallidos, 1)
  } finally {
    arreglarSmtp()
  }

  const o = ordenDe(ref)
  assert.equal(o.correo_enviado_en, null)
  assert.equal(o.correo_intentos, 1, 'el intento tiene que quedar contado UNA vez')
  assert.ok(o.correo_ultimo_error, 'el motivo del fallo se guarda para el panel')
  assert.ok(o.correo_proximo_intento, 'se agenda el siguiente intento')
})

test('la espera creciente se respeta: no se reintenta antes de tiempo', async () => {
  const ref = await comprarYPagar()
  olvidarCorreo(ref)
  romperSmtp()
  try {
    await reintentarPendientes()
  } finally {
    arreglarSmtp()
  }

  const o = ordenDe(ref)
  assert.equal(o.correo_intentos, 1)
  // El próximo intento quedó en el futuro, así que ahora mismo no entra.
  assert.ok(new Date(o.correo_proximo_intento) > new Date())

  const c = await reintentarPendientes()
  assert.equal(c.revisadas, 0, 'todavia no le toca')
  assert.equal(ordenDe(ref).correo_intentos, 1, 'no se gasto un intento de mas')
})

test('cuando el SMTP se recupera, el reintento sale y queda marcado', async () => {
  const ref = await comprarYPagar()
  olvidarCorreo(ref)
  romperSmtp()
  try {
    await reintentarPendientes()
  } finally {
    arreglarSmtp()
  }
  assert.equal(ordenDe(ref).correo_enviado_en, null)

  // Le toca de nuevo (se adelanta el reloj) y ahora el SMTP funciona.
  db.prepare('UPDATE orden SET correo_proximo_intento = ? WHERE referencia = ?')
    .run(new Date(Date.now() - 60_000).toISOString(), ref)

  const c = await reintentarPendientes()
  assert.equal(c.enviados, 1)

  const o = ordenDe(ref)
  assert.ok(o.correo_enviado_en, 'quedo marcado como enviado')
  assert.equal(o.correo_ultimo_error, null, 'se limpia el error viejo')
  assert.equal(o.correo_proximo_intento, null, 'ya no hay nada agendado')
})

test('al agotar los intentos queda una alerta CRITICA', async () => {
  const ref = await comprarYPagar()
  olvidarCorreo(ref)
  // Se le dejan gastados todos menos uno.
  db.prepare('UPDATE orden SET correo_intentos = ? WHERE referencia = ?')
    .run(MAX_INTENTOS - 1, ref)

  romperSmtp()
  try {
    const c = await reintentarPendientes()
    assert.equal(c.agotados, 1)
    assert.equal(c.fallidos, 0)
  } finally {
    arreglarSmtp()
  }

  const o = ordenDe(ref)
  assert.equal(o.correo_intentos, MAX_INTENTOS)

  const a = alertas().alertas.find((x) => x.referencia === ref && x.tipo === 'CORREO_NO_ENVIADO')
  assert.ok(a, 'tiene que aparecer en las alertas')
  assert.equal(a.nivel, 'critico')
  assert.match(a.detalle, /reenviarlo a mano/)
  assert.ok(a.comprador.correo, 'el panel necesita a quien escribirle')
  assert.match(a.accion, /reenviar/, 'la alerta dice que hacer')

  // Y ya no se vuelve a intentar solo.
  const c = await reintentarPendientes()
  assert.equal(c.revisadas, 0)
})

test('las esperas crecen', () => {
  for (let i = 1; i < ESPERAS_MINUTOS.length; i++) {
    assert.ok(ESPERAS_MINUTOS[i] > ESPERAS_MINUTOS[i - 1],
      'cada espera tiene que ser mayor que la anterior')
  }
})

// =============================================================================
test('GET /api/admin/alertas exige token de admin', async () => {
  assert.equal((await pedir('GET', '/api/admin/alertas')).status, 401)
  assert.equal((await pedir('GET', '/api/admin/alertas', { token: 'puerta-prueba' })).status, 401)
  assert.equal((await pedir('GET', '/api/admin/alertas', { token: 'admin-prueba' })).status, 200)
})

test('una orden que expiro con transaccion conocida se reporta', async () => {
  const ref = await comprarYPagar()
  db.prepare(`
    UPDATE orden SET estado = 'expirada', wompi_transaction_id = 'tx-perdida-99',
                     cerrada_en = ?, motivo_cierre = 'La reserva vencio y la pasarela nunca confirmo el pago'
     WHERE referencia = ?`).run(new Date().toISOString(), ref)

  const r = await pedir('GET', '/api/admin/alertas', { token: 'admin-prueba' })
  const a = r.json.alertas.find((x) => x.referencia === ref)
  assert.ok(a, 'esta es la peor de todas: pudo haber pagado y no tener boletas')
  assert.equal(a.tipo, 'EXPIRO_CON_TRANSACCION')
  assert.equal(a.nivel, 'critico')
  assert.equal(a.idTransaccion, 'tx-perdida-99')
  assert.match(a.accion, /panel de Wompi/)
})

test('un AMEX aprobado aparece como aviso, no como critico', async () => {
  const ref = await comprarYPagar()
  db.prepare(`UPDATE orden SET franquicia = 'AMEX' WHERE referencia = ?`).run(ref)

  const r = await pedir('GET', '/api/admin/alertas', { token: 'admin-prueba' })
  const a = r.json.alertas.find((x) => x.referencia === ref && x.tipo === 'FRANQUICIA_NO_ACEPTADA')
  assert.ok(a)
  assert.equal(a.nivel, 'aviso', 'la boleta se emitio: es para gestionar, no una emergencia')

  // Una VISA no genera alerta.
  const otra = await comprarYPagar()
  db.prepare(`UPDATE orden SET franquicia = 'VISA' WHERE referencia = ?`).run(otra)
  const r2 = await pedir('GET', '/api/admin/alertas', { token: 'admin-prueba' })
  assert.ok(!r2.json.alertas.some((x) => x.referencia === otra && x.tipo === 'FRANQUICIA_NO_ACEPTADA'))
})

test('las alertas criticas van primero', async () => {
  const r = await pedir('GET', '/api/admin/alertas', { token: 'admin-prueba' })
  const niveles = r.json.alertas.map((a) => a.nivel)
  const primerAviso = niveles.indexOf('aviso')
  if (primerAviso >= 0) {
    assert.ok(!niveles.slice(primerAviso).includes('critico'),
      'ningun critico puede quedar despues de un aviso')
  }
  assert.equal(r.json.criticas, niveles.filter((x) => x === 'critico').length)
})

// =============================================================================
test('la sobreventa deja de estar escondida', async () => {
  // disponibles se recorta en 0 para no mostrar negativos; eso tapaba el
  // problema. Ahora se reporta aparte.
  const antes = disponibilidad()
  assert.equal(antes.sobreventa, 0)

  // Se fuerzan mas vendidas que el aforo (10).
  const alguna = db.prepare(`SELECT id FROM orden WHERE estado = 'pagada' LIMIT 1`).get()
  db.prepare('UPDATE orden SET cantidad = 20 WHERE id = ?').run(alguna.id)

  const d = disponibilidad()
  assert.ok(d.vendidas > d.aforo)
  assert.equal(d.disponibles, 0, 'no se muestran negativos')
  assert.ok(d.sobreventa > 0, 'pero la sobreventa si se reporta')

  const r = await pedir('GET', '/api/admin/alertas', { token: 'admin-prueba' })
  const a = r.json.alertas.find((x) => x.tipo === 'SOBREVENTA')
  assert.ok(a)
  assert.equal(a.nivel, 'critico')

  db.prepare('UPDATE orden SET cantidad = 1 WHERE id = ?').run(alguna.id)
})

// =============================================================================
test('las migraciones se pueden correr dos veces sin romper nada', () => {
  // Es lo que va a pasar en cada despliegue: el proceso arranca y migra.
  const primera = correrMigraciones(db)
  const segunda = correrMigraciones(db)
  assert.deepEqual(primera, [], 'ya estaban aplicadas al importar la base')
  assert.deepEqual(segunda, [])

  const columnas = db.prepare('PRAGMA table_info(orden)').all().map((c) => c.name)
  assert.ok(columnas.includes('correo_intentos'))
  assert.ok(columnas.includes('correo_ultimo_error'))
  assert.ok(columnas.includes('correo_proximo_intento'))
})
