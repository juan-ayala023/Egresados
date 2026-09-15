// -----------------------------------------------------------------------------
// La promocion: OBLIGATORIA para quien compra, OPCIONAL para los acompanantes.
//
// Lo pidio el colegio el 11 de septiembre de 2026. La razon es de venta: quien
// compra sabe su propio ano de grado, pero de los amigos que lleva puede no
// acordarse, y quedarse trancado en el formulario por ese dato es perder la
// compra entera.
//
// LO QUE MAS CUIDA ESTE ARCHIVO no es que se acepte el vacio -- es que un vacio
// NO marque a nadie como egresado. Antes esEgresado() era `!== 'no-egresado'`,
// asi que una casilla en blanco habria dado egresado verificado sin que nadie
// lo dijera, y eso sale en el reporte del comite y en la lista de la puerta.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DB_PATH = ':memory:'
process.env.WOMPI_SIMULACION = 'true'
process.env.DATOS_ASISTENTE = 'acta'

const { validarOrden, esEgresado } = await import('../src/lib/validaciones.js')

const anioValido = String(new Date().getFullYear() - 5)

/** Una orden de 2 boletas: el titular y un acompanante. */
const orden = (promoAcompanante) => ({
  cantidad: 2,
  comprador: {
    nombre: 'Juan Ayala Botero',
    tipoDocumento: 'CC',
    cedula: '1023626286',
    correo: 'juan@ejemplo.com',
    celular: '3001234567',
    direccion: 'Cra 45 # 12-30',
    ciudad: 'Medellin',
    fechaNacimiento: '1986-05-10',
    promocion: anioValido,
  },
  aceptaTratamientoDatos: true,
  aceptaTerminos: true,
  asistentes: [
    { nombre: 'Juan Ayala Botero', tipoDocumento: 'CC', cedula: '1023626286', promocion: anioValido },
    { nombre: 'Maria Gomez Perez', tipoDocumento: 'CC', cedula: '43567890', promocion: promoAcompanante },
  ],
})

// -----------------------------------------------------------------------------

test('el acompanante puede ir SIN promocion', () => {
  const { errores } = validarOrden(orden(''))
  assert.equal(errores['asistentes.1.promocion'], undefined)
  assert.deepEqual(errores, {}, `no deberia haber errores: ${JSON.stringify(errores)}`)
})

test('quien compra SI tiene que poner su promocion', () => {
  const cuerpo = orden(anioValido)
  cuerpo.comprador.promocion = ''
  cuerpo.asistentes[0].promocion = ''

  const { errores } = validarOrden(cuerpo)
  assert.ok(errores['comprador.promocion'], 'la del comprador es obligatoria')
})

test('un acompanante sin promocion NO queda marcado como egresado', () => {
  // Esta es la que importa. Un vacio significa "no sabemos", no "si".
  const { errores, datos } = validarOrden(orden(''))
  assert.deepEqual(errores, {})

  const acompanante = datos.asistentes[1]
  assert.equal(acompanante.promocion, '')
  assert.equal(acompanante.esEgresado, false)
})

test('esEgresado distingue los tres casos', () => {
  assert.equal(esEgresado('2010'), true)        // puso su ano
  assert.equal(esEgresado('no-egresado'), false) // dijo que no lo es
  assert.equal(esEgresado(''), false)            // no dijo nada
  assert.equal(esEgresado(null), false)
  assert.equal(esEgresado('   '), false)
})

test('si el acompanante SI pone promocion, se sigue validando', () => {
  // Opcional no quiere decir que valga cualquier cosa: un 1900 sigue siendo
  // un error, porque el colegio no existia.
  const { errores } = validarOrden(orden('1900'))
  assert.ok(errores['asistentes.1.promocion'])
})

test('el acompanante puede declararse NO egresado', () => {
  const { errores, datos } = validarOrden(orden('no-egresado'))
  assert.deepEqual(errores, {})
  assert.equal(datos.asistentes[1].esEgresado, false)
  assert.equal(datos.asistentes[1].promocion, 'no-egresado')
})

test('la tarjeta de identidad ya no se acepta: la fiesta es para adultos', () => {
  // Decision del colegio del 11 de septiembre de 2026. TI es el documento de
  // los menores; tenerla en la lista invitaba a registrar a uno.
  const cuerpo = orden(anioValido)
  cuerpo.comprador.tipoDocumento = 'TI'
  const { errores } = validarOrden(cuerpo)
  assert.ok(errores['comprador.tipoDocumento'], 'TI deberia rechazarse')

  // Y los demas siguen entrando.
  for (const tipo of ['CC', 'CE', 'NIT', 'PP']) {
    const c = orden(anioValido)
    c.comprador.tipoDocumento = tipo
    assert.equal(validarOrden(c).errores['comprador.tipoDocumento'], undefined, `${tipo} deberia aceptarse`)
  }
})

test('el nombre tiene que traer apellido: solo "Juan" no pasa', () => {
  // Pedido del colegio del 13 de septiembre de 2026. La boleta va a nombre de
  // esa persona y en la puerta se cruza con la cedula.
  const c = orden(anioValido)
  c.comprador.nombre = 'Juanito'
  c.asistentes[0].nombre = 'Juanito'
  const { errores } = validarOrden(c)
  assert.match(errores['comprador.nombre'], /apellidos/)
  assert.match(errores['asistentes.0.nombre'], /apellidos/)

  // Con apellido si pasa.
  const ok = orden(anioValido)
  assert.equal(validarOrden(ok).errores['comprador.nombre'], undefined)
})
