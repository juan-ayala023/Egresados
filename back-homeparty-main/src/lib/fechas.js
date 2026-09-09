// Utilidades de fecha. Todo se guarda en ISO-8601 UTC ("2026-11-14T00:00:00.000Z")
// para que las comparaciones de texto en SQLite tambien sean comparaciones
// cronologicas correctas.

export const ahora = () => new Date().toISOString()

export const enMinutos = (minutos, desde = new Date()) =>
  new Date(desde.getTime() + minutos * 60_000).toISOString()

export const yaPaso = (iso) => new Date(iso).getTime() <= Date.now()

/** Formatea para mostrarle al usuario en correos: "sabado 14 de noviembre de 2026, 7:00 p. m." */
export function formatoLargo(iso, zona = 'America/Bogota') {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: zona,
  }).format(new Date(iso))
}

/** Formatea centavos como "$87.000" para correos y PDF. */
export function formatoPesos(centavos) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(centavos / 100)
}
