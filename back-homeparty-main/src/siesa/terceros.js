// -----------------------------------------------------------------------------
// EL TERCERO: DAR DE ALTA AL COMPRADOR EN SIESA ANTES DE FACTURARLE.
//
// Esta era la pregunta que trabo la facturacion, y la respondio el colegio:
//
//   "Juan se debe validar si el tercero existe en Siesa y sino existe mandarlo
//    a crear"
//   "dentro del WSDL de Pangea estan los dos metodos, uno del tercero y otro
//    de la sucursal"
//
// SIESA no le factura a una cedula suelta. Necesita dos registros:
//
//   1. TERCERO  (t200_mm_terceros)  -> la persona: cedula, nombre, contacto.
//   2. CLIENTE  (t201_mm_clientes)  -> su sucursal 001, que es la que la
//                                      factura referencia en F311_ID_SUCURSAL_CLI.
//
// Un tercero sin sucursal no se puede facturar. Por eso van juntos.
//
// POR QUE ESTO IMPORTA AQUI Y NO EN LOS DEMAS EVENTOS DEL COLEGIO: teatro,
// carreras y camp le venden a familias que YA estan en ecampus, o sea que ya
// son terceros. Homecoming le vende a egresados del 2004 que se fueron hace
// veinte años. La mayoria no existe en el ERP.
//
// LO QUE ESTE ARCHIVO NO HACE:
//   - No modifica un tercero que ya existe. Se consulta primero, y si esta, se
//     usa tal cual. Sobrescribir el registro de un empleado o de un padre de
//     familia con lo que alguien escribio en el checkout de una fiesta seria
//     mucho peor que no facturar.
//   - No escribe en SQL Server. La consulta de existencia es un SELECT.
//   - No manda nada con SIESA_ENSAYO=true. Arma los documentos y los devuelve.
// -----------------------------------------------------------------------------
import soap from 'soap'
import { config } from '../config.js'
import { conectar, leerConfiguracionSiesa } from './config.js'
import { ErrorSiesaFactura, limpiarTexto, fechaSiesa, ordenarParaPangea } from './facturacion.js'

/**
 * Tipo de documento del checkout -> letra que usa SIESA en F200_ID_TIPO_IDENT.
 *
 * Las letras salen de la propia plataforma del colegio: su EMPLOYEE_ID_TYPE_MAP
 * traduce al reves ("C" -> "CC", "E" -> "CE", "T" -> "TI", "P" -> pasaporte),
 * leyendo f200_id_tipo_ident de t200_mm_terceros. Aqui se invierte ese mapa.
 */
export function tipoIdentSiesa(tipoDocumento) {
  const mapa = { CC: 'C', CE: 'E', TI: 'T', PP: 'P', NIT: 'N' }
  return mapa[String(tipoDocumento ?? '').toUpperCase()] ?? 'C'
}

// Particulas que no arrancan un apellido por si solas: "DE LA CRUZ" es un
// apellido, no dos.
const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LO', 'LOS', 'Y', 'DA', 'DI', 'VAN', 'VON', 'MC', 'SAN', 'SANTA'])

/**
 * Parte "JUAN CARLOS RODRIGUEZ TORRES" en nombres y dos apellidos.
 *
 * El checkout pide UN solo campo de nombre, asi que esto es una suposicion:
 * en Colombia los dos ultimos pedazos suelen ser los apellidos. Se equivoca
 * con nombres compuestos raros y con extranjeros de un solo apellido.
 *
 * NO ES GRAVE, y vale la pena decir por que: lo que sale impreso en la factura
 * es F200_RAZON_SOCIAL, que lleva el nombre completo sin tocar. El corte solo
 * afecta como queda ordenado el tercero en el ERP.
 */
export function partirNombre(nombreCompleto) {
  const partes = limpiarTexto(nombreCompleto, 120).toUpperCase().split(' ').filter(Boolean)

  if (partes.length === 0) return { nombres: '', apellido1: '', apellido2: '' }
  if (partes.length === 1) return { nombres: partes[0], apellido1: '', apellido2: '' }
  if (partes.length === 2) return { nombres: partes[0], apellido1: partes[1], apellido2: '' }

  // Se camina desde el final: el apellido2 se lleva las particulas que lo
  // preceden ("... DE LA CRUZ" queda entero en apellido2).
  let corte = partes.length - 1
  while (corte > 1 && PARTICULAS.has(partes[corte - 1])) corte -= 1
  const apellido2 = partes.slice(corte).join(' ')

  let corte1 = corte - 1
  while (corte1 > 1 && PARTICULAS.has(partes[corte1 - 1])) corte1 -= 1
  const apellido1 = partes.slice(corte1, corte).join(' ')

  return { nombres: partes.slice(0, corte1).join(' '), apellido1, apellido2 }
}

