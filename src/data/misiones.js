/**
 * Misiones del partido: lo que el profe le pide a cada chico y al equipo
 * antes de jugar, y cómo salió. Lógica pura, sin red ni DOM.
 *
 * El pedido del club es no premiar el goleo: por eso la lista de métricas es
 * cerrada y no tiene puntos propios ni nada de tiro. La app muestra el número
 * del boxscore al lado de la misión pero nunca decide ni sugiere el estado: lo
 * marca quien fijó la misión, porque el dato de la CABB depende de quién cargó
 * la planilla en esa cancha.
 *
 * La lista de métricas y la de estados están también en los check de
 * 0054_misiones_partido.sql; tests/contratoMisiones.test.js las compara.
 */

import { LIMITE } from './limites.js';
import { clavearNombre } from '../parser/parserCabb.js';

const AMBOS = ['jugador', 'equipo'];

/**
 * El sentido es fijo por métrica: nadie quiere "al menos 3 pérdidas", y así el
 * profe se ahorra un toque y un error. `campo` es la clave camelCase de la
 * estadística (o del partido, con fuente 'partido').
 */
export const METRICAS = [
  { clave: 'reb_of', columna: 'reb_of', campo: 'rebOf', etiqueta: 'Rebotes en ataque', singular: 'rebote en ataque', plural: 'rebotes en ataque', sentido: 'al_menos', ambitos: AMBOS },
  { clave: 'reb_def', columna: 'reb_def', campo: 'rebDef', etiqueta: 'Rebotes en defensa', singular: 'rebote en defensa', plural: 'rebotes en defensa', sentido: 'al_menos', ambitos: AMBOS },
  { clave: 'reb_tot', columna: 'reb_tot', campo: 'rebTot', etiqueta: 'Rebotes', singular: 'rebote', plural: 'rebotes', sentido: 'al_menos', ambitos: AMBOS },
  { clave: 'ast', columna: 'ast', campo: 'ast', etiqueta: 'Asistencias', singular: 'asistencia', plural: 'asistencias', sentido: 'al_menos', ambitos: AMBOS },
  { clave: 'rec', columna: 'rec', campo: 'rec', etiqueta: 'Robos', singular: 'robo', plural: 'robos', sentido: 'al_menos', ambitos: AMBOS },
  { clave: 'tap', columna: 'tap_cometidos', campo: 'tapCometidos', etiqueta: 'Tapas', singular: 'tapa', plural: 'tapas', sentido: 'al_menos', ambitos: AMBOS },
  { clave: 'per', columna: 'per', campo: 'per', etiqueta: 'Pérdidas', singular: 'pérdida', plural: 'pérdidas', sentido: 'como_maximo', ambitos: AMBOS },
  { clave: 'fal', columna: 'fal_cometidas', campo: 'falCometidas', etiqueta: 'Faltas', singular: 'falta', plural: 'faltas', sentido: 'como_maximo', ambitos: AMBOS },
  // Del marcador sólo el del rival: los puntos propios son anotación.
  { clave: 'puntos_rival', columna: 'puntos_rival', campo: 'puntosRival', fuente: 'partido', etiqueta: 'Puntos del rival', singular: 'punto del rival', plural: 'puntos del rival', sentido: 'como_maximo', ambitos: ['equipo'] },
];

const POR_CLAVE = new Map(METRICAS.map((m) => [m.clave, m]));

export const ESTADOS = [
  { id: 'logrado', nombre: 'Logrado' },
  { id: 'en_proceso', nombre: 'En proceso' },
  { id: 'no_logrado', nombre: 'No logrado' },
];

export const MAX_POR_JUGADOR = 2;
// Que el objetivo común siga siendo uno o dos, no una lista.
export const MAX_DE_EQUIPO = 3;

export function metricasPara(ambito) {
  return METRICAS.filter((m) => m.ambitos.includes(ambito));
}

export function metrica(clave) {
  return POR_CLAVE.get(clave) ?? null;
}

const SENTIDO = { al_menos: 'al menos', como_maximo: 'como máximo' };
const unidad = (m, n) => (n === 1 ? m.singular : m.plural);

/**
 * El número real de una misión. `fuente` es la fila del jugador en el
 * boxscore (o los totales del equipo); sin fila o con la columna nula es
 * `null`, "sin dato", nunca 0.
 */
export function valorReal(mision, fuente, partido) {
  const m = metrica(mision?.metrica);
  if (!m) return null;
  const origen = m.fuente === 'partido' ? partido : fuente;
  const v = origen?.[m.campo];
  return Number.isInteger(v) ? v : null;
}

/**
 * Suma de los jugadores propios. Si alguna fila no tiene el dato, el total es
 * `null`: una suma parcial mentiría para abajo y el profe la leería como real.
 */
export function totalesDelEquipo(estadisticas) {
  const totales = {};
  for (const m of METRICAS) {
    if (m.fuente === 'partido') continue;
    let suma = estadisticas.length ? 0 : null;
    for (const fila of estadisticas) {
      const v = fila[m.campo];
      if (!Number.isInteger(v)) { suma = null; break; }
      suma += v;
    }
    totales[m.campo] = suma;
  }
  return totales;
}

function coincideRival(rival, rivalNombre) {
  const a = clavearNombre(rival ?? '');
  const b = clavearNombre(rivalNombre ?? '');
  return a !== '' && b !== '' && (a.includes(b) || b.includes(a));
}

/**
 * A qué partido va cada previa. La previa se carga antes de que exista el
 * partido (nace con el import), así que el vínculo se calcula por plantel y
 * fecha, con el rival para desempatar. Nada se fija acá: el `partidoId` se
 * guarda recién cuando el profe evalúa o elige a mano, así lo confirma una
 * persona. Devuelve un Map previaId → { partidoId, motivo }.
 */
