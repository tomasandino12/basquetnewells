// Formularios del portal del básquet (0058).
// Se importa a través de src/data/repositorio.js (fachada).
import { obtenerCliente } from '../cliente.js';
import { formularioDesdeFila, formularioPublicoDesdeFila } from '../formulariosPortal.js';

const COLUMNAS = 'id, titulo, texto, enlace, orden, activo, actualizado_por, actualizado_en';

/**
 * Lo que ve el portal sin sesión: título, texto y enlace de los formularios
 * activos de un club, en orden. Es la única puerta de anon (formularios_publicos
 * de 0058): la tabla no se lee directo.
 */
export async function formulariosPublicos(clubId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('formularios_publicos', { p_club: clubId });
  if (error) throw error;
  return data.map(formularioPublicoDesdeFila);
}

/** La lista completa del panel, con los ocultos. Sólo la lee la coordinación del club (RLS de 0058). */
export async function listarFormularios(clubId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('formulario_portal')
    .select(COLUMNAS)
    .eq('club_id', clubId)
    .order('orden');
  if (error) throw error;
  return data.map(formularioDesdeFila);
}

/** Alta al final de la lista: `orden` lo calcula quien llama, a partir de lo que ya muestra. */
export async function crearFormulario({ clubId, titulo, texto, enlace, orden }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('formulario_portal')
    .insert({ club_id: clubId, titulo, texto, enlace, orden, activo: true })
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return formularioDesdeFila(data);
}

/**
 * Sólo las columnas con grant de update. Se pide la fila de vuelta porque un
 * update que la RLS no deja pasar no da error: afecta cero filas.
 */
export async function actualizarFormulario(id, { titulo, texto, enlace, activo }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('formulario_portal')
    .update({ titulo, texto, enlace, activo })
    .eq('id', id)
    .select(COLUMNAS);
  if (error) throw error;
  if (!data.length) throw new Error('NO_SE_PUDO_EDITAR');
  return formularioDesdeFila(data[0]);
}

/**
 * Guarda el orden nuevo: sólo los { id, orden } que cambiaron (ver
 * moverFormulario). Sin índice único sobre `orden`, el estado de en medio no
 * choca; si una fila falla, la pantalla recarga la lista de la base.
 */
export async function reordenarFormularios(cambios) {
  const supabase = obtenerCliente();
  for (const { id, orden } of cambios) {
    const { data, error } = await supabase.from('formulario_portal').update({ orden }).eq('id', id).select('id');
    if (error) throw error;
    if (!data.length) throw new Error('NO_SE_PUDO_EDITAR');
  }
}
