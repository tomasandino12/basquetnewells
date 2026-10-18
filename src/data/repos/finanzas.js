// Finanzas del básquet: rubros y movimientos (0054). Sólo coordinación (RLS).
// Se importa a través de src/data/repositorio.js (fachada).
import { obtenerCliente, TAMANIO_PAGINA } from '../cliente.js';
import { montoParaBase } from '../finanzas.js';

const COLUMNAS_RUBRO = 'id, nombre, tipo, activo';
const COLUMNAS_MOVIMIENTO =
  'id, rubro_id, fecha, monto, descripcion, comprobante_url, actualizado_por, actualizado_en, borrado_en';

const rubroDesdeFila = (f) => ({ id: f.id, nombre: f.nombre, tipo: f.tipo, activo: f.activo });

// La base guarda numeric(12,2); acá se pasa a centavos enteros para no sumar
// decimales en coma flotante. Doce cifras entran exactas en un Number.
const movimientoDesdeFila = (f) => ({
  id: f.id,
  rubroId: f.rubro_id,
  fecha: f.fecha,
  centavos: Math.round(Number(f.monto) * 100),
  descripcion: f.descripcion,
  comprobanteUrl: f.comprobante_url,
  actualizadoPor: f.actualizado_por,
  actualizadoEn: f.actualizado_en,
  borradoEn: f.borrado_en,
});

const filaDeMovimiento = ({ rubroId, fecha, centavos, descripcion, comprobanteUrl }) => ({
  rubro_id: rubroId,
  fecha,
  monto: montoParaBase(centavos),
  descripcion: descripcion ?? '',
  comprobante_url: comprobanteUrl || null,
});

/** Todos los rubros del club, activos o no: los inactivos siguen nombrando meses viejos. */
export async function obtenerRubros(clubId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('rubro')
    .select(COLUMNAS_RUBRO)
    .eq('club_id', clubId)
    .order('nombre');
  if (error) throw error;
  return data.map(rubroDesdeFila);
}

/** Si el nombre ya existe en el club, el índice único devuelve 23505. */
export async function agregarRubro({ clubId, nombre, tipo }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('rubro')
    .insert({ club_id: clubId, nombre, tipo })
    .select(COLUMNAS_RUBRO)
    .single();
  if (error) throw error;
  return rubroDesdeFila(data);
}

/** Sólo nombre y activo: el tipo no cambia (no tiene grant de update). */
export async function editarRubro(id, cambios) {
  const fila = {};
  if ('nombre' in cambios) fila.nombre = cambios.nombre;
  if ('activo' in cambios) fila.activo = cambios.activo;
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('rubro')
    .update(fila)
    .eq('id', id)
    .select(COLUMNAS_RUBRO);
  if (error) throw error;
  if (!data.length) throw new Error('NO_SE_PUDO_EDITAR');
  return rubroDesdeFila(data[0]);
}

/** Los movimientos no borrados con fecha en [desde, hasta). */
export async function obtenerMovimientosDelPeriodo(clubId, { desde, hasta }) {
  const supabase = obtenerCliente();
  const filas = [];
  let inicio = 0;
  for (;;) {
    const { data: pagina, error } = await supabase
      .from('movimiento')
      .select(COLUMNAS_MOVIMIENTO)
      .eq('club_id', clubId)
      .is('borrado_en', null)
      .gte('fecha', desde)
      .lt('fecha', hasta)
      .order('fecha', { ascending: false })
      .order('id')
      .range(inicio, inicio + TAMANIO_PAGINA - 1);
    if (error) throw error;
    filas.push(...pagina);
    if (pagina.length < TAMANIO_PAGINA) break;
    inicio += TAMANIO_PAGINA;
  }
  return filas.map(movimientoDesdeFila);
}

/** Un movimiento (para editarlo). null si no existe o no se puede ver. */
export async function obtenerMovimiento(id) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('movimiento')
    .select(COLUMNAS_MOVIMIENTO)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? movimientoDesdeFila(data) : null;
}

export async function agregarMovimiento({ clubId, ...movimiento }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('movimiento')
    .insert({ club_id: clubId, ...filaDeMovimiento(movimiento) })
    .select(COLUMNAS_MOVIMIENTO)
    .single();
  if (error) throw error;
  return movimientoDesdeFila(data);
}

/**
 * Se pide la fila de vuelta porque un update que la RLS no deja pasar no da
 * error: afecta cero filas. El rastro lo deja un trigger en la misma sentencia.
 */
export async function editarMovimiento(id, movimiento) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('movimiento')
    .update(filaDeMovimiento(movimiento))
    .eq('id', id)
    .select(COLUMNAS_MOVIMIENTO);
  if (error) throw error;
  if (!data.length) throw new Error('NO_SE_PUDO_EDITAR');
  return movimientoDesdeFila(data[0]);
}

/**
 * Baja lógica: se manda cualquier borrado_en y el trigger lo pisa con la hora
 * y el usuario del servidor. La fila queda en la base con su rastro.
 */
export async function borrarMovimiento(id) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase
    .from('movimiento')
    .update({ borrado_en: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data.length) throw new Error('NO_SE_PUDO_EDITAR');
}
