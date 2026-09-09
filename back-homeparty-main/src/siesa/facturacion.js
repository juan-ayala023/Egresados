// -----------------------------------------------------------------------------
// FACTURACION EN SIESA.
//
// Emite los dos documentos que el colegio genera por cada venta:
//
//   FES  factura de venta      -> Financiera_Factura
//   RCV  recibo de caja        -> Recibo_de_caja   (cruza contra la factura)
//
// ESTO NO SE INVENTO AQUI. Es la traduccion, campo por campo, del
// siesa_adapter.py que la plataforma de eventos del colegio lleva meses usando
// para teatro, carreras y camp. Los nombres raros (F350_, F320_, F357_) son de
// SIESA; se dejan igual a proposito, porque cualquier cosa que contabilidad
// tenga que revisar la va a buscar con ese nombre.
//
// EL TERCERO ES LA CEDULA. Esa fue la duda que trabo esto durante dias, y la
// respuesta estaba en su propio codigo:
//
//     siesa_id = row.siesa_id if row.siesa_id and row.siesa_id != 0 else nit
//
// Es decir: el numero de documento ES el identificador del tercero, salvo que
// la persona tenga uno propio registrado (padres de familia, empleados). Como
// Homecoming le vende a egresados que no estan en ecampus, aqui siempre va la
// cedula del comprador.
//
// OJO CON ESO: el tercero tiene que EXISTIR en SIESA (tabla t200_mm_terceros).
// La plataforma del colegio solo le factura a gente que ya esta ahi. Un
// egresado del 2004 probablemente no. Si SIESA no crea el tercero solo al
// recibir una cedula desconocida, hay que crearlos antes. Es la unica pregunta
// que queda abierta y la responde contabilidad.
//
// POR ESO ARRANCA EN MODO ENSAYO: con SIESA_ENSAYO=true arma los documentos y
// los deja en el log sin mandarlos. Una factura mal emitida en un sistema
// contable no se borra: se anula a mano.
// -----------------------------------------------------------------------------
import soap from 'soap'
import { config } from '../config.js'
import { leerConfiguracionSiesa } from './config.js'

export class ErrorSiesaFactura extends Error {
  constructor(mensaje, { tipo, detalle = null } = {}) {
    super(mensaje)
    this.tipo = tipo // 'sin_configurar' | 'sin_tercero' | 'red' | 'rechazo'
    this.detalle = detalle
  }
}

/**
 * SIESA rechaza acentos y caracteres raros en los campos de texto, y corta por
 * longitud. Misma limpieza que hace sanitize_siesa_text() en el original.
 */
export function limpiarTexto(valor, maximo = 250) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // quita tildes
    .replace(/[^\w\s.,;:()#/-]/g, ' ') // deja solo lo que SIESA acepta
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo)
}

