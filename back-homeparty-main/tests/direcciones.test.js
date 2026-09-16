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

const { validarDireccion, validarCiudad, esCiudadConocida, nombreCiudad } =
  await import('../src/lib/direcciones.js')
const { DEPARTAMENTOS } = await import('../src/lib/divipola.js')

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

test('un municipio de la DIVIPOLA pasa, con o sin tilde, en cualquier caja', () => {
  assert.equal(validarCiudad('Medellín, Antioquia'), null)
  assert.equal(validarCiudad('medellin, antioquia'), null)
  assert.equal(validarCiudad('ITAGÜÍ, ANTIOQUIA'), null)
  assert.equal(validarCiudad('Retiro, Antioquia'), null)        // el DANE lo llama asi, sin "El"
  assert.equal(validarCiudad('Bogotá D.C.'), null)              // municipio y departamento a la vez
  assert.equal(validarCiudad('Sucre, Sucre'), null)
  assert.ok(esCiudadConocida('envigado, antioquia'))
  assert.ok(!esCiudadConocida('Narnia, Antioquia'))
})

test('la ciudad se guarda como "Municipio, Departamento"', () => {
  assert.equal(nombreCiudad('Medellín', 'Antioquia'), 'Medellín, Antioquia')
  // Salvo Bogota, donde repetirlo se veria tonto.
  assert.equal(nombreCiudad('Bogotá D.C.', 'Bogotá D.C.'), 'Bogotá D.C.')
})

test('fuera de Colombia se acepta un nombre, pero no basura', () => {
  assert.equal(validarCiudad('Miami, Estados Unidos'), null)
  assert.equal(validarCiudad('Ciudad de México'), null)
  assert.equal(validarCiudad("L'Hospitalet, España"), null)
  assert.ok(validarCiudad(''))
  assert.ok(validarCiudad('12'))
  assert.ok(validarCiudad('a1b2'))
  assert.ok(validarCiudad('Medellín 123'))
  assert.ok(validarCiudad('x'))
})

test('la DIVIPOLA esta completa y Antioquia va de primera', () => {
  assert.equal(DEPARTAMENTOS.length, 33)                       // 32 + Bogota D.C.
  const municipios = DEPARTAMENTOS.reduce((n, d) => n + d.municipios.length, 0)
  assert.ok(municipios >= 1100, `solo hay ${municipios} municipios`)
  assert.equal(DEPARTAMENTOS[0].nombre, 'Antioquia')
  assert.equal(DEPARTAMENTOS[0].municipios[0].nombre, 'Medellín') // la capital primero
  for (const c of ['Envigado', 'Sabaneta', 'Itagüí', 'Bello', 'La Estrella', 'Rionegro']) {
    assert.ok(DEPARTAMENTOS[0].municipios.some((m) => m.nombre === c), `falta ${c}`)
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
      direccion: 'Cra 43A # 1-50 Apto 902', ciudad: 'Medellín, Antioquia', fechaNacimiento: '1986-05-10',
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

test('un correo con punto al final se limpia; uno sin dominio valido se rechaza', async () => {
  // 15 de septiembre de 2026: "moniaarrubla@gmail.com." paso la validacion,
  // Gmail lo rechazo 7 veces y la boleta no llego.
  const { limpiarCorreo, validarOrden } = await import('../src/lib/validaciones.js')
  assert.equal(limpiarCorreo('Monia@Gmail.com. '), 'monia@gmail.com')
  const base = {
    tipoBoletaId: 'homecoming-80', cantidad: 1,
    comprador: {
      nombre: 'Monica Arrubla Gomez', tipoDocumento: 'CC', cedula: '43000000', celular: '3001234567',
      direccion: 'Cra 43A # 1-50', ciudad: 'Medellín, Antioquia', fechaNacimiento: '1980-01-01', promocion: '1998',
    },
    asistentes: [{ nombre: 'Monica Arrubla Gomez', tipoDocumento: 'CC', cedula: '43000000', promocion: '1998' }],
    aceptaTratamientoDatos: true, aceptaTerminos: true,
  }
  const conPunto = validarOrden({ ...base, comprador: { ...base.comprador, correo: 'moniaarrubla@gmail.com.' } })
  assert.equal(conPunto.errores['comprador.correo'], undefined)
  assert.equal(conPunto.datos.comprador.correo, 'moniaarrubla@gmail.com')
  const sinDominio = validarOrden({ ...base, comprador: { ...base.comprador, correo: 'monia@gmail' } })
  assert.ok(sinDominio.errores['comprador.correo'])
  const dosPuntos = validarOrden({ ...base, comprador: { ...base.comprador, correo: 'monia@gmail..com' } })
  assert.ok(dosPuntos.errores['comprador.correo'])
})
