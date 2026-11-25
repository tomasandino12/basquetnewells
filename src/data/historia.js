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

// El Mundial U17 de 2018: la sede y la refacción para ese torneo salen de Wikipedia; el sorteo
// de FIBA es la fuente secundaria. Se distingue el medio para que los badges no digan dos veces "Wikipedia".
const WIKIPEDIA_U17_2018 = {
  medio: 'Wikipedia · Mundial U17',
  titulo: '2018 FIBA Under-17 Basketball World Cup',
  fecha: null,
  consultada: CONSULTADA,
  url: 'https://en.wikipedia.org/wiki/2018_FIBA_Under-17_Basketball_World_Cup',
};

const FIBA_SORTEO_U17_2018 = {
  medio: 'FIBA',
  titulo: 'Draw results in for FIBA U17 Basketball World Cup 2018',
  fecha: null,
  consultada: CONSULTADA,
  url: 'https://www.fiba.basketball/world/u17/2018/news/draw-results-in-for-fiba-u17-basketball-world-cup-2018',
};

// Archivo del Centenario de la Asociación Rosarina: una nota por temporada.
const arbb = (titulo, fecha, slug) => ({
  medio: 'Asociación Rosarina de Básquet · 100 años',
  titulo,
  fecha,
  url: `https://rosariobasquetbol.com.ar/${slug}/`,
});
const ARBB_1943 = arbb('1943 – Comienza la hegemonía de Newell’s', '2025-08-18', '1943-comienza-la-hegemonia-de-newells');
const ARBB_1947 = arbb('1947 – Hegemonía leprosa', '2025-09-03', '1947-hegemonia-leprosa');
const ARBB_1948 = arbb('1948 – Newells séxtuple campeón', '2025-09-04', '1948-newells-sextuple-campeon');
const ARBB_1954 = arbb('1954 – Récord de participantes en el certamen de Cuarta División: 82 equipos', '2025-09-22', '1954-record-de-participantes-en-el-certamen-de-cuarta-division-82-equipos');
const ARBB_1977 = arbb('1977 – Rosario campeón en el certamen provincial de cadetes infantiles', '2026-02-22', '1977-rosario-campeon-en-el-certamen-provincial-de-cadetes-infantiles');
const ARBB_1978 = arbb('1978 – Unión total de la dirigencia del básquet', '2026-03-25', '1978-union-total-de-la-dirigencia-del-basquet');
const ARBB_1983 = arbb('1983 – Newell’s campeón tras cinco años y Constitución por primera vez', '2026-06-15', '1983-newells-volvio-a-salir-campeon-luego-de-cinco-anos');

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
  // Ese año hubo por primera vez dos campeones. La Asociación lo llama "torneo
  // regular" (La Capital, "Clausura"); el otro, el Apertura, fue de Sportivo Constitución.
  ...(anio === 1983 ? { torneo: 'Torneo regular' } : {}),
  fuente: LA_CAPITAL,
}));

// `solapada`: el período cae dentro de otra época (1950 está dentro de los 12
// seguidos). Sirve para marcarla en la línea de tiempo, pero no para ubicar un año.
const EPOCAS = [
  { id: 'doce-seguidos', nombre: 'Los 12 seguidos', desde: 1943, hasta: 1954, hitoPrincipal: 'doce-seguidos' },
  { id: 'invicto-1948', nombre: '1948, el invicto', desde: 1948, hasta: 1948, solapada: true, hitoPrincipal: 'campania-1948' },
  { id: 'del-vecchio', nombre: 'Del Vecchio campeón del mundo', desde: 1950, hasta: 1950, solapada: true, hitoPrincipal: 'del-vecchio-mundial-1950' },
  { id: 'la-vuelta', nombre: 'La vuelta', desde: 1977, hasta: 1978, hitoPrincipal: 'la-vuelta' },
  { id: 'la-15', nombre: 'La 15ª', desde: 1983, hasta: 1983, hitoPrincipal: 'campeon-1983' },
  { id: 'el-cubierto', nombre: 'El Cubierto, sede del Mundial', desde: 1990, hasta: 1990, hitoPrincipal: 'cubierto-mundial-1990' },
];

