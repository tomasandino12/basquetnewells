import { TIPOS_AGENDA, idCalendario, claveValida } from './agenda.js';
import { aniosDeCategoria, textoAnios } from './categorias.js';

/**
 * Lo que muestra la página pública del básquet y no sale de la base: los
 * calendarios, las categorías con sus horarios, la sede, el contacto, el alias
 * para transferir, la foto y los sponsors. Vive acá y no en el HTML para que
 * cambiar uno sea tocar una línea (guía en docs/COORDINACION.md).
 *
 * Lo que el club todavía no pasó va en null o en una lista vacía: esa parte de
 * la página no se muestra. Nunca un "Próximamente" ni un botón a ningún lado.
 *
 * Los calendarios son públicos: cualquiera con el ID ve todos los eventos. Por
 * eso nunca nombres de jugadores en los eventos.
 */
export const PORTAL = Object.freeze({
  // Newell's Old Boys (semilla 0004). El id de un club no es secreto: la función
  // pública formularios_publicos(club) sólo devuelve lo que la coordinación
  // dejó activo en la página.
  clubId: '20000000-0000-0000-0000-000000000001',

  // La temporada que se anuncia: de ella salen los años de cada categoría y el
  // "la inscripción 2027 todavía no abrió". PENDIENTE: confirmar con Tomás.
  temporada: 2027,

  // El calendario del portal lo arma la página con los eventos de Google
  // Calendar. UN calendario público, y el tipo de cada evento lo dice el color
  // que se le pone en Google (TIPO_POR_COLOR en agenda.js: Tomate = partido,
  // Banana = evento, Pavo real = charla, Albahaca = entrenamiento). Sin color,
  // toma `tipo`. `clave`: API key de Google, restringida al dominio del portal
  // y a la Calendar API (pasos en docs/COORDINACION.md). Sin clave o sin ID, la
  // sección no se ve.
  agenda: Object.freeze({
    // Pública a propósito: la usa el navegador. Restringida en Google Cloud al
    // sitio app-semillero.vercel.app y sólo a la Calendar API (proyecto
    // "Portal básquet", cuenta Comisión Básquet, 20/10/2026).
    clave: 'AIzaSyBPZ8Sq8ho4kv-5x1mfm4bs7y40l9P7IK4',
    calendarios: Object.freeze([
      // PENDIENTE: el ID del calendario público del básquet. No el principal de
      // la cuenta (comisionbasquetnob@gmail.com), que es privado y tiene lo
      // interno de la subcomisión.
      Object.freeze({ tipo: 'evento', titulo: 'Agenda del básquet', id: null }),
    ]),
  }),

  // Las categorías que ofrece el club. Los años NO van acá: salen de la
  // temporada con la misma regla que categoriza a un chico (categorias.js).
  // `grupo`: ESCUELITA, U9, U11, U13, U15, U17, U21 o MAYORES. `nombre`
  // opcional (para que MAYORES diga "Primera"). `horario` opcional: días y hora.
  // Horarios: descripción del formulario "Quiero jugar en Newell's" (temporada
  // 2026). Los femeninos no figuran en ningún formulario: van sin horario.
  categorias: Object.freeze([
    Object.freeze({ grupo: 'ESCUELITA', rama: 'Mixto', horario: 'Mar 18 a 19 h (Estadio Cubierto) · Jue 18 a 19 h (Playón Deportivo)' }),
    Object.freeze({ grupo: 'U9', rama: 'Mixto', horario: 'Mar 18 a 19 h (Estadio Cubierto) · Jue 18 a 19 h (Playón Deportivo)' }),
    Object.freeze({ grupo: 'U11', rama: 'Mixto', horario: 'Mar 19 a 20 h (Estadio Cubierto) · Jue 19 a 20 h (Playón Deportivo)' }),
    Object.freeze({ grupo: 'U13', rama: 'Mixto', horario: 'Lun y Vie 18 a 19 h (Estadio Cubierto) · Mié 18 a 19 h (Microestadio)' }),
    Object.freeze({ grupo: 'U15', rama: 'Masculino', horario: 'Lun y Vie 18 a 19 h (Estadio Cubierto) · Mié 18 a 19 h (Microestadio)' }),
    Object.freeze({ grupo: 'U17', rama: 'Masculino', horario: 'Lun y Vie 19 a 20 h (Estadio Cubierto) · Mié 19 a 20 h (Microestadio)' }),
    Object.freeze({ grupo: 'U21', rama: 'Masculino', horario: 'Lun y Vie 20 a 21 h (Estadio Cubierto) · Mié 20 a 21 h (Microestadio)' }),
    Object.freeze({ grupo: 'U15', rama: 'Femenino', horario: null }),
    Object.freeze({ grupo: 'U17', rama: 'Femenino', horario: null }),
    Object.freeze({ grupo: 'U21', rama: 'Femenino', horario: null }),
    Object.freeze({ grupo: 'MAYORES', nombre: 'Primera', rama: 'Femenino', horario: null }),
  ]),

  // Dónde se entrena. Sin calle ni número en ningún formulario: el mapa es una
  // búsqueda de Google Maps. Si el club pasa el link de "Compartir", va ese.
  sede: Object.freeze({
    nombre: 'Estadio Cubierto "Claudio Newell"',
    direccion: 'Parque de la Independencia, Rosario. Algunos días se entrena en el Microestadio o en el Playón Deportivo.',
    mapa: 'https://www.google.com/maps/search/?api=1&query=Estadio+Cubierto+Claudio+Newell+Rosario',
  }),

  // WhatsApp del coordinador (confirmado por Tomás, 20/10): el botón "Ayuda" de
  // arriba y el "¿Dudas?" de abajo. wa.me lleva el 9 de los celulares argentinos.
  contacto: 'https://wa.me/5493413709161',

  // Alias para transferir, en la tarjeta del comprobante con un botón Copiar.
  // PENDIENTE: confirmar que es el de las cuotas (hubo varios) y el titular.
  alias: Object.freeze({ alias: 'pagosbasquetnob', titular: null }),

  // Foto del club. Sólo fotos con la autorización de imagen firmada por las
  // familias de todos los chicos que se reconozcan. El archivo va en
  // public/portal/ (jpg o webp, ~1200 px de ancho).
  // PENDIENTE: { src: '/public/portal/club.jpg', alt: 'qué se ve en la foto', epigrafe?: '…' }.
  foto: null,

  // Logos de sponsors y colaboradores, para la sección "Sumate como sponsor".
  // Cada uno: { nombre, logo: '/public/sponsors/archivo.png', enlace?: 'https://…' }.
  // El archivo va en public/sponsors/ (png, jpg, webp o svg). Un archivo que no
  // existe o una ruta de otro lado, no se muestra: ver sponsorsValidos().
  sponsors: Object.freeze([]),

  // Respaldo de los formularios: lo que se muestra si la base no responde. La
  // lista de verdad la carga la coordinación desde su panel. Vacío a propósito
  // mientras la inscripción nueva no esté publicada: mejor la tarjeta cerrada
  // que mandar a un formulario viejo.
  formularios: Object.freeze([]),
});

