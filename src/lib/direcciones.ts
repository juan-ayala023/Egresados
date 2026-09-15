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

/* Departamento + municipio, de la lista oficial del DANE (divipola.ts). El
   checkout muestra dos desplegables y manda la ciudad como
   "Municipio, Departamento" (o solo "Bogotá D.C."). Quien vive fuera de
   Colombia escribe "Ciudad, País" a mano. */
import { DEPARTAMENTOS } from './divipola';

export { DEPARTAMENTOS };

/* Lo que elige quien vive fuera de Colombia en el desplegable de departamento. */
export const DEPARTAMENTO_EXTERIOR = 'EXTERIOR';

const clave = (s: string) => sinTildes(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const PARES = new Set<string>();
for (const d of DEPARTAMENTOS) {
  for (const m of d.municipios) {
    PARES.add(`${clave(m.nombre)}, ${clave(d.nombre)}`);
    if (clave(m.nombre) === clave(d.nombre)) PARES.add(clave(m.nombre));
  }
}

/** Como se manda la ciudad: "Medellín, Antioquia", o "Bogotá D.C." si coinciden. */
export const nombreCiudad = (municipio: string, departamento: string) =>
  clave(municipio) === clave(departamento) ? municipio : `${municipio}, ${departamento}`;

export const esCiudadConocida = (valor: string) => PARES.has(clave(valor));

/** Mensaje de error, o null. Para el texto libre de "Fuera de Colombia". */
export function validarCiudad(valor: string): string | null {
  const v = (valor ?? '').trim().replace(/\s+/g, ' ');
  if (!v) return 'Selecciona el departamento y el municipio.';
  if (esCiudadConocida(v)) return null;
  if (v.length < 3) return 'Escribe el nombre de la ciudad.';
  if (v.length > 80) return 'El nombre es demasiado largo.';
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ][a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.,'-]*$/.test(v)) {
    return 'La ciudad solo lleva letras (ej: Medellín).';
  }
  return null;
}

/* Misma regla que el servidor (validarFechaNacimiento en validaciones.js):
   AAAA-MM-DD, real, y de un adulto. SIESA exige la fecha para crear el
   tercero (15 de septiembre de 2026). */
export function validarFechaNacimiento(valor: string): string | null {
  const s = (valor ?? '').trim();
  if (!s) return 'Escribe tu fecha de nacimiento.';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return 'La fecha debe ser AAAA-MM-DD.';
  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const valida =
    fecha.getUTCFullYear() === Number(m[1]) &&
    fecha.getUTCMonth() === Number(m[2]) - 1 &&
    fecha.getUTCDate() === Number(m[3]);
  if (!valida) return 'Esa fecha no existe.';
  const hoy = new Date();
  const antesDelCumple =
    hoy.getUTCMonth() < fecha.getUTCMonth() ||
    (hoy.getUTCMonth() === fecha.getUTCMonth() && hoy.getUTCDate() < fecha.getUTCDate());
  const edad = hoy.getUTCFullYear() - fecha.getUTCFullYear() - (antesDelCumple ? 1 : 0);
  if (edad < 18) return 'Debes ser mayor de edad.';
  if (edad > 110) return 'Revisa el año de nacimiento.';
  return null;
}
