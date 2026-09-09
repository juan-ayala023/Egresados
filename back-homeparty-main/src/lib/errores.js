// -----------------------------------------------------------------------------
// Un solo tipo de error para todo el backend. Cada error sabe su HTTP status y
// su codigo de negocio, que son exactamente los que el front tiene que saber
// pintar (BACKEND.md seccion 5).
// -----------------------------------------------------------------------------

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje, extra = {}) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
    this.extra = extra
  }

  aJson() {
    return { error: { codigo: this.codigo, mensaje: this.message, ...this.extra } }
  }
}

// Atajos para los casos del contrato. Los mensajes estan redactados para
// mostrarse tal cual al usuario final.
export const errores = {
  validacion: (campos) =>
    new ErrorApi(422, 'VALIDACION', 'Revisa los datos del formulario.', { campos }),

  // Si el comite decide no revelar cupos (decision #5), se llama con null y el
  // numero no viaja al front.
  cupoInsuficiente: (disponibles) =>
    new ErrorApi(
      409,
      'CUPO_INSUFICIENTE',
      'Quedan menos boletas de las que pediste.',
      disponibles === null ? {} : { disponibles },
    ),

  limiteCedula: (max, yaCompradas) =>
    new ErrorApi(
      409,
      'LIMITE_CEDULA',
      `Esa cedula ya compro su maximo de ${max} boletas.`,
      { max, yaCompradas },
    ),

  // El acta del colegio: para comprar hay que ser egresado. Solo se lanza con
  // VALIDAR_EGRESADO=exigir y la base de mercadeo ya cargada.
  noEsEgresado: (motivo) =>
    new ErrorApi(
      409,
      'NO_ES_EGRESADO',
      'Esta cedula no aparece en la base de egresados del colegio. ' +
      'Si crees que es un error, escribenos por WhatsApp.',
      { motivo },
    ),

  ventaCerrada: (motivo) =>
    new ErrorApi(423, 'VENTA_CERRADA', motivo || 'La venta esta cerrada.'),

  noEncontrado: (que = 'El recurso') =>
    new ErrorApi(404, 'NO_ENCONTRADO', `${que} no existe.`),

  noAutorizado: () =>
    new ErrorApi(401, 'NO_AUTORIZADO', 'Falta el token de acceso o no es valido.'),

  demasiadasPeticiones: (segundos) =>
    new ErrorApi(
      429,
      'DEMASIADAS_PETICIONES',
      `Espera ${segundos} segundos antes de volver a intentar.`,
      { reintentarEn: segundos },
    ),

  conflicto: (codigo, mensaje, extra = {}) => new ErrorApi(409, codigo, mensaje, extra),
}
