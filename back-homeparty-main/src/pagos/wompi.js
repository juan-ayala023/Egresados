// -----------------------------------------------------------------------------
// ADAPTADOR DE WOMPI.
//
// Este es el UNICO archivo que sabe como habla Wompi. Todo lo demas del backend
// pasa por src/pagos/index.js, que expone el vocabulario del negocio (pagos,
// referencias, estados) y no menciona la pasarela. Si algun dia el colegio
// cambia a PlaceToPay, se escribe otro archivo como este y no se toca nada mas.
//
// Aqui viven tres cosas que se confunden facil:
//
//   1. FIRMA DE INTEGRIDAD  -> la calcula el backend, viaja al checkout con el
//      usuario, y le prueba a Wompi que el monto no fue alterado en el navegador.
//      SHA256(referencia + montoEnCentavos + moneda + integrity_secret)
//
//   2. CHECKSUM DEL WEBHOOK -> lo calcula Wompi, llega en el evento, y nos
//      prueba a nosotros que el evento es autentico.
//      SHA256(valores de signature.properties + timestamp + events_secret)
//
//   3. CONSULTA A LA API    -> la hacemos nosotros para preguntar por una
//      transaccion. GET /v1/transactions/{id}, con la llave PUBLICA.
//
// Los dos secretos son distintos y ninguno sale nunca del servidor.
// -----------------------------------------------------------------------------
import crypto from 'node:crypto'
import { config } from '../config.js'

const sha256 = (texto) => crypto.createHash('sha256').update(texto, 'utf8').digest('hex')

// -----------------------------------------------------------------------------
// 1. Firma de integridad
// -----------------------------------------------------------------------------

/**
 * Firma con la que se abre el checkout.
 * OJO: el monto va en CENTAVOS. $80.000 COP es 8000000.
 */
export function firmaIntegridad(referencia, montoEnCentavos, moneda = config.wompi.moneda) {
  const cadena = `${referencia}${montoEnCentavos}${moneda}${config.wompi.integritySecret}`
  return sha256(cadena)
}

/**
 * Arma el bloque que el front necesita para abrir el Web Checkout.
 * El front no calcula nada: solo copia estos campos.
 */
export function datosCheckout(referencia, montoEnCentavos) {
  return {
    publicKey: config.wompi.publicKey,
    currency: config.wompi.moneda,
    amountInCents: montoEnCentavos,
    reference: referencia,
    signatureIntegrity: firmaIntegridad(referencia, montoEnCentavos),
    redirectUrl: config.wompi.redirectUrl,
  }
}

// -----------------------------------------------------------------------------
// 2. Checksum del webhook
// -----------------------------------------------------------------------------

/** Lee un valor anidado tipo "transaction.amount_in_cents" de un objeto. */
function valorAnidado(objeto, ruta) {
  return ruta.split('.').reduce((acc, llave) => (acc == null ? acc : acc[llave]), objeto)
}

/**
 * Arma la cadena que se firma. Separada para poder probarla sola.
 *
 * Wompi manda en signature.properties la LISTA de campos que firmo y en que
 * orden. Hay que concatenar sus valores en ese mismo orden, pegarle el
 * timestamp y el events_secret.
 *
 * NO se queman los nombres de los campos: si Wompi cambia el set, esto sigue
 * funcionando.
 */
export function cadenaDelChecksum(evento, secreto = config.wompi.eventsSecret) {
  const propiedades = evento?.signature?.properties ?? []
  const valores = propiedades.map((ruta) => valorAnidado(evento.data, ruta)).join('')
  return `${valores}${evento.timestamp}${secreto}`
}

/**
 * Verifica el checksum de un evento entrante.
 *
 * @returns {{valido: boolean, motivo?: string}}
 */
export function verificarChecksumWebhook(evento) {
  // En modo simulacion (desarrollo) no hay secreto real que validar.
  if (config.wompi.simulacion) return { valido: true, motivo: 'simulacion' }

  const firma = evento?.signature
  if (!firma?.checksum || !Array.isArray(firma?.properties)) {
    return { valido: false, motivo: 'El evento no trae signature.properties o signature.checksum' }
  }
  if (evento.timestamp === undefined || evento.timestamp === null) {
    return { valido: false, motivo: 'El evento no trae timestamp' }
  }

  const calculado = sha256(cadenaDelChecksum(evento))

  // Comparacion en tiempo constante: comparar hashes con === filtra informacion
  // por el tiempo que tarda en fallar. Wompi publica el checksum en mayusculas.
  const a = Buffer.from(calculado, 'utf8')
  const b = Buffer.from(String(firma.checksum).toLowerCase(), 'utf8')
  const valido = a.length === b.length && crypto.timingSafeEqual(a, b)

  return valido ? { valido: true } : { valido: false, motivo: 'El checksum no coincide' }
}

