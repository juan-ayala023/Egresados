// -----------------------------------------------------------------------------
// DIRECCION Y CIUDAD DE FACTURACION.
//
// El colegio cayo en cuenta el 14 de septiembre de 2026, la vispera de la
// primera compra real: la direccion aceptaba cualquier cosa ("asdfgh") y la
// ciudad tambien ("xyz"). Los dos van a la factura electronica, y la DIAN
// rechaza una factura con direccion basura -- pero se entera contabilidad
// semanas despues, cuando ya no se puede corregir con el comprador.
//
// Aqui no se intenta saber si la direccion EXISTE (eso no se puede sin un
// servicio de mapas). Se exige que tenga la FORMA de una direccion
// colombiana: una via (calle, carrera, avenida...) y un numero. Con eso se
// cae el 99% de lo que se escribe para salir del paso.
//
// La misma lista de ciudades y la misma regla estan en el front
// (src/lib/direcciones.ts). Si cambia una, cambia la otra.
// -----------------------------------------------------------------------------

/**
 * Como se nombran las vias en Colombia, con sus abreviaturas mas comunes.
 * Sin tilde: la direccion se normaliza antes de compararla.
 */
const VIAS = [
  'calle', 'cl', 'cll', 'cle',
  'carrera', 'cra', 'cr', 'kr', 'kra', 'crr',
  'avenida', 'av', 'avda', 'ave',
  'diagonal', 'dg', 'diag',
  'transversal', 'tv', 'tr', 'trans', 'transv',
  'circular', 'cq', 'circ',
  'kilometro', 'km',
  'autopista', 'aut', 'auto',
  'via',
  'vereda', 'vda',
  'manzana', 'mz',
  'casa', 'cs',
  'finca', 'lote', 'lt',
  'sector', 'barrio', 'corregimiento',
  'carretera', 'variante', 'glorieta',
]

// La via tiene que ir como palabra: al inicio o tras espacio/punto, y seguida
// de espacio, punto, numero o #. Asi "Cra 43A" y "Cra43A" pasan, y "acra"
// (dentro de otra palabra) no.
const PATRON_VIA = new RegExp(`(^|[\\s.])(${VIAS.join('|')})(?=[\\s.\\d#-]|$)`, 'i')

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * ¿Tiene forma de direccion colombiana?
 *
 * @param {string} valor
 * @param {{ exterior?: boolean }} opciones  si el comprador vive fuera de
 *   Colombia, no se le exige una via colombiana: solo un numero y largo
 *   razonable.
 * @returns {string|null} el mensaje de error, o null si esta bien
 */
export function validarDireccion(valor, { exterior = false } = {}) {
  const v = sinTildes(valor).trim().replace(/\s+/g, ' ')

  if (v.length < 6) return 'Escribe la direccion completa.'
  if (v.length > 120) return 'La direccion es demasiado larga.'
  if (!/\d/.test(v)) return 'La direccion tiene que llevar numero (ej: Cra 43A # 1-50).'
  if (!/[a-zA-Z]/.test(v)) return 'La direccion tiene que llevar letras (ej: Calle 10 # 5-20).'

  // Solo lo que cabe en una direccion: letras, numeros, espacio y # - . , / ° ª º
  if (/[^a-zA-Z0-9\s#\-.,/°ªºñÑ]/.test(v)) {
    return 'La direccion tiene caracteres que no van (usa solo letras, numeros, # y -).'
  }

  if (!exterior && !PATRON_VIA.test(v)) {
    return 'Empieza por la via: Calle, Carrera, Avenida, Diagonal, Transversal... (ej: Cra 43A # 1-50).'
  }

  return null
}

// -----------------------------------------------------------------------------

/**
 * Ciudades que ofrece el desplegable. Primero el area metropolitana de
 * Medellin y Antioquia, que es donde vive casi todo el que compra; despues
 * las capitales. Es una lista, no una base de datos: si falta una, se agrega.
 */
export const CIUDADES = [
  // Area metropolitana del Valle de Aburra
  'Medellín', 'Envigado', 'Sabaneta', 'Itagüí', 'Bello', 'La Estrella',
  'Caldas', 'Copacabana', 'Girardota', 'Barbosa',
  // Oriente antioqueno
  'Rionegro', 'El Retiro', 'La Ceja', 'Marinilla', 'Guarne', 'El Carmen de Viboral',
  'Santa Fe de Antioquia', 'San Jerónimo', 'Sopetrán',
  // Capitales y ciudades grandes
  'Bogotá', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira',
  'Manizales', 'Armenia', 'Cúcuta', 'Santa Marta', 'Ibagué', 'Villavicencio',
  'Montería', 'Pasto', 'Neiva', 'Valledupar', 'Popayán', 'Sincelejo',
  'Tunja', 'Riohacha', 'Quibdó', 'Florencia', 'Yopal', 'Chía', 'Cajicá',
  'Jamundí', 'Palmira', 'Floridablanca', 'Dosquebradas', 'Soledad',
  'Apartadó', 'Turbo', 'Caucasia', 'Puerto Berrío',
]

/** Las dos salidas del desplegable que piden texto aparte. */
export const CIUDAD_OTRA = 'OTRA'
export const CIUDAD_EXTERIOR = 'EXTERIOR'

const normalizarCiudad = (s) => sinTildes(s).trim().toLowerCase().replace(/\s+/g, ' ')
const CIUDADES_NORMALIZADAS = new Set(CIUDADES.map(normalizarCiudad))

/** ¿Esta en la lista? (sin importar tildes ni mayusculas) */
export const esCiudadConocida = (valor) => CIUDADES_NORMALIZADAS.has(normalizarCiudad(valor))

/**
 * ¿Es una ciudad aceptable?
 *
 * De la lista, sin mas. Si no esta en la lista (eligio "Otra" o "Fuera de
 * Colombia" y escribio el nombre), tiene que ser un nombre: solo letras,
 * espacios y algun guion o punto, minimo 3 letras. "xyz" pasa por letras
 * pero "123" y "a1b2" no; contra el que quiere mentir no hay validacion que
 * valga, esto es contra el que quiere salir rapido.
 *
 * @returns {string|null}
 */
export function validarCiudad(valor) {
  const v = String(valor ?? '').trim().replace(/\s+/g, ' ')
  if (!v) return 'Selecciona la ciudad.'
  if (esCiudadConocida(v)) return null
  if (v.length < 3) return 'Escribe el nombre de la ciudad.'
  if (v.length > 60) return 'El nombre de la ciudad es demasiado largo.'
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ][a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.,'-]*$/.test(v)) {
    return 'La ciudad solo lleva letras (ej: Medellín).'
  }
  return null
}