// `momento: true` marca los hitos que no son un título: la línea de tiempo los muestra
// como tarjetas aparte, sin estrella (aunque caigan en un año de título, como 1950).
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
    id: 'copa-jose-guido-1943',
    anio: 1943,
    epoca: 'doce-seguidos',
    texto: 'Recién vuelto a la Rosarina, Newell’s ganó por primera vez la Copa José Guido, la reservada a los campeones de Primera. Entre el torneo de Ascenso y el Campeonato Rosarino jugó 33 partidos y ganó 32.',
    // Grafía de la fuente (en la de 1948 aparece "Battilana").
    plantel: ['Ítalo Scolara', 'Daniel Batillana', 'Juan Lanzini', 'Pedro Fernández', 'Juan Batillana', 'Jesús Hernández', 'Joaquín Pérez'],
    fuente: ARBB_1943,
  },
  {
    // La nota de 1947 dice que la ganó "al igual que el año anterior".
    id: 'galdiz-1946',
    anio: 1946,
    epoca: 'doce-seguidos',
    texto: 'Además del título, la Copa Nicolás Galdiz: el premio al club con mejor rendimiento en todas las categorías y competencias oficiales de la Rosarina.',
    fuente: ARBB_1947,
  },
  {
    id: 'galdiz-1947',
    anio: 1947,
    epoca: 'doce-seguidos',
    texto: 'Otra vez la Copa Nicolás Galdiz al mejor club de todas las categorías, y Rosario Central segundo en Primera.',
    fuente: ARBB_1947,
  },
  {
    id: 'campania-1948',
    anio: 1948,
    epoca: 'invicto-1948',
    texto: 'Campeón invicto por primera vez: ganó los 30 partidos que jugó. Se consagró el 8 de febrero de 1949 ante Velocidad y Resistencia (34-24), igualó el récord de seis títulos seguidos de Huracán y sumó la tercera Copa Nicolás Galdiz.',
    tecnico: 'Héctor Carrozo',
    plantel: ['Ítalo Scolara (capitán)', 'Daniel Battilana', 'Juan Battilana', 'Juan Lanzini', 'Arturo Alegrechy', 'Hugo Del Vecchio', 'Raúl Pettit'],
    fuente: ARBB_1948,
  },
  {
    id: 'del-vecchio-mundial-1950',
    anio: 1950,
    epoca: 'del-vecchio',
    momento: true,
    texto: 'Hugo «Balazo» Del Vecchio, rosarino y jugador de Newell’s, integró el plantel argentino campeón del primer Mundial, en 1950: en el Luna Park, Argentina le ganó la final 64-50 a Estados Unidos.',
    fuente: OLYMPEDIA_DEL_VECCHIO,
    otrasFuentes: [FIBA_MUNDIAL_1950],
  },
  {
    id: 'record-1954',
    anio: 1954,
    epoca: 'doce-seguidos',
    texto: 'Duodécimo título consecutivo, algo único en la ciudad, en el país y, según la Asociación, también en el mundo. Hasta el presidente de la Nación felicitó por carta a los campeones.',
    fuente: ARBB_1954,
  },
  {
    id: 'la-vuelta',
    epoca: 'la-vuelta',
    texto: 'En 1977 y 1978 Newell’s volvió a ser campeón: el regreso a los primeros planos.',
    fuente: LA_CAPITAL,
  },
  {
    id: 'maquina-1977',
    anio: 1977,
    epoca: 'la-vuelta',
    texto: 'Una de las mejores campañas de la historia del básquet rosarino: ganó los 21 partidos que jugó, pasó los 100 puntos en diez y promedió 99,70 por partido.',
    fuente: ARBB_1977,
  },
  {
    id: 'bicampeon-1978',
    anio: 1978,
    epoca: 'la-vuelta',
    texto: 'En la rueda final le ganó 96-70 a Central, con 29 puntos de Guillermo Buffarini. El 26 de diciembre de 1978 venció otra vez al clásico, 70-63, y repitió el título de 1977.',
    fuente: ARBB_1978,
  },
  {
    id: 'campeon-1983',
    anio: 1983,
    epoca: 'la-15',
    texto: 'Campeón del torneo regular tras cinco años: en semifinales le ganó la serie 2-1 a Central, que venía de ganar todo entre 1979 y 1982, y en la final a Náutico, 53-52 y 67-66. Fue el primer año con dos campeones: el Apertura lo ganó Sportivo Constitución.',
    tecnico: 'Pablo D’Angelo',
    plantel: ['César Pastorino', 'Edgardo Lalima', 'Roberto Miraglio', 'Osvaldo Barreiro', 'Fernando Belli', 'Carlos Gorosito', 'Fernando Angelone', 'Marcelo Ottolini', 'Raúl Spaggiari', 'Gabriel Lalima', 'Marcelo Estévez', 'Gustavo Lalima'],
    fuente: ARBB_1983,
  },
  {
    id: 'cubierto-mundial-1990',
    anio: 1990,
    epoca: 'el-cubierto',
    momento: true,
    nombre: 'Estadio Cubierto Dr. Claudio L. Newell',
    // Ni fecha de inauguración ni superficie ni "acá se jugaron los títulos": ninguna fuente lo confirma
    // (las finales de 1978 y 1983 fueron en Sportivo América). El texto no lleva años: los dicen las `sedes`.
    texto: 'Uno de los estadios cubiertos emblemáticos del básquet argentino, en el Parque de la Independencia: sede mundialista, se refaccionó para volver a recibir al mundo.',
    sedes: ['Mundial FIBA 1990 · Grupo B', 'Mundial FIBA U17 2018'],
    fuente: WIKIPEDIA_CUBIERTO,
    otrasFuentes: [WIKIPEDIA_U17_2018, FIBA_SORTEO_U17_2018],
  },
  {
    // Contexto de la Asociación, no de Newell's; no pertenece a ninguna época.
    id: 'arbb-cien-anios',
    anio: 1926,
    epoca: null,
    momento: true,
    texto: 'La Asociación Rosarina de Básquet cumple 100 años el 12 de julio de 2026. Su primer campeón fue Provincial, en 1926.',
    fuente: LA_CAPITAL,
  },
];

