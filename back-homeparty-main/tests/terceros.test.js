// -----------------------------------------------------------------------------
// Pruebas del alta del comprador como TERCERO y CLIENTE en SIESA.
//
// No tocan la red ni el ERP. Comprueban el armado de los dos documentos contra
// los ejemplos que mando el colegio (EjemploTerceros.txt, EjemploCliente.txt).
//
// Lo que cuidan, en orden de que tan caro es equivocarse:
//
//   1. Que el tercero NO salga marcado como empleado ni como proveedor. Un
//      cero cambiado ahi mete a un egresado en las nominas del colegio.
//   2. Que el cliente se cree con el mismo tipo y la misma condicion de pago
//      con los que se factura, o la venta queda colgando en una cartera que
//      nadie revisa.
//   3. Que la cedula que se consulta contra SQL Server sea puro numero: esa
//      consulta viaja por OPENQUERY como texto y no se puede parametrizar.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.EVENTO_NOMBRE = 'Homecoming 80 Anos'
process.env.SIESA_F_CIA = '1'
process.env.SIESA_ID_SUCURSAL = '001'
process.env.SIESA_ENSAYO = 'true'

const { armarTercero, armarCliente, armarCriterio, partirNombre, tipoIdentSiesa, cedulaValida, consultarTercero, respuestaFallo, elegirSucursal } =
  await import('../src/siesa/terceros.js')

/* La misma fila 465 que usan las pruebas de facturacion. */
const CONFIG_465 = {
  id_co: '001',
  siesa_service_id: 'VS35951500',
  siesa_cc: '11049',
  siesa_id_motivo: '42',
  id_tipo_cli: 'CEXT',
  id_cond_pago: '0D',
  id_auxiliar_docto_cruce: '13453005',
  id_co_docto_cruce: '001',
  id_un_docto_cruce: '99',
  id_caja: '010',
  id_fe: '1189',
  id_un: '99',
  siesa_seller_id: '007',
  siesa_seller_tercero_id: '1037577112',
}

const COMPRADOR = {
  nombre: 'Juan Andrés Ayala Botero',
  tipo_documento: 'CC',
  cedula: '1023626286',
  correo: 'juan@ejemplo.com',
  celular: '3001234567',
  direccion: 'Cra 45 # 12-30',
  ciudad: 'Medellín',
  fecha_nacimiento: '1986-05-10',
  fechaNacimiento: '1986-05-10',
}

// -----------------------------------------------------------------------------

test('el id del tercero es la cedula, igual que en la factura', () => {
  const t = armarTercero(COMPRADOR)
  assert.equal(t.F200_ID, '1023626286')
  assert.equal(t.F200_NIT, '1023626286')
})

test('el tercero NO queda marcado como empleado, proveedor ni accionista', () => {
  const t = armarTercero(COMPRADOR)

  // Si alguno de estos se va en 1, un egresado que compro una boleta aparece
  // en modulos del ERP donde no tiene nada que hacer.
  assert.equal(t.F200_IND_EMPLEADO, '0')
  assert.equal(t.F200_IND_PROVEEDOR, '0')
  assert.equal(t.F200_IND_ACCIONISTA, '0')
  assert.equal(t.F200_IND_INTERNO, '0')

  // Y si va lo que si es: cliente, persona natural, activo.
  assert.equal(t.F200_IND_CLIENTE, '1')
  assert.equal(t.F200_IND_TIPO_TERCERO, '1')
  assert.equal(t.F200_IND_ESTADO, '1')
})

test('la razon social lleva el nombre completo sin tildes', () => {
  const t = armarTercero(COMPRADOR)
  // Es lo que se imprime en la factura. SIESA no acepta tildes.
  assert.equal(t.F200_RAZON_SOCIAL, 'JUAN ANDRES AYALA BOTERO')
  assert.equal(t.F200_NOMBRE_EST, 'JUAN ANDRES AYALA BOTERO')
})

