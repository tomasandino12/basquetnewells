// Cambio de temporada (0059): lo hace el coordinador. Abrir la temporada nueva,
// ver quién falta pasar y confirmar los pases, todo por RPC.
// Se importa a través de src/data/repositorio.js (fachada).
import { obtenerCliente } from '../cliente.js';

/**
 * Crea la temporada `nombre` (un año mayor que la vigente) con los mismos
 * planteles. Devuelve su id. Errores: 'TEMPORADA_NO_ES_POSTERIOR',
 * 'TEMPORADA_NO_ES_UN_ANIO', 'SIN_TEMPORADA_VIGENTE'.
 */
export async function abrirTemporada({ clubId, nombre }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('abrir_temporada', { p_club_id: clubId, p_nombre: nombre });
  if (error) throw error;
  return data;
}

/** Los chicos con plantel vigente en una temporada anterior: los que falta pasar. */
export async function obtenerPasesDeTemporada(clubId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('pases_de_temporada', { p_club_id: clubId });
  if (error) throw error;
  return data.map((f) => ({
    jugadorId: f.jugador_id,
    nombreLimpio: f.nombre_limpio,
    anioNacimiento: f.anio_nacimiento,
    codigos: f.codigos ?? [],
  }));
}

/**
 * filas: [{ jugadorId, plantelId | null }] (null = no sigue). Todo o nada.
 * Devuelve { pasados, cerradas }.
 */
export async function confirmarPases({ clubId, filas }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('confirmar_pases', { p_club_id: clubId, p_filas: filas });
  if (error) throw error;
  return data;
}