// Sin texto a propósito: lo que no tiene fuente no se escribe. `falta` es una nota
// para quien cargue el dato, nunca para la pantalla.
const PENDIENTES = [
  { id: 'inauguracion-cubierto', pendiente: true, falta: 'Confirmar la fecha de inauguración del Estadio Cubierto Claudio Newell (una copia de Wikipedia dice 1982).' },
  { id: 'clasico-1943', anio: 1943, pendiente: true, falta: 'La única derrota de 1943 fue con Central el 16/10; la fuente dice «ajustada» pero da 64 a 34: confirmar el resultado.' },
  { id: 'planteles-otros-anios', pendiente: true, falta: 'Planteles de 1944–1947, 1949–1954, 1977 y 1978.' },
]

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

/** Los hitos publicables que no son un título (Del Vecchio, el Cubierto, los 100 años de la Rosarina), en orden cronológico. */
export const momentos = () => H.filter((h) => h.momento && !h.pendiente).sort((a, b) => a.anio - b.anio);

/** El dato propio de un año de título (nunca el de su época, ni un momento); null si no tiene. */
export const hitoDeTitulo = (anio) => H.find((h) => h.anio === anio && !h.momento && !h.pendiente) ?? null;

/**
 * Las cifras del encabezado, calculadas de los títulos: cuántos hay, la racha más larga de años
 * consecutivos (con su primer y último año) y el primer y el último título.
 */
export function resumenDeTitulos() {
  const anios = T.map((t) => t.anio);
  let racha = { cantidad: 0, desde: null, hasta: null };
  let inicio = 0;
  anios.forEach((anio, i) => {
    if (i > 0 && anio !== anios[i - 1] + 1) inicio = i;
    const cantidad = i - inicio + 1;
    if (cantidad > racha.cantidad) racha = { cantidad, desde: anios[inicio], hasta: anio };
  });
  return { total: anios.length, racha, primero: anios[0] ?? null, ultimo: anios.at(-1) ?? null };
}

/**
 * Las placas de la copa, en las dos filas del tambor de madera (como en la copa real): arriba las
 * ocho primeras (1943–1950) y abajo las otras siete. Cada placa lleva su año, su número de título y
 * su lugar en la fila (`i`); la fila dice cuántas entran en la vuelta (`n`), así el ángulo de cada una
 * es i·360°/n. El marcado de las placas está escrito en public/historia.html (se ven sin JavaScript)
 * y un test lo compara con esto.
 */
const PLACAS_ARRIBA = 8;
export function filasDePlacas() {
  const placa = (t, i) => ({ anio: t.anio, numero: t.numero, i });
  return [T.slice(0, PLACAS_ARRIBA), T.slice(PLACAS_ARRIBA)].map((fila) => ({ n: fila.length, placas: fila.map(placa) }));
}

/**
 * Las piezas que alternan en la vitrina 3D: el trofeo (la copa) y la medalla oficial. `etiqueta` es
 * el texto del selector y `leyenda` lo que dice el pie de la vitrina cuando la pieza está a la vista.
 * Las dos son recreaciones: no hay fotos de época, así que no se las presenta como tales.
 */
const PIEZAS = [
  { id: 'copa', etiqueta: 'Trofeo ARBB', leyenda: 'Recreación inspirada en la copa actual de la Asociación Rosarina' },
  { id: 'medalla', etiqueta: 'Medalla oficial', leyenda: 'Recreación inspirada en la medalla actual de la Asociación Rosarina' },
];
export const piezasDeVitrina = () => PIEZAS.map((p) => ({ ...p }));