test('el nombre se parte en nombres y dos apellidos', () => {
  assert.deepEqual(partirNombre('Juan Andrés Ayala Botero'),
    { nombres: 'JUAN ANDRES', apellido1: 'AYALA', apellido2: 'BOTERO' })

  assert.deepEqual(partirNombre('Maria Rodriguez'),
    { nombres: 'MARIA', apellido1: 'RODRIGUEZ', apellido2: '' })

  assert.deepEqual(partirNombre('Ana Lucia Gomez'),
    { nombres: 'ANA', apellido1: 'LUCIA', apellido2: 'GOMEZ' })

  // Las particulas no se quedan solas de apellido.
  assert.deepEqual(partirNombre('Carlos Alberto de la Cruz Perez'),
    { nombres: 'CARLOS ALBERTO', apellido1: 'DE LA CRUZ', apellido2: 'PEREZ' })

  // Un solo pedazo no revienta.
  assert.deepEqual(partirNombre('Prince'), { nombres: 'PRINCE', apellido1: '', apellido2: '' })
})

test('el tipo de documento se traduce a la letra de SIESA', () => {
  // Las letras salen del EMPLOYEE_ID_TYPE_MAP de la plataforma del colegio.
  assert.equal(tipoIdentSiesa('CC'), 'C')
  assert.equal(tipoIdentSiesa('CE'), 'E')
  assert.equal(tipoIdentSiesa('TI'), 'T')
  assert.equal(tipoIdentSiesa('PP'), 'P')
  assert.equal(tipoIdentSiesa('NIT'), 'N')
  // Lo desconocido cae en cedula, que es lo que compra el 99% de la gente.
  assert.equal(tipoIdentSiesa('loquesea'), 'C')
})

test('el cliente se crea con el mismo tipo y condicion de pago con que se factura', () => {
  const c = armarCliente(COMPRADOR, CONFIG_465)

  // Si estos dos no coinciden con los de la factura, la venta queda en una
  // cartera distinta a la que contabilidad revisa.
  assert.equal(c.F201_ID_TIPO_CLI, CONFIG_465.id_tipo_cli)
  assert.equal(c.F201_ID_COND_PAGO, CONFIG_465.id_cond_pago)
  assert.equal(c.F201_ID_VENDEDOR, CONFIG_465.siesa_seller_id)
})

test('el cliente es la sucursal 001 del tercero, sin cupo de credito', () => {
  const c = armarCliente(COMPRADOR, CONFIG_465)
  assert.equal(c.F201_ID_TERCERO, '1023626286')
  assert.equal(c.F201_ID_SUCURSAL, '001')
  assert.equal(c.F201_ID_MONEDA, 'COP')

  // La boleta se paga por Wompi antes de existir: nadie le debe nada al
  // colegio, y un cupo de credito abierto seria un error contable.
  assert.equal(c.F201_CUPO_CREDITO, '0')
  assert.equal(c.F201_DIAS_GRACIA, '0')
})

test('la sucursal del cliente es la misma que referencia la factura', async () => {
  const { armarFactura } = await import('../src/siesa/facturacion.js')
  const orden = { cantidad: 2, total_centavos: 17400000, metodo_pago: 'CARD', wompi_transaction_id: 'x' }
  const f = await armarFactura(orden, COMPRADOR, { configuracion: CONFIG_465 })
  const c = armarCliente(COMPRADOR, CONFIG_465)

  // Sin esto la factura apunta a una sucursal que no existe.
  assert.equal(f.F311_ID_SUCURSAL_CLI, c.F201_ID_SUCURSAL)
})

test('la ciudad va en codigo DANE, no en el texto que escribio la persona', () => {
  const t = armarTercero(COMPRADOR)
  // El comprador escribio "Medellín"; SIESA quiere 400 / 05 / 169.
  assert.equal(t.F015_ID_CIUDAD, '400')
  assert.equal(t.F015_ID_DEPTO, '05')
  assert.equal(t.F015_ID_PAIS, '169')
})

test('el criterio esta apagado mientras contabilidad no diga cual va', () => {
  assert.equal(armarCriterio(COMPRADOR), null)
})