/** Solo digitos, y de un largo creible. Lo que no pase por aqui no se consulta. */
export function cedulaValida(cedula) {
  return /^\d{5,15}$/.test(String(cedula ?? '').trim())
}

// -----------------------------------------------------------------------------
// CONSULTA DE EXISTENCIA
// -----------------------------------------------------------------------------

/**
 * ¿Existe ya esta cedula como tercero en SIESA?
 *
 * Va por el servidor enlazado CSERPDB, igual que _search_employees() en el
 * person_repository.py del colegio. OPENQUERY no acepta parametros -- la
 * consulta viaja como texto al otro servidor -- asi que la cedula se valida
 * con cedulaValida() ANTES, y si no es puro numero ni se arma el SQL.
 *
 * LA UNION CON CLIENTES ES POR ROWID. SIESA no enlaza t201_mm_clientes con
 * el tercero por la cedula sino por su rowid interno (f201_rowid_tercero =
 * f200_rowid), igual que el colegio une contactos por f200_rowid_contacto.
 * Se supuso f201_id_tercero y no existe: se descubrio el 13 de septiembre de
 * 2026 corriendo la consulta contra la base real, la vispera de la primera
 * factura. Los nombres se verificaron con SELECT TOP 1 * sobre la tabla.
 *
 * @returns {Promise<{existe:boolean, tercero:string|null, sucursales:string[], activas:string[]}>}
 *   `sucursales` son todas; `activas` solo las que tienen f201_ind_estado_activo = 1.
 */
export async function consultarTercero(cedula) {
  const nit = String(cedula ?? '').trim()
  if (!cedulaValida(nit)) {
    throw new ErrorSiesaFactura(`Cedula no consultable en SIESA: "${nit}"`, { tipo: 'sin_tercero' })
  }

  const enlazado = config.siesa.servidorErp
  const cia = config.siesa.compania || '1'
  const conexion = await conectar()

  const consulta = `
    SELECT * FROM OPENQUERY(${enlazado},
    'SELECT t.f200_id, t.f200_nit, c.f201_id_sucursal, c.f201_ind_estado_activo
       FROM t200_mm_terceros t
            LEFT JOIN t201_mm_clientes c
              ON c.f201_id_cia = t.f200_id_cia
             AND c.f201_rowid_tercero = t.f200_rowid
      WHERE t.f200_id_cia = ${Number(cia)}
        AND t.f200_nit = ''${nit}''
    ')`

  const resultado = await conexion.request().query(consulta)
  const filas = resultado.recordset ?? []

  if (filas.length === 0) return { existe: false, tercero: null, sucursales: [] }

  const sucursales = filas
    .map((f) => String(f.f201_id_sucursal ?? '').trim())
    .filter(Boolean)
  // Una sucursal inactiva no se puede facturar ("La sucursal 001 del cliente
  // no esta activa", 15 de septiembre de 2026). Se distingue aqui para que
  // elegirSucursal no la escoja.
  const activas = filas
    .filter((f) => String(f.f201_ind_estado_activo ?? '').trim() === '1')
    .map((f) => String(f.f201_id_sucursal ?? '').trim())
    .filter(Boolean)
  return { existe: true, tercero: String(filas[0].f200_id ?? nit).trim(), sucursales, activas }
}

// -----------------------------------------------------------------------------
// ARMADO DE LOS DOCUMENTOS
// -----------------------------------------------------------------------------

/**
 * Arma el cuerpo del TERCERO (la persona) sin enviarlo.
 * Campos y valores tomados del EjemploTerceros.txt que mando el colegio.
 */
