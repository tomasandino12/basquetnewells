import { TIPOS_AGENDA, idCalendario, claveValida } from './agenda.js';
import { aniosDeCategoria, textoAnios } from './categorias.js';

/**
 * Las fotos del club que usa el portal (public/img/fotos/): el nombre del
 * archivo SIN extensión (de cada uno hay un `-640.webp` para el celular), qué se
 * ve (texto alternativo: lo que pasa en la foto, nunca quiénes son) y hacia
 * dónde mirar cuando la tarjeta la recorta (`posicion`, de object-position).
 * Provisorias: del Instagram del básquet, hasta tener las del fotógrafo. Cada
 * archivo se usa UNA vez en la página (la del hero, formativas-bandeja, va
 * escrita en el HTML): una foto repetida con otro recorte se nota.
 */
export const FOTOS = Object.freeze({
  // La del hero: va escrita en portal.html; acá está sólo como la foto general de "Lo que viene".
  heroe: Object.freeze({ archivo: 'formativas-bandeja', posicion: '50% 30%', alt: 'Un jugador de Newell\'s sube a hacer una bandeja en un partido de las formativas' }),
  mini: Object.freeze({ archivo: 'formativas-mini', posicion: '50% 70%', alt: 'Chicos de mini de Newell\'s y de otro club posan juntos en la cancha después de un partido' }),
  dribbling: Object.freeze({ archivo: 'formativas-dribbling', posicion: '48% 40%', alt: 'Un jugador de Newell\'s conduce la pelota en un partido' }),
  grupo: Object.freeze({ archivo: 'escuelita-grupo', posicion: '45% 70%', alt: 'Chicas, chicos y grandes posan juntos en la cancha del Estadio Cubierto' }),
  entrenamiento: Object.freeze({ archivo: 'formativas-entrenamiento', posicion: '30% 40%', alt: 'Un jugador de Newell\'s avanza con la pelota en un partido' }),
  ataque: Object.freeze({ archivo: 'juego-ataque', posicion: '62% 40%', alt: 'Un jugador de Newell\'s protege la pelota con las dos manos frente a un rival' }),
  penetracion: Object.freeze({ archivo: 'primera-penetracion', posicion: '35% 40%', alt: 'Un jugador de Newell\'s entra a canasta marcado por un rival' }),
  lanzamiento: Object.freeze({ archivo: 'primera-lanzamiento', posicion: '40% 30%', alt: 'Un jugador sube a lanzar al aro marcado por un rival' }),
  femenino: Object.freeze({ archivo: 'femenino-equipo', posicion: '50% 45%', alt: 'Un equipo femenino de Newell\'s posa en la cancha con su entrenador' }),
  sede: Object.freeze({ archivo: 'estadio-cubierto', posicion: '50% 30%', alt: 'El Estadio Cubierto Claudio Newell por dentro, con sus tribunas rojas' }),
  // El afiche que el club subió a Instagram para buscar sponsors: el texto va en el alt.
  sponsor: Object.freeze({ archivo: 'sponsor-camisetas', posicion: '50% 50%', alt: 'Afiche del club: Newell\'s Básquet 2026, nuevas camisetas. Sumá tu empresa como sponsor: 341 370-9161' }),
});

/**
 * La foto de "Lo que viene" según el tipo de evento: los eventos del calendario
 * no traen foto propia. Reusa fotos de FOTOS (excepción a "una vez por página":
 * se ve sólo si hay un evento de ese tipo, y en la tarjeta grande, no en la fila
 * de categorías). Un tipo sin foto usa la general del hero.
 */
const FOTO_POR_TIPO = Object.freeze({
  partido: FOTOS.ataque,
  evento: FOTOS.grupo,
  charla: FOTOS.mini,
  entrenamiento: FOTOS.entrenamiento,
});

