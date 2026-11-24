/**
 * Datos de "Nuestra Historia" (public/historia.html): los títulos del básquet de
 * Newell's en la Asociación Rosarina, las épocas de la línea de tiempo y los
 * hitos. Módulo puro: sin DOM ni red, se prueba con `node --test`.
 *
 * Regla de oro: lo que se muestra lleva `fuente` (medio, título, fecha o fecha de
 * consulta, URL). Lo que ninguna fuente confirma no se escribe acá como texto: queda
 * como `pendiente: true`, con `falta` diciendo qué hay que confirmar, y no sale en
 * `datosPublicables()`. Cuando aparezca la fuente, se lo convierte en hito con su
 * texto y desaparece de los pendientes. Spec: docs/superpowers/specs/
 * 2026-11-24-nuestra-historia-design.md.
 */

const LA_CAPITAL = {
  medio: 'La Capital',
  titulo: 'Los campeones de todos los años en los torneos de la Asociación Rosarina de Básquet',
  fecha: '2025-12-31',
  url: 'https://www.lacapital.com.ar/ovacion/basquet-los-campeones-todos-los-anos-los-torneos-la-asociacion-rosarina-basquet-n10237635.html',
};

// Olympedia, FIBA y Wikipedia no muestran la fecha de publicación: se guarda cuándo
// se consultó cada página, que es lo único que sabemos con certeza.
const CONSULTADA = '2026-11-24';

const OLYMPEDIA_DEL_VECCHIO = {
  medio: 'Olympedia',
  titulo: 'Hugo Del Vecchio',
  fecha: null,
  consultada: CONSULTADA,
  url: 'https://www.olympedia.org/athletes/5986',
};

const FIBA_MUNDIAL_1950 = {
  medio: 'FIBA',
  titulo: 'On this day, 70 years ago: Argentina win the inaugural FIBA Basketball World Cup',
  fecha: null,
  consultada: CONSULTADA,
  url: 'https://www.fiba.basketball/news/on-this-day-70-years-ago-argentina-win-the-inaugural-fiba-basketball-world-cup',
};

const WIKIPEDIA_CUBIERTO = {
  medio: 'Wikipedia',
  titulo: "Estadio Cubierto Newell's Old Boys",
  fecha: null,
  consultada: CONSULTADA,
  url: 'https://en.wikipedia.org/wiki/Estadio_Cubierto_Newell%27s_Old_Boys',
};

const ANIOS_TITULOS = [
  1943, 1944, 1945, 1946, 1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954,
  1977, 1978, 1983,
];

const epocaDelTitulo = (anio) => (anio <= 1954 ? 'doce-seguidos' : anio <= 1978 ? 'la-vuelta' : 'la-15');

const TITULOS = ANIOS_TITULOS.map((anio, i) => ({
  id: `titulo-${anio}`,
  anio,
  numero: i + 1,
  epoca: epocaDelTitulo(anio),
  // Ese año hubo por primera vez dos campeones: Newell's ganó el Clausura.
  ...(anio === 1983 ? { torneo: 'Clausura' } : {}),
  fuente: LA_CAPITAL,
}));

// `solapada`: el período cae dentro de otra época (1950 está dentro de los 12
// seguidos). Sirve para marcarla en la línea de tiempo, pero no para ubicar un año.
const EPOCAS = [
  { id: 'doce-seguidos', nombre: 'Los 12 seguidos', desde: 1943, hasta: 1954, hitoPrincipal: 'doce-seguidos' },
  { id: 'del-vecchio', nombre: 'Del Vecchio campeón del mundo', desde: 1950, hasta: 1950, solapada: true, hitoPrincipal: 'del-vecchio-mundial-1950' },
  { id: 'la-vuelta', nombre: 'La vuelta', desde: 1977, hasta: 1978, hitoPrincipal: 'la-vuelta' },
  { id: 'la-15', nombre: 'La 15ª', desde: 1983, hasta: 1983, hitoPrincipal: 'clausura-1983' },
  { id: 'el-cubierto', nombre: 'El Cubierto, sede del Mundial', desde: 1990, hasta: 1990, hitoPrincipal: 'cubierto-mundial-1990' },
];

