// -----------------------------------------------------------------------------
// Generador del numero de orden: HC80-XXXXXX.
//
// El front hoy lo inventa en el navegador con Math.random. Aqui se genera con
// crypto (no predecible) y se verifica contra la base para que nunca se repita:
// esta referencia es la llave que viaja a Wompi y vuelve en el webhook.
// -----------------------------------------------------------------------------
import crypto from 'node:crypto'

// Sin I, O, 0, 1: se confunden cuando alguien dicta el numero de orden por
// telefono a soporte.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LARGO = 6
const PREFIJO = 'HC80'

function sufijoAleatorio() {
  const bytes = crypto.randomBytes(LARGO)
  let salida = ''
  for (let i = 0; i < LARGO; i++) salida += ALFABETO[bytes[i] % ALFABETO.length]
  return salida
}

/**
 * @param {(ref: string) => boolean} yaExiste consulta a la base de datos
 * @returns {string} referencia unica, ej. "HC80-4F9K2A"
 */
export function generarReferencia(yaExiste = () => false) {
  for (let intento = 0; intento < 20; intento++) {
    const ref = `${PREFIJO}-${sufijoAleatorio()}`
    if (!yaExiste(ref)) return ref
  }
  // 32^6 = mil millones de combinaciones para 500 boletas. Si esto pasa, algo
  // esta muy mal (por ejemplo, la consulta yaExiste siempre devuelve true).
  throw new Error('No se pudo generar una referencia unica despues de 20 intentos')
}

export const esReferenciaValida = (ref) =>
  new RegExp(`^${PREFIJO}-[${ALFABETO}]{${LARGO}}$`).test(String(ref ?? ''))
