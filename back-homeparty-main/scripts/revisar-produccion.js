// -----------------------------------------------------------------------------
// ¿ESTA LISTO PARA VENDER DE VERDAD?
//
//   npm run revisar-produccion
//
// Un solo comando que responde esa pregunta. No revisa el .env con una lista de
// campos obligatorios -- eso ya lo hace el arranque. Este PRUEBA, hablando con
// cada sistema del que depende una venta:
//
//   Wompi     le pregunta por el comercio con la llave que hay configurada
//   SIESA     lee la fila contable de Homecoming en el SQL Server del colegio
//   Correo    abre la conexion SMTP y se autentica
//
// Sirve el dia del despliegue y cada vez que alguien toque el .env. Un fallo
// aqui es una venta que no va a funcionar; encontrarlo con este comando cuesta
// treinta segundos, y encontrarlo con un comprador enojado cuesta mucho mas.
//
// NO ENVIA CORREOS, NO CREA ORDENES Y NO ESCRIBE NADA. Solo lee y pregunta.
// -----------------------------------------------------------------------------
import 'dotenv/config'
import nodemailer from 'nodemailer'
import { config, revisarConfiguracion } from '../src/config.js'
import { consultarTransaccion, ErrorPasarela } from '../src/pagos/wompi.js'
import { leerConfiguracionSiesa, camposVacios, cerrarConexion } from '../src/siesa/config.js'

const problemas = []
const avisos = []

const ok = (t) => console.log(`  [ok]     ${t}`)
const mal = (t, detalle) => { console.log(`  [FALLA]  ${t}`); if (detalle) console.log(`           ${detalle}`); problemas.push(t) }
const ojo = (t, detalle) => { console.log(`  [ojo]    ${t}`); if (detalle) console.log(`           ${detalle}`); avisos.push(t) }
const titulo = (t) => console.log(`\n  ${t}\n  ${'-'.repeat(t.length)}`)

console.log('\n  REVISION PARA PRODUCCION - Homecoming 80\n')

// -----------------------------------------------------------------------------
titulo('1. Configuracion')

try {
  revisarConfiguracion()
  ok('el .env pasa todas las revisiones de arranque')
} catch (e) {
  // El mensaje ya viene con la lista de lo que falta, una por linea.
  mal('el servidor no arrancaria', e.message.split('\n').slice(1).join('\n           '))
}

if (config.wompi.simulacion) {
  mal(
    'WOMPI_SIMULACION=true: los pagos serian de mentira',
    'Ponlo en false. Con esto en true nadie paga nada de verdad.',
  )
} else {
  // "Apagada" significa que se habla con Wompi de verdad. Si el dinero se
  // mueve o no lo decide la llave, y eso se revisa mas abajo.
  ok('la simulacion esta apagada: se habla con Wompi de verdad')
}

// -----------------------------------------------------------------------------
titulo('2. Wompi')

const esProd = config.wompi.publicKey.startsWith('pub_prod_')
const apiEsProd = config.wompi.apiUrl.includes('production')

console.log(`  llave    ${config.wompi.publicKey.slice(0, 13)}...`)
console.log(`  api      ${config.wompi.apiUrl}`)
console.log(`  entorno  NODE_ENV=${config.entorno}`)
console.log('')

if (esProd !== apiEsProd) {
  mal(
    'la llave y la URL de la API no son del mismo ambiente',
    esProd
      ? 'Llave de PRODUCCION contra la API de sandbox. Usa https://production.wompi.co/v1'
      : 'Llave de PRUEBAS contra la API de produccion. Usa https://sandbox.wompi.co/v1',
  )
} else {
  ok(`llave y API coinciden: ${esProd ? 'PRODUCCION' : 'pruebas (sandbox)'}`)
}

if (!esProd) {
  ojo(
    'estas con llaves de PRUEBAS',
    'Se puede probar todo, pero ningun pago mueve dinero. Para vender de verdad hacen falta las cuatro llaves de produccion.',
  )
}