function fechaNacimientoSiesa(comprador) {
  const propia = String(comprador?.fecha_nacimiento ?? '').replace(/\D/g, '')
  if (/^\d{8}$/.test(propia)) return propia
  const defecto = config.siesa.fechaNacimientoDefecto
  if (/^\d{8}$/.test(defecto)) return defecto
  // Sin dato: la fecha del dia. Es lo que hace el propio SIESA cuando se crea
  // un tercero a mano ("el campo siempre queda por defecto con la fecha del
  // sistema"), y contabilidad autorizo crearlos asi el 15 de septiembre de
  // 2026 para las 27 compras de esa manana que no la traian.
  return fechaSiesa()
}

export function armarTercero(comprador) {
  const nit = String(comprador?.cedula ?? '').trim()
  if (!cedulaValida(nit)) {
    throw new ErrorSiesaFactura('El comprador no tiene una cedula valida para SIESA', { tipo: 'sin_tercero' })
  }

  const { nombres, apellido1, apellido2 } = partirNombre(comprador.nombre)
  const completo = limpiarTexto(comprador.nombre, 250).toUpperCase()

  return {
    // --- Contacto (bloque F015) ---
    F015_CELULAR: limpiarTexto(comprador.celular, 20),
    F015_COD_POSTAL: '',
    F015_CONTACTO: completo,
    F015_DIRECCION1: limpiarTexto(comprador.direccion ?? '', 100).toUpperCase(),
    F015_DIRECCION2: '',
    F015_DIRECCION3: '',
    F015_EMAIL: String(comprador.correo ?? '').trim().toUpperCase().slice(0, 100),
    F015_FAX: '',
    F015_ID_BARRIO: '',
    F015_ID_CIUDAD: config.siesa.ciudad,
    F015_ID_DEPTO: config.siesa.departamento,
    F015_ID_PAIS: config.siesa.pais,
    F015_TELEFONO: limpiarTexto(comprador.celular, 20),

    // --- Persona (bloque F200) ---
    F200_ID: nit,          // el id del tercero ES la cedula
    F200_NIT: nit,
    F200_DV_NIT: '',       // digito de verificacion: solo aplica a NIT de empresa
    F200_ID_TIPO_IDENT: tipoIdentSiesa(comprador.tipo_documento),
    F200_NOMBRES: nombres,
    F200_APELLIDO1: apellido1,
    F200_APELLIDO2: apellido2,
    F200_NOMBRE_EST: completo,
    F200_RAZON_SOCIAL: completo,  // lo que se imprime en la factura
    // SIESA la exige (15 de septiembre de 2026). Viene del checkout como
    // AAAA-MM-DD; para compras anteriores, la de SIESA_FECHA_NACIMIENTO_DEFECTO
    // si contabilidad la autorizo. Sin ninguna, se para antes de enviar.
    F200_FECHA_NACIMIENTO: fechaNacimientoSiesa(comprador),
    F200_ID_CIIU: '',

    // Es cliente, persona natural, activo. Nada mas: no es empleado, ni
    // proveedor, ni accionista. Estos ceros importan -- un tercero marcado
    // como empleado aparece en nominas.
    F200_IND_CLIENTE: '1',
    F200_IND_TIPO_TERCERO: '1',
    F200_IND_ESTADO: '1',
    F200_IND_ACCIONISTA: '0',
    F200_IND_EMPLEADO: '0',
    F200_IND_INTERNO: '0',
    F200_IND_NO_DOMICILIADO: '0',
    F200_IND_OTROS: '0',
    F200_IND_PROVEEDOR: '0',

    F_ACTUALIZA_REG: '1',
    F_CIA: config.siesa.compania,
  }
}

/**
 * Arma el CLIENTE, que en SIESA es la sucursal del tercero (la 001).
 * Es lo que la factura referencia en F311_ID_SUCURSAL_CLI; sin esto la
 * factura no cuadra contra nadie.
 *
 * Campos del EjemploCliente.txt. Los que van vacios ahi van vacios aqui: son
 * cosas de cartera corporativa (cupo, EDI, lista de precios) que no aplican a
 * alguien que compra una boleta y paga de una.
 */
