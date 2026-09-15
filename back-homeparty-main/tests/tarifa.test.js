// -----------------------------------------------------------------------------
// Pruebas del cobro con la TARIFA REAL.
//
// Van en archivo aparte por la misma razon que bloque1: el runner de node corre
// cada archivo en su propio proceso, y estas necesitan una configuracion
// distinta. bloque1 congelo el caso de tarifa 0, que fue la decision de un
// momento; despues el comite la dejo en 7.000 y nadie volvio a probar
// ese camino.
//
// Lo que se prueba aqui es plata de 500 personas:
//   precio 80.000 + tarifa 7.000 = 87.000 por boleta.
//
// Un error de un peso en el total no se nota mirando la pantalla, pero viaja
// dentro de la firma de integridad: si el monto firmado no es el mismo que se
// le pide cobrar a Wompi, Wompi rechaza el checkout con un error opaco y nadie
// puede comprar. Por eso se prueban las dos cosas juntas, el total y la firma.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'homecoming-tarifa-'))

// La configuracion REAL del .env, no una de laboratorio.
process.env.NODE_ENV = 'test'
process.env.DB_PATH = path.join(CARPETA, 'prueba.db')
process.env.EVENTO_AFORO = '500'
process.env.VENTA_APERTURA = '2020-01-01T00:00:00-05:00'
process.env.EVENTO_CIERRE_VENTA = '2099-01-01T00:00:00-05:00'
process.env.BOLETA_PRECIO_COP = '80000'
process.env.BOLETA_TARIFA_COP = '7000'
process.env.MAX_POR_COMPRA = '4'
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
process.env.LIMITE_CREAR_ORDEN = '1000'

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

async function pedir(metodo, ruta, { cuerpo } = {}) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const texto = await res.text()
  let json = null
  try { json = JSON.parse(texto) } catch { /* no era json */ }
  return { status: res.status, json }
}

/**
 * Compra valida. Cada prueba pasa su propia cedula base porque el limite de 4
 * boletas es ACUMULADO por cedula: si todas comprasen con la misma, la segunda
 * prueba en correr recibiria 409 y el fallo no tendria nada que ver con la
 * tarifa, que es lo que se esta probando aqui.
 */
const compra = (cantidad = 1, cedulaBase = 1020304050) => ({
  tipoBoletaId: 'homecoming-80',
  cantidad,
  comprador: {
    nombre: 'Maria Fernanda Restrepo Gomez',
    tipoDocumento: 'CC',
    cedula: String(cedulaBase),
    correo: 'maria@correo.com',
    celular: '3001234567',
    direccion: 'Cra 43A # 1-50 Apto 902',
    ciudad: 'Medellin',
    fechaNacimiento: '1986-05-10',
    promocion: '2004',
  },
  asistentes: Array.from({ length: cantidad }, (_, i) => ({
    nombre: `Asistente Numero ${i + 1}`,
    tipoDocumento: 'CC',
    cedula: String(cedulaBase + i),
    promocion: '2004',
  })),
  aceptaTratamientoDatos: true,
  aceptaTerminos: true,
})

// -----------------------------------------------------------------------------

test('la boleta se publica desglosada: 80.000 + 7.000 = 87.000', async () => {
  const { status, json } = await pedir('GET', '/api/boletas')
  assert.equal(status, 200)

  const b = json.boletas[0]
  assert.equal(b.precioCentavos, 8000000, 'el precio es 80.000')
  assert.equal(b.tarifaServicioCentavos, 700000, 'la tarifa es 7.000')
  assert.equal(b.totalCentavos, 8700000, 'el comprador paga 87.000 por boleta')

  // El front pinta el desglose con estos tres numeros. Si el total no es la
  // suma exacta, el usuario ve una cuenta que no cuadra.
  assert.equal(b.precioCentavos + b.tarifaServicioCentavos, b.totalCentavos)
})

test('la tarifa se cobra por boleta, no por compra', async () => {
  const { status, json } = await pedir('POST', '/api/ordenes', { cuerpo: compra(3, 2020304050) })
  assert.equal(status, 201)

  // 3 boletas: (80.000 + 7.000) x 3 = 261.000
  assert.equal(json.totalCentavos, 26100000)

  // El error clasico es sumar la tarifa una sola vez: 80.000 x 3 + 7.000.
  assert.notEqual(json.totalCentavos, 24700000, 'la tarifa quedo cobrada una sola vez')
})

test('Wompi recibe firmado el total con tarifa, no el precio pelado', async () => {
  const { status, json } = await pedir('POST', '/api/ordenes', { cuerpo: compra(2, 3030304050) })
  assert.equal(status, 201)

  const esperado = 17400000 // (80.000 + 7.000) x 2
  assert.equal(json.totalCentavos, esperado)
  assert.equal(json.wompi.amountInCents, esperado, 'a Wompi se le pide cobrar el total')

  // La firma se recalcula aqui a mano, con la formula que publica Wompi. Si
  // el backend firmara el precio sin tarifa, esta comparacion falla: es la
  // unica forma de detectar que se firmo un monto distinto al que se cobra.
  const cadena = `${json.referencia}${esperado}COP${process.env.WOMPI_INTEGRITY_SECRET}`
  const firma = crypto.createHash('sha256').update(cadena, 'utf8').digest('hex')
  assert.equal(json.wompi.signatureIntegrity, firma)
})

test('el webhook rechaza el pago del precio sin la tarifa', async () => {
  const { json: orden } = await pedir('POST', '/api/ordenes', { cuerpo: compra(1, 4040304050) })

  // Alguien paga 80.000 en vez de 87.000. Puede ser un monto manipulado en el
  // navegador o una orden vieja de cuando la tarifa era 0. En cualquier caso
  // no se puede emitir la boleta: falta plata.
  await pedir('POST', '/api/webhooks/wompi', {
    cuerpo: {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'trx-tarifa-faltante',
          reference: orden.referencia,
          status: 'APPROVED',
          amount_in_cents: 8000000, // el precio pelado, sin la tarifa
          currency: 'COP',
          payment_method_type: 'CARD',
        },
      },
      sent_at: new Date().toISOString(),
    },
  })

  // Se responde 200 a proposito, aunque el evento se descarte: a una pasarela
  // hay que confirmarle que el aviso llego, o lo reintenta indefinidamente. Lo
  // que importa no es el codigo de respuesta sino que la orden NO quede pagada.
  const { json: despues } = await pedir('GET', `/api/ordenes/${orden.referencia}`)
  assert.notEqual(despues.estado, 'pagada', 'la orden no puede quedar pagada')
})
