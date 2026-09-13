// -----------------------------------------------------------------------------
// Validaciones del formulario.
//
// Son EXACTAMENTE las mismas reglas que el front ya aplica (BACKEND.md seccion
// 2), repetidas aqui porque nunca se le cree al cliente: cualquiera puede
// mandar un POST con curl saltandose el formulario.
//
// Las funciones devuelven un objeto { "campo": "mensaje" }. Si sale vacio, los
// datos estan bien.
// -----------------------------------------------------------------------------
import { config } from '../config.js'

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ANIO_MINIMO_PROMOCION = 1948
export const NO_EGRESADO = 'no-egresado'

// Tipos de documento aprobados en el acta ("NIT/CC").
//
// SIN TARJETA DE IDENTIDAD desde el 11 de septiembre de 2026: es el documento
// de los menores, y esta fiesta es para adultos. Se rechaza aqui, ANTES de la
// base.
//
// El CHECK de las tablas comprador y asistente si sigue aceptando 'TI', y es a
// proposito: SQLite no deja cambiar un CHECK sin reconstruir la tabla entera,
// y no vale la pena por un valor que esta validacion ya no deja pasar. Si
// alguien lo ve ahi y le parece inconsistente: esta linea es la que manda.
export const TIPOS_DOCUMENTO = ['CC', 'CE', 'NIT', 'PP']
export const TIPO_DOCUMENTO_POR_DEFECTO = 'CC'

/** Deja solo digitos, igual que hace el front al escribir. */
export const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '')

const limpio = (v) => String(v ?? '').trim()

/**
 * Nombre Y apellidos: al menos dos palabras. El colegio pidio (13 de
 * septiembre de 2026) que no se pueda registrar a alguien solo con el nombre:
 * la boleta va a nombre de esa persona y en la puerta se cruza con la cedula.
 */
function validarNombre(valor) {
  const v = limpio(valor)
  if (v.length < 5) return 'Escribe el nombre completo (minimo 5 caracteres).'
  if (v.split(/\s+/).length < 2) return 'Escribe nombre y apellidos, no solo el nombre.'
  return null
}

function validarCedula(valor) {
  if (soloDigitos(valor).length < 6) return 'La cedula debe tener al menos 6 digitos.'
  return null
}

/**
 * El tipo de documento solo es obligatorio si el front ya tiene el selector
 * (EXIGIR_TIPO_DOCUMENTO). Mientras no lo tenga, lo que llegue vacio se guarda
 * como CC, que es el caso de casi todo el mundo.
 */
function validarTipoDocumento(valor, obligatorio) {
  const v = limpio(valor).toUpperCase()
  if (!v) {
    return obligatorio ? 'Selecciona el tipo de documento.' : null
  }
  if (!TIPOS_DOCUMENTO.includes(v)) {
    return `El tipo de documento debe ser uno de: ${TIPOS_DOCUMENTO.join(', ')}.`
  }
  return null
}

export const normalizarTipoDocumento = (valor) => {
  const v = limpio(valor).toUpperCase()
  return TIPOS_DOCUMENTO.includes(v) ? v : TIPO_DOCUMENTO_POR_DEFECTO
}

function validarCorreo(valor) {
  if (!RE_CORREO.test(limpio(valor))) return 'Escribe un correo valido.'
  return null
}

function validarCelular(valor) {
  if (soloDigitos(valor).length < 10) return 'El celular debe tener al menos 10 digitos.'
  return null
}

/**
 * Ano de grado entre 1948 y el ano pasado, o el literal "no-egresado".
 *
 * OBLIGATORIA PARA QUIEN COMPRA, OPCIONAL PARA LOS ACOMPANANTES. Lo pidio el
 * colegio el 11 de septiembre de 2026, y tiene sentido: quien compra sabe su
 * propio ano de grado, pero de los amigos que lleva puede no acordarse -- y
 * quedarse trancado en el formulario por ese dato es perder la venta.
 *
 * Si viene vacia en un acompanante NO se asume que es egresado: se guarda
 * vacia y es_egresado queda en 0. Ver esEgresado() aqui abajo.
 */
function validarPromocion(valor, { obligatoria = true } = {}) {
  const v = limpio(valor)
  if (!v) return obligatoria ? 'Selecciona tu promocion.' : null
  if (v === NO_EGRESADO) return null
  const anio = Number(v)
  const anioPasado = new Date().getFullYear() - 1
  if (!Number.isInteger(anio) || anio < ANIO_MINIMO_PROMOCION || anio > anioPasado) {
    return `La promocion debe estar entre ${ANIO_MINIMO_PROMOCION} y ${anioPasado}.`
  }
  return null
}

/**
 * VACIO NO ES EGRESADO. Antes esto era `!== NO_EGRESADO`, y con la promocion
 * opcional en los acompanantes una casilla en blanco los habria marcado como
 * egresados verificados sin que nadie lo dijera. Vacio significa "no sabemos".
 */
export const esEgresado = (promocion) => {
  const v = limpio(promocion)
  return v !== '' && v !== NO_EGRESADO
}

/**
 * Valida el cuerpo completo de POST /api/ordenes.
 *
 * Devuelve { errores, datos }. "datos" viene normalizado (cedulas y celulares
 * con solo digitos, correos en minuscula) y listo para guardar.
 */
