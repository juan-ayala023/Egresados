/* ============================================================================
   CLIENTE DE LA API DE ADMINISTRACIÓN

   Todo lo de aquí exige `Authorization: Bearer <ADMIN_TOKEN>`.

   SOBRE EL TOKEN: es un secreto estático y compartido. Quien lo tenga puede
   ver todos los datos personales, anular órdenes y reemitir boletas. Se guarda
   en sessionStorage (se borra al cerrar la pestaña) y nunca en localStorage ni
   en la URL. Aun así: no se comparte por WhatsApp, y si alguien deja el comité,
   se cambia en el .env del servidor.
   ========================================================================== */

import { ErrorApi, type BoletaEmitida } from './api';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const CLAVE_TOKEN = 'homecoming.admin.token';

export function guardarToken(token: string) {
  try {
    sessionStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    /* almacenamiento bloqueado: el token vive solo en memoria */
  }
}

export function leerToken(): string {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN) ?? '';
  } catch {
    return '';
  }
}

export function olvidarToken() {
  try {
    sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* nada que hacer */
  }
}

async function pedirAdmin<T>(ruta: string, token: string, init?: RequestInit): Promise<T> {
  if (!BASE) {
    throw new ErrorApi(0, 'SIN_CONFIGURAR', 'Falta NEXT_PUBLIC_API_URL.');
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No pudimos conectarnos al servidor.');
  }

  const cuerpo = await res.json().catch(() => null);

  if (!res.ok) {
    const e = (cuerpo as { error?: Record<string, unknown> })?.error ?? {};
    const { codigo, mensaje } = e;
    throw new ErrorApi(
      res.status,
      typeof codigo === 'string' ? codigo : 'ERROR',
      typeof mensaje === 'string' ? mensaje : 'Algo salió mal.'
    );
  }

  return cuerpo as T;
}

/* --- formas que devuelve el backend -------------------------------------- */

export type Aforo = {
  aforo: number;
  vendidas: number;
  reservadas: number;
  disponibles: number;
  sobreventa: number;
  evento?: string;
};

export type Alerta = {
  tipo: string;
  nivel: 'critico' | 'aviso';
  referencia?: string;
  detalle: string;
  accion?: string;
  comprador?: { nombre?: string; correo?: string; celular?: string };
  intentos?: number;
  ultimoError?: string | null;
  idTransaccion?: string;
  franquicia?: string;
  cantidad?: number;
};

export type Alertas = {
  generadoEn: string;
  total: number;
  criticas: number;
  aforo: Aforo;
  alertas: Alerta[];
};

export type OrdenBuscada = {
  id: number;
  referencia: string;
  estado: string;
  cantidad: number;
  total_centavos: number;
  creada_en: string;
  pagada_en: string | null;
  correo_enviado_a: string | null;
  nombre: string;
  cedula: string;
  correo: string;
  celular: string;
};

/* La ficha de admin trae más por boleta que la vista pública: el estado
   (emitida / usada / anulada) sí le importa al comité. */
export type BoletaAdmin = BoletaEmitida & {
  estado: 'emitida' | 'usada' | 'anulada';
  promocion: string;
  esEgresado: boolean;
};

export type FichaOrden = {
  orden: Record<string, unknown> & {
    referencia: string;
    estado: string;
    total_centavos: number;
    franquicia: string | null;
    metodo_pago: string | null;
    correo_enviado_en: string | null;
    correo_intentos: number;
    correo_ultimo_error: string | null;
  };
  comprador: Record<string, string | number | null>;
  asistentes: Array<Record<string, string | number | null>>;
  boletas: BoletaAdmin[];
};

/* --- llamadas ------------------------------------------------------------- */

export const obtenerAlertas = (token: string) =>
  pedirAdmin<Alertas>('/api/admin/alertas', token);

export const obtenerAforo = (token: string) =>
  pedirAdmin<Aforo & { estadoVenta: string }>('/api/admin/aforo', token);

export const buscarOrdenes = (token: string, texto: string) =>
  pedirAdmin<{ total: number; ordenes: OrdenBuscada[] }>(
    `/api/admin/ordenes?buscar=${encodeURIComponent(texto)}`,
    token
  );

export const obtenerFicha = (token: string, referencia: string) =>
  pedirAdmin<FichaOrden>(`/api/admin/ordenes/${encodeURIComponent(referencia)}`, token);

export const reenviarBoletas = (token: string, referencia: string) =>
  pedirAdmin<{ enviado: boolean; via?: string; detalle?: string }>(
    `/api/admin/ordenes/${encodeURIComponent(referencia)}/reenviar`,
    token,
    { method: 'POST' }
  );

export const anularOrden = (token: string, referencia: string, motivo: string) =>
  pedirAdmin<{ anulada: boolean; cuposLiberados: number }>(
    `/api/admin/ordenes/${encodeURIComponent(referencia)}/anular`,
    token,
    { method: 'POST', body: JSON.stringify({ motivo }) }
  );

/* El CSV no pasa por fetch: se descarga con el token en la URL no serviría
   (el backend lo espera en el header), así que se trae como blob y se guarda. */
export async function descargarCsv(token: string, estado = 'pagada') {
  const res = await fetch(`${BASE}/api/admin/ordenes.csv?estado=${estado}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ErrorApi(res.status, 'ERROR', 'No se pudo descargar el reporte.');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ordenes-${estado}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
