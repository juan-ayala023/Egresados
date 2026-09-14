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
// CIUDAD: departamento + municipio, de la lista oficial del DANE.
//
// El 14 de septiembre de 2026 el colegio pidio que estuvieran TODOS los
// municipios y departamentos de Colombia, no una lista corta. Vienen de
// divipola.js (1.122 municipios, 33 departamentos). El front muestra dos
// desplegables -- departamento y luego municipio -- y manda la ciudad como
// "Municipio, Departamento" (o solo "Bogotá D.C.", que es las dos cosas).
//
// Quien vive fuera de Colombia escribe "Ciudad, País" a mano: eso no esta en
// ninguna lista, y se acepta si parece un nombre.
// -----------------------------------------------------------------------------
import { DEPARTAMENTOS } from './divipola.js'

/** Sin tildes, en minuscula, un solo espacio: para comparar sin drama. */
const clave = (s) => sinTildes(s).trim().toLowerCase().replace(/\s+/g, ' ')

// "medellin, antioquia" -> true. Se arma una vez al cargar.
const PARES = new Set()
for (const d of DEPARTAMENTOS) {
  for (const m of d.municipios) {
    PARES.add(`${clave(m.nombre)}, ${clave(d.nombre)}`)
    // Bogota D.C. es municipio y departamento a la vez: vale solo.
    if (clave(m.nombre) === clave(d.nombre)) PARES.add(clave(m.nombre))
  }
}

/** Como se guarda la ciudad: "Medellín, Antioquia", o "Bogotá D.C." si coinciden. */
export function nombreCiudad(municipio, departamento) {
  return clave(municipio) === clave(departamento) ? municipio : `${municipio}, ${departamento}`
}

/** ¿Es un municipio colombiano de la DIVIPOLA? (sin importar tildes ni mayusculas) */
export const esCiudadConocida = (valor) => PARES.has(clave(valor))

/**
 * ¿Es una ciudad aceptable?
 *
 * De la DIVIPOLA, sin mas. Si no esta (vive fuera de Colombia y escribio
 * "Ciudad, País"), tiene que ser un nombre: letras, espacios, coma y algun
 * guion o punto, minimo 3 letras. "xyz" pasa por letras pero "123" y "a1b2"
 * no; contra el que quiere mentir no hay validacion que valga, esto es
 * contra el que quiere salir rapido.
 *
 * @returns {string|null}
 */
export function validarCiudad(valor) {
  const v = String(valor ?? '').trim().replace(/\s+/g, ' ')
  if (!v) return 'Selecciona el departamento y el municipio.'
  if (esCiudadConocida(v)) return null
  if (v.length < 3) return 'Escribe el nombre de la ciudad.'
  if (v.length > 80) return 'El nombre de la ciudad es demasiado largo.'
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ][a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.,'-]*$/.test(v)) {
    return 'La ciudad solo lleva letras (ej: Medellín).'
  }
  return null
}