export function validarOrden(cuerpo) {
  const errores = {}
  const c = cuerpo?.comprador ?? {}
  const entrada = Array.isArray(cuerpo?.asistentes) ? cuerpo.asistentes : []

  // --- tipo de boleta --------------------------------------------------------
  const tipoBoletaId = limpio(cuerpo?.tipoBoletaId) || config.boleta.id
  if (tipoBoletaId !== config.boleta.id) {
    errores.tipoBoletaId = 'Ese tipo de boleta no existe.'
  }

  // --- cantidad --------------------------------------------------------------
  const cantidad = Number(cuerpo?.cantidad)
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    errores.cantidad = 'Elige al menos una boleta.'
  } else if (cantidad > config.boleta.maxPorCompra) {
    errores.cantidad = `Maximo ${config.boleta.maxPorCompra} boletas por compra.`
  } else if (entrada.length !== cantidad) {
    errores.asistentes =
      `Faltan datos: pediste ${cantidad} boletas y enviaste ${entrada.length} asistentes.`
  }

  // --- comprador -------------------------------------------------------------
  const revisar = (campo, mensaje) => {
    if (mensaje) errores[campo] = mensaje
  }
  revisar('comprador.nombre', validarNombre(c.nombre))
  revisar('comprador.tipoDocumento',
    validarTipoDocumento(c.tipoDocumento, config.exigirTipoDocumento))
  revisar('comprador.cedula', validarCedula(c.cedula))
  revisar('comprador.correo', validarCorreo(c.correo))
  revisar('comprador.celular', validarCelular(c.celular))
  revisar('comprador.promocion', validarPromocion(c.promocion))

  // DECISION #2: la facturacion electronica DIAN exige direccion y ciudad.
  // El front ya las pide y las manda (Checkout.tsx). El interruptor del .env
  // se queda por si hay que vender sin facturar, pero en operacion normal va
  // en true: sin direccion, la DIAN rechaza la factura.
  if (config.exigirDireccionFacturacion) {
    if (limpio(c.direccion).length < 5) {
      errores['comprador.direccion'] = 'Escribe la direccion de facturacion.'
    }
    if (limpio(c.ciudad).length < 3) {
      errores['comprador.ciudad'] = 'Escribe la ciudad.'
    }
  }

  // --- asistentes ------------------------------------------------------------
  // Cuantos datos se piden por acompanante (DATOS_ASISTENTE):
  //   minimo   -> nombre (la promocion se pide, pero no se exige)
  //   acta     -> ademas tipo y numero de documento. Es lo que pidio el colegio:
  //               "nombre, Tipo de documento y numero, y si es egresado o no".
  //   completo -> ademas correo y celular (lo que pide el front hoy)
  //
  // LA PROMOCION DEL ACOMPANANTE NUNCA ES OBLIGATORIA, en ningun modo. Solo
  // la de quien compra. Decision del colegio del 11 de septiembre de 2026.
  const modo = config.datosAsistente
  const pideDocumento = modo === 'acta' || modo === 'completo'
  const pideContacto = modo === 'completo'

  entrada.forEach((a, i) => {
    revisar(`asistentes.${i}.nombre`, validarNombre(a?.nombre))
    // Opcional a proposito: ver validarPromocion(). El unico que tiene que
    // poner su ano de grado es quien compra.
    revisar(`asistentes.${i}.promocion`, validarPromocion(a?.promocion, { obligatoria: false }))
    if (pideDocumento) {
      revisar(`asistentes.${i}.tipoDocumento`,
        validarTipoDocumento(a?.tipoDocumento, config.exigirTipoDocumento))
      revisar(`asistentes.${i}.cedula`, validarCedula(a?.cedula))
    }
    if (pideContacto) {
      revisar(`asistentes.${i}.correo`, validarCorreo(a?.correo))
      revisar(`asistentes.${i}.celular`, validarCelular(a?.celular))
    }
  })

  // Dos boletas para la misma cedula en la misma orden no tiene sentido: en la
  // puerta seria imposible saber cual QR es de quien.
  const vistas = new Set()
  entrada.forEach((a, i) => {
    const ced = soloDigitos(a?.cedula)
    if (!ced) return
    if (vistas.has(ced)) errores[`asistentes.${i}.cedula`] = 'Esa cedula ya esta en esta compra.'
    vistas.add(ced)
  })

  // --- aceptaciones legales (DECISION #3) ------------------------------------
  if (cuerpo?.aceptaTratamientoDatos !== true) {
    errores.aceptaTratamientoDatos = 'Debes aceptar el tratamiento de datos personales.'
  }
  if (cuerpo?.aceptaTerminos !== true) {
    errores.aceptaTerminos = 'Debes aceptar los terminos y condiciones.'
  }

  if (Object.keys(errores).length > 0) return { errores, datos: null }

  // --- normalizacion ---------------------------------------------------------
  const datos = {
    tipoBoletaId,
    cantidad,
    comprador: {
      nombre: limpio(c.nombre),
      tipoDocumento: normalizarTipoDocumento(c.tipoDocumento),
      cedula: soloDigitos(c.cedula),
      correo: limpio(c.correo).toLowerCase(),
      celular: soloDigitos(c.celular),
      direccion: limpio(c.direccion) || null,
      ciudad: limpio(c.ciudad) || null,
      promocion: limpio(c.promocion),
    },
    asistentes: entrada.map((a) => ({
      nombre: limpio(a.nombre),
      tipoDocumento: normalizarTipoDocumento(a.tipoDocumento),
      cedula: soloDigitos(a.cedula) || null,
      correo: limpio(a.correo).toLowerCase() || null,
      celular: soloDigitos(a.celular) || null,
      promocion: limpio(a.promocion),
      esEgresado: esEgresado(a.promocion),
    })),
    aceptaTratamientoDatos: true,
    aceptaTerminos: true,
  }

  return { errores: {}, datos }
}