// -----------------------------------------------------------------------------
// 3. Consulta a la API
// -----------------------------------------------------------------------------

export class ErrorPasarela extends Error {
  constructor(mensaje, { tipo, status = null }) {
    super(mensaje)
    this.tipo = tipo // 'no_encontrada' | 'sin_configurar' | 'red' | 'respuesta'
    this.status = status
  }
}

/**
 * Consulta una transaccion por su id.
 *
 * La documentacion de Wompi dice que el estado se puede consultar con la llave
 * PUBLICA; la privada es para crear y anular. Se usa la publica a proposito:
 * este backend nunca necesita la privada, y no tenerla es una cosa menos que
 * se puede filtrar.
 *
 * @param {string} id id de transaccion de Wompi (el que vuelve en el redirect)
 * @returns {Promise<object>} la transaccion cruda, tal como la manda Wompi
 */
/**
 * Busca la transaccion de una orden POR SU REFERENCIA.
 *
 * ES LA PIEZA QUE HACE QUE LA BOLETA NO DEPENDA DEL COMPRADOR.
 *
 * El problema: el id de transaccion de Wompi solo nos llega de dos formas, y
 * ninguna esta garantizada. Por el webhook -- que apunta a la plataforma del
 * colegio, no a nosotros -- o porque la persona le da a "volver al comercio".
 * Quien paga y cierra la pestana se quedaba sin boleta, y el barrido de
 * reconciliacion no podia rescatarlo porque tampoco tenia el id que consultar.
 *
 * Buscando por referencia se cierra ese circulo: la referencia SIEMPRE la
 * tenemos, es nuestra.
 *
 * OJO: este listado exige la llave PRIVADA. La publica devuelve
 * "Solicitud no autorizada". Es la unica cosa para la que este backend la
 * necesita, y por eso dejo de estar vacia.
 *
 * @returns {Promise<object|null>} la transaccion mas reciente, o null
 */
