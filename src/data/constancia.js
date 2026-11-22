// Constancia del jugador: rachas de asistencia, semana de prácticas y vistas de asistencia.
// Lógica pura, sin red ni DOM. Las rachas vienen del laboratorio de interacciones
// (web/src/interacciones) y se usan tal cual.

/**
 * Entrenamientos seguidos con presente, desde el último hacia atrás. `null` es un día sin tomar
 * asistencia: no suma ni corta (el profe no la tomó, el chico no tiene la culpa).
 * @param {(boolean | null)[]} presencias
 * @returns {number}
 */
export function asistenciaSeguida(presencias) {
  let racha = 0;
  for (let i = presencias.length - 1; i >= 0; i--) {
    const p = presencias[i];
    if (p == null) continue;
    if (!p) break;
    racha++;
  }
  return racha;
}

/**
 * La racha más larga de presencias en la lista (con la misma regla: un día sin tomar no corta).
 * @param {(boolean | null)[]} presencias
 * @returns {number}
 */
export function mejorRacha(presencias) {
  let mejor = 0;
  let actual = 0;
  for (const p of presencias) {
    if (p == null) continue;
    actual = p ? actual + 1 : 0;
    mejor = Math.max(mejor, actual);
  }
  return mejor;
}

// --- Semana de prácticas y vistas de asistencia ---------------------------------------------
// Las fechas son 'AAAA-MM-DD' del día argentino (como `fechaLocal` de escalones.js) y "hoy" llega
// siempre de afuera: acá no se lee el reloj, así los tests no dependen del día en que corren. Los
// cálculos de calendario se hacen en UTC a mano: `new Date('2026-04-06')` es UTC y en Argentina
// se corre al día anterior.

/** Los mismos `tipo` que el check de `practica_jugador` (tests/contratoConstancia.test.js los compara). */
export const TIPOS_DE_PRACTICA = ['recurso', 'fisico'];

/** Cantidad de entrenamientos de la vista corta de asistencia. */
export const ENTRENAMIENTOS_RECIENTES = 10;

function aUtc(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aIso(fecha) {
  return fecha.toISOString().slice(0, 10);
}

/** Los siete días de la semana de `hoy`, de lunes ('AAAA-MM-DD' cada uno). */
function diasDeLaSemana(hoy) {
  const base = aUtc(hoy);
  const desdeElLunes = (base.getUTCDay() + 6) % 7; // lunes = 0 … domingo = 6
  return Array.from({ length: 7 }, (_, i) => aIso(new Date(base.getTime() + (i - desdeElLunes) * 86_400_000)));
}

/**
 * Lunes a domingo de la semana de `hoy`, un objeto por día. `hecho` es si practicó algo ese día:
 * dos prácticas el mismo día son un solo bloque. Un día que todavía no llegó es `futuro`, no "sin rutina".
 * @param {{ fecha: string, recursoId?: string | null }[]} marcas
 * @param {string} hoy
 * @returns {{ fecha: string, hecho: boolean, esHoy: boolean, futuro: boolean }[]}
 */
export function semanaDePracticas(marcas, hoy) {
  const conMarca = new Set(marcas.map((m) => m.fecha));
  return diasDeLaSemana(hoy).map((fecha) => ({
    fecha,
    hecho: conMarca.has(fecha),
    esHoy: fecha === hoy,
    futuro: fecha > hoy,
  }));
}

/** Días de esta semana en que practicó ese recurso (para «2 de 3 veces esta semana»). */
export function vecesEnLaSemana(marcas, recursoId, hoy) {
  const semana = new Set(diasDeLaSemana(hoy));
  const dias = new Set(marcas.filter((m) => m.recursoId === recursoId && semana.has(m.fecha)).map((m) => m.fecha));
  return dias.size;
}

/** Los recursos que se pueden practicar: los de lectura de juego se miran, no se practican. */
export function recursosPracticables(recursos) {
  return recursos.filter((r) => r.tipo !== 'lectura');
}

/**
 * Lo que muestra la tarjeta de asistencia para una vista: `ultimos` (los 10 últimos entrenamientos,
 * se haya tomado asistencia o no), `mes` o `anio` (los del mes o el año de `hoy`).
 * `dias` trae un día por entrenamiento con `vino`: `true`, `false` o `null` (no se tomó: no cuenta como
 * falta ni como tomada). Devuelve los días del período, a cuántos vino de cuántos tomados, y las rachas.
 * La racha actual es la de toda su historia, no la del período: mirar el mes no la reinicia.
 * @param {{ fecha: string, vino: boolean | null }[]} dias
 * @param {'ultimos' | 'mes' | 'anio'} vista
 * @param {string} hoy
 */
export function vistaDeAsistencia(dias, vista, hoy) {
  const hasta = dias.filter((d) => d.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  let delPeriodo;
  if (vista === 'ultimos') delPeriodo = hasta.slice(-ENTRENAMIENTOS_RECIENTES);
  else if (vista === 'mes') delPeriodo = hasta.filter((d) => d.fecha.startsWith(hoy.slice(0, 7)));
  else if (vista === 'anio') delPeriodo = hasta.filter((d) => d.fecha.startsWith(hoy.slice(0, 4)));
  else throw new Error(`vista desconocida: ${vista}`);

  const presencias = delPeriodo.map((d) => d.vino);
  return {
    dias: delPeriodo,
    vino: presencias.filter((p) => p === true).length,
    tomadas: presencias.filter((p) => p != null).length,
    racha: asistenciaSeguida(hasta.map((d) => d.vino)),
    mejorRacha: mejorRacha(presencias),
  };
}