test('una cedula que no sea puro numero no llega a la consulta SQL', async () => {
  // La consulta va por OPENQUERY: viaja como texto al servidor enlazado y no
  // se puede parametrizar. Lo unico que la protege es este filtro.
  assert.equal(cedulaValida('1023626286'), true)
  assert.equal(cedulaValida("1' OR '1'='1"), false)
  assert.equal(cedulaValida('123'), false)
  assert.equal(cedulaValida(''), false)
  assert.equal(cedulaValida(null), false)

  // Y se comprueba que consultarTercero de verdad se detiene antes de abrir
  // la conexion, no despues.
  await assert.rejects(
    () => consultarTercero("1' OR '1'='1"),
    (e) => e.tipo === 'sin_tercero',
  )
})

test('armar el tercero sin cedula falla en vez de mandar basura al ERP', () => {
  assert.throws(() => armarTercero({ ...COMPRADOR, cedula: '' }), (e) => e.tipo === 'sin_tercero')
  assert.throws(() => armarCliente({ ...COMPRADOR, cedula: 'abc' }, CONFIG_465), (e) => e.tipo === 'sin_tercero')
})

test('un rechazo que viene dentro del ArrayOfstring se detecta', () => {
  // SIESA no lanza excepcion cuando rechaza: devuelve el error como texto. Si
  // no se lee, un rechazo pasa por exito.
  assert.ok(respuestaFallo([{ TerceroResult: { string: ['Error: el tercero ya existe'] } }]))
  assert.ok(respuestaFallo([{ TerceroResult: { string: ['No se pudo crear el registro'] } }]))
  // 15 de septiembre de 2026: los rechazos no siempre dicen "error". Ahora
  // CUALQUIER texto cuenta como rechazo (en exito el Result viene null), y
  // quien llama comprueba en la tabla antes de darlo por perdido.
  assert.ok(respuestaFallo([{ TerceroResult: { string: ['El dato es obligatorio. Valor: F200_FECHA_NACIMIENTO'] } }]))
  assert.ok(respuestaFallo([{ TerceroResult: { string: ['1023626286'] } }]))
  assert.equal(respuestaFallo([{ TerceroResult: null }]), null)
  assert.equal(respuestaFallo([{ Financiera_FacturaResult: null }]), null)
  assert.equal(respuestaFallo([{ TerceroResult: { string: [] } }]), null)
})

// -----------------------------------------------------------------------------
// LA SUCURSAL A LA QUE SE FACTURA (14 de septiembre de 2026).
//
// Con la primera factura real, contabilidad vio que la compradora -- empleada
// y mama del colegio -- quedo facturada en la sucursal 001, que en el ERP es
// la cuenta de su hijo. La 000 es la persona misma. Regla que pidieron: 000
// si la tiene; si no, la menor; si no tiene ninguna, se crea la 001.
// -----------------------------------------------------------------------------
test('si el tercero tiene la sucursal 000 (es empleado), se le factura a esa', async () => {
  const { elegirSucursal } = await import('../src/siesa/terceros.js')
  // Veronica: 000 ella, 001 y 002 sus hijos.
  assert.deepEqual(elegirSucursal(['000', '001', '002']), { sucursal: '000', crear: false })
  assert.deepEqual(elegirSucursal(['001', '000']), { sucursal: '000', crear: false })
})

test('sin la 000 se factura a la menor que tenga, sin crear nada', async () => {
  const { elegirSucursal } = await import('../src/siesa/terceros.js')
  assert.deepEqual(elegirSucursal(['001']), { sucursal: '001', crear: false })
  assert.deepEqual(elegirSucursal(['002', '001']), { sucursal: '001', crear: false })
  assert.deepEqual(elegirSucursal(['003']), { sucursal: '003', crear: false })
})

test('un tercero sin sucursales recibe la 001, y esa es la que se crea', async () => {
  const { elegirSucursal } = await import('../src/siesa/terceros.js')
  assert.deepEqual(elegirSucursal([]), { sucursal: '001', crear: true })
  assert.deepEqual(elegirSucursal(['', null]), { sucursal: '001', crear: true })
})