export async function buscarPorReferencia(referencia, { timeoutMs = 10_000 } = {}) {
  if (!config.wompi.apiUrl) {
    throw new ErrorPasarela('WOMPI_API_URL no esta configurada', { tipo: 'sin_configurar' })
  }
  if (!config.wompi.privateKey) {
    throw new ErrorPasarela(
      'Falta WOMPI_PRIVATE_KEY: sin ella no se puede buscar por referencia y quien no vuelva al sitio se queda sin boleta',
      { tipo: 'sin_configurar' },
    )
  }
  if (!referencia) {
    throw new ErrorPasarela('Se pidio buscar sin referencia', { tipo: 'sin_configurar' })
  }

  const url = `${config.wompi.apiUrl.replace(/\/$/, '')}/transactions?reference=${encodeURIComponent(referencia)}`

  let respuesta
  try {
    respuesta = await fetch(url, {
      headers: { Authorization: `Bearer ${config.wompi.privateKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    throw new ErrorPasarela(`No se pudo consultar Wompi: ${e.message}`, { tipo: 'red' })
  }

  if (!respuesta.ok) {
    throw new ErrorPasarela(`Wompi respondio ${respuesta.status} al buscar por referencia`, {
      tipo: respuesta.status === 401 ? 'sin_configurar' : 'red',
    })
  }

  const cuerpo = await respuesta.json().catch(() => null)
  const lista = Array.isArray(cuerpo?.data) ? cuerpo.data : []
  if (!lista.length) return null

  /* Puede haber varios intentos sobre la misma referencia: alguien que puso mal
     la tarjeta, reintento y luego pago. Gana el APROBADO -- si existe uno, esa
     persona pago y tiene derecho a su boleta, sin importar cuantos intentos
     fallidos haya antes. */
  const aprobada = lista.find((t) => t.status === 'APPROVED')
  return aprobada ?? lista[lista.length - 1]
}

export async function consultarTransaccion(id, { timeoutMs = 10_000 } = {}) {
  if (!config.wompi.apiUrl) {
    throw new ErrorPasarela('WOMPI_API_URL no esta configurada', { tipo: 'sin_configurar' })
  }
  if (!id) {
    throw new ErrorPasarela('Se pidio consultar una transaccion sin id', { tipo: 'sin_configurar' })
  }

  const url = `${config.wompi.apiUrl.replace(/\/$/, '')}/transactions/${encodeURIComponent(id)}`

  // Con la llave PRIVADA si la hay. Con la publica, Wompi respondio 404 el 14
  // de septiembre de 2026 para una transaccion de ese mismo dia que a
  // mediodia si habia devuelto: la consulta publica parece limitada en el
  // tiempo. La privada es la del comercio y ve todas sus transacciones.
  const llave = config.wompi.privateKey || config.wompi.publicKey

  let respuesta
  try {
    respuesta = await fetch(url, {
      headers: { Authorization: `Bearer ${llave}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    // Sin internet, DNS caido, timeout. Es reintentable: el barrido volvera.
    throw new ErrorPasarela(`No se pudo hablar con Wompi: ${e.message}`, { tipo: 'red' })
  }

  if (respuesta.status === 404) {
    throw new ErrorPasarela(`Wompi no conoce la transaccion ${id}`, {
      tipo: 'no_encontrada', status: 404,
    })
  }
  if (!respuesta.ok) {
    throw new ErrorPasarela(`Wompi respondio ${respuesta.status}`, {
      tipo: 'respuesta', status: respuesta.status,
    })
  }

  let cuerpo
  try {
    cuerpo = await respuesta.json()
  } catch {
    throw new ErrorPasarela('Wompi respondio algo que no es JSON', { tipo: 'respuesta' })
  }

  // La API envuelve el recurso en { data: {...} }.
  const transaccion = cuerpo?.data ?? cuerpo
  if (!transaccion?.id) {
    throw new ErrorPasarela('La respuesta de Wompi no trae una transaccion', { tipo: 'respuesta' })
  }
  return transaccion
}

// -----------------------------------------------------------------------------
// 4. Traduccion al vocabulario del negocio
// -----------------------------------------------------------------------------

/**
 * Estado de Wompi -> estado de nuestra orden.
 *   APPROVED -> pagada     (la unica que emite boletas)
 *   DECLINED / VOIDED / ERROR -> rechazada (libera la reserva)
 *   PENDING  -> pendiente  (tipico en PSE: todavia no se decide nada)
 */
export function estadoOrdenSegunWompi(estadoWompi) {
  switch (String(estadoWompi ?? '').toUpperCase()) {
    case 'APPROVED': return 'pagada'
    case 'DECLINED':
    case 'VOIDED':
    case 'ERROR': return 'rechazada'
    case 'PENDING': return 'pendiente'
    default: return null
  }
}

/**
 * La marca de la tarjeta.
 *
 * La documentacion la muestra como payment_method.extra.brand en unos ejemplos
 * y como payment_method.brand en otros, asi que se miran los dos sitios. En
 * PSE, Nequi o Bancolombia no viene: queda null.
 */
export function franquiciaDe(transaccion) {
  const marca = transaccion?.payment_method?.extra?.brand
    ?? transaccion?.payment_method?.extra?.card_brand
    ?? transaccion?.payment_method?.brand
    ?? null
  return marca ? String(marca).toUpperCase().trim() : null
}

/**
 * Los ultimos cuatro digitos de la tarjeta (payment_method.extra.last_four).
 * SIESA los exige en el recibo de caja cuando el medio es tarjeta. En PSE,
 * Nequi o Bancolombia no vienen: queda null.
 */
export function ultimosCuatroDe(transaccion) {
  const valor = transaccion?.payment_method?.extra?.last_four
    ?? transaccion?.payment_method?.extra?.lastDigits
    ?? null
  const digitos = String(valor ?? '').replace(/\D/g, '')
  return digitos.length === 4 ? digitos : null
}

/**
 * El codigo de aprobacion del banco (payment_method.extra.external_identifier):
 * el mismo que sale en el voucher del datafono. Contabilidad lo quiere en la
 * Autorizacion del recibo de caja. No siempre viene: entonces null, y el
 * recibo usa el id de Wompi.
 */
export function autorizacionBancoDe(transaccion) {
  // Para TODOS los medios de pago, igual que la plataforma de eventos del
  // colegio (contabilidad pidio el 14 de septiembre de 2026 que sea identico).
  // En tarjeta es el codigo del banco ("R18193"); en transferencia Bancolombia
  // es el id de sesion del boton ("_DhUelc4tFB"). Contabilidad lo sabe y asi
  // lo quiere, para que los recibos de los dos sistemas se lean igual.
  const valor = String(transaccion?.payment_method?.extra?.external_identifier ?? '').trim()
  return valor ? valor.slice(0, 20) : null
}

/**
 * Normaliza una transaccion de Wompi a lo que le importa al backend.
 * Es la frontera: de aqui para adentro nadie vuelve a ver un campo en ingles.
 */
export function normalizar(transaccion) {
  return {
    idTransaccion: transaccion.id ?? null,
    referencia: transaccion.reference ?? null,
    estado: estadoOrdenSegunWompi(transaccion.status),
    estadoCrudo: transaccion.status ?? null,
    montoCentavos: Number(transaccion.amount_in_cents),
    moneda: transaccion.currency ?? null,
    metodoPago: transaccion.payment_method_type ?? null,
    franquicia: franquiciaDe(transaccion),
    ultimosCuatro: ultimosCuatroDe(transaccion),
    autorizacionBanco: autorizacionBancoDe(transaccion),
  }
}