export function armarCliente(comprador, cfg) {
  const nit = String(comprador?.cedula ?? '').trim()
  if (!cedulaValida(nit)) {
    throw new ErrorSiesaFactura('El comprador no tiene una cedula valida para SIESA', { tipo: 'sin_tercero' })
  }

  const completo = limpiarTexto(comprador.nombre, 250).toUpperCase()
  const s = config.siesa

  return {
    // --- Contacto (mismo bloque F015 del tercero) ---
    F015_COD_POSTAL: '',
    F015_CONTACTO: completo,
    F015_DIRECCION1: limpiarTexto(comprador.direccion ?? '', 100).toUpperCase(),
    F015_DIRECCION2: '',
    F015_DIRECCION3: '',
    F015_EMAIL: String(comprador.correo ?? '').trim().toUpperCase().slice(0, 100),
    F015_FAX: '',
    F015_ID_BARRIO: '',
    F015_ID_CIUDAD: s.ciudad,
    F015_ID_DEPTO: s.departamento,
    F015_ID_PAIS: s.pais,
    F015_TELEFONO: limpiarTexto(comprador.celular, 20),
    f015_celular: limpiarTexto(comprador.celular, 20),

    // --- Sucursal (bloque F201) ---
    F201_ID_TERCERO: nit,
    F201_ID_SUCURSAL: s.sucursal,
    F201_DESCRIPCION_SUCURSAL: completo,
    F201_FECHA_INGRESO: fechaSiesa(),
    F201_ID_MONEDA: 'COP',

    // Estos tres deciden como se contabiliza la venta: van los mismos de la
    // fila 465 con la que se emite la factura. Si el cliente se creara con
    // otro tipo o con otra condicion de pago, la factura le quedaria colgando
    // en una cartera que nadie revisa.
    //
    // El ejemplo que mando el colegio traia CAES y eso abrio la duda. La
    // resolvieron ellos mismos el 10 de septiembre de 2026: "se debe crear
    // con el que tiene configurado el servicio de Homecoming, CEXT". O sea el
    // de la fila 465, que es justo lo que hace esta linea.
    F201_ID_TIPO_CLI: s.tipoCliente || cfg.id_tipo_cli,
    F201_ID_COND_PAGO: s.condicionPago || cfg.id_cond_pago,
    F201_ID_VENDEDOR: s.vendedor || cfg.siesa_seller_id,

    // Sin credito: la boleta se paga por Wompi antes de existir.
    F201_CUPO_CREDITO: '0',
    F201_DIAS_GRACIA: '0',
    F201_IND_CALIFICACION: 'A',
    F201_IND_BLOQUEADO: '0',
    F201_IND_BLOQUEO_CUPO: '0',
    F201_IND_BLOQUEO_MORA: '0',
    // 1 = ACTIVA. El ejemplo del proveedor traia 0 y con 0 la sucursal queda
    // inactiva: "La sucursal 000 del cliente no esta activa" al facturar
    // (15 de septiembre de 2026, primer tercero creado de verdad).
    F201_IND_ESTADO_ACTIVO: '1',
    F201_IND_FACTURA_UNIFICADA: '0',
    F201_IND_PEDIDO_BACKORDER: '0',
    F201_PORC_EXCESO_VENTA: '0',
    F201_PORC_MAX_MARGEN: '0',
    F201_PORC_MIN_MARGEN: '0',
    F201_NOTAS: limpiarTexto(`Comprador ${config.evento.nombre}`, 250).toUpperCase(),

    // Vacios a proposito (ver comentario de arriba).
    F201_CODIGO_EAN: '',
    F201_ID_CLIENTE_CORP: '',
    F201_ID_CO_FACTURA: '',
    F201_ID_CO_MOVTO_FACTURA: '',
    F201_ID_GRUPO_DSCTO: '',
    F201_ID_LISTA_PRECIO: '',
    F201_ID_PARAMETRO_EDI: '',
    F201_ID_SUCURSAL_CORP: '',
    F201_ID_UN_MOVTO_FACTURA: '',

    F_ACTUALIZA_REG: '1',
    F_CIA: s.compania,
  }
}

/**
 * Arma el CRITERIO con el que el colegio clasifica a sus clientes.
 *
 * Opcional: solo sale si SIESA_PLAN_CRITERIOS tiene valor, y HOY VA APAGADO.
 * Los ejemplos traen dos planes ("ANE" y "TIC") y ninguno es obviamente el de
 * un egresado comprando boleta. Lo decidio el colegio el 10 de septiembre de
 * 2026: "el tema del criterio dejemoslo vacio por el momento".
 *
 * Queda escrito y probado igual: el dia que digan cual va, es una linea del
 * .env, no codigo nuevo.
 */