test('la factura y el recibo llevan la sucursal elegida, no la fija del .env', async () => {
  const { armarFactura, armarRecibo } = await import('../src/siesa/facturacion.js')
  const orden = { cantidad: 1, total_centavos: 8700000, metodo_pago: 'CARD', wompi_transaction_id: 'x', ultimos_cuatro: '4242' }

  const f = await armarFactura(orden, COMPRADOR, { configuracion: CONFIG_465, sucursal: '000' })
  assert.equal(f.F311_ID_SUCURSAL_CLI, '000')
  assert.equal(f.MOVIMIENTOS.Factura_Financiera_Movimiento[0].F320_ID_SUCURSAL_CLIENTE, '000')

  // El cruce del recibo tiene que apuntar a la MISMA sucursal de la factura.
  const r = await armarRecibo(orden, COMPRADOR, '001-FES-1', { configuracion: CONFIG_465, sucursal: '000' })
  assert.equal(r.F353_ID_SUCURSAL_DOCTO_CRUCE, '000')

  // Sin sucursal explicita sigue siendo la del .env (001).
  const f2 = await armarFactura(orden, COMPRADOR, { configuracion: CONFIG_465 })
  assert.equal(f2.F311_ID_SUCURSAL_CLI, '001')
})

// -----------------------------------------------------------------------------
// LA FECHA DE NACIMIENTO (15 de septiembre de 2026). SIESA no crea una
// persona natural sin ella: "El dato es obligatorio y debe ser una fecha
// valida" en F200_FECHA_NACIMIENTO. Se pide en el checkout desde hoy.
// -----------------------------------------------------------------------------
test('la fecha de nacimiento del checkout va al tercero como AAAAMMDD', () => {
  const t = armarTercero({ ...COMPRADOR, fecha_nacimiento: '1976-03-02' })
  assert.equal(t.F200_FECHA_NACIMIENTO, '19760302')
})

test('sin fecha de nacimiento va la del dia, como hace SIESA al crear a mano', async () => {
  // Autorizado por contabilidad el 15 de septiembre de 2026.
  const { fechaSiesa } = await import('../src/siesa/facturacion.js')
  const t = armarTercero({ ...COMPRADOR, fecha_nacimiento: null })
  assert.equal(t.F200_FECHA_NACIMIENTO, fechaSiesa())
})

test('la fecha de nacimiento se valida en el checkout', async () => {
  const { validarFechaNacimiento } = await import('../src/lib/validaciones.js')
  assert.equal(validarFechaNacimiento('1986-05-10'), null)
  assert.ok(validarFechaNacimiento(''))
  assert.ok(validarFechaNacimiento('10/05/1986'))
  assert.ok(validarFechaNacimiento('1986-02-30'))
  assert.ok(validarFechaNacimiento('2015-01-01'), 'un menor no compra')
  assert.ok(validarFechaNacimiento('1890-01-01'))
})

test('la sucursal del cliente se crea ACTIVA', () => {
  // 15 de septiembre de 2026: con 0 (lo que traia el ejemplo del proveedor)
  // SIESA la dejo inactiva y rechazo la factura.
  const c = armarCliente(COMPRADOR, CONFIG_465)
  assert.equal(c.F201_IND_ESTADO_ACTIVO, '1')
})

test('una sucursal inactiva no se elige: si no hay activas se crea o activa la del .env', () => {
  // 15 de septiembre de 2026: "La sucursal 001 del cliente no esta activa".
  // elegirSucursal recibe SOLO las activas; vacio = crear/activar.
  assert.deepEqual(elegirSucursal([]), { sucursal: '001', crear: true })
  assert.deepEqual(elegirSucursal(['002']), { sucursal: '002', crear: false })
})

test('la sucursal del cliente se crea SIN bloqueo (1 en f201_ind_estado_bloqueado)', () => {
  // 15 de septiembre de 2026: con 0, SIESA la muestra como "cliente bloqueado".
  const c = armarCliente(COMPRADOR, CONFIG_465)
  assert.equal(c.F201_IND_BLOQUEADO, '1')
  assert.equal(c.F201_IND_BLOQUEO_CUPO, '0')
  assert.equal(c.F201_IND_BLOQUEO_MORA, '0')
})
