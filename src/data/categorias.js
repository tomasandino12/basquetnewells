/*
 * Categoría por año de nacimiento. Regla de los formularios del club para
 * 2026: Uxx = nacidos en (temporada − xx) y el año siguiente; U21 abarca
 * cuatro años, Escuelita todo lo más chico y Mayores todo lo más grande.
 * Sólo cuenta el año: así lo arma la CABB, no por fecha de cumpleaños.
 * Spec: docs/superpowers/specs/2026-10-19-datos-conectados-design.md §1.
 */

// Los códigos del catálogo `categoria` hoy (0016 + 0019). Se pasan como
// parámetro donde se tenga el catálogo real: una categoría que el club sume
// por SQL (U15F, por ejemplo) aparece sola sin tocar este archivo.
export const CATEGORIAS_SEMILLERO = ['U13M', 'U15M', 'U17M', 'U21M', 'MAY_M', 'MAY_F'];

// [edad máxima en el año de la temporada, grupo], de chico a grande.
const TRAMOS = [
  [7, 'ESCUELITA'],
  [9, 'U9'],
  [11, 'U11'],
  [13, 'U13'],
  [15, 'U15'],
  [17, 'U17'],
  [21, 'U21'],
];

const NOMBRE_RAMA = { M: 'masculino', F: 'femenino' };

/** '2026' o 2026 → 2026; cualquier otro nombre de temporada → null. */
export function temporadaComoAnio(nombre) {
  const t = String(nombre ?? '').trim();
  return /^\d{4}$/.test(t) ? Number(t) : null;
}

function normalizarRama(rama) {
  const r = String(rama ?? '').trim().toUpperCase();
  if (r === 'M' || r === 'MASCULINO') return 'M';
  if (r === 'F' || r === 'FEMENINO') return 'F';
  return null;
}

function grupoPorEdad(edad) {
  for (const [maxima, grupo] of TRAMOS) if (edad <= maxima) return grupo;
  return 'MAYORES';
}

/**
 * fecha 'aaaa-mm-dd', temporada (año o su nombre), rama ('M'/'F' o el texto
 * del formulario) → { grupo, codigo, motivo? }. `grupo` sale sólo del año;
 * `codigo` es el de Semillero, o null con el motivo si no hay dónde ponerlo.
 */
export function categoriaPorNacimiento(fecha, temporada, rama, catalogo = CATEGORIAS_SEMILLERO) {
  const anioTemporada = temporadaComoAnio(temporada);
  if (anioTemporada == null) return { grupo: null, codigo: null, motivo: 'la temporada no es un año' };
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(String(fecha ?? ''));
  if (!m) return { grupo: null, codigo: null, motivo: 'sin fecha de nacimiento' };
  const edad = anioTemporada - Number(m[1]);
  if (edad < 0) return { grupo: null, codigo: null, motivo: 'la fecha de nacimiento es posterior a la temporada' };

  const grupo = grupoPorEdad(edad);
  const r = normalizarRama(rama);
  if (!r) return { grupo, codigo: null, motivo: 'sin rama (masculino o femenino)' };
  const candidato = grupo === 'MAYORES' ? `MAY_${r}` : `${grupo}${r}`;
  if (new Set(catalogo).has(candidato)) return { grupo, codigo: candidato };
  const nombre = grupo === 'ESCUELITA' ? 'Escuelita' : grupo === 'MAYORES' ? 'Mayores' : grupo;
  return { grupo, codigo: null, motivo: `Semillero no tiene ${nombre} ${NOMBRE_RAMA[r]}` };
}

/**
 * La rama de un chico según sus planteles vigentes (U15M → M, MAY_F → F).
 * Si está en planteles de las dos ramas no se adivina: null.
 */
export function ramaDeCodigos(codigos) {
  const ramas = new Set((codigos ?? []).map((c) => String(c).slice(-1)).filter((x) => x === 'M' || x === 'F'));
  return ramas.size === 1 ? [...ramas][0] : null;
}

/**
 * Los años de nacimiento que entran en un grupo, según TRAMOS: la misma
 * regla que decide la categoría de un chico, así el portal no repite años a
 * mano que haya que correr cada temporada. `nuevo` null = Mayores (no hay
 * tope); `viejo` null = Escuelita (todo lo más chico). Grupo o temporada
 * desconocidos → null.
 */
export function aniosDeCategoria(grupo, temporada) {
  const t = temporadaComoAnio(temporada);
  if (t == null) return null;
  if (grupo === 'MAYORES') return { viejo: null, nuevo: t - TRAMOS.at(-1)[0] - 1 };
  const i = TRAMOS.findIndex(([, g]) => g === grupo);
  if (i < 0) return null;
  const maxima = TRAMOS[i][0];
  if (i === 0) return { viejo: t - maxima, nuevo: null };
  return { viejo: t - maxima, nuevo: t - TRAMOS[i - 1][0] - 1 };
}

/** { viejo, nuevo } → "2017 y 2018", "2005 a 2008", "2019 en adelante", "2004 y antes". */
export function textoAnios(anios) {
  if (!anios) return '';
  const { viejo, nuevo } = anios;
  if (nuevo == null) return `${viejo} en adelante`;
  if (viejo == null) return `${nuevo} y antes`;
  if (viejo === nuevo) return String(viejo);
  return nuevo - viejo === 1 ? `${viejo} y ${nuevo}` : `${viejo} a ${nuevo}`;
}
