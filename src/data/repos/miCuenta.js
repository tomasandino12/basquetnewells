// Lo que lee un jugador con cuenta propia: su ficha, sus recursos, su plan y su
// progreso. Se importa a través de src/data/repositorio.js (fachada).
//
// No consulta ninguna tabla: el jugador no tiene `select` sobre ninguna (0030).
// Cada función llama a su RPC, que corre como dueño y devuelve sólo lo suyo. Por
// eso estas pantallas no reusan los repos del cuerpo técnico.
import { obtenerCliente } from '../cliente.js';

// Las RPC devuelven jsonb ya en camelCase; los mappers fijan la forma del
// dominio y convierten los numeric (kg, segundos), que pueden llegar como texto.
const numeroONulo = (v) => (v == null ? null : Number(v));

const lineaDesdeJson = (l) => ({
  id: l.id,
  orden: l.orden,
  bloque: l.bloque,
  nombreOriginal: l.nombreOriginal,
  series: l.series,
  reps: l.reps,
  cargaSugerida: l.cargaSugerida,
  pausa: l.pausa,
  notas: l.notas,
  video: l.video ? { nombre: l.video.nombre, link: l.video.link } : null,
});

const planDesdeJson = (p) => ({
  planId: p.planId,
  plantelId: p.plantelId,
  categoria: p.categoria,
  nombreArchivo: p.nombreArchivo,
  sesiones: (p.sesiones ?? []).map((s) => ({ id: s.id, fecha: s.fecha, lineas: (s.lineas ?? []).map(lineaDesdeJson) })),
});

/**
 * Null si quien llama no es un jugador con cuenta vigente: es la señal con la
 * que el arranque decide entre el shell del jugador y "todavía no tenés club".
 */
export async function obtenerMiFicha() {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('mi_ficha');
  if (error) throw error;
  if (!data) return null;
  return {
    jugadorId: data.jugadorId,
    clubId: data.clubId,
    clubNombre: data.clubNombre,
    nombre: data.nombre,
    planteles: (data.planteles ?? []).map((p) => ({
      plantelId: p.plantelId,
      categoriaCodigo: p.categoriaCodigo,
      categoria: p.categoria,
    })),
  };
}

/**
 * Anota que el jugador abrió un recurso (la primera vez cuenta; la base ignora
 * las siguientes y también lo que no se le envió). El profe ve sólo cuántos
 * abrieron, nunca quién (0034). No es algo que el jugador espere: nunca lanza.
 */
export async function registrarAperturaDeRecurso(recursoId) {
  try {
    await obtenerCliente().rpc('registrar_apertura', { p_recurso_id: recursoId });
  } catch {
    // Sin conexión o cualquier falla: el recurso se abre igual.
  }
}

// Las marcas de práctica: { fecha, recursoId }. recursoId es null si el recurso
// se borró (la marca queda, para que el día no se pierda).
const practicaDesdeFila = (f) => ({ fecha: f.fecha, recursoId: f.recursoId ?? null });

/**
 * Sus marcas de práctica de las últimas 12 semanas (0068). Null si quien llama
 * no tiene cuenta de jugador vigente: se conserva, no se vuelve [].
 */
export async function misPracticas() {
  const { data, error } = await obtenerCliente().rpc('mis_practicas');
  if (error) throw error;
  return data ? data.map(practicaDesdeFila) : null;
}

/**
 * Marca (o, con `hecho` false, desmarca) que hoy practicó ese recurso. La fecha
 * la pone el servidor: nunca se manda. Devuelve las marcas ya actualizadas, o
 * null si no es un jugador con cuenta. Un recurso que no se le envió no anota
 * nada y tampoco da error (la base no deja averiguar qué recursos existen).
 */
export async function marcarPractica(recursoId, hecho) {
  const { data, error } = await obtenerCliente().rpc('marcar_practica', { p_recurso_id: recursoId, p_hecho: hecho });
  if (error) throw error;
  return data ? data.map(practicaDesdeFila) : null;
}

/**
 * Su asistencia de los últimos 12 meses, un día por fecha: `vino` es true,
 * false o null. Null es «no se tomó» o «pausa por lesión»: no suma ni corta la
 * racha, y no se vuelve false. Sin motivo ni lesión (0068).
 */
export async function miAsistencia() {
  const { data, error } = await obtenerCliente().rpc('mi_asistencia');
  if (error) throw error;
  return data ? data.map((d) => ({ fecha: d.fecha, vino: d.vino ?? null })) : null;
}

export async function obtenerMisRecursos() {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('mis_recursos');
  if (error) throw error;
  return data.map((f) => ({
    id: f.recurso_id,
    titulo: f.titulo,
    descripcion: f.descripcion,
    enlace: f.enlace,
    fecha: f.fecha,
    // Desde 0069. Null es «el profe no lo cargó»: el check de Inicio lo ofrece igual.
    tipo: f.tipo ?? null,
    frecuenciaSemanal: f.frecuencia_semanal ?? null,
  }));
}

/**
 * Un plan por cada plantel del jugador, ya elegido en la base, más su último
 * peso en cada ejercicio (`pesos`, con la clave del ejercicio: planDelJugador.js
 * los une a cada línea).
 */
export async function obtenerMiPlan() {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('mi_plan');
  if (error) throw error;
  return {
    planes: (data?.planes ?? []).map(planDesdeJson),
    pesos: (data?.pesos ?? []).map((p) => ({ clave: p.clave, nombre: p.nombre, kg: Number(p.kg) })),
  };
}

/**
 * Todo lo del jugador, con la forma que esperan las funciones de
 * estadisticas.js: `partidos` trae el partido y su fila de estadística juntos.
 */
export async function obtenerMiProgreso() {
  const supabase = obtenerCliente();
  const { data, error } = await supabase.rpc('mi_progreso');
  if (error) throw error;
  return {
    partidos: data?.partidos ?? [],
    tiro: data?.tiro ?? [],
    // Un ausente llega con tiempoVueloMs null: se preserva, no se vuelve 0.
    saltos: (data?.saltos ?? []).map((s) => ({
      ...s,
      intentos: (s.intentos ?? []).map((i) => ({ ...i, tiempoVueloMs: numeroONulo(i.tiempoVueloMs) })),
    })),
    // Igual: un ausente llega con tiempoMs null.
    sprints: (data?.sprints ?? []).map((s) => ({
      ...s,
      intentos: (s.intentos ?? []).map((i) => ({ ...i, tiempoMs: numeroONulo(i.tiempoMs), parcialMs: numeroONulo(i.parcialMs) })),
    })),
    // Un ausente llega con idas null: se preserva, no se vuelve 0.
    yoyos: (data?.yoyos ?? []).map((y) => ({ ...y, idas: numeroONulo(y.idas) })),
    escalones: (data?.escalones ?? []).map((e) => ({ ...e, kg: Number(e.kg) })),
  };
}
