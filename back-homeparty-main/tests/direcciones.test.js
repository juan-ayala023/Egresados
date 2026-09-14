// -----------------------------------------------------------------------------
// Direccion y ciudad de facturacion: tienen que PARECER lo que dicen ser.
//
// El colegio cayo en cuenta el 14 de septiembre de 2026: la direccion aceptaba
// "asdfgh" y la ciudad "xyz", y los dos van a la factura electronica. La DIAN
// la rechaza semanas despues, cuando ya no hay como volver a preguntarle al
// comprador.
//
// Lo que cuidan estas pruebas, en orden:
//   1. Que las direcciones REALES de la gente pasen. Un filtro que rechaza a
//      un comprador legitimo es peor que uno que deja pasar basura.
//   2. Que la basura obvia no pase.
//   3. Que la ciudad venga de la lista, o al menos sea un nombre.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

const { validarDireccion, validarCiudad, esCiudadConocida, CIUDADES } =
  await import('../src/lib/direcciones.js')

test('las direcciones como las escribe la gente pasan', () => {
  const reales = [
    'Cra 43A # 1-50 Apto 902',
    'Calle 10 # 5-20',
    'Cra43A #1-50',                         // sin espacio tras la via
    'Carrera 80 No. 45 - 12',
    'Av. El Poblado 5-120',
    'Avenida Las Vegas 25 sur 12',
    'Km 3 vía Las Palmas, casa 4',          // con tilde
    'Diagonal 75B # 2A-120 Torre 3 Apto 501',
    'Transversal 5 # 45-10',
    'Cl 5 sur 43-2',
    'Vereda El Salado, finca La Loma 2',
    'Circular 4 # 70-15',
    'Mz 3 Casa 12 barrio Los Colores',
    'Kr 7 # 12-34',
  ]
  for (const d of reales) {
    assert.equal(validarDireccion(d), null, `deberia pasar: "${d}"`)
  }
})

test('la basura obvia no pasa', () => {
  const basura = {
    'asdfgh': /numero/,
    '12345': /completa/,
    'Casa de mi mama': /numero/,
    'no se': /completa/,
    'Mi casa queda cerca del parque': /numero/,
    'Cra 43A # 1-50 <script>': /caracteres/,
    'qwerty 123': /via/,                      // numero pero sin via
  }
  for (const [d, esperado] of Object.entries(basura)) {
    const error = validarDireccion(d)
    assert.ok(error, `deberia rechazarse: "${d}"`)
    assert.match(error, esperado, `"${d}" -> ${error}`)
  }
})

test('fuera de Colombia no se exige via colombiana, pero si numero y letras', () => {
  assert.equal(validarDireccion('1200 Brickell Ave, Miami FL 33131', { exterior: true }), null)
  assert.equal(validarDireccion('Rue de Rivoli 45, Paris', { exterior: true }), null)
  // Pero "asdfgh" sigue sin pasar aunque diga que vive afuera.
  assert.ok(validarDireccion('asdfgh', { exterior: true }))
})

test('la ciudad de la lista pasa, con o sin tilde, en cualquier caja', () => {
  assert.equal(validarCiudad('Medellín'), null)
  assert.equal(validarCiudad('medellin'), null)
  assert.equal(validarCiudad('MEDELLIN'), null)
  assert.equal(validarCiudad('Itagüí'), null)
  assert.equal(validarCiudad('Bogota'), null)
  assert.ok(esCiudadConocida('envigado'))
  assert.ok(!esCiudadConocida('Narnia'))
})

test('una ciudad que no esta en la lista tiene que ser al menos un nombre', () => {
  // "Otra ciudad" o "fuera de Colombia": se acepta lo que parezca un nombre.
  assert.equal(validarCiudad('Ciudad de México'), null)
  assert.equal(validarCiudad('Santa Rosa de Osos'), null)
  assert.equal(validarCiudad("L'Hospitalet"), null)
  // Y no lo que no lo parezca.
  assert.ok(validarCiudad(''))
  assert.ok(validarCiudad('12'))
  assert.ok(validarCiudad('a1b2'))
  assert.ok(validarCiudad('Medellín 123'))
  assert.ok(validarCiudad('x'))
})

test('la lista trae el area metropolitana, que es donde vive casi todo el que compra', () => {
  for (const c of ['Medellín', 'Envigado', 'Sabaneta', 'Itagüí', 'Bello', 'La Estrella', 'Rionegro', 'Bogotá']) {
    assert.ok(CIUDADES.includes(c), `falta ${c}`)
  }
})

test('validarOrden usa las reglas nuevas', async () => {
  process.env.NODE_ENV = 'test'
  process.env.WOMPI_SIMULACION = 'true'
  const { validarOrden } = await import('../src/lib/validaciones.js')
  const anio = String(new Date().getFullYear() - 5)
  const base = () => ({
    cantidad: 1,
    comprador: {
      nombre: 'Juan Ayala Botero', tipoDocumento: 'CC', cedula: '1023626286',
      correo: 'j@e.com', celular: '3001234567', promocion: anio,
      direccion: 'Cra 43A # 1-50 Apto 902', ciudad: 'Medellín',
    },
    aceptaTratamientoDatos: true, aceptaTerminos: true,
    asistentes: [{ nombre: 'Juan Ayala Botero', tipoDocumento: 'CC', cedula: '1023626286', promocion: anio }],
  })

  assert.deepEqual(validarOrden(base()).errores, {})

  const malaDir = base(); malaDir.comprador.direccion = 'asdfgh'
  assert.ok(validarOrden(malaDir).errores['comprador.direccion'])

  const malaCiudad = base(); malaCiudad.comprador.ciudad = 'x1'
  assert.ok(validarOrden(malaCiudad).errores['comprador.ciudad'])

  // Fuera de Colombia: direccion sin via colombiana, y pasa.
  const afuera = base()
  afuera.comprador.ciudad = 'Miami, Estados Unidos'
  afuera.comprador.direccion = '1200 Brickell Ave 33131'
  assert.deepEqual(validarOrden(afuera).errores, {})
})
