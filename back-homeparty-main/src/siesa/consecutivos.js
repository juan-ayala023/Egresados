// -----------------------------------------------------------------------------
// EL NUMERO DE LA FACTURA SE BUSCA EN LA TABLA, NO VIENE EN LA RESPUESTA.
//
// Se descubrio el 14 de septiembre de 2026 con la PRIMERA factura real:
// Pangea acepto la llamada y no devolvio el consecutivo. El script se detuvo
// antes del recibo, que era lo correcto, pero la factura quedo en el ERP sin
// que supieramos su numero.
//
// La plataforma de eventos del colegio hace lo mismo que se hace aqui: despues
// de enviar, consulta t350_co_docto_contable por tipo de documento, tercero,
// valor y un trozo de la nota (su obtener_consecutivo_generado() en
// siesa_adapter.py). Nuestra nota lleva el id de la transaccion de Wompi, que
// es unico por compra, asi que la busqueda es exacta.
//
// Y sirve para lo mas importante: preguntar ANTES de enviar si la factura ya
// existe, para no emitirla dos veces.
// -----------------------------------------------------------------------------
import { conectar } from './config.js'
import { config } from '../config.js'

const soloSeguro = (s) => String(s ?? '').replace(/[^\w\s.-]/g, '')

/**
 * Busca en SIESA el consecutivo de un documento ya emitido.
 *
 * @param {'FES'|'RCV'} tipoDocto
 * @param {string} tercero        la cedula (F200_ID)
 * @param {number} totalPesos     F350_TOTAL_DB, en pesos
 * @param {string} notaLike       un trozo de F350_NOTAS; aqui el id de Wompi
 * @returns {Promise<string|null>} "001-FES-00001234", o null si no esta
 */
export async function buscarConsecutivo(tipoDocto, tercero, totalPesos, notaLike) {
  const enlazado = config.siesa.servidorErp
  const cia = Number(config.siesa.compania || 1)
  const conexion = await conectar()

  // OPENQUERY viaja como texto: todo lo que entra se limpia primero.
  const t = soloSeguro(tercero)
  const n = soloSeguro(notaLike)
  const tipo = tipoDocto === 'RCV' ? 'RCV' : 'FES'
  const total = Math.round(Number(totalPesos))

  const consulta = `
    SELECT * FROM OPENQUERY(${enlazado}, '
      SELECT TOP 1
        DC.F350_ID_CO         AS ID_CO,
        DC.F350_ID_TIPO_DOCTO AS ID_TIPO_DOCTO,
        DC.F350_CONSEC_DOCTO  AS CONSEC_DOCTO,
        DC.F350_FECHA         AS FECHA,
        DC.F350_TOTAL_DB      AS TOTAL
      FROM t350_co_docto_contable DC
      INNER JOIN t200_mm_terceros T ON T.F200_ROWID = DC.F350_ROWID_TERCERO
      WHERE DC.F350_ID_TIPO_DOCTO = ''${tipo}''
        AND DC.F350_TOTAL_DB = ${total}
        AND T.F200_ID = ''${t}''
        AND T.F200_ID_CIA = ${cia}
        AND DC.F350_NOTAS LIKE ''%${n}%''
      ORDER BY DC.F350_CONSEC_DOCTO DESC
    ')`

  const r = await conexion.request().query(consulta)
  const fila = r.recordset?.[0]
  if (!fila) return null

  const consecutivo = String(fila.CONSEC_DOCTO).padStart(8, '0')
  return `${String(fila.ID_CO).trim()}-${String(fila.ID_TIPO_DOCTO).trim()}-${consecutivo}`
}
