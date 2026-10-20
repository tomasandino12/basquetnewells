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
  // Newell's Old Boys (semilla 0004). El id de un club no es secreto: la función
  // pública formularios_publicos(club) sólo devuelve lo que la coordinación
  // dejó activo en la página.
  clubId: '20000000-0000-0000-0000-000000000001',
  calendarios: Object.freeze([
    // PENDIENTE: ID del calendario (Configuración del calendario → "ID de calendario").
    Object.freeze({ titulo: 'Partidos y torneos', id: null }),
    // PENDIENTE: ID del calendario de eventos y recaudación.
    Object.freeze({ titulo: 'Eventos y recaudación', id: null }),
  ]),
  // Logos de sponsors y colaboradores, para la franja de la sección "Sumate como
  // sponsor o colaborador". Mientras la lista esté vacía, la franja no se ve.
  // Cada uno: { nombre, logo: '/public/sponsors/archivo.png', enlace?: 'https://…' }.
  // El archivo va en public/sponsors/ (png, jpg, webp o svg). Un archivo que no
  // existe o una ruta de otro lado, no se muestra: ver sponsorsValidos().
  sponsors: Object.freeze([]),
  // PENDIENTE: link de WhatsApp (https://wa.me/549341…) o mail (mailto:…) del
  // coordinador, para el "¿Dudas?" del portal. El club no tiene mail propio.
  contacto: null,
  // Respaldo de los formularios: es lo que se muestra si la base no responde.
  // La lista de verdad la carga la coordinación desde su panel (spec v2 §3).
  // Cada uno lleva una línea de para qué es y qué tener a mano: las familias
  // no tienen por qué saber qué se necesita antes de abrirlo.
  formularios: Object.freeze([
    Object.freeze({
      titulo: 'Inscripción',
      texto: 'Para anotar al chico o a la chica en el club. Tené a mano el DNI del chico y el tuyo (para sacarles una foto de frente y otra de dorso), la credencial de la obra social y un celular con cámara. Después, la coordinación revisa todo y, si falta algo, te avisa tu profe.',
      enlace: 'https://docs.google.com/forms/d/e/1FAIpQLSfXI11Sruothw4K67u6deMbRgfK0uZO00sfE-DBgsqam3peBQ/viewform',
    }),
  ]),
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

/**
 * Un Google Form por https, sin usuario ni puerto, y sin espacios, comillas ni
 * < > que rompan el atributo. Es el MISMO texto que el check
 * `formulario_portal_enlace_google` de 0058: tests/contratoFormularioPortal
 * compara los dos, así la página no muestra lo que la base rechazaría ni al
 * revés.
 */
export const PATRON_ENLACE_FORMULARIO = '^https://(docs\\.google\\.com/forms/|forms\\.gle/)[^\\s"<>]+$';
const ENLACE_FORMULARIO = new RegExp(PATRON_ENLACE_FORMULARIO);

/** El link al formulario si es un Google Form por https; si no, null. */
export function enlaceFormulario(valor) {
  if (typeof valor !== 'string' || !ENLACE_FORMULARIO.test(valor)) return null;
  try {
    new URL(valor);
  } catch {
    return null;
  }
  return valor;
}

/**
 * El enlace de contacto si es WhatsApp (https://wa.me/…) o un mail
 * (mailto:algo@dominio); si no, null. Termina en un <a href>, así que no
 * pasa cualquier esquema.
 */
export function enlaceContacto(valor) {
  if (typeof valor !== 'string') return null;
  if (/^mailto:[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+$/.test(valor)) return valor;
  let u;
  try {
    u = new URL(valor);
  } catch {
    return null;
  }
  return u.protocol === 'https:' && u.hostname === 'wa.me' && u.pathname.length > 1 ? valor : null;
}

// Sólo imágenes propias, de la carpeta de logos: el CSP de la app no deja cargar
// imágenes de otro sitio y un nombre de archivo raro no tiene que poder salirse de ella.
const RUTA_LOGO = /^\/public\/sponsors\/[\w-]+\.(?:png|jpe?g|webp|svg)$/;

/** De la lista de sponsors, los que se pueden mostrar: con nombre, con un logo propio y, si traen enlace, que sea https. */
export function sponsorsValidos(lista) {
  return (Array.isArray(lista) ? lista : []).filter((s) => typeof s?.nombre === 'string' && s.nombre.trim() !== ''
    && RUTA_LOGO.test(s.logo ?? '')
    && (s.enlace == null || /^https:\/\/[^\s"<>]+$/.test(s.enlace)));
}