// Se le pregunta a Wompi por el comercio. Es la unica forma de saber que la
// llave sirve de verdad y no solo que tiene la forma correcta.
try {
  const url = `${config.wompi.apiUrl.replace(/\/$/, '')}/merchants/${config.wompi.publicKey}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    mal(`Wompi respondio ${res.status} al preguntar por el comercio`, 'Revisa que la llave publica sea la correcta.')
  } else {
    const m = (await res.json()).data
    ok(`Wompi responde: comercio "${m.name}"`)

    // OJO: aqui NO se puede comprobar lo de AMEX y DINERS. Este endpoint lista
    // METODOS de pago (CARD, PSE, NEQUI...), no las FRANQUICIAS de tarjeta, y
    // AMEX es una franquicia dentro de CARD. Buscar "AMEX" en esta lista
    // siempre da negativo y quedaria un visto bueno que no verifico nada.
    // Se vio AMEX habilitado en el checkout el 5 de septiembre de 2026.
    ojo(
      'AMEX y DINERS: hay que mirarlo en el checkout, no se puede desde aqui',
      'La API lista metodos (CARD, PSE...), no franquicias. Abre un checkout de prueba y mira si aparecen los logos. Se acordo no aceptarlos y el 5-sep-2026 seguian activos.',
    )
  }
} catch (e) {
  mal('no se pudo hablar con Wompi', e.message)
}

// La consulta de transacciones es de lo que depende la reconciliacion: si esto
// no funciona, un webhook perdido deja a alguien pagado y sin boletas.
try {
  await consultarTransaccion('esta-transaccion-no-existe-revision')
  ojo('la consulta de transacciones respondio algo inesperado')
} catch (e) {
  if (e instanceof ErrorPasarela && e.tipo === 'no_encontrada') {
    ok('la consulta de transacciones funciona (la reconciliacion puede preguntar)')
  } else if (e instanceof ErrorPasarela && e.tipo === 'red') {
    mal('no hay salida a la API de Wompi', e.message)
  } else {
    ojo('la consulta de transacciones respondio raro', e.message)
  }
}

// -----------------------------------------------------------------------------
titulo('3. SIESA (configuracion contable)')

if (!config.siesa.host || !config.siesa.usuario) {
  ojo(
    'sin configurar (MSSQL_HOST / MSSQL_USER)',
    'La venta funciona igual: esto solo hace falta para facturar.',
  )
} else {
  console.log(`  servidor ${config.siesa.host}:${config.siesa.puerto}/${config.siesa.baseDatos}`)
  console.log(`  servicio ${config.siesa.servicioId}`)
  console.log('')
  try {
    const cfg = await leerConfiguracionSiesa()
    ok(`se leyo la fila ${config.siesa.servicioId} de school_services`)
    const vacios = camposVacios(cfg)
    if (vacios.length) {
      ojo(`${vacios.length} campo(s) contables sin valor: ${vacios.join(', ')}`, 'Los llena el colegio en su tabla.')
    } else {
      ok('los 14 campos contables vienen con valor')
    }
  } catch (e) {
    ojo(`no se pudo leer la configuracion contable: ${e.message}`, 'La venta no depende de esto, la facturacion si.')
  } finally {
    await cerrarConexion()
  }
}

// -----------------------------------------------------------------------------
titulo('4. Correo')

if (!config.correo.host) {
  mal('sin SMTP_HOST', 'Los correos con las boletas se guardarian en disco en vez de enviarse.')
} else {
  console.log(`  servidor ${config.correo.host}:${config.correo.puerto}`)
  console.log(`  usuario  ${config.correo.usuario || '(sin usuario)'}`)
  console.log(`  remite   ${config.correo.remitente}`)
  console.log('')

  // El remitente tiene que ser la misma cuenta que se autentica: Gmail
  // reescribe el From o rechaza el envio si no coinciden.
  const dentroDelRemitente = config.correo.remitente.toLowerCase()
  if (config.correo.usuario && !dentroDelRemitente.includes(config.correo.usuario.toLowerCase())) {
    ojo(
      'el remitente no es la cuenta que se autentica',
      `Se autentica como ${config.correo.usuario} pero firma como "${config.correo.remitente}". Gmail reescribe el remitente o rechaza el envio.`,
    )
  }

  try {
    const t = nodemailer.createTransport({
      host: config.correo.host,
      port: config.correo.puerto,
      secure: config.correo.puerto === 465,
      auth: config.correo.usuario ? { user: config.correo.usuario, pass: config.correo.clave } : undefined,
    })
    await t.verify()
    ok('el servidor de correo acepta la conexion y la contrasena')
    t.close()
  } catch (e) {
    mal('el correo no autentica', `${e.message}\n           Con Gmail hace falta una CONTRASENA DE APLICACION, no la de entrar al correo.`)
  }

  ojo(
    'SPF y DKIM no se pueden comprobar desde aqui',
    'Sin ellos, 500 correos con PDF adjunto se van a spam. Lo confirma TI del colegio.',
  )
}

// -----------------------------------------------------------------------------
titulo('Resumen')

if (problemas.length === 0 && avisos.length === 0) {
  console.log('\n  Todo en orden. El sistema puede vender.\n')
} else {
  if (problemas.length) {
    console.log(`\n  ${problemas.length} cosa(s) IMPIDEN vender:`)
    problemas.forEach((p) => console.log(`    - ${p}`))
  }
  if (avisos.length) {
    console.log(`\n  ${avisos.length} cosa(s) para revisar antes de abrir:`)
    avisos.forEach((a) => console.log(`    - ${a}`))
  }
  console.log('')
}

process.exitCode = problemas.length ? 1 : 0