/** Los calendarios que se pueden pedir: con un tipo conocido, un ID válido y la clave puesta. */
export function calendariosActivos(agenda) {
  if (!claveValida(agenda?.clave)) return [];
  return (agenda.calendarios ?? [])
    .filter((c) => TIPOS_AGENDA.includes(c?.tipo) && idCalendario(c.id))
    .map((c) => ({ tipo: c.tipo, titulo: String(c.titulo ?? '').trim() || c.tipo, id: idCalendario(c.id) }));
}

const NOMBRE_GRUPO = { ESCUELITA: 'Escuelita', MAYORES: 'Mayores' };
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * La lista de categorías del portal, con sus años de nacimiento para la
 * temporada. Una con un grupo que no existe se descarta: mejor una fila menos
 * que unos años inventados.
 */
export function categoriasDelPortal(lista, temporada) {
  return (Array.isArray(lista) ? lista : []).flatMap((c) => {
    const anios = aniosDeCategoria(c?.grupo, temporada);
    if (!anios) return [];
    return [{
      nombre: texto(c.nombre) || NOMBRE_GRUPO[c.grupo] || c.grupo,
      rama: texto(c.rama) || null,
      anios: textoAnios(anios),
      horario: texto(c.horario) || null,
    }];
  });
}

const MAPA = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com)\/[^\s"<>]*$/;

/** La sede si tiene nombre; el link al mapa sólo si es de Google Maps. */
export function sedeValida(sede) {
  const nombre = texto(sede?.nombre);
  if (!nombre) return null;
  return { nombre, direccion: texto(sede.direccion) || null, mapa: MAPA.test(sede.mapa ?? '') ? sede.mapa : null };
}

// Alias de CBU/CVU: de 6 a 20 letras, números, puntos o guiones.
const ALIAS = /^[A-Za-z0-9.-]{6,20}$/;

export function aliasValido(valor) {
  const alias = texto(valor?.alias);
  return ALIAS.test(alias) ? { alias, titular: texto(valor.titular) || null } : null;
}

// Sólo una foto propia de public/portal/: la CSP no deja cargar imágenes de otro sitio.
const RUTA_FOTO = /^\/public\/portal\/[\w-]+\.(?:jpe?g|webp)$/;

/** La foto si es un archivo propio y tiene texto alternativo (contar qué se ve, no quiénes son). */
export function fotoValida(foto) {
  const alt = texto(foto?.alt);
  if (!RUTA_FOTO.test(foto?.src ?? '') || !alt) return null;
  return { src: foto.src, alt, epigrafe: texto(foto.epigrafe) || null };
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