export function armarCriterio(comprador) {
  const s = config.siesa
  if (!s.planCriterios) return null

  return {
    F207_ID_PLAN_CRITERIOS: s.planCriterios,
    F207_ID_CRITERIO_MAYOR: s.criterioMayor || 'N/A',
    F207_ID_SUCURSAL: s.sucursal,
    F207_ID_TERCERO: String(comprador?.cedula ?? '').trim(),
    F_ACTUALIZA_REG: '1',
    F_CIA: s.compania,
  }
}

// -----------------------------------------------------------------------------
// ENVIO
// -----------------------------------------------------------------------------

let cliente = null

async function obtenerCliente() {
  if (cliente) return cliente
  const { wsdl } = config.siesa
  if (!wsdl) {
    throw new ErrorSiesaFactura('Falta SIESA_WSDL_URL en el .env', { tipo: 'sin_configurar' })
  }
  try {
    // WSDL por HTTP plano contra IP interna: sin `request: https.request`.
    cliente = await soap.createClientAsync(wsdl, {
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
 * SIESA responde con un ArrayOfstring. Cuando algo sale mal, el mensaje viene
 * ahi adentro: no hay excepcion SOAP, hay un string que dice el error. Si no
 * se lee, un rechazo pasa por exito y la factura de despues falla sin motivo
 * aparente.
 */
/**
 * EL NAMESPACE DE LOS CAMPOS, PUESTO A MANO.
 *
 * Los campos del Tercero, del Cliente y del Criterio van en el espacio de
 * nombres del contrato de datos (CRM.SERVICIOS), no en el de la operacion
 * (tempuri). En la factura y el recibo node-soap lo resuelve solo, pero en
 * estas tres operaciones el elemento del parametro se llama IGUAL que la
 * operacion (Tercero > Tercero, Clientes > Clientes) y node-soap se pierde:
 * deja los campos en tempuri. WCF ignora lo que viene en otro namespace, le
 * llegan todos los campos nulos y contesta "Value cannot be null. Parameter
 * name: String" sin decir cual.
 *
 * Se descubrio el 15 de septiembre de 2026 con las primeras cinco compras de
 * gente que no existia en el ERP. Aqui cada campo lleva su xmlns explicito.
 */
export const ESPACIO_CRM = 'http://schemas.datacontract.org/2004/07/CRM.SERVICIOS'

export function paraPangea(documento) {
  const ordenado = ordenarParaPangea(documento)
  const conEspacio = {}
  for (const [campo, valor] of Object.entries(ordenado)) {
    conEspacio[campo] = { attributes: { xmlns: ESPACIO_CRM }, $value: valor }
  }
  return conEspacio
}

export function respuestaFallo(respuesta) {
  const cuerpo = respuesta?.[0] ?? respuesta ?? null

  // Cuando Pangea acepta, el Result viene en null (verificado con la factura
  // y el recibo el 14 de septiembre de 2026). Si trae CUALQUIER texto, es un
  // motivo de rechazo. Antes se buscaban palabras ("error", "invalid"...) y
  // el 15 de septiembre se colaron rechazos del Tercero que decian otra cosa
  // (por ejemplo "El dato es obligatorio"): se dieron por creados cinco
  // compradores que no existian, y las cinco facturas fallaron.
  if (cuerpo && typeof cuerpo === 'object') {
    for (const valor of Object.values(cuerpo)) {
      if (valor === null || valor === undefined) continue
      const textos = Array.isArray(valor?.string) ? valor.string : Array.isArray(valor) ? valor : [valor]
      const conTexto = textos.map((s) => String(s ?? '').trim()).filter(Boolean)
      if (conTexto.length > 0) return conTexto.join(' | ')
    }
  }

  const texto = JSON.stringify(cuerpo ?? '')
  if (/error|fall|no se|invalid|existe ya|rechaz|excepcion|exception|obligatori/i.test(texto)) return texto
  return null
}

/**
 * Se asegura de que el comprador exista como tercero y como cliente en SIESA.
 *
 * Orden: consultar -> si no esta, crear tercero -> crear sucursal -> criterio.
 * Si ya esta, no se toca NADA suyo.
 *
 * En ensayo devuelve los documentos armados y no llama al ERP.
 *
 * @returns {Promise<{ensayo:boolean, existia:boolean, tercero:string,
 *                    documentoTercero:object|null, documentoCliente:object|null}>}
 */
/**
 * A QUE SUCURSAL DEL TERCERO SE LE FACTURA.
 *
 * En el ERP del colegio las sucursales de una persona no son "sedes": son
 * las cuentas por las que se le cobra. La 000 es la persona misma (la tienen
 * los empleados) y la 001, 002... son sus hijos matriculados. Se supo con la
 * primera factura real (14 de septiembre de 2026): la compradora era
 * empleada y mama del colegio, y la factura de SU boleta quedo en la 001,
 * que era la cuenta de su hijo.
 *
 * Regla que pidio contabilidad ese dia: si tiene la 000 se usa esa; si no,
 * la menor que tenga; si no tiene ninguna, se le crea la de SIESA_ID_SUCURSAL
 * (000 desde el 15 de septiembre de 2026, tambien a pedido de contabilidad:
 * la persona misma). Nunca se crea una sucursal a quien ya tiene alguna.
 *
 * SOLO CUENTAN LAS ACTIVAS (15 de septiembre de 2026): una inactiva no se
 * puede facturar. Si no tiene ninguna activa, se manda la de SIESA_ID_SUCURSAL
 * por Clientes con F_ACTUALIZA_REG=1, que la crea si no existe o la activa si
 * existe (fue lo que paso con las que este mismo sistema creo inactivas ese
 * dia, antes de corregir F201_IND_ESTADO_ACTIVO).
 *
 * @param {string[]} activas las sucursales ACTIVAS que ya tiene
 * @returns {{sucursal: string, crear: boolean}}
 */
export function elegirSucursal(activas) {
  const limpias = (activas ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)
  if (limpias.includes('000')) return { sucursal: '000', crear: false }
  if (limpias.length > 0) {
    const menor = [...limpias].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))[0]
    return { sucursal: menor, crear: false }
  }
  return { sucursal: config.siesa.sucursal, crear: true }
}

export async function asegurarTercero(comprador, { configuracion } = {}) {
  // Con tercero generico no hay nada que crear: todas las facturas salen
  // contra un tercero que el colegio ya tiene dado de alta.
  const generico = String(config.siesa.terceroGenerico ?? '').trim()
  if (generico) {
    return { ensayo: config.siesa.ensayo, existia: true, tercero: generico, sucursal: config.siesa.sucursal, documentoTercero: null, documentoCliente: null }
  }

  const cfg = configuracion ?? (await leerConfiguracionSiesa())
  const nit = String(comprador?.cedula ?? '').trim()
  const documentoTercero = armarTercero(comprador)
  const documentoCliente = armarCliente(comprador, cfg)

  if (config.siesa.ensayo) {
    return { ensayo: true, existia: false, tercero: nit, sucursal: config.siesa.sucursal, documentoTercero, documentoCliente }
  }

  // 1. ¿Ya esta? Si SQL Server no responde, se prefiere NO crear a crear a
  //    ciegas: crear un tercero que ya existe con F_ACTUALIZA_REG=1 le
  //    sobrescribiria los datos a alguien.
  const encontrado = await consultarTercero(nit)
  if (encontrado.existe) {
    const { sucursal, crear } = elegirSucursal(encontrado.activas)
    if (!crear) {
      return { ensayo: false, existia: true, tercero: encontrado.tercero, sucursal, documentoTercero: null, documentoCliente: null }
    }
    // Tercero sin ninguna sucursal ACTIVA: existe la persona pero no el
    // cliente (o el cliente esta inactivo). Se manda solo la sucursal, que
    // Pangea crea o actualiza (F_ACTUALIZA_REG=1); el tercero no se toca.
    const cli = await obtenerCliente()
    const r = await cli.ClientesAsync({ Clientes: paraPangea(documentoCliente) })
    console.log(`[siesa] respuesta de Clientes para ${nit}: ${JSON.stringify(r?.[0] ?? r ?? '').slice(0, 600)}`)
    const fallo = respuestaFallo(r)
    // Pangea contesta "Cliente Creado Correctamente" como texto, igual que un
    // rechazo. La tabla manda: lo que importa es que la sucursal quede ACTIVA.
    const despues = await consultarTercero(nit)
    if (!despues.activas.includes(sucursal)) {
      throw new ErrorSiesaFactura(
        `La sucursal ${sucursal} del tercero ${nit} no quedo activa en el ERP (activas: ${despues.activas.join(',') || 'ninguna'}). Pangea: ${String(fallo ?? 'sin texto').slice(0, 300)}`,
        { tipo: 'rechazo' },
      )
    }
    return { ensayo: false, existia: true, tercero: encontrado.tercero, sucursal, documentoTercero: null, documentoCliente }
  }

  // 2. No esta: se crea la persona y despues su sucursal.
  const cli = await obtenerCliente()

  const rTercero = await cli.TerceroAsync({ Tercero: paraPangea(documentoTercero) })
  console.log(`[siesa] respuesta de Tercero para ${nit}: ${JSON.stringify(rTercero?.[0] ?? rTercero ?? '').slice(0, 600)}`)
  const falloTercero = respuestaFallo(rTercero)
  if (falloTercero) {
    // La tabla manda: si a pesar del texto el tercero quedo, se sigue.
    const despues = await consultarTercero(nit)
    if (!despues.existe) {
      // El XML tal cual salio: es la unica forma de ver que campo llego nulo
      // cuando Pangea contesta "Value cannot be null" sin decir cual.
      console.error(`[siesa] XML enviado a Tercero para ${nit}: ${String(cli.lastRequest ?? '').replace(/\s+/g, ' ').slice(0, 4000)}`)
      throw new ErrorSiesaFactura(`SIESA rechazo el tercero: ${falloTercero.slice(0, 400)}`, { tipo: 'rechazo' })
    }
    console.warn(`[siesa] Tercero ${nit} respondio con texto pero quedo creado: ${falloTercero.slice(0, 200)}`)
  }

  const rCliente = await cli.ClientesAsync({ Clientes: paraPangea(documentoCliente) })
  console.log(`[siesa] respuesta de Clientes para ${nit}: ${JSON.stringify(rCliente?.[0] ?? rCliente ?? '').slice(0, 600)}`)
  const falloCliente = respuestaFallo(rCliente)
  if (falloCliente) {
    const despues = await consultarTercero(nit)
    if (!despues.activas.includes(config.siesa.sucursal)) {
      // El tercero YA quedo creado. Se avisa distinto a proposito: reintentar
      // todo lo volveria a mandar, y lo que falta es solo la sucursal.
      throw new ErrorSiesaFactura(
        `El tercero ${nit} SI se creo, pero su sucursal fallo: ${falloCliente.slice(0, 400)}`,
        { tipo: 'rechazo', detalle: { tercero: nit } },
      )
    }
    console.warn(`[siesa] Clientes ${nit} respondio con texto pero la sucursal quedo: ${falloCliente.slice(0, 200)}`)
  }

  // 3. Criterio, si contabilidad definio uno. Que esto falle no invalida la
  //    venta: el tercero ya es facturable. Se avisa y se sigue.
  const criterio = armarCriterio(comprador)
  if (criterio) {
    try {
      await cli.Criterios_ClientesAsync({ CriClientes: paraPangea(criterio) })
    } catch (e) {
      console.warn(`[siesa] criterio del tercero ${nit} no se pudo aplicar: ${e.message}`)
    }
  }

  // 4. COMPROBAR EN LA TABLA que quedo. Pangea puede contestar sin error y no
  //    haber creado nada (15 de septiembre de 2026). La factura contra un
  //    tercero que no existe se rechaza igual, pero con un mensaje que no
  //    dice por que; mejor pararse aqui con las respuestas a la vista.
  const comprobado = await consultarTercero(nit)
  if (!comprobado.existe || !comprobado.activas.includes(config.siesa.sucursal)) {
    throw new ErrorSiesaFactura(
      `Pangea no rechazo el tercero ${nit} pero no quedo facturable en el ERP (existe: ${comprobado.existe}, sucursales activas: ${comprobado.activas.join(',') || 'ninguna'}). Tercero: ${JSON.stringify(rTercero?.[0] ?? rTercero).slice(0, 300)} Clientes: ${JSON.stringify(rCliente?.[0] ?? rCliente).slice(0, 300)}`,
      { tipo: 'rechazo' },
    )
  }

  return { ensayo: false, existia: false, tercero: nit, sucursal: config.siesa.sucursal, documentoTercero, documentoCliente }
}
