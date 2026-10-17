/**
 * Enlaces externos de la página pública del básquet: los dos calendarios y el
 * formulario de inscripción. Viven todos acá y no en el HTML para que cambiar
 * uno sea tocar una línea (guía en docs/COORDINACION.md).
 *
 * Lo que todavía no pasó el club va en null: la tarjeta muestra
 * "Próximamente" en vez de un iframe vacío o un botón que no lleva a ningún lado.
 *
 * Los calendarios son públicos para que el embed funcione: cualquiera con el
 * link ve todos los eventos. Por eso nunca nombres de jugadores en los eventos.
 */
export const PORTAL = Object.freeze({
  calendarios: Object.freeze([
    // PENDIENTE: ID del calendario (Configuración del calendario → "ID de calendario").
    Object.freeze({ titulo: 'Partidos y torneos', id: null }),
    // PENDIENTE: ID del calendario de eventos y recaudación.
    Object.freeze({ titulo: 'Eventos y recaudación', id: null }),
  ]),
  // PENDIENTE: link del formulario de Google (el corto forms.gle/... o el largo).
  inscripcion: null,
});

/** Hosts que la página pública mete en un iframe. La CSP (frame-src) tiene que permitirlos. */
export const HOSTS_EMBEBIDOS = Object.freeze(['calendar.google.com']);

const EMBED = 'https://calendar.google.com/calendar/embed';
// Un ID de Google Calendar tiene forma de mail. Estricto porque termina en un
// <iframe src>: con comillas o espacios, mejor "Próximamente" que un embed roto.
const ID_CALENDARIO = /^[A-Za-z0-9._%+-]{1,200}@[A-Za-z0-9.-]{1,200}$/;

/**
 * URL del embed en vista agenda (en un celular, el mes no entra). Acepta el ID
 * o la URL de embed entera, porque es lo que Google ofrece para copiar; de esa
 * URL sólo se rescata el ID y el resto se arma acá, así el huso queda siempre
 * en el de Rosario.
 */
export function urlEmbedCalendario(valor) {
  if (typeof valor !== 'string') return null;
  let id = valor.trim();
  if (id.startsWith('https://')) {
    let u;
    try {
      u = new URL(id);
    } catch {
      return null;
    }
    if (`${u.origin}${u.pathname}` !== EMBED) return null;
    id = u.searchParams.get('src') ?? '';
  }
  if (!ID_CALENDARIO.test(id)) return null;
  const q = new URLSearchParams({
    src: id,
    ctz: 'America/Argentina/Buenos_Aires',
    mode: 'AGENDA',
    showTitle: '0',
    showPrint: '0',
    showTabs: '0',
    showCalendars: '0',
  });
  return `${EMBED}?${q}`;
}

/** El link al formulario si es un Google Form por https; si no, null. */
export function enlaceInscripcion(valor) {
  if (typeof valor !== 'string') return null;
  let u;
  try {
    u = new URL(valor);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const esForm = u.hostname === 'forms.gle'
    || (u.hostname === 'docs.google.com' && u.pathname.startsWith('/forms/'));
  return esForm ? valor : null;
}