/** La foto válida de un tipo de evento (ver FOTO_POR_TIPO); si el tipo no tiene, la del hero. */
export function fotoDeEvento(tipo) {
  return fotoDeCategoriaValida(FOTO_POR_TIPO[tipo]) ?? fotoDeCategoriaValida(FOTOS.heroe);
}

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
      // "Básquet NOB · Agenda (PÚBLICO)", creado el 20/10 aparte del principal
      // de la cuenta (comisionbasquetnob@gmail.com), que es privado y tiene lo
      // interno de la subcomisión.
      Object.freeze({ tipo: 'evento', titulo: 'Agenda del básquet', id: '84aad29a932a6c72cce8f11e5fb488b747d200bb45b842df1dc4260aa7f8e42b@group.calendar.google.com' }),
    ]),
  }),

  // Las categorías que ofrece el club. Los años NO van acá: salen de la
  // temporada con la misma regla que categoriza a un chico (categorias.js).
  // `grupo`: ESCUELITA, U9, U11, U13, U15, U17, U21 o MAYORES. `nombre`
  // opcional (para que MAYORES diga "Primera"). `horario` opcional: días y hora.
  // Horarios: descripción del formulario "Quiero jugar en Newell's" (temporada
  // 2026). Newell's no tiene Escuelita ni femeninos de inferiores: la única
  // femenina es Primera. Las dos Primeras no figuran en ningún formulario y van
  // sin horario hasta que el club lo pase.
  categorias: Object.freeze([
    Object.freeze({ grupo: 'U9', rama: 'Mixto', horario: 'Mar 18 a 19 h (Estadio Cubierto) · Jue 18 a 19 h (Playón Deportivo)', foto: FOTOS.mini }),
    Object.freeze({ grupo: 'U11', rama: 'Mixto', horario: 'Mar 19 a 20 h (Estadio Cubierto) · Jue 19 a 20 h (Playón Deportivo)', foto: FOTOS.dribbling }),
    Object.freeze({ grupo: 'U13', rama: 'Mixto', horario: 'Lun y Vie 18 a 19 h (Estadio Cubierto) · Mié 18 a 19 h (Microestadio)', foto: FOTOS.grupo }),
    Object.freeze({ grupo: 'U15', rama: 'Masculino', horario: 'Lun y Vie 18 a 19 h (Estadio Cubierto) · Mié 18 a 19 h (Microestadio)', foto: FOTOS.entrenamiento }),
    Object.freeze({ grupo: 'U17', rama: 'Masculino', horario: 'Lun y Vie 19 a 20 h (Estadio Cubierto) · Mié 19 a 20 h (Microestadio)', foto: FOTOS.ataque }),
    Object.freeze({ grupo: 'U21', rama: 'Masculino', horario: 'Lun y Vie 20 a 21 h (Estadio Cubierto) · Mié 20 a 21 h (Microestadio)', foto: FOTOS.penetracion }),
    Object.freeze({ grupo: 'MAYORES', nombre: 'Primera', rama: 'Masculino', horario: null, foto: FOTOS.lanzamiento }),
    Object.freeze({ grupo: 'MAYORES', nombre: 'Primera', rama: 'Femenino', horario: null, foto: FOTOS.femenino }),
  ]),

  // Dónde se entrena. Sin calle ni número en ningún formulario: el mapa es una
  // búsqueda de Google Maps. Si el club pasa el link de "Compartir", va ese.
  sede: Object.freeze({
    nombre: 'Estadio Cubierto "Claudio Newell"',
    direccion: 'Parque de la Independencia, Rosario',
    // Los tres lugares que aparecen en los horarios de las categorías.
    lugares: Object.freeze(['Estadio Cubierto "Claudio Newell"', 'Microestadio', 'Playón Deportivo']),
    mapa: 'https://www.google.com/maps/search/?api=1&query=Estadio+Cubierto+Claudio+Newell+Rosario',
    // Lo que busca el mapa embebido (sólo se carga si la persona lo toca).
    // PENDIENTE: que Tomás confirme que el punto cae en el estadio.
    buscar: 'Estadio Cubierto Claudio Newell, Rosario',
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

const ARCHIVO_FOTO = /^(?!.*-640$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POSICION_FOTO = /^\d{1,3}% \d{1,3}%$/;

/**
 * La foto de una categoría: sólo un archivo de public/img/fotos/ (la CSP no
 * deja otras imágenes y un nombre raro no tiene que poder salirse de ahí), con
 * texto alternativo. Devuelve las dos rutas (celular y normal), o null.
 */
export function fotoDeCategoriaValida(foto) {
  const archivo = texto(foto?.archivo);
  const alt = texto(foto?.alt);
  if (!ARCHIVO_FOTO.test(archivo) || !alt) return null;
  return {
    src: `/public/img/fotos/${archivo}.webp`,
    src640: `/public/img/fotos/${archivo}-640.webp`,
    alt,
    posicion: POSICION_FOTO.test(texto(foto.posicion)) ? foto.posicion.trim() : '50% 50%',
  };
}

/**
 * Las tarjetas del carrusel de categorías: las mismas categorías de
 * categoriasDelPortal, cada una con su foto (o null si no tiene o no es válida:
 * la tarjeta sale igual, sin foto). Con sus topes de años (`desde`/`hasta`,
 * null si no tiene) para marcar la del año elegido, y `anio`: el año al que
 * salta el buscador al tocarla (el más viejo; la Primera, el más nuevo).
 */
export function tarjetasDeCategorias(lista, temporada) {
  return (Array.isArray(lista) ? lista : []).flatMap((c) => {
    const [categoria] = categoriasDelPortal([c], temporada);
    if (!categoria) return [];
    const { viejo, nuevo } = aniosDeCategoria(c.grupo, temporada);
    return [{ ...categoria, foto: fotoDeCategoriaValida(c.foto), desde: viejo, hasta: nuevo, anio: viejo ?? nuevo }];
  });
}

/** Si quien nació en `anio` entra en la tarjeta (de tarjetasDeCategorias). */
export function tarjetaDelAnio(tarjeta, anio) {
  return Number.isInteger(anio) && (tarjeta.desde == null || anio >= tarjeta.desde) && (tarjeta.hasta == null || anio <= tarjeta.hasta);
}

/**
 * El horario de una categoría partido en turnos: "Lun y Vie 18 a 19 h
 * (Estadio Cubierto) · Mié 18 a 19 h (Microestadio)" → [{ cuando, lugar }].
 * Un turno sin lugar entre paréntesis queda con lugar null. Sin horario, [].
 */
export function turnosDeHorario(horario) {
  return texto(horario).split(' · ').map((t) => t.trim()).filter(Boolean).map((t) => {
    const m = t.match(/^(.*\S)\s*\(([^()]+)\)$/);
    return m ? { cuando: m[1], lugar: m[2].trim() } : { cuando: t, lugar: null };
  });
}

/**
 * "¿En qué categoría juega?": las categorías del portal que le tocan a quien
 * nació en `anio`, con la misma regla de la CABB que la lista. Puede ser más
 * de una (Primera masculino y femenino) o ninguna (más chico que la U9).
 */
export function categoriasDelAnio(lista, temporada, anio) {
  const leTocan = (Array.isArray(lista) ? lista : []).filter((c) => {
    const a = aniosDeCategoria(c?.grupo, temporada);
    return a && Number.isInteger(anio) && (a.viejo == null || anio >= a.viejo) && (a.nuevo == null || anio <= a.nuevo);
  });
  return categoriasDelPortal(leTocan, temporada);
}

const MAPA = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com)\/[^\s"<>]*$/;

/**
 * La sede si tiene nombre; el link al mapa sólo si es de Google Maps. `embed`
 * es la dirección del mapa para el iframe (www.google.com, lo único que deja
 * frame-src fuera de YouTube): la arma acá a partir de lo que se busca, así
 * nunca termina en un iframe una URL pegada a mano.
 */
export function sedeValida(sede) {
  const nombre = texto(sede?.nombre);
  if (!nombre) return null;
  const lugares = (Array.isArray(sede.lugares) ? sede.lugares : []).map(texto).filter(Boolean).slice(0, 6);
  const buscar = texto(sede.buscar).slice(0, 120);
  return {
    nombre,
    direccion: texto(sede.direccion) || null,
    lugares,
    mapa: MAPA.test(sede.mapa ?? '') ? sede.mapa : null,
    embed: buscar ? `https://www.google.com/maps?q=${encodeURIComponent(buscar)}&output=embed` : null,
  };
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
