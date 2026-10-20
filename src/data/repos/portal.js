// Formularios del portal del básquet (0058).
// Se importa a través de src/data/repositorio.js (fachada).
import { obtenerCliente } from '../cliente.js';
import { formularioDesdeFila, formularioPublicoDesdeFila } from '../formulariosPortal.js';
import { rangoDelMes, urlEventos, eventoDesdeGoogle } from '../agenda.js';

const COLUMNAS = 'id, titulo, texto, enlace, orden, activo, destino, actualizado_por, actualizado_en';

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
export async function crearFormulario({ clubId, titulo, texto, enlace, orden, destino = null }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('formulario_portal')
    .insert({ club_id: clubId, titulo, texto, enlace, orden, activo: true, destino })
    .select(COLUMNAS)
    .single();
  if (error) throw error;
  return formularioDesdeFila(data);
}

/**
 * Sólo las columnas con grant de update. Se pide la fila de vuelta porque un
 * update que la RLS no deja pasar no da error: afecta cero filas.
 */
export async function actualizarFormulario(id, { titulo, texto, enlace, activo, destino }) {
  const supabase = obtenerCliente();
  // `destino` sólo se escribe si se pasa (null lo saca): una pantalla que edita
  // otra cosa, como ocultar, no tiene que borrárselo sin querer.
  const cambios = { titulo, texto, enlace, activo };
  if (destino !== undefined) cambios.destino = destino;
  const { data, error } = await supabase
    .from('formulario_portal')
    .update(cambios)
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

/**
 * Cambia sólo el destino de un formulario (o se lo saca con null). Hay a lo
 * sumo un formulario por destino y club (índice único de 0061): para pasárselo
 * a otro, primero se le saca al que lo tiene (esta función con null) y después
 * se lo pone al nuevo, en ese orden.
 */
export async function asignarDestinoFormulario(id, destino) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.from('formulario_portal').update({ destino }).eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('NO_SE_PUDO_EDITAR');
}

/**
 * Los eventos de un mes (1–12) de los calendarios públicos del club, de
 * Google Calendar. Un calendario que falla (ID mal copiado, sin internet, la
 * clave rechazada) no tira los demás: se cuenta en `fallidos` y la página lo
 * avisa. Uno sin ID o sin clave válida ni se pide.
 */
export async function eventosDelMes(calendarios, clave, anio, mes) {
  const rango = rangoDelMes(anio, mes);
  const listas = await Promise.all(calendarios.map(async ({ tipo, id }) => {
    const url = urlEventos(id, clave, rango);
    if (!url) return [];
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const { items } = await r.json();
      return (items ?? []).map((item) => eventoDesdeGoogle(item, tipo)).filter(Boolean);
    } catch {
      return null;
    }
  }));
  return { eventos: listas.flatMap((l) => l ?? []), fallidos: listas.filter((l) => l == null).length };
}
