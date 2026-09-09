// -----------------------------------------------------------------------------
// Pruebas de AFORO BAJO CONCURRENCIA.
//
// El resto de la suite compra de a una orden por vez. La realidad del dia que
// abra la venta es otra: se avisa por WhatsApp a los egresados y entran cientos
// de personas al mismo tiempo, todas apretando "Pagar" en el mismo segundo.
//
// Ahi es donde aparece la sobreventa clasica: dos peticiones leen "quedan 3
// cupos" a la vez, las dos deciden que hay espacio, y las dos venden. Con 500
// boletas, unas cuantas de esas significan gente con boleta pagada y sin cupo
// en la puerta.
//
// El backend se defiende con BEGIN IMMEDIATE alrededor del conteo y la reserva.
// Esto lo comprueba de la unica forma que sirve: disparando las compras de
// verdad en paralelo y contando cuantas pasaron.
//
// Se usa un aforo chico (10) para que corra rapido. La condicion de carrera no
// depende del tamanio del aforo: depende de que dos transacciones se crucen, y
// con 40 peticiones simultaneas se cruzan igual con 10 que con 500.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'homecoming-conc-'))

const AFORO = 10
const PETICIONES = 40 // cuatro veces mas gente que boletas

process.env.NODE_ENV = 'test'
process.env.DB_PATH = path.join(CARPETA, 'prueba.db')
process.env.EVENTO_AFORO = String(AFORO)
process.env.VENTA_APERTURA = '2020-01-01T00:00:00-05:00'
process.env.EVENTO_CIERRE_VENTA = '2099-01-01T00:00:00-05:00'
process.env.BOLETA_PRECIO_COP = '80000'
process.env.BOLETA_TARIFA_COP = '7000'
process.env.DATOS_ASISTENTE = 'acta'
process.env.EXIGIR_DIRECCION_FACTURACION = 'true'
process.env.VALIDAR_EGRESADO = 'advertir'
process.env.WOMPI_SIMULACION = 'true'
process.env.WOMPI_PUBLIC_KEY = 'pub_test_deprueba'
process.env.WOMPI_INTEGRITY_SECRET = 'secreto-de-prueba'
process.env.WOMPI_EVENTS_SECRET = 'eventos-de-prueba'
process.env.QR_SECRET = 'qr-secreto-de-prueba'
process.env.ADMIN_TOKEN = 'admin-prueba'
process.env.PUERTA_TOKEN = 'puerta-prueba'
process.env.SMTP_HOST = ''
// El limitador de peticiones se sube a proposito: aqui se prueba el aforo, no
// el rate limit. Con el valor de produccion, 40 peticiones del mismo IP darian
// 429 y la prueba no probaria nada.
process.env.LIMITE_CREAR_ORDEN = '10000'

const { crearApp } = await import('../src/app.js')
const { cerrar: cerrarBaseDatos } = await import('../src/db/index.js')

const servidor = crearApp().listen(0)
const BASE = `http://127.0.0.1:${servidor.address().port}`

test.after(() => {
  servidor.close()
  cerrarBaseDatos()
  try {
    fs.rmSync(CARPETA, { recursive: true, force: true })
  } catch {
    // Windows a veces sigue con el archivo tomado; no vale tumbar la prueba.
  }
})

/** Una compra de 1 boleta, cada una con cedula distinta. */
function compra(i) {
  const cedula = String(1000000000 + i)
  return {
    tipoBoletaId: 'homecoming-80',
    cantidad: 1,
    comprador: {
      nombre: `Egresado Numero ${i}`,
      tipoDocumento: 'CC',
      cedula,
      correo: `egresado${i}@correo.com`,
      celular: '3001234567',
      direccion: 'Cra 43A # 1-50',
      ciudad: 'Medellin',
      promocion: '2004',
    },
    asistentes: [{
      nombre: `Egresado Numero ${i}`,
      tipoDocumento: 'CC',
      cedula,
      promocion: '2004',
    }],
    aceptaTratamientoDatos: true,
    aceptaTerminos: true,
  }
}

async function crearOrden(i) {
  const res = await fetch(`${BASE}/api/ordenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(compra(i)),
  })
  let json = null
  try { json = await res.json() } catch { /* puede no traer cuerpo */ }
  // Los errores vienen envueltos: { error: { codigo, mensaje } }.
  return { status: res.status, codigo: json?.error?.codigo ?? null }
}

// -----------------------------------------------------------------------------

test('40 personas comprando a la vez no pueden vender mas de 10 boletas', async () => {
  // Promise.all dispara las 40 sin esperar a que termine ninguna: es lo mas
  // parecido a la avalancha del primer minuto de venta.
  const resultados = await Promise.all(
    Array.from({ length: PETICIONES }, (_, i) => crearOrden(i)),
  )

  const creadas = resultados.filter((r) => r.status === 201)
  const rechazadas = resultados.filter((r) => r.status !== 201)

  assert.equal(
    creadas.length,
    AFORO,
    `se vendieron ${creadas.length} boletas con un aforo de ${AFORO}`,
  )
  assert.equal(creadas.length + rechazadas.length, PETICIONES, 'ninguna se quedo sin respuesta')

  // A quien no alcanzo hay que decirle por que, no darle un error generico.
  for (const r of rechazadas) {
    assert.ok(
      ['CUPO_INSUFICIENTE', 'VENTA_CERRADA'].includes(r.codigo),
      `un rechazo llego con codigo "${r.codigo}", que el front no sabe explicar`,
    )
  }
})

test('despues de la avalancha, el evento se reporta agotado', async () => {
  const res = await fetch(`${BASE}/api/boletas`)
  const json = await res.json()

  assert.equal(json.boletas[0].disponible, false, 'sigue ofreciendo boletas que no existen')
  assert.equal(json.estadoVenta, 'agotada')
})

test('una compra que llega despues del Sold Out recibe una negativa clara', async () => {
  const { status, codigo } = await crearOrden(999)

  assert.notEqual(status, 201, 'vendio una boleta numero 11')
  assert.ok(
    ['CUPO_INSUFICIENTE', 'VENTA_CERRADA'].includes(codigo),
    `el codigo fue "${codigo}"`,
  )
})
