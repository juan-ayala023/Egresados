// -----------------------------------------------------------------------------
// Configuracion central. TODO valor que el comite pueda querer cambiar vive aqui
// y se lee de variables de entorno (.env). Nada de numeros magicos regados por
// el codigo.
//
// Las lineas marcadas con "DECISION #n" corresponden a las decisiones abiertas
// del BACKEND.md, seccion 9. Tienen un valor por defecto para poder trabajar,
// pero hay que confirmarlas con el colegio antes de abrir la venta.
// -----------------------------------------------------------------------------
import dotenv from 'dotenv'

// EL .env MANDA SOBRE EL ENTORNO DEL SHELL.
//
// Por defecto dotenv NO pisa una variable que ya exista en el entorno. En un
// computador propio da igual. En el servidor del colegio no: el usuario
// `eventos` tiene cargadas las variables de la plataforma de eventos (sus
// llaves de Wompi, su URL de API...), y el 13 de septiembre de 2026 el
// backend arranco leyendo ESAS en vez de las del archivo -- le preguntaba a
// la URL equivocada y Wompi respondia 404.
//
// Con override, lo que dice back-homeparty-main/.env es lo que vale, este
// donde este el proceso. La unica excepcion son las pruebas: ellas fijan sus
// propias variables ANTES de importar esto (DB en memoria, simulacion, etc.)
// y el .env no las puede pisar, o escribirian en la base de verdad.
dotenv.config({ override: process.env.NODE_ENV !== 'test' })
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Helpers pequenos para leer variables de entorno con valor por defecto.
const texto = (clave, pordefecto) => process.env[clave] ?? pordefecto
const numero = (clave, pordefecto) => {
  const v = process.env[clave]
  if (v === undefined || v === '') return pordefecto
  const n = Number(v)
  if (Number.isNaN(n)) throw new Error(`La variable ${clave} debe ser un numero, llego "${v}"`)
  return n
}
const booleano = (clave, pordefecto) => {
  const v = process.env[clave]
  if (v === undefined || v === '') return pordefecto
  return v === 'true' || v === '1' || v === 'si'
}
const lista = (clave, pordefecto) => {
  const v = process.env[clave]
  if (!v) return pordefecto
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

// Los montos SIEMPRE se guardan y se transmiten en centavos. $87.000 COP es
// 8700000, no 87000. En el .env se escriben en pesos porque es mas legible y
// aqui se multiplican una sola vez.
const PRECIO_COP = numero('BOLETA_PRECIO_COP', 80000)
// Tarifa de servicio que paga el COMPRADOR, encima del precio de la boleta:
// $80.000 + $7.000 = $87.000. El colegio la redondeo el 8 de septiembre de
// 2026; antes eran $6.634, que daban un total de $86.634. (Y antes de eso iba
// en 0, porque el acta del comite decia que el colegio asumia los costos
// financieros.) Este valor tiene que ser el mismo que tarifaServicio en el
// data.ts del front, o la tarjeta muestra un precio y el checkout otro.
const TARIFA_COP = numero('BOLETA_TARIFA_COP', 7000)

export const config = {
  entorno: texto('NODE_ENV', 'development'),
  puerto: numero('PORT', 4000),
  raiz: RAIZ,

  // URL publica de ESTE backend. Se usa para armar qrUrl y pdfUrl.
  urlPublica: texto('PUBLIC_URL', `http://localhost:${numero('PORT', 4000)}`),

  // Origenes permitidos por CORS. En produccion: el subdominio institucional
  // (DECISION #10, todavia sin definir).
  origenesPermitidos: lista('CORS_ORIGINS', ['http://localhost:3000']),

  baseDatos: texto('DB_PATH', path.join(RAIZ, 'datos', 'homecoming.db')),

  evento: {
    nombre: texto('EVENTO_NOMBRE', 'Homecoming 80 Anos'),
    fecha: texto('EVENTO_FECHA', '2026-11-14T19:00:00-05:00'),
    lugar: texto('EVENTO_LUGAR', 'The Columbus School'),
    direccion: texto('EVENTO_DIRECCION', 'Alto de las Palmas, Medellin'),
    // Aforo CERRADO en 500 por el comite. Queda parametrizado y no quemado
    // para que un cambio sea una linea del .env, pero no se toca sin que el
    // comite lo diga: el Sold Out automatico depende de este numero.
    aforo: numero('EVENTO_AFORO', 500),
    // La venta abre sola en esta fecha. Antes, estadoVenta() dice "proxima".
    apertura: texto('VENTA_APERTURA', '2026-09-15T00:00:00-05:00'),
    // Red de seguridad si el aforo no se llena. El cierre principal es el
    // Sold Out automatico al agotar las boletas.
    cierreVenta: texto('EVENTO_CIERRE_VENTA', '2026-11-07T23:59:59-05:00'),
    // Interruptor manual por si hay que cerrar la venta antes de tiempo.
    ventaHabilitada: booleano('VENTA_HABILITADA', true),
  },

  boleta: {
    id: texto('BOLETA_ID', 'homecoming-80'),
    nombre: texto('BOLETA_NOMBRE', 'Boleta Homecoming 80 Anos'),
    precioCentavos: PRECIO_COP * 100,
    tarifaCentavos: TARIFA_COP * 100,
    totalCentavos: (PRECIO_COP + TARIFA_COP) * 100,
    maxPorCompra: numero('MAX_POR_COMPRA', 4),
    // DECISION #6: el limite de 4 es ACUMULADO por cedula del comprador,
    // no por transaccion. Si se pone en false vuelve a ser por compra.
    limitePorCedulaAcumulado: booleano('LIMITE_POR_CEDULA_ACUMULADO', true),
  },

  // DECISION #5: la reunion pidio NO mostrar cupos restantes (estrategia de
  // escasez). Con esto en false el endpoint devuelve solo un booleano.
  mostrarCuposRestantes: booleano('MOSTRAR_CUPOS_RESTANTES', false),

  // DECISION #4: cuantos datos se piden por acompanante.
  //   'minimo'  -> nombre + promocion (lo que exigio la reunion)
  //   'completo'-> ademas cedula, correo y celular (lo que pide el front hoy)
  // Se deja en 'completo' porque la cedula facilita el control en la puerta.
  datosAsistente: texto('DATOS_ASISTENTE', 'completo'),

  // Facturacion DIAN: direccion y ciudad del comprador. El front todavia no
  // los pide, asi que con esto en true una compra real falla con 422.
  exigirDireccionFacturacion: booleano('EXIGIR_DIRECCION_FACTURACION', true),

  // El acta aprobo "NIT/CC" como campo de facturacion. Se guarda siempre (por
  // defecto CC); esto solo controla si el front esta OBLIGADO a mandarlo.
  // Se prende el dia que el checkout tenga el selector.
  exigirTipoDocumento: booleano('EXIGIR_TIPO_DOCUMENTO', false),

  // Enlaces legales que el front muestra junto a las casillas obligatorias.
  // BLOQUEANTE: los tiene que entregar el colegio (politica de datos) y
  // mercadeo (terminos y condiciones). Vacios = el front no pinta el enlace.
  politicaDatosUrl: texto('POLITICA_DATOS_URL', ''),
  terminosUrl: texto('TERMINOS_URL', ''),

  // El acta exige que quien COMPRA sea egresado, con doble check contra la
  // base que entrega mercadeo. Los acompanantes pueden no serlo.
  //   'apagado'  -> no se revisa nada
  //   'advertir' -> se revisa, se marca en la orden, pero la compra pasa
  //   'exigir'   -> quien no aparezca en la base recibe 409 NO_ES_EGRESADO
  // Arranca en 'advertir' porque la base todavia no existe: en 'exigir' con la
  // tabla vacia se cae toda la venta.
  validarEgresado: texto('VALIDAR_EGRESADO', 'advertir'),

  // Cuanto vive la reserva de cupo mientras el usuario esta en la pasarela.
  reservaMinutos: numero('RESERVA_MINUTOS', 20),

  wompi: {
    publicKey: texto('WOMPI_PUBLIC_KEY', 'pub_test_SIN_CONFIGURAR'),
    integritySecret: texto('WOMPI_INTEGRITY_SECRET', 'integrity_SIN_CONFIGURAR'),
    eventsSecret: texto('WOMPI_EVENTS_SECRET', 'events_SIN_CONFIGURAR'),
    // Solo para consultar transacciones (Bloque 2: reconciliacion). No firma
    // nada y NUNCA viaja al navegador.
    privateKey: texto('WOMPI_PRIVATE_KEY', ''),
    apiUrl: texto('WOMPI_API_URL', 'https://sandbox.wompi.co/v1'),
    moneda: 'COP',
    // A donde devuelve Wompi al usuario despues de pagar (pagina del front).
    redirectUrl: texto('WOMPI_REDIRECT_URL', 'http://localhost:3000/pago/resultado'),
    // En modo simulacion no se valida el checksum del webhook y se habilita
    // POST /api/simulacion/pagar. NUNCA dejar esto en true en produccion.
    simulacion: booleano('WOMPI_SIMULACION', true),
  },

  // Llave con la que se firman los tokens del QR. Cambiarla invalida todas
  // las boletas ya emitidas.
  qrSecret: texto('QR_SECRET', 'cambiame-en-produccion-por-favor'),

  correo: {
    host: texto('SMTP_HOST', ''),
    puerto: numero('SMTP_PORT', 587),
    usuario: texto('SMTP_USER', ''),
    clave: texto('SMTP_PASS', ''),
    remitente: texto('MAIL_FROM', 'Homecoming 80 Anos <boletas@ejemplo.edu.co>'),
    /* Canal de atencion al comprador. El colegio decidio el 8 de septiembre de
       2026 NO usar WhatsApp y centralizar todo en este correo. Va en el pie de
       los correos y de los PDF de las boletas: es lo unico que tiene alguien a
       quien no le llego la boleta o cuyo pago quedo en el limbo. */
    soporte: texto('SOPORTE_CORREO', 'HomecomingTCS@columbus.edu.co'),
  },

  // Limites de peticiones. Se dejan configurables porque en las pruebas hay que
  // subirlos y en produccion puede tocar bajarlos.
  limites: {
    crearOrdenPor10Min: numero('LIMITE_CREAR_ORDEN', 10),
    consultarOrdenPorMin: numero('LIMITE_CONSULTAR_ORDEN', 120),
    reenviarPor15Min: numero('LIMITE_REENVIAR', 3),
    archivosPorMin: numero('LIMITE_ARCHIVOS', 60),
  },

  // Tokens de acceso para los endpoints protegidos. Se mandan en el header
  // Authorization: Bearer <token>.
  tokens: {
    admin: texto('ADMIN_TOKEN', 'admin-cambiame'),
    puerta: texto('PUERTA_TOKEN', 'puerta-cambiame'),
  },

  // SQL Server del colegio. SOLO LECTURA: de aqui sale la configuracion
  // contable con la que SIESA emite la factura (centro de operacion, caja,
  // tipo de cliente, vendedor). El colegio ya le dio a Homecoming su fila en
  // ecampus.dbo.school_services y pidio que se lea de ahi, igual que hace su
  // plataforma de eventos.
  //
  // La venta NO depende de esto: sin configurar, el backend arranca y vende
  // igual. Solo la facturacion lo necesita.
  // Cuantos proxies hay delante de Node. Ver app.js. 1 = solo nginx.
  trustProxy: numero('TRUST_PROXY', 1),

  siesa: {
    host: texto('MSSQL_HOST', ''),
    puerto: numero('MSSQL_PORT', 1433),
    baseDatos: texto('MSSQL_DB', 'ecampus'),
    usuario: texto('MSSQL_USER', ''),
    clave: texto('MSSQL_PASSWORD', ''),
    // Id de Homecoming en school_services. El colegio lo creo: 465.
    servicioId: numero('SIESA_SERVICE_ID', 0),

    // --- Facturacion (SOAP contra el ERP) --------------------------------
    // Los tres salen del .env de la plataforma de eventos del colegio, que
    // lleva meses facturando con ellos.
    wsdl: texto('SIESA_WSDL_URL', ''),
    compania: texto('SIESA_F_CIA', ''),
    sucursal: texto('SIESA_ID_SUCURSAL', ''),

    // Interruptor de seguridad. En true, el backend ARMA la factura y la
    // registra en el log, pero NO la manda al ERP. Arranca asi a proposito:
    // una factura mal emitida en un sistema contable no se borra, se anula, y
    // eso lo tiene que hacer alguien a mano.
    ensayo: booleano('SIESA_ENSAYO', true),

    // A nombre de quien sale la factura.
    //
    // VACIO (lo normal) = la cedula del comprador, que es lo que hacen todos
    // los demas eventos del colegio. Los datos ya se piden en el checkout.
    //
    // Con un valor = TODAS las facturas salen a ese unico tercero. Es el plan
    // B para si SIESA no crea solo el tercero de un egresado que no existe en
    // t200_mm_terceros: se pone aqui el consumidor final y la venta se
    // factura igual. No se pierde a quien le vendimos: nombre, cedula,
    // direccion y ciudad quedan guardados en la orden y salen en el reporte.
    terceroGenerico: texto('SIESA_TERCERO_GENERICO', ''),
    // Fecha de nacimiento (AAAAMMDD) con la que se crea un tercero cuando el
    // comprador no la dejo (compras anteriores al 15 de septiembre de 2026).
    // Vacio = no se inventa: la factura queda pendiente con el motivo claro.
    // Solo se pone si contabilidad lo autoriza.
    fechaNacimientoDefecto: texto('SIESA_FECHA_NACIMIENTO_DEFECTO', '').replace(/\D/g, ''),

    // --- Creacion del tercero --------------------------------------------
    // El comprador tiene que EXISTIR en SIESA antes de facturarle. Un egresado
    // del 2004 no esta. Estos son los datos que SIESA pide y que el checkout
    // no puede preguntar sin volverse un formulario de banco.
    //
    // La ciudad viene como texto libre ("Medellin", "envigado", "MDE") y SIESA
    // la quiere en codigos DANE. No hay tabla para traducir eso, asi que se
    // usan estos por defecto y el texto que escribio la persona queda en la
    // orden. Son los mismos codigos de los ejemplos que mando el colegio.
    pais: texto('SIESA_ID_PAIS', '169'),        // Colombia
    departamento: texto('SIESA_ID_DEPTO', '05'), // Antioquia
    ciudad: texto('SIESA_ID_CIUDAD', '400'),     // Medellin

    // Tipo de cliente y vendedor con los que se da de alta la sucursal del
    // comprador. Si se dejan vacios se usan los de la fila 465, que son con
    // los que se factura. Existen aparte por si contabilidad quiere separar a
    // los compradores de Homecoming del resto.
    tipoCliente: texto('SIESA_ID_TIPO_CLI', ''),
    vendedor: texto('SIESA_ID_VENDEDOR', ''),
    condicionPago: texto('SIESA_ID_COND_PAGO', ''),

    // Plan de criterios (Criterios_Clientes). El colegio clasifica asi a sus
    // terceros; en los ejemplos van "ANE" y "TIC". Vacio = no se manda.
    planCriterios: texto('SIESA_PLAN_CRITERIOS', ''),
    criterioMayor: texto('SIESA_CRITERIO_MAYOR', ''),

    // Servidor enlazado de SQL Server por donde se ve la base del ERP.
    // Es el mismo nombre que usa la plataforma del colegio en sus OPENQUERY.
    servidorErp: texto('SIESA_LINKED_SERVER', 'CSERPDB'),
  },
}

// -----------------------------------------------------------------------------
// Revision de arranque.
//
// El disparador NO es NODE_ENV: es WOMPI_SIMULACION=false. El momento peligroso
// es cuando hay dinero real de por medio, y eso pasa igual en Sandbox con
// NODE_ENV=development. Arrancar con un secreto de ejemplo firmaria todas las
// transacciones con una llave falsa y Wompi las rechazaria con un error opaco.
//
// Se reportan TODOS los problemas juntos, no el primero: si faltan cinco cosas
// hay que enterarse de las cinco en el primer intento.
// -----------------------------------------------------------------------------

const VALORES_VALIDOS = {
  validarEgresado: ['apagado', 'advertir', 'exigir'],
  datosAsistente: ['minimo', 'acta', 'completo'],
}

export function revisarConfiguracion() {
  const problemas = []

  // --- siempre, aunque sea desarrollo: valores de enum mal escritos ---------
  for (const [clave, permitidos] of Object.entries(VALORES_VALIDOS)) {
    if (!permitidos.includes(config[clave])) {
      problemas.push(`${clave} = "${config[clave]}" no es valido (usa: ${permitidos.join(', ')})`)
    }
  }
  if (!Number.isInteger(config.evento.aforo) || config.evento.aforo < 1) {
    problemas.push('EVENTO_AFORO tiene que ser un entero mayor que cero')
  }
  for (const [clave, valor] of Object.entries({
    VENTA_APERTURA: config.evento.apertura,
    EVENTO_CIERRE_VENTA: config.evento.cierreVenta,
    EVENTO_FECHA: config.evento.fecha,
  })) {
    if (Number.isNaN(new Date(valor).getTime())) {
      problemas.push(`${clave} = "${valor}" no es una fecha ISO valida`)
    }
  }
  if (new Date(config.evento.apertura) >= new Date(config.evento.cierreVenta)) {
    problemas.push('VENTA_APERTURA es posterior al cierre: la venta nunca abriria')
  }

  // --- con dinero real de por medio ----------------------------------------
  if (!config.wompi.simulacion) {
    const { publicKey, integritySecret, eventsSecret } = config.wompi

    if (publicKey.includes('SIN_CONFIGURAR')) problemas.push('falta WOMPI_PUBLIC_KEY')
    else if (!/^pub_(test|prod)_/.test(publicKey)) {
      problemas.push('WOMPI_PUBLIC_KEY no empieza por pub_test_ ni pub_prod_')
    }
    if (integritySecret.includes('SIN_CONFIGURAR')) problemas.push('falta WOMPI_INTEGRITY_SECRET')
    if (eventsSecret.includes('SIN_CONFIGURAR')) problemas.push('falta WOMPI_EVENTS_SECRET')
    if (config.qrSecret.startsWith('cambiame')) {
      problemas.push('falta QR_SECRET: generalo con  npm run generar-qr-secret')
    }
    if (config.tokens.admin.endsWith('cambiame')) problemas.push('falta ADMIN_TOKEN')
    if (config.tokens.puerta.endsWith('cambiame')) problemas.push('falta PUERTA_TOKEN')
    if (!config.correo.host) {
      problemas.push('falta SMTP_HOST: los correos con las boletas se guardarian en disco en vez de enviarse')
    }

    // Las llaves de produccion y el entorno tienen que estar de acuerdo. Un
    // pub_prod_ con NODE_ENV=development casi siempre es un despliegue mal
    // configurado, y al reves es cobrar de mentira creyendo que es de verdad.
    const esProd = publicKey.startsWith('pub_prod_')
    if (esProd && config.entorno !== 'production') {
      problemas.push(`llaves de PRODUCCION con NODE_ENV=${config.entorno}`)
    }
    if (!esProd && config.entorno === 'production') {
      problemas.push('NODE_ENV=production con llaves de prueba (pub_test_)')
    }
    if (esProd && !config.urlPublica.startsWith('https://')) {
      problemas.push(`PUBLIC_URL tiene que ser https en produccion, llego "${config.urlPublica}"`)
    }

    // LAS CUATRO LLAVES TIENEN QUE SER DEL MISMO JUEGO. El 13 de septiembre
    // de 2026 llegaron dos de produccion y dos del sandbox: con eso el
    // checkout abre contra un ambiente y la firma se calcula con el secreto
    // del otro, y Wompi rechaza TODOS los pagos. Mejor que el servidor no
    // arranque a que arranque y nadie pueda comprar.
    if (esProd) {
      const { privateKey, apiUrl } = config.wompi
      if (privateKey && !privateKey.startsWith('prv_prod_')) {
        problemas.push('WOMPI_PUBLIC_KEY es de produccion pero WOMPI_PRIVATE_KEY no (prv_prod_)')
      }
      if (!integritySecret.startsWith('prod_')) {
        problemas.push('WOMPI_PUBLIC_KEY es de produccion pero WOMPI_INTEGRITY_SECRET no (prod_integrity_)')
      }
      if (!eventsSecret.startsWith('prod_')) {
        problemas.push('WOMPI_PUBLIC_KEY es de produccion pero WOMPI_EVENTS_SECRET no (prod_events_)')
      }
      if (apiUrl.includes('sandbox')) {
        problemas.push(`llaves de produccion contra el sandbox: WOMPI_API_URL=${apiUrl}`)
      }
    }
  }

  // El token del panel protege las ventas, los datos de 500 personas y el
  // boton de anular. En produccion no puede ser corto ni adivinable.
  if (config.entorno === 'production' && String(config.tokens.admin).length < 24) {
    problemas.push('ADMIN_TOKEN es demasiado corto para produccion (minimo 24 caracteres al azar)')
  }

  if (config.entorno === 'production' && config.wompi.simulacion) {
    problemas.push('WOMPI_SIMULACION=true en produccion: los pagos serian de mentira')
  }

  if (problemas.length) {
    const detalle = problemas.map((p) => `  - ${p}`).join(String.fromCharCode(10))
    throw new Error(
      ['', 'El servidor no arranca. Revisa el .env:', detalle, ''].join(String.fromCharCode(10)),
    )
  }
}

// Nombre viejo, por si algo lo importa todavia.
export const revisarConfiguracionDeProduccion = revisarConfiguracion
