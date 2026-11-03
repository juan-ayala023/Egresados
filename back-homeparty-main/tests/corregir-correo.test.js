// -----------------------------------------------------------------------------
// CORREGIR UN CORREO MAL ESCRITO.
//
// 3 de noviembre de 2026: Maria Mercedes Arboleda escribio "@hotmail.vom". El
// correo pasa la validacion (".vom" es un dominio posible) pero no existe: su
// boleta se fue al vacio. Lo que tiene que pasar, y lo que NO:
//
//   1. Se puede encontrar el dedazo sin revisar 500 filas a mano.
//   2. Corregirlo cambia el correo y deja la compra lista para reenviar.
//   3. El QR NO se toca. Es la misma persona y la misma boleta: si se anulara,
//      quien ya tuviera el PDF en la mano se quedaria por fuera.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.EVENTO_NOMBRE = 'TCS Homecoming 80 Anos'
process.env.WOMPI_SIMULACION = 'true'
process.env.SIESA_ENSAYO = 'true'

const { db } = await import('../src/db/index.js')
const { correoSugerido } = await import('../src/lib/validaciones.js')
const {
  crearOrden, confirmarPago, boletasDeOrden, buscarPorReferencia,
  compradorDe, asistentesDe, corregirCorreo, correosSospechosos,
} = await import('../src/servicios/ordenes.js')

let siguiente = 1000
function compraPagada({ correo, segundoAsistente = null }) {
  const cedula = String(79000000 + siguiente++)
  const { referencia } = crearOrden({
    tipoBoletaId: 'homecoming-80',
    cantidad: segundoAsistente ? 2 : 1,
    comprador: {
      nombre: 'Maria Mercedes Arboleda', tipoDocumento: 'CC', cedula,
      correo, celular: '3001234567',
      direccion: 'Cra 43A # 1-50', ciudad: 'Medellín, Antioquia',
      fechaNacimiento: '1966-04-12', promocion: '1984',
    },
    asistentes: [
      { nombre: 'Maria Mercedes Arboleda', tipoDocumento: 'CC', cedula, correo, promocion: '1984' },
      ...(segundoAsistente ? [segundoAsistente] : []),
    ],
    aceptaTratamientoDatos: true, aceptaTerminos: true,
  })
  confirmarPago(referencia, { estadoDestino: 'pagada', transactionId: `tx-${cedula}`, metodoPago: 'CARD' })
  return buscarPorReferencia(referencia)
}

// -----------------------------------------------------------------------------

test('reconoce el dominio mal escrito y dice cual era', () => {
  assert.equal(correoSugerido('tallerlabruma@hotmail.vom'), 'tallerlabruma@hotmail.com')
  assert.equal(correoSugerido('alguien@gmail.con'), 'alguien@gmail.com')
  assert.equal(correoSugerido('alguien@gmai.com'), 'alguien@gmail.com')
  assert.equal(correoSugerido('profe@columbus.edu.c'), 'profe@columbus.edu.co')
})

test('no se inventa correcciones sobre dominios que estan bien', () => {
  assert.equal(correoSugerido('alguien@gmail.com'), null)
  assert.equal(correoSugerido('profe@columbus.edu.co'), null)
  // Un dominio propio, que no se parece a ninguno de la lista: se deja quieto.
  assert.equal(correoSugerido('contacto@tallerlabruma.co'), null)
  assert.equal(correoSugerido('juan@empresa-de-el.com.co'), null)
})

test('encuentra la compra del correo mal escrito entre las que estan bien', () => {
  compraPagada({ correo: 'buena1@gmail.com' })
  const mala = compraPagada({ correo: 'tallerlabruma@hotmail.vom' })
  compraPagada({ correo: 'buena2@hotmail.com' })

  const encontradas = correosSospechosos()
  assert.equal(encontradas.length, 1)
  assert.equal(encontradas[0].referencia, mala.referencia)
  assert.equal(encontradas[0].sugerido, 'tallerlabruma@hotmail.com')
})

test('corrige el correo y deja la boleta intacta', () => {
  const orden = compraPagada({ correo: 'tallerlabruma@hotmail.vom' })
  const antes = boletasDeOrden(orden.id, 'https://x')

  const r = corregirCorreo(orden.id, 'tallerlabruma@hotmail.com')
  assert.equal(r.ok, true)
  assert.equal(r.de, 'tallerlabruma@hotmail.vom')
  assert.equal(r.a, 'tallerlabruma@hotmail.com')

  assert.equal(compradorDe(orden.id).correo, 'tallerlabruma@hotmail.com')

  // La misma boleta, el mismo QR, sin anular: ya la pago y es ella misma.
  const despues = boletasDeOrden(orden.id, 'https://x')
  assert.deepEqual(despues.map((b) => b.id), antes.map((b) => b.id))
  assert.ok(despues.every((b) => b.estado === 'emitida'))

  // Y ya no aparece en la lista de sospechosos.
  assert.ok(!correosSospechosos().some((f) => f.referencia === orden.referencia))
})

test('arrastra el correo malo del asistente, pero no toca el de otra persona', () => {
  const orden = compraPagada({
    correo: 'tallerlabruma@hotmail.vom',
    segundoAsistente: {
      nombre: 'Jorge Arboleda Mesa', tipoDocumento: 'CC', cedula: '8300111',
      correo: 'jorge@gmail.com', promocion: '1990',
    },
  })

  const r = corregirCorreo(orden.id, 'tallerlabruma@hotmail.com')
  assert.equal(r.ok, true)
  assert.equal(r.asistentes, 1, 'solo el asistente que tenia el correo malo')

  const correos = asistentesDe(orden.id).map((a) => a.correo)
  assert.ok(correos.includes('tallerlabruma@hotmail.com'))
  assert.ok(correos.includes('jorge@gmail.com'), 'el acompanante conserva el suyo')
})

test('limpia el error del envio anterior, para que no quede marcada como fallida', () => {
  const orden = compraPagada({ correo: 'tallerlabruma@hotmail.vom' })
  db.prepare(`UPDATE orden SET correo_ultimo_error = 'Dominio inexistente' WHERE id = ?`).run(orden.id)

  corregirCorreo(orden.id, 'tallerlabruma@hotmail.com')
  assert.equal(buscarPorReferencia(orden.referencia).correo_ultimo_error, null)
})

test('no acepta un correo invalido ni el que ya tiene', () => {
  const orden = compraPagada({ correo: 'tallerlabruma@hotmail.vom' })
  assert.equal(corregirCorreo(orden.id, 'esto no es un correo').ok, false)
  assert.equal(corregirCorreo(orden.id, 'tallerlabruma@hotmail.vom').ok, false)
  // El punto al final lo limpia solo (lo de septiembre), no lo rechaza.
  assert.equal(corregirCorreo(orden.id, 'tallerlabruma@hotmail.com.').a, 'tallerlabruma@hotmail.com')
})
