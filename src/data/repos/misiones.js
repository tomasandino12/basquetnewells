// Misiones del partido (0055): previas, misiones y logros de equipo.
// Se importa a través de src/data/repositorio.js (fachada). La RLS decide qué
// ve cada uno: el coordinador recibe previas y misiones de equipo, y cero
// filas de mision_jugador.
import { obtenerCliente } from '../cliente.js';
import {
  COLUMNAS_ESTADISTICA_DE_MISION, estadisticaDeMisionDesdeFila, misionDesdeFila, previaDesdeFila,
} from '../misiones.js';

const COLUMNAS_PREVIA = 'id, club_id, plantel_id, fecha, rival, partido_id';
const COLUMNAS_MISION = 'id, previa_id, orden, metrica, valor, texto, estado, comentario';
const COLUMNAS_MISION_JUGADOR = `${COLUMNAS_MISION}, jugador_id`;

async function misionesDe(tabla, columnas, previaIds) {
  if (!previaIds.length) return [];
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from(tabla)
    .select(columnas)
    .in('previa_id', previaIds)
    .order('orden');
  if (error) throw error;
  return data.map(misionDesdeFila);
}

/**
 * Las previas del plantel, la más reciente primero. `evaluada` es true si
 * alguna de sus misiones ya tiene estado: el ciclo de esa previa se cerró.
 */
export async function obtenerPreviasDelPlantel(clubId, plantelId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('previa_partido')
    .select(COLUMNAS_PREVIA)
    .eq('club_id', clubId)
    .eq('plantel_id', plantelId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  const ids = data.map((f) => f.id);
  const evaluadas = new Set();
  if (ids.length) {
    for (const tabla of ['mision_jugador', 'mision_equipo']) {
      const { data: filas, error: e } = await supabase
        .from(tabla)
        .select('previa_id')
        .in('previa_id', ids)
        .not('estado', 'is', null);
      if (e) throw e;
      filas.forEach((f) => evaluadas.add(f.previa_id));
    }
  }
  return data.map((f) => ({ ...previaDesdeFila(f), evaluada: evaluadas.has(f.id) }));
}

/** Una previa con sus misiones; null si no existe o no se ve. */
export async function obtenerPrevia(previaId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('previa_partido')
    .select(COLUMNAS_PREVIA)
    .eq('id', previaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [misionesJugador, misionesEquipo] = await Promise.all([
    misionesDe('mision_jugador', COLUMNAS_MISION_JUGADOR, [previaId]),
    misionesDe('mision_equipo', COLUMNAS_MISION, [previaId]),
  ]);
  return { ...previaDesdeFila(data), misionesJugador, misionesEquipo };
}

/** payload de prepararPayloadPrevia. Todo o nada (RPC 0055). */
export async function guardarPrevia(payload) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('guardar_previa', { payload });
  if (error) throw error;
  return data;
}

/** { previaId, partidoId, evaluaciones: [{ tipo, id, estado, comentario }] }. Todo o nada. */
export async function evaluarMisiones(payload) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('evaluar_misiones', { payload });
  if (error) throw error;
  return data;
}

/** Elegir a mano de qué partido es la previa, sin evaluar. Una fila: sin RPC. */
export async function vincularPrevia(previaId, partidoId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('previa_partido')
    .update({ partido_id: partidoId })
    .eq('id', previaId)
    .select('id');
  if (error) throw error;
  if (!data.length) throw new Error('NO_SE_PUDO_VINCULAR');
}

/** Falla con MISION_EVALUADA si ya tiene algo evaluado: eso no se borra. */
export async function borrarPrevia(previaId) {
  const supabase = obtenerCliente();
  const { error } = await supabase.from('previa_partido').delete().eq('id', previaId);
  if (error) throw error;
}

/** Las filas del boxscore de un partido, sólo con las columnas de misión. */
export async function obtenerEstadisticasParaMisiones(partidoId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('estadistica_jugador_partido')
    .select(COLUMNAS_ESTADISTICA_DE_MISION)
    .eq('partido_id', partidoId);
  if (error) throw error;
  return data.map(estadisticaDeMisionDesdeFila);
}

/**
 * Previas y misiones de equipo de un plantel (o de todo el club, para
 * Panorama), para armar los logros con logrosDelEquipo.
 */
export async function obtenerMisionesDeEquipo(clubId, plantelId = null) {
  const supabase = obtenerCliente();
  let consulta = supabase.from('previa_partido').select(COLUMNAS_PREVIA).eq('club_id', clubId);
  if (plantelId) consulta = consulta.eq('plantel_id', plantelId);
  const { data, error } = await consulta;
  if (error) throw error;
  const previas = data.map(previaDesdeFila);
  const misiones = await misionesDe('mision_equipo', COLUMNAS_MISION, previas.map((p) => p.id));
  return { previas, misiones };
}

/** Las misiones de un chico y sus previas, para la ficha (misionesConPrevia). */
export async function obtenerMisionesDelJugador(jugadorId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('mision_jugador')
    .select(COLUMNAS_MISION_JUGADOR)
    .eq('jugador_id', jugadorId);
  if (error) throw error;
  const misiones = data.map(misionDesdeFila);
  const ids = [...new Set(misiones.map((m) => m.previaId))];
  if (!ids.length) return { misiones, previas: [] };
  const { data: filas, error: e2 } = await supabase.from('previa_partido').select(COLUMNAS_PREVIA).in('id', ids);
  if (e2) throw e2;
  return { misiones, previas: filas.map(previaDesdeFila) };
}
