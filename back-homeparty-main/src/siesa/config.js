// -----------------------------------------------------------------------------
// CONFIGURACION CONTABLE DE SIESA.
//
// SIESA es el ERP del colegio. Para emitir la factura de una boleta necesita
// saber contra que centro de operacion, que caja, que vendedor y que tipo de
// cliente se registra la venta. Nada de eso vive en el .env: vive en una tabla
// de SQL Server que administra el colegio, y Homecoming tiene ahi su propia
// fila (school_services.id = 465, creada por ellos).
//
// La plataforma de eventos del colegio lee exactamente estos 14 campos, ni uno
// mas: ver get_service_siesa_config() en su siesa_adapter.py. Se leen los
// mismos a proposito, para que las dos facturen igual.
//
// OJO CON EL ALCANCE:
//   - Este archivo SOLO LEE. Ningun INSERT, UPDATE ni DELETE.
//   - Leer esta tabla no factura nada todavia. Es el primer paso del bloque
//     contable; falta el SOAP a SIESA y el tercero del comprador.
//   - La venta de boletas NO pasa por aqui. Si SQL Server esta caido o sin
//     configurar, se sigue vendiendo, cobrando y emitiendo QR igual.
//
// La base es 10.90.11.15, una IP privada del colegio: esto solo conecta desde
// dentro de su red o por VPN.
// -----------------------------------------------------------------------------
import sql from 'mssql'
import { config } from '../config.js'

// Los 14 campos que SIESA necesita. Si el colegio agrega uno nuevo, va aqui.
const CAMPOS = [
  'id_co',
  'siesa_service_id',
  'siesa_cc',
  'siesa_id_motivo',
  'id_tipo_cli',
  'id_cond_pago',
  'id_auxiliar_docto_cruce',
  'id_co_docto_cruce',
  'id_un_docto_cruce',
  'id_caja',
  'id_fe',
  'id_un',
  'siesa_seller_id',
  'siesa_seller_tercero_id',
]

export class ErrorSiesa extends Error {
  constructor(mensaje, { tipo }) {
    super(mensaje)
    this.tipo = tipo // 'sin_configurar' | 'conexion' | 'sin_fila' | 'incompleta'
  }
}

let pool = null

/**
 * Abre (o reusa) la conexion a SQL Server.
 *
 * Se reusa un solo pool porque abrir una conexion a SQL Server es caro y en
 * temporada de venta esto se llamaria una vez por factura.
 */
export async function conectar() {
  if (pool?.connected) return pool

  const { host, puerto, baseDatos, usuario, clave } = config.siesa
  if (!host || !usuario || !clave) {
    throw new ErrorSiesa(
      'Falta configurar MSSQL_HOST, MSSQL_USER o MSSQL_PASSWORD en el .env',
      { tipo: 'sin_configurar' },
    )
  }

  try {
    pool = await new sql.ConnectionPool({
      server: host,
      port: puerto,
      database: baseDatos,
      user: usuario,
      password: clave,
      options: {
        // El servidor es interno y no expone un certificado publico valido.
        encrypt: false,
        trustServerCertificate: true,
      },
      pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
      connectionTimeout: 15_000,
      requestTimeout: 15_000,
    }).connect()
  } catch (e) {
    pool = null
    throw new ErrorSiesa(`No se pudo conectar a SQL Server: ${e.message}`, { tipo: 'conexion' })
  }

  return pool
}

/**
 * Lee la configuracion contable de Homecoming.
 *
 * @param {number} servicioId  fila de school_services. Por defecto la del .env.
 * @returns {Promise<object>}  los 14 campos, tal como estan en la tabla.
 */
export async function leerConfiguracionSiesa(servicioId = config.siesa.servicioId) {
  if (!servicioId) {
    throw new ErrorSiesa(
      'Falta SIESA_SERVICE_ID en el .env (el colegio le asigno el 465 a Homecoming)',
      { tipo: 'sin_configurar' },
    )
  }

  const conexion = await conectar()

  // Parametrizado, no interpolado: el id nunca entra crudo en el SQL.
  const resultado = await conexion
    .request()
    .input('id', sql.Int, servicioId)
    .query(`SELECT ${CAMPOS.join(', ')} FROM ecampus.dbo.school_services WHERE id = @id`)

  const fila = resultado.recordset[0]
  if (!fila) {
    throw new ErrorSiesa(
      `El servicio ${servicioId} no existe en ecampus.dbo.school_services`,
      { tipo: 'sin_fila' },
    )
  }

  return fila
}

/**
 * Que campos vienen vacios.
 *
 * Se separa de la lectura porque no todos los campos pesan igual y quien llame
 * decide que hacer. Un id_caja en null revienta la factura; un campo de cruce
 * en null puede ser normal segun como el colegio haya montado el servicio.
 * Sirve para avisar ANTES de la primera venta, no en mitad de ella.
 */
export function camposVacios(configuracion) {
  return CAMPOS.filter((campo) => {
    const valor = configuracion[campo]
    return valor === null || valor === undefined || String(valor).trim() === ''
  })
}

/** Cierra la conexion. Solo la usan los scripts; el servidor deja el pool vivo. */
export async function cerrarConexion() {
  if (pool) {
    await pool.close()
    pool = null
  }
}
