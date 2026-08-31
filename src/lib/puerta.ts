/* ============================================================================
   CLIENTE DE LA PUERTA

   El escáner de código de barras/QR se comporta como un teclado: "escribe" el
   token y presiona Enter. Por eso no hace falta cámara ni permisos.

   MODO SIN CONEXIÓN — BACKEND.md §7 lo advierte: si el wifi del colegio falla
   esa noche, la validación en línea se cae con él y la fila se detiene. Por eso
   antes del evento se descarga la lista de tokens válidos y, si no hay red, se
   valida contra ella y los escaneos quedan en cola para subirlos después.

   Lo que NO se puede hacer sin conexión es verificar la firma HMAC, porque eso
   necesitaría el QR_SECRET en el navegador — y un secreto en un portátil de la
   entrada es un secreto perdido. Se compara contra la lista descargada, que es
   suficiente: quien no esté en ella no entra.
   ========================================================================== */

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const CLAVE_TOKEN_PUERTA = 'homecoming.puerta.token';
export const CLAVE_LISTA = 'homecoming.puerta.lista';
export const CLAVE_COLA = 'homecoming.puerta.cola';
export const CLAVE_PUERTA = 'homecoming.puerta.nombre';

export type Resultado = 'VALIDA' | 'YA_USADA' | 'INVALIDA';

export type RespuestaPuerta = {
  resultado: Resultado;
  asistente?: string;
  promocion?: string;
  referencia?: string;
  boletaId?: string;
  usadaEn?: string;
  puerta?: string;
  motivo?: string;
  /* Lo pone el cliente, no el servidor: de dónde salió esta decisión. */
  origen?: 'linea' | 'local';
};

export type BoletaOffline = {
  id: string;
  token: string;
  estado: string;
  asistente: string;
  promocion: string;
};

export type Escaneo = {
  token: string;
  puerta: string | null;
  operador: string | null;
  momento: string;
};

/* --- almacenamiento local ------------------------------------------------- */

const leer = <T>(clave: string, pordefecto: T): T => {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : pordefecto;
  } catch {
    return pordefecto;
  }
};

const escribir = (clave: string, valor: unknown) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin espacio o bloqueado */
  }
};

export const leerTokenPuerta = () => {
  try { return sessionStorage.getItem(CLAVE_TOKEN_PUERTA) ?? ''; } catch { return ''; }
};
export const guardarTokenPuerta = (t: string) => {
  try { sessionStorage.setItem(CLAVE_TOKEN_PUERTA, t); } catch { /* bloqueado */ }
};

export const leerLista = () => leer<BoletaOffline[]>(CLAVE_LISTA, []);
export const guardarLista = (l: BoletaOffline[]) => escribir(CLAVE_LISTA, l);

export const leerCola = () => leer<Escaneo[]>(CLAVE_COLA, []);
export const guardarCola = (c: Escaneo[]) => escribir(CLAVE_COLA, c);

/* Los ids marcados como usados sin conexión, para no dejar pasar dos veces
   el mismo QR mientras no hay red. */
const CLAVE_USADAS_LOCAL = 'homecoming.puerta.usadas';
export const leerUsadasLocal = () => new Set(leer<string[]>(CLAVE_USADAS_LOCAL, []));
export const marcarUsadaLocal = (id: string) => {
  const s = leerUsadasLocal();
  s.add(id);
  escribir(CLAVE_USADAS_LOCAL, Array.from(s));
};

/* --- llamadas ------------------------------------------------------------- */

async function pedirPuerta<T>(ruta: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok && res.status !== 409 && res.status !== 404) {
    throw new Error((cuerpo as { error?: { mensaje?: string } })?.error?.mensaje ?? `Error ${res.status}`);
  }
  return cuerpo as T;
}

/** Valida en línea. El servidor marca la boleta como usada en la misma operación. */
export const validarEnLinea = (token: string, qr: string, puerta: string, operador: string) =>
  pedirPuerta<RespuestaPuerta>('/api/puerta/validar', token, {
    method: 'POST',
    body: JSON.stringify({ token: qr, puerta, operador }),
  });

export const descargarLista = (token: string) =>
  pedirPuerta<{ total: number; boletas: BoletaOffline[] }>('/api/puerta/tokens', token);

export const estadoPuerta = (token: string) =>
  pedirPuerta<{ emitidas: number; ingresadas: number; faltantes: number }>(
    '/api/puerta/estado', token);

export const sincronizar = (token: string, escaneos: Escaneo[]) =>
  pedirPuerta<{ procesados: number; validas: number; yaUsadas: number; invalidas: number }>(
    '/api/puerta/sincronizar', token, { method: 'POST', body: JSON.stringify({ escaneos }) });

/* --- validación sin conexión ---------------------------------------------- */

/**
 * Decide sin red, contra la lista descargada.
 * El escaneo queda en cola para subirlo cuando vuelva la conexión.
 */
export function validarLocal(qr: string, puerta: string, operador: string): RespuestaPuerta {
  const lista = leerLista();
  const b = lista.find((x) => x.token === qr);

  if (!b) {
    return { resultado: 'INVALIDA', motivo: 'No está en la lista descargada', origen: 'local' };
  }
  if (b.estado === 'anulada') {
    return { resultado: 'INVALIDA', motivo: 'Boleta anulada', origen: 'local' };
  }

  const usadas = leerUsadasLocal();
  /* "usada" puede venir de la lista (ya había entrado antes de descargarla) o
     de un escaneo nuestro de esta misma noche. */
  if (b.estado === 'usada' || usadas.has(b.id)) {
    return {
      resultado: 'YA_USADA', asistente: b.asistente, promocion: b.promocion, origen: 'local',
    };
  }

  marcarUsadaLocal(b.id);
  guardarCola([
    ...leerCola(),
    { token: qr, puerta: puerta || null, operador: operador || null, momento: new Date().toISOString() },
  ]);

  return {
    resultado: 'VALIDA', asistente: b.asistente, promocion: b.promocion,
    boletaId: b.id, origen: 'local',
  };
}
