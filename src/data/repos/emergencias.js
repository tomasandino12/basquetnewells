// Datos de emergencia del chico (0059). Salud de menores: lo ve el profe del
// plantel y el coordinador, lo decide la base. Nada de esto se guarda en el
// celular: ni caché ni localStorage; se pide al abrir y vive en pantalla.
// Se importa a través de src/data/repositorio.js (fachada).
import { obtenerCliente } from '../cliente.js';

function emergenciaDesdeFila(f) {
  return {
    jugadorId: f.jugador_id,
    nombreLimpio: f.nombre_limpio,
    telefonoAdulto: f.telefono_adulto,
    contactoUrgencia: f.contacto_urgencia,
    alertas: f.alertas ?? [],
    alergias: f.alergias,
    medicacion: f.medicacion,
    indicacion: f.indicacion,
    obraSocial: f.obra_social,
    actualizadoEn: f.actualizado_en,
    // Sin fila de emergencia, la lista igual trae al chico con todo en NULL.
    cargado: f.actualizado_en != null,
  };
}

/** Todos los chicos vigentes del plantel, con o sin datos de emergencia. */
export async function obtenerEmergenciasDelPlantel(plantelId) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('emergencias_del_plantel', { p_plantel_id: plantelId });
  if (error) throw error;
  return data.map(emergenciaDesdeFila);
}

/** Pisa la emergencia de cada chico de la tanda. Devuelve { guardados }. */
export async function importarEmergencias({ plantelId, filas }) {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('importar_emergencias', { payload: { plantelId, filas } });
  if (error) throw error;
  return data;
}
