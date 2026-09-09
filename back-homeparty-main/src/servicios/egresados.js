// -----------------------------------------------------------------------------
// Verificacion de egresados.
//
// La tabla de requerimientos del colegio dice, textual:
//
//   "Para poder avanzar con la compra DEBE ser egresado. A traves de la
//    plataforma se hara doble check si es egresado a traves de la cedula o
//    ano de graduacion, mercadeo compartira la base de datos actualizada."
//
// La restriccion es sobre el COMPRADOR. Los acompanantes pueden no serlo: la
// misma tabla pide que de ellos se guarde "si es egresado o no".
//
// MIENTRAS LA BASE NO LLEGUE la tabla `egresado` esta vacia. Por eso el modo
// por defecto es "advertir": se consulta, se deja el resultado guardado en la
// orden, y la compra pasa igual. Poner VALIDAR_EGRESADO=exigir con la tabla
// vacia rechaza el 100% de las compras.
// -----------------------------------------------------------------------------
import { db } from '../db/index.js'
import { config } from '../config.js'
import { ahora } from '../lib/fechas.js'

const q = {
  porCedula: db.prepare(`SELECT cedula, nombre, promocion FROM egresado WHERE cedula = ?`),
  // El "doble check" del acta: cedula, y si no, cedula + ano de grado.
  porCedulaYPromocion: db.prepare(
    `SELECT cedula, nombre, promocion FROM egresado WHERE cedula = ? AND promocion = ?`),
  total: db.prepare(`SELECT COUNT(*) AS n FROM egresado`),
  insertar: db.prepare(`
    INSERT INTO egresado (cedula, nombre, promocion, cargado_en)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(cedula) DO UPDATE SET
      nombre = excluded.nombre,
      promocion = excluded.promocion,
      cargado_en = excluded.cargado_en`),
  vaciar: db.prepare(`DELETE FROM egresado`),
}

/** Cuantos egresados hay cargados. 0 = mercadeo todavia no entrego la base. */
export const totalEgresados = () => q.total.get().n

/** True si la base esta cargada y se puede confiar en el resultado. */
export const baseCargada = () => totalEgresados() > 0

/**
 * Revisa una cedula contra la base.
 *
 * @returns {{verificado: boolean, motivo: string, egresado: object|null}}
 *   verificado: true solo si la cedula aparece de verdad en la base.
 *   motivo: por que dio ese resultado, para poder explicarlo en el panel.
 */
export function verificar(cedula, promocion = null) {
  if (!baseCargada()) {
    return { verificado: false, motivo: 'BASE_SIN_CARGAR', egresado: null }
  }

  const porCedula = q.porCedula.get(cedula)
  if (!porCedula) {
    return { verificado: false, motivo: 'NO_APARECE', egresado: null }
  }

  // Doble check: si el usuario dijo un ano de grado y no coincide con el de la
  // base, se acepta igual (la cedula manda) pero queda anotado, porque suele
  // ser un dato mal digitado y no un intento de colarse.
  if (promocion && promocion !== 'no-egresado' && porCedula.promocion &&
      String(porCedula.promocion) !== String(promocion)) {
    return { verificado: true, motivo: 'PROMOCION_NO_COINCIDE', egresado: porCedula }
  }

  return { verificado: true, motivo: 'OK', egresado: porCedula }
}

/**
 * Decide si una compra puede seguir. Es lo que llama crearOrden().
 *
 * @returns {{permitir: boolean, verificado: boolean, motivo: string}}
 */
export function revisarComprador(cedula, promocion = null) {
  const modo = config.validarEgresado

  if (modo === 'apagado') {
    return { permitir: true, verificado: false, motivo: 'VALIDACION_APAGADA' }
  }

  const r = verificar(cedula, promocion)

  // En "exigir" con la base sin cargar se rechazaria a todo el mundo. Eso es
  // peor que no validar: se deja pasar y se grita en consola, porque es un
  // error de despliegue y no del comprador.
  if (modo === 'exigir' && r.motivo === 'BASE_SIN_CARGAR') {
    console.error(
      '[egresados] VALIDAR_EGRESADO=exigir pero la tabla egresado esta vacia. ' +
      'Se deja pasar la compra. Carga la base con: npm run importar-egresados -- archivo.csv',
    )
    return { permitir: true, verificado: false, motivo: 'BASE_SIN_CARGAR' }
  }

  if (modo === 'exigir' && !r.verificado) {
    return { permitir: false, verificado: false, motivo: r.motivo }
  }

  return { permitir: true, verificado: r.verificado, motivo: r.motivo }
}

/**
 * Carga la base. Reemplaza lo que hubiera: mercadeo entrega el archivo
 * completo cada vez, no diferencias.
 *
 * @param {Array<{cedula: string, nombre?: string, promocion?: string}>} filas
 * @returns {{cargados: number, descartados: number}}
 */
export function cargarBase(filas) {
  const t = ahora()
  let cargados = 0
  let descartados = 0

  const tx = db.transaction(() => {
    q.vaciar.run()
    for (const f of filas) {
      const cedula = String(f.cedula ?? '').replace(/\D/g, '')
      if (cedula.length < 6) {
        descartados++
        continue
      }
      q.insertar.run(cedula, f.nombre ?? null, f.promocion ? String(f.promocion) : null, t)
      cargados++
    }
  })
  tx.immediate()

  return { cargados, descartados }
}