// Un hito con `anio` es el dato propio de ese año; los que no lo tienen (los
// principales de las épocas de varios años) valen para todos los años de su época.
const HITOS = [
  {
    id: 'doce-seguidos',
    epoca: 'doce-seguidos',
    texto: 'Doce títulos consecutivos, de 1943 a 1954: un registro que La Capital califica de «sin precedentes» en las grandes ligas del mundo.',
    fuente: LA_CAPITAL,
  },
  {
    id: 'del-vecchio-mundial-1950',
    anio: 1950,
    epoca: 'del-vecchio',
    texto: 'Hugo «Balazo» Del Vecchio, rosarino y jugador de Newell’s, integró el plantel argentino campeón del primer Mundial, en 1950: en el Luna Park, Argentina le ganó la final 64-50 a Estados Unidos.',
    fuente: OLYMPEDIA_DEL_VECCHIO,
    otrasFuentes: [FIBA_MUNDIAL_1950],
  },
  {
    id: 'la-vuelta',
    epoca: 'la-vuelta',
    texto: 'En 1977 y 1978 Newell’s volvió a ser campeón: el regreso a los primeros planos.',
    fuente: LA_CAPITAL,
  },
  {
    id: 'clausura-1983',
    anio: 1983,
    epoca: 'la-15',
    texto: 'En 1983 Newell’s ganó el Clausura. Fue el primer año con dos campeones: el Apertura lo ganó Sportivo Constitución.',
    fuente: LA_CAPITAL,
  },
  {
    id: 'cubierto-mundial-1990',
    anio: 1990,
    epoca: 'el-cubierto',
    // No se da fecha de inauguración: ninguna fuente la confirma.
    texto: 'El Estadio Cubierto Claudio Newell fue sede del Grupo B del Mundial de básquet de 1990.',
    fuente: WIKIPEDIA_CUBIERTO,
  },
  {
    // Contexto de la Asociación, no de Newell's; no pertenece a ninguna época.
    id: 'arbb-cien-anios',
    anio: 1926,
    epoca: null,
    texto: 'La Asociación Rosarina de Básquet cumple 100 años el 12 de julio de 2026. Su primer campeón fue Provincial, en 1926.',
    fuente: LA_CAPITAL,
  },
];

// Sin texto a propósito: lo que no tiene fuente no se escribe. `falta` es una nota
// para quien cargue el dato, nunca para la pantalla.
const PENDIENTES = [
  { id: 'copa-jose-guido', pendiente: true, falta: 'Confirmar con fuente que existe y qué es la copa «José Guido».' },
  { id: 'copa-nicolas-galdiz', pendiente: true, falta: 'Confirmar con fuente que existe y qué es la copa «Nicolás Galdiz».' },
  { id: 'racha-1943', anio: 1943, pendiente: true, falta: 'Confirmar la marca de partidos ganados de 1943 (se oyó «32 de 33»).' },
  { id: 'campania-1948', anio: 1948, pendiente: true, falta: 'Confirmar el 30-0 de la campaña de 1948 y quién fue el técnico.' },
  { id: 'campania-1977', anio: 1977, pendiente: true, falta: 'Confirmar el 21-0 y el promedio de 99,7 puntos de 1977.' },
  { id: 'final-1978', anio: 1978, pendiente: true, falta: 'Confirmar el resultado (96-70) y la fecha (26/12/1978) de la final de 1978.' },
  { id: 'final-1983', anio: 1983, pendiente: true, falta: 'Confirmar contra quién fue la final de 1983 (se oyó Náutico).' },
  { id: 'planteles', pendiente: true, falta: 'Confirmar con fuente los nombres de los planteles campeones.' },
];

const congelar = (lista) => Object.freeze(lista.map((d) => Object.freeze(d)));
const T = congelar(TITULOS);
const E = congelar(EPOCAS);
const H = congelar(HITOS);
const P = congelar(PENDIENTES);

/** Los 15 títulos de Primera, en orden cronológico. */
export const titulos = () => [...T];

/** Épocas de la línea de tiempo, en el orden en que se muestran. */
export const epocas = () => [...E];

/** Todo lo que se puede mostrar: títulos e hitos, y nada que sea `pendiente`. */
export const datosPublicables = () => [...T, ...H].filter((d) => !d.pendiente);

/** Lo que falta confirmar. Sólo para quien carga datos; la pantalla no lo usa. */
export const datosPendientes = () => [...P];

/**
 * La época en la que cae un año, o null. Un año de título se ubica por su título
 * (1950 es de "Los 12 seguidos", no de "Del Vecchio", que está dentro de esa época).
 */
export function epocaDeAnio(anio) {
  const titulo = T.find((t) => t.anio === anio);
  if (titulo) return E.find((e) => e.id === titulo.epoca) ?? null;
  return E.find((e) => !e.solapada && e.desde <= anio && anio <= e.hasta) ?? null;
}

/**
 * El dato corto de un año: el propio si tiene, si no el principal de su época.
 * Devuelve null si el año no tiene ninguno (nunca inventa uno).
 */
export function microDato(anio) {
  const publicables = H.filter((h) => !h.pendiente);
  const propio = publicables.find((h) => h.anio === anio);
  if (propio) return propio;
  const epoca = epocaDeAnio(anio);
  return epoca ? publicables.find((h) => h.id === epoca.hitoPrincipal) ?? null : null;
}