/** Fecha en el formato que espera SIESA: AAAAMMDD, hora de Colombia. */
export function fechaSiesa(momento = new Date()) {
  const bogota = new Date(momento.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const p = (n) => String(n).padStart(2, '0')
  return `${bogota.getFullYear()}${p(bogota.getMonth() + 1)}${p(bogota.getDate())}`
}

/**
 * Medio de pago de Wompi -> codigo contable de SIESA.
 *   TCD  tarjetas
 *   CB5  transferencias, PSE, billeteras y efectivo
 * Es la misma tabla de equivalencias del adaptador de Python.
 */
export function medioDePago(metodoWompi) {
  const m = String(metodoWompi ?? '').toUpperCase()
  const esTarjeta = /CARD|VISA|MASTER|AMEX|DINERS|CREDIT|DEBIT|TARJETA/.test(m)
  return esTarjeta ? 'TCD' : 'CB5'
}

/**
 * A nombre de quien se factura.
 *
 * Por defecto la CEDULA del comprador, que es lo que hacen todos los eventos
 * del colegio. La boleta no es deducible para nadie, asi que nadie va a pedir
 * factura a su nombre -- pero el colegio si tiene que reportar el ingreso, y
 * con la cedula la venta queda rastreable si alguien reclama despues.
 *
 * SIESA_TERCERO_GENERICO es el plan B: si el ERP no crea solo el tercero de
 * un egresado que no existe en t200_mm_terceros, se pone ahi el consumidor
 * final y todas las facturas salen contra el. A quien se le vendio no se
 * pierde: queda en la orden y sale en el reporte del comite.
 */
export function terceroDe(comprador) {
  const generico = String(config.siesa.terceroGenerico ?? '').trim()
  if (generico) return generico
  return String(comprador?.cedula ?? '').trim()
}

// -----------------------------------------------------------------------------

let cliente = null

async function obtenerCliente() {
  if (cliente) return cliente

  const { wsdl } = config.siesa
  if (!wsdl) {
    throw new ErrorSiesaFactura('Falta SIESA_WSDL_URL en el .env', { tipo: 'sin_configurar' })
  }

  try {
    cliente = await soap.createClientAsync(wsdl, {
      // El WSDL del colegio va por HTTP PLANO contra una IP interna
      // (http://10.90.11.140:8082/...), no por HTTPS. Por eso NO se le pasa
      // aqui un `request: https.request`: forzarlo rompe la conexion contra
      // una URL http. La libreria elige el protocolo segun la URL.
      //
      // El rejectUnauthorized queda por si algun dia lo pasan a HTTPS con
      // certificado interno; hoy no hace nada. El adaptador de Python del
      // colegio hace lo mismo (session.verify = False).
      wsdl_options: { rejectUnauthorized: false },
      wsdl_headers: { Connection: 'keep-alive' },
    })
  } catch (e) {
    cliente = null
    throw new ErrorSiesaFactura(`No se pudo cargar el WSDL de SIESA: ${e.message}`, { tipo: 'red' })
  }
  return cliente
}

/**
 * Arma el cuerpo de la FACTURA (FES) sin enviarlo.
 * Se separa del envio para poder revisarlo, probarlo y mostrarlo en el modo
 * ensayo sin tocar el ERP.
 */
export async function armarFactura(orden, comprador, { configuracion } = {}) {
  const cfg = configuracion ?? (await leerConfiguracionSiesa())
  const tercero = terceroDe(comprador)

  if (!tercero) {
    throw new ErrorSiesaFactura('La orden no tiene cedula del comprador', { tipo: 'sin_tercero' })
  }
  if (!config.siesa.compania || !config.siesa.sucursal) {
    throw new ErrorSiesaFactura('Faltan SIESA_F_CIA o SIESA_ID_SUCURSAL', { tipo: 'sin_configurar' })
  }

  const fecha = fechaSiesa()
  // SIESA lleva los valores en PESOS, no en centavos como el resto del sistema.
  const totalPesos = String(Math.round(orden.total_centavos / 100))
  const nota = limpiarTexto(`Pago evento ${config.evento.nombre} | Wompi ${orden.wompi_transaction_id ?? 'N/A'}`)

  return {
    F350_ID_CO: cfg.id_co,
    F350_ID_TIPO_DOCTO: 'FES',
    F350_ID_CLASE_DOCTO: '22',
    F350_CONSEC_DOCTO: '',        // lo asigna SIESA
    F350_FECHA: fecha,
    F350_ID_TERCERO: tercero,
    F350_IND_ESTADO: '1',
    F350_NOTAS: nota,
    F311_ID_SUCURSAL_CLI: config.siesa.sucursal,
    F311_ID_TIPO_CLI: cfg.id_tipo_cli,
    F311_ID_TERCERO_VENDEDOR: cfg.siesa_seller_tercero_id,
    F311_ID_COND_PAGO: cfg.id_cond_pago,
    F311_ID_MONEDA_DOCTO: 'COP',
    F_CIA: config.siesa.compania,
    MOVIMIENTOS: {
      Factura_Financiera_Movimiento: [
        {
          // Una linea por la orden completa: la cantidad son las boletas.
          F320_CANTIDAD: String(orden.cantidad),
          F320_ID_CO_MOVTO: cfg.id_co,
          F320_ID_UN_MOVTO: cfg.id_un,
          F320_ID_MOTIVO: cfg.siesa_id_motivo,
          F320_ID_SERVICIO: cfg.siesa_service_id,
          F320_ID_CCOSTO_MOVTO: cfg.siesa_cc,
          F320_ID_SUCURSAL_CLIENTE: config.siesa.sucursal,
          F320_ID_TERCERO_MOVTO: tercero,
          F320_VLR_BRUTO: totalPesos,
          F320_VLR_DSCTO_1: '0',
          F320_VLR_DSCTO_2: '0',
          F320_NOTAS: limpiarTexto(`Evento ${config.evento.nombre}`),
        },
      ],
    },
  }
}

/**
 * Arma el RECIBO DE CAJA (RCV), que cruza contra la factura ya emitida.
 * @param {string} numeroFactura consecutivo que devolvio SIESA al facturar
 */
export async function armarRecibo(orden, comprador, numeroFactura, { configuracion } = {}) {
  if (!numeroFactura) {
    throw new ErrorSiesaFactura('El recibo necesita el numero de la factura', { tipo: 'sin_configurar' })
  }

  const cfg = configuracion ?? (await leerConfiguracionSiesa())
  const tercero = terceroDe(comprador)
  const fecha = fechaSiesa()
  const totalPesos = String(Math.round(orden.total_centavos / 100))
  const nota = limpiarTexto(`Pago evento ${config.evento.nombre} | Wompi ${orden.wompi_transaction_id ?? 'N/A'}`)

  // El consecutivo puede venir como "001-FES-1234": SIESA quiere solo el numero.
  const consecutivo = String(numeroFactura).includes('-')
    ? String(numeroFactura).split('-').pop()
    : String(numeroFactura)

  const medio = medioDePago(orden.metodo_pago)
  const idTransaccion = String(orden.wompi_transaction_id ?? '')

  return {
    F350_ID_CO: cfg.id_co,
    F350_ID_TIPO_DOCTO: 'RCV',
    F350_ID_CLASE_DOCTO: '13',
    F350_CONSEC_DOCTO: '',
    F350_FECHA: fecha,
    F350_ID_TERCERO: tercero,
    F350_IND_ESTADO: '1',
    F350_NOTAS: nota,

    F357_FECHA_RECAUDO: fecha,
    F357_ID_CAJA: cfg.id_caja,
    F357_ID_FE: cfg.id_fe,
    F357_ID_MONEDA_APLICAR: 'COP',
    F357_ID_MONEDA_INGRESO: 'COP',
    F357_REFERENCIA: idTransaccion || 'N/A',
    F357_VALOR_APLICAR_REAL: totalPesos,
    F357_VALOR_INGRESO: totalPesos,
    F357_ID_COBRADOR: cfg.siesa_seller_id,
    F357_IND_VALIDA_MEDPAGO: '1',

    // Cruce contra la factura: es lo que deja la venta saldada en cartera.
    F353_ID_AUXILIAR_DOCTO_CRUCE: cfg.id_auxiliar_docto_cruce,
    F353_CONSEC_DOCTO_CRUCE: consecutivo,
    F353_ID_CO_DOCTO_CRUCE: cfg.id_co_docto_cruce,
    F353_ID_TIPO_DOCTO_CRUCE: 'FES',
    F353_ID_SUCURSAL_DOCTO_CRUCE: config.siesa.sucursal,
    F353_ID_UN_DOCTO_CRUCE: cfg.id_un_docto_cruce,
    F353_NRO_CUOTA_CRUCE: '0',

    F354_VALOR_CR: totalPesos,
    F354_VALOR_APLICADO_PP: '0',
    F354_VALOR_APROVECHA: '0',
    F354_VALOR_RETENCION: '0',

    F358_ID_MEDIOS_PAGO: medio,
    F358_NRO_CUENTA: medio === 'TCD' ? String(orden.ultimos_cuatro ?? '') : '',
    F358_NRO_AUTORIZACION: idTransaccion.slice(0, 10),
    F358_REFERENCIA_OTROS: medio === 'TCD' ? '' : idTransaccion.slice(0, 8),
    F358_NOTAS: nota,
    F358_FECHA_CONSIGNACION: fecha,
    F358_FECHA_VCTO: fecha,
    F358_VALOR: totalPesos,
    F358_ID_TERCERO: tercero,

    F_CIA: config.siesa.compania,
  }
}

/**
 * Lee el consecutivo que SIESA devuelve en su respuesta.
 * La forma exacta depende del WSDL, asi que se buscan las claves conocidas en
 * vez de asumir una: es preferible devolver null y que quede el aviso, a
 * inventarse un numero de factura.
 */
export function consecutivoDe(respuesta) {
  const r = respuesta?.[0] ?? respuesta ?? {}
  const texto = JSON.stringify(r)
  for (const clave of ['CONSEC_DOCTO', 'F350_CONSEC_DOCTO', 'Consecutivo', 'consecutivo']) {
    const m = new RegExp(`"${clave}"\\s*:\\s*"?([\\w-]+)"?`).exec(texto)
    if (m) return m[1]
  }
  return null
}

/**
 * Emite factura y recibo de una orden pagada.
 *
 * En modo ensayo (SIESA_ENSAYO=true) arma los dos documentos, los devuelve y
 * NO llama al ERP. Es el modo con el que arranca.
 *
 * @returns {Promise<{ensayo:boolean, factura:object, recibo:object|null,
 *                     numeroFactura:string|null, numeroRecibo:string|null}>}
 */
export async function facturar(orden, comprador) {
  const configuracion = await leerConfiguracionSiesa()
  const factura = await armarFactura(orden, comprador, { configuracion })

  if (config.siesa.ensayo) {
    // Ni se carga el WSDL: en ensayo no se toca el ERP ni de lejos.
    return { ensayo: true, factura, recibo: null, numeroFactura: null, numeroRecibo: null }
  }

  const cli = await obtenerCliente()

  let numeroFactura = null
  try {
    const respuesta = await cli.Financiera_FacturaAsync({ Factura: factura })
    numeroFactura = consecutivoDe(respuesta)
  } catch (e) {
    throw new ErrorSiesaFactura(`SIESA rechazo la factura: ${e.message}`, {
      tipo: 'rechazo', detalle: e.root ?? null,
    })
  }

  if (!numeroFactura) {
    throw new ErrorSiesaFactura(
      'SIESA acepto la factura pero no devolvio el consecutivo. Hay que buscarla en el ERP antes de reintentar, o se factura dos veces.',
      { tipo: 'rechazo' },
    )
  }

  const recibo = await armarRecibo(orden, comprador, numeroFactura, { configuracion })

  let numeroRecibo = null
  try {
    const respuesta = await cli.Recibo_de_cajaAsync({ Recibo: recibo })
    numeroRecibo = consecutivoDe(respuesta)
  } catch (e) {
    // La factura YA se emitio. Se avisa distinto a proposito: reintentar todo
    // duplicaria la factura. Lo que falta es solo el recibo.
    throw new ErrorSiesaFactura(
      `La factura ${numeroFactura} SI se emitio, pero el recibo de caja fallo: ${e.message}`,
      { tipo: 'rechazo', detalle: { numeroFactura } },
    )
  }

  return { ensayo: false, factura, recibo, numeroFactura, numeroRecibo }
}