export function vincularPrevias(previas, partidos) {
  const resultado = new Map();
  const tomados = new Set(previas.filter((p) => p.partidoId).map((p) => p.partidoId));
  const reclamos = new Map();

  for (const p of previas) {
    if (p.partidoId) {
      resultado.set(p.id, { partidoId: p.partidoId, motivo: 'fijado' });
      continue;
    }
    const delDia = partidos.filter((x) => x.plantelId === p.plantelId && x.fecha === p.fecha && !tomados.has(x.id));
    let elegido = null;
    let motivo = 'sin_partido';
    if (delDia.length === 1) {
      elegido = delDia[0].id;
      motivo = 'fecha';
    } else if (delDia.length > 1) {
      const porRival = delDia.filter((x) => coincideRival(p.rival, x.rivalNombre));
      if (porRival.length === 1) {
        elegido = porRival[0].id;
        motivo = 'rival';
      } else {
        motivo = 'ambiguo';
      }
    }
    resultado.set(p.id, { partidoId: elegido, motivo });
    if (elegido) reclamos.set(elegido, [...(reclamos.get(elegido) ?? []), p.id]);
  }

  // Dos previas que caen en el mismo partido: que elija el profe.
  for (const ids of reclamos.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) resultado.set(id, { partidoId: null, motivo: 'ambiguo' });
  }
  return resultado;
}

const largo = (t) => String(t ?? '').length;
const conTexto = (t) => String(t ?? '').trim() !== '';

function erroresDeMision(mision, ambito) {
  const tieneMetrica = mision.metrica != null;
  const tieneTexto = conTexto(mision.texto);
  if (tieneMetrica && tieneTexto) return ['Una misión es con número o con texto, no las dos.'];
  if (!tieneMetrica && !tieneTexto) return ['Falta escribir la misión.'];
  if (tieneTexto) {
    return largo(mision.texto.trim()) > LIMITE.textoMision
      ? [`La misión no puede pasar de ${LIMITE.textoMision} caracteres.`]
      : [];
  }
  const m = metrica(mision.metrica);
  if (!m || !m.ambitos.includes(ambito)) return ['Esa métrica no se puede usar acá.'];
  if (!Number.isInteger(mision.valor) || mision.valor < 0) return ['El número de la misión tiene que ser entero, de 0 para arriba.'];
  return [];
}

export function validarPrevia(borrador) {
  const errores = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(borrador.fecha ?? '')) errores.push('Elegí la fecha del partido.');
  if (largo(String(borrador.rival ?? '').trim()) > LIMITE.rival) errores.push(`El rival no puede pasar de ${LIMITE.rival} caracteres.`);

  const porJugador = new Map();
  for (const m of borrador.misionesJugador ?? []) {
    porJugador.set(m.jugadorId, (porJugador.get(m.jugadorId) ?? 0) + 1);
    errores.push(...erroresDeMision(m, 'jugador'));
  }
  if ([...porJugador.values()].some((n) => n > MAX_POR_JUGADOR)) {
    errores.push(`Cada jugador puede tener como mucho ${MAX_POR_JUGADOR} misiones.`);
  }
  const equipo = borrador.misionesEquipo ?? [];
  if (equipo.length > MAX_DE_EQUIPO) errores.push(`El equipo puede tener como mucho ${MAX_DE_EQUIPO} misiones.`);
  for (const m of equipo) errores.push(...erroresDeMision(m, 'equipo'));

  return { ok: errores.length === 0, errores: [...new Set(errores)] };
}

const misionParaPayload = (m, orden) => (m.metrica != null
  ? { id: m.id, orden, metrica: m.metrica, valor: m.valor, texto: null }
  : { id: m.id, orden, metrica: null, valor: null, texto: m.texto.trim() });

/** El payload de guardar_previa. Supone un borrador que ya pasó validarPrevia. */
export function prepararPayloadPrevia(borrador) {
  const vistos = new Map();
  const rival = String(borrador.rival ?? '').trim();
  return {
    previaId: borrador.previaId,
    clubId: borrador.clubId,
    plantelId: borrador.plantelId,
    fecha: borrador.fecha,
    rival: rival || null,
    misionesJugador: (borrador.misionesJugador ?? []).map((m) => {
      const orden = (vistos.get(m.jugadorId) ?? 0) + 1;
      vistos.set(m.jugadorId, orden);
      const { id, ...resto } = misionParaPayload(m, orden);
      return { id, jugadorId: m.jugadorId, ...resto };
    }),
    misionesEquipo: (borrador.misionesEquipo ?? []).map((m, i) => misionParaPayload(m, i + 1)),
  };
}

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** La consigna como la lee el profe: "Al menos 5 rebotes". */
export function textoDeMision(mision) {
  const m = metrica(mision.metrica);
  if (!m) return String(mision.texto ?? '').trim();
  if (m.clave === 'puntos_rival') return `El rival hace ${SENTIDO[m.sentido]} ${mision.valor} puntos`;
  return mayuscula(`${SENTIDO[m.sentido]} ${mision.valor} ${unidad(m, mision.valor)}`);
}

/** "7 rebotes · misión: al menos 5". Null para una misión de texto. */
export function textoDelValor(mision, real) {
  const m = metrica(mision.metrica);
  if (!m) return null;
  const hecho = real == null ? 'sin dato' : `${real} ${unidad(m, real)}`;
  return `${hecho} · misión: ${SENTIDO[m.sentido]} ${mision.valor}`;
}
