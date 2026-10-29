// Asistencia a los entrenamientos y lesiones (0064).
// Se importa a través de src/data/repositorio.js (fachada). La RLS decide qué
// ve cada uno: el coordinador no recibe ninguna fila de un chico, sólo el %
// por categoría de obtenerAsistenciaDelClub.
import { obtenerCliente } from '../cliente.js';
import { entrenamientoDesdeFila, lesionDesdeFila } from '../asistencia.js';

/**
 * Los días de práctica del plantel entre dos fechas ISO (inclusive), el más
 * reciente primero, cada uno con lo tomado. Un día es a lo sumo uno por plantel
 * y fecha, así que el rango de una temporada entra en una sola página.
 */
export async function obtenerEntrenamientos(plantelId, desde, hasta) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('entrenamiento')
    .select('id, fecha, hubo, asistencia(jugador_id, estado)')
    .eq('plantel_id', plantelId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data.map(entrenamientoDesdeFila);
}

/**
 * Todo el día en una transacción (RPC 0064). `filas`: [{ jugadorId, estado }];
 * estado null desmarca a ese chico, y los que no vienen quedan como estaban.
 * Con hubo = false las filas se ignoran. Devuelve el id del día.
 */
export async function guardarAsistencia({ plantelId, fecha, hubo, filas }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('guardar_asistencia', {
    p_plantel_id: plantelId,
    p_fecha: fecha,
    p_hubo: hubo,
    p_filas: filas.map(({ jugadorId, estado }) => ({ jugadorId, estado: estado ?? null })),
  });
  if (error) throw error;
  return data;
}

/**
 * Las lesiones, abiertas y cerradas, de los chicos que hoy están en el plantel.
 * La lesión es del jugador y no del plantel: se llega por su pertenencia vigente.
 */
export async function obtenerLesionesDelPlantel(plantelId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('lesion')
    .select('id, jugador_id, desde, hasta, zona, lado, tipo, jugador!inner(pertenencia!inner(plantel_id, hasta))')
    .eq('jugador.pertenencia.plantel_id', plantelId)
    .is('jugador.pertenencia.hasta', null)
    .order('desde', { ascending: false });
  if (error) throw error;
  return data.map(lesionDesdeFila);
}

/** zona, lado y tipo son opcionales: null es "no se sabe". `desde` es ISO. */
export async function abrirLesion({ clubId, jugadorId, desde, zona = null, lado = null, tipo = null }) {
  const supabase = obtenerCliente();
  const { error } = await supabase
    .from('lesion')
    .insert({ club_id: clubId, jugador_id: jugadorId, desde, zona, lado, tipo });
  if (error) throw error;
}

/** `hasta` es el día del alta: ese día el chico ya cuenta como sano. */
export async function darAlta(lesionId, hasta) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('lesion')
    .update({ hasta })
    .eq('id', lesionId)
    .select('id');
  if (error) throw error;
  if (!data.length) throw new Error('NO_SE_PUDO_DAR_ALTA');
}

/**
 * Lo único que ve el coordinador (RPC security definer): por categoría, la
 * cantidad de entrenamientos y el % general. pct null = sin asistencia tomada.
 */
export async function obtenerAsistenciaDelClub(clubId, desde, hasta) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('asistencia_del_club', {
    p_club_id: clubId,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) throw error;
  return data.map((f) => ({
    plantelId: f.plantel_id,
    categoria: f.categoria,
    entrenamientos: f.entrenamientos,
    // numeric: según el cliente llega como número o como string.
    pct: f.pct == null ? null : Number(f.pct),
  }));
}
