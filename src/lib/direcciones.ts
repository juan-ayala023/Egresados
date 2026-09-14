/* ============================================================================
   DIRECCIÓN Y CIUDAD DE FACTURACIÓN — lado del navegador.

   Es el espejo de back-homeparty-main/src/lib/direcciones.js: misma lista de
   ciudades y misma regla para la dirección, para avisar al instante sin
   esperar al servidor. El servidor vuelve a validar igual; aquí no se decide
   nada. Si cambia una, cambia la otra.

   Por qué existe (14 de septiembre de 2026): la dirección aceptaba cualquier
   cosa y la ciudad también, y los dos van a la factura electrónica. Una
   factura con "asdfgh" la rechaza la DIAN semanas después, cuando ya no hay
   cómo volver a preguntarle al comprador.
   ========================================================================== */

const VIAS = [
  'calle', 'cl', 'cll', 'cle',
  'carrera', 'cra', 'cr', 'kr', 'kra', 'crr',
  'avenida', 'av', 'avda', 'ave',
  'diagonal', 'dg', 'diag',
  'transversal', 'tv', 'tr', 'trans', 'transv',
  'circular', 'cq', 'circ',
  'kilometro', 'km',
  'autopista', 'aut', 'auto',
  'via',
  'vereda', 'vda',
  'manzana', 'mz',
  'casa', 'cs',
  'finca', 'lote', 'lt',
  'sector', 'barrio', 'corregimiento',
  'carretera', 'variante', 'glorieta',
];

const PATRON_VIA = new RegExp(`(^|[\\s.])(${VIAS.join('|')})(?=[\\s.\\d#-]|$)`, 'i');

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Mensaje de error, o null si la dirección tiene forma de dirección. */
export function validarDireccion(valor: string, { exterior = false } = {}): string | null {
  const v = sinTildes(valor ?? '').trim().replace(/\s+/g, ' ');

  if (v.length < 6) return 'Escribe la dirección completa.';
  if (v.length > 120) return 'La dirección es demasiado larga.';
  if (!/\d/.test(v)) return 'Tiene que llevar número (ej: Cra 43A # 1-50).';
  if (!/[a-zA-Z]/.test(v)) return 'Tiene que llevar letras (ej: Calle 10 # 5-20).';
  if (/[^a-zA-Z0-9\s#\-.,/°ªºñÑ]/.test(v)) return 'Usa solo letras, números, # y -.';
  if (!exterior && !PATRON_VIA.test(v)) {
    return 'Empieza por la vía: Calle, Carrera, Avenida… (ej: Cra 43A # 1-50).';
  }
  return null;
}

/* Primero el área metropolitana y Antioquia, que es donde vive casi todo el
   que compra; después las capitales. */
export const CIUDADES = [
  'Medellín', 'Envigado', 'Sabaneta', 'Itagüí', 'Bello', 'La Estrella',
  'Caldas', 'Copacabana', 'Girardota', 'Barbosa',
  'Rionegro', 'El Retiro', 'La Ceja', 'Marinilla', 'Guarne', 'El Carmen de Viboral',
  'Santa Fe de Antioquia', 'San Jerónimo', 'Sopetrán',
  'Bogotá', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira',
  'Manizales', 'Armenia', 'Cúcuta', 'Santa Marta', 'Ibagué', 'Villavicencio',
  'Montería', 'Pasto', 'Neiva', 'Valledupar', 'Popayán', 'Sincelejo',
  'Tunja', 'Riohacha', 'Quibdó', 'Florencia', 'Yopal', 'Chía', 'Cajicá',
  'Jamundí', 'Palmira', 'Floridablanca', 'Dosquebradas', 'Soledad',
  'Apartadó', 'Turbo', 'Caucasia', 'Puerto Berrío',
];

/* Las dos salidas del desplegable que piden el nombre aparte. */
export const CIUDAD_OTRA = 'OTRA';
export const CIUDAD_EXTERIOR = 'EXTERIOR';

const normalizar = (s: string) => sinTildes(s).trim().toLowerCase().replace(/\s+/g, ' ');
const CONOCIDAS = new Set(CIUDADES.map(normalizar));

export const esCiudadConocida = (valor: string) => CONOCIDAS.has(normalizar(valor ?? ''));

/** Mensaje de error, o null. Para el texto libre de "Otra" / "Fuera de Colombia". */
export function validarCiudad(valor: string): string | null {
  const v = (valor ?? '').trim().replace(/\s+/g, ' ');
  if (!v) return 'Selecciona la ciudad.';
  if (esCiudadConocida(v)) return null;
  if (v.length < 3) return 'Escribe el nombre de la ciudad.';
  if (v.length > 60) return 'El nombre es demasiado largo.';
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ][a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.,'-]*$/.test(v)) {
    return 'La ciudad solo lleva letras (ej: Medellín).';
  }
  return null;
}
