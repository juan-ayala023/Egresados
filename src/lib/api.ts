/* ============================================================================
   CLIENTE DE LA API
   Único punto por donde el sitio habla con el backend. Los componentes no
   arman URLs ni leen `process.env`: piden funciones de aquí.

   El backend trabaja SIEMPRE en centavos (80.000 COP = 8000000). La
   conversión vive aquí, en el borde, para que ni un componente ni un
   formateador reciban centavos por error y muestren un precio 100 veces
   más grande.
   ========================================================================== */

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const aPesos = (centavos: number) => Math.round(centavos / 100);

export type EstadoVenta = 'abierta' | 'agotada' | 'cerrada';

export type EventoApi = {
  nombre: string;
  fecha: string;
  lugar: string;
  direccion: string;
  aforo: number;
  cierreVenta: string;
  estadoVenta: EstadoVenta;
};

export type BoletaApi = {
  id: string;
  nombre: string;
  precioCentavos: number;
  tarifaServicioCentavos: number;
  totalCentavos: number;
  maxPorCompra: number;
  /* El backend expone un booleano y no el conteo de cupos, como se pidió en
     la reunión: no revelar cuántos quedan. */
  disponible: boolean;
};

/* Tipos de documento que aprobó el acta ("NIT/CC"). El backend los valida
   contra la misma lista; si cambia una, cambia la otra. */
export const TIPOS_DOCUMENTO = ['CC', 'CE', 'NIT', 'PP', 'TI'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const ETIQUETA_DOCUMENTO: Record<TipoDocumento, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  NIT: 'NIT',
  PP: 'Pasaporte',
  TI: 'Tarjeta de identidad',
};

export type Comprador = {
  nombre: string;
  tipoDocumento: TipoDocumento;
  cedula: string;
  correo: string;
  celular: string;
  direccion: string;
  ciudad: string;
  promocion: string;
};

export type AsistenteApi = {
  nombre: string;
  tipoDocumento: TipoDocumento;
  cedula: string;
  correo: string;
  celular: string;
  promocion: string;
};

export type NuevaOrden = {
  tipoBoletaId: string;
  cantidad: number;
  comprador: Comprador;
  asistentes: AsistenteApi[];
  aceptaTratamientoDatos: boolean;
  aceptaTerminos: boolean;
};

export type DatosWompi = {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signatureIntegrity: string;
  redirectUrl: string;
};

export type OrdenCreada = {
  referencia: string;
  totalCentavos: number;
  expiraEn: string;
  wompi: DatosWompi;
};

export type EstadoOrdenValor =
  | 'pendiente'
  | 'pagada'
  | 'rechazada'
  | 'expirada'
  | 'anulada';

export type BoletaEmitida = {
  id: string;
  asistente: string;
  qrUrl: string;
  pdfUrl: string;
};

export type EstadoOrden = {
  referencia: string;
  estado: EstadoOrdenValor;
  cantidad: number;
  totalCentavos: number;
  creadaEn: string;
  expiraEn: string;
  pagadaEn: string | null;
  correoEnviadoA: string | null;
  boletas: BoletaEmitida[];
};

/* El backend responde los errores con una envoltura fija:
     { error: { codigo, mensaje, campos?, ...extra } }
   `campos` viene con claves en notación de punto —"comprador.direccion",
   "asistentes.0.cedula"— que el checkout usa para marcar el input exacto. */
export class ErrorApi extends Error {
  codigo: string;
  campos: Record<string, string>;
  extra: Record<string, unknown>;
  status: number;

  constructor(
    status: number,
    codigo: string,
    mensaje: string,
    campos: Record<string, string> = {},
    extra: Record<string, unknown> = {}
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
    this.extra = extra;
  }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  if (!BASE) {
    throw new ErrorApi(
      0,
      'SIN_CONFIGURAR',
      'Falta NEXT_PUBLIC_API_URL. Copia .env.example a .env.local.'
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    /* fetch solo rechaza por red o CORS. El usuario no puede hacer nada con
       "Failed to fetch", así que se traduce a algo accionable. */
    throw new ErrorApi(
      0,
      'SIN_CONEXION',
      'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.'
    );
  }

  const cuerpo = await res.json().catch(() => null);

  if (!res.ok) {
    const e = (cuerpo as { error?: Record<string, unknown> })?.error ?? {};
    const { codigo, mensaje, campos, ...extra } = e;
    throw new ErrorApi(
      res.status,
      typeof codigo === 'string' ? codigo : 'ERROR',
      typeof mensaje === 'string' ? mensaje : 'Algo salió mal. Intenta de nuevo.',
      (campos as Record<string, string>) ?? {},
      extra
    );
  }

  return cuerpo as T;
}

export const obtenerEvento = () => pedir<EventoApi>('/api/evento');

export const obtenerBoletas = () =>
  pedir<{ estadoVenta: EstadoVenta; boletas: BoletaApi[] }>('/api/boletas');

export const crearOrden = (orden: NuevaOrden) =>
  pedir<OrdenCreada>('/api/ordenes', { method: 'POST', body: JSON.stringify(orden) });

export const consultarOrden = (referencia: string) =>
  pedir<EstadoOrden>(`/api/ordenes/${encodeURIComponent(referencia)}`);

/* Al volver del checkout, Wompi pone el id de la transacción en la URL. Se lo
   mandamos al backend para que le PREGUNTE a Wompi cómo quedó el pago, en vez
   de esperar a que llegue el webhook.

   Dos razones para no saltarse esto:
   1. Resuelve el pago en el segundo en que el usuario vuelve, sin esperar.
   2. El backend guarda ese id, y sin él su barrido de reconciliación no tiene
      a quién preguntarle después. Si el webhook se pierde y nunca mandamos el
      id, esa orden se queda colgada y alguien pagó sin recibir sus boletas.

   No es un atajo para "marcar como pagada": el backend verifica contra Wompi
   que la transacción sea de esta orden y que el monto cuadre. */
export const verificarPago = (referencia: string, idTransaccion: string) =>
  pedir<EstadoOrden>(
    `/api/ordenes/${encodeURIComponent(referencia)}/verificar`,
    { method: 'POST', body: JSON.stringify({ idTransaccion }) }
  );

export const reenviarCorreo = (referencia: string) =>
  pedir<{ enviadoA: string }>(
    `/api/ordenes/${encodeURIComponent(referencia)}/reenviar`,
    { method: 'POST' }
  );

/* Checkout web de Wompi. Se arma con lo que firmó el backend: el monto y la
   firma de integridad NO se calculan aquí, porque el secreto no puede salir
   del servidor. El front solo redirige. */
export function urlCheckoutWompi(w: DatosWompi) {
  const q = new URLSearchParams({
    'public-key': w.publicKey,
    currency: w.currency,
    'amount-in-cents': String(w.amountInCents),
    reference: w.reference,
    'signature:integrity': w.signatureIntegrity,
    'redirect-url': w.redirectUrl,
  });
  return `https://checkout.wompi.co/p/?${q.toString()}`;
}
