// Cuentas de familia (0057): el import de inscriptos que hace el entrenador, lo
// que ve la familia y el control posterior del coordinador.
// Se importa a través de src/data/repositorio.js (fachada).
//
// La familia no consulta ninguna tabla: vincular_por_mail() y mis_chicos() son
// funciones que corren como dueño y devuelven sólo lo suyo. Los mails de los
// responsables sí son una tabla (responsable_jugador), pero la lee sólo el
// entrenador del plantel.
import { obtenerCliente } from '../cliente.js';

/**
 * Importa la planilla ya revisada de un plantel, en una transacción. `filas`:
 * [{ jugadorId } | { nombreClave, nombreLimpio, desambiguador? }, con
 * fechaNacimiento y mails]. Devuelve { creados, existentes, mails }.
 * Errores con message 'JUGADOR_DE_OTRO_CLUB', 'JUGADOR_YA_EXISTE' o
 * 'FECHA_NACIMIENTO_REQUERIDA', seguidos de "(fila N)".
 */
export async function importarInscriptos({ plantelId, filas }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('importar_inscriptos', { payload: { plantelId, filas } });
  if (error) throw error;
  return data;
}

/**
 * Al entrar sin club: crea los vínculos que falten para el mail de quien llama
 * y devuelve cuántos nuevos. Lanza el 42501 de siempre si la cuenta es del
 * cuerpo técnico o de un jugador: quien lo llama lo trata como "no es familia".
 */
export async function vincularPorMail() {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('vincular_por_mail');
  if (error) throw error;
  return data;
}

/** Los chicos vinculados a quien llama. Vacío si no tiene ninguno. */
export async function obtenerMisChicos() {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('mis_chicos');
  if (error) throw error;
  return data.map((f) => ({
    vinculoId: f.vinculo_id, nombre: f.nombre, clubNombre: f.club_nombre, categorias: f.categorias,
  }));
}

/** Los vínculos vigentes del club, para el coordinador. El mail viene enmascarado. */
export async function obtenerVinculosFamiliaDelClub(clubId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('vinculos_familia_del_club', { p_club_id: clubId });
  if (error) throw error;
  return data.map((f) => ({
    id: f.id, jugador: f.jugador, categorias: f.categorias, desde: f.desde, via: f.via,
    nombre: f.nombre, emailEnmascarado: f.email_enmascarado,
  }));
}

/** Da de baja un vínculo: lo cierra, no lo borra. Sólo coordinación. */
export async function cerrarVinculoFamilia(vinculoId) {
  const supabase = obtenerCliente();
  const { error } = await supabase.rpc('cerrar_vinculo_familia', { p_vinculo_id: vinculoId });
  if (error) throw error;
}

/* ---------- Mails de los responsables (los ve y corrige el profe) ---------- */

export async function obtenerResponsablesDeJugador(jugadorId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('responsable_jugador')
    .select('id, email')
    .eq('jugador_id', jugadorId)
    .order('cargado_en');
  if (error) throw error;
  return data.map((f) => ({ id: f.id, email: f.email }));
}

export async function agregarResponsable(clubId, jugadorId, email) {
  const supabase = obtenerCliente();
  const { error } = await supabase
    .from('responsable_jugador')
    .insert({ club_id: clubId, jugador_id: jugadorId, email });
  if (error) throw error;
}

export async function quitarResponsable(responsableId) {
  const supabase = obtenerCliente();
  const { error } = await supabase.from('responsable_jugador').delete().eq('id', responsableId);
  if (error) throw error;
}
