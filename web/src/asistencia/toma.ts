// Lógica de la toma de asistencia que la pantalla necesita. Las reglas viven en src/data/asistencia.js
// (las comparte la app vieja); acá sólo se les pone tipo y se arma lo que es propio de React.
import {
  ETIQUETAS,
  accionesDeTarjeta,
  alternar,
  contarEstados,
  filasParaGuardar,
  huboCambios,
  lesionadoEn,
  resumenDelDia,
} from '@datos/asistencia.js';
import type { EstadoAsistencia, Entrenamiento, JugadorDelPlantel, Lesion } from '../datos/repositorio';

/** null es «sin tomar»: nadie dijo que faltó, y no se guarda. */
export type Estado = EstadoAsistencia | null;

export interface Tarjeta {
  jugadorId: string;
  estado: Estado;
}

export const etiqueta = (clave: string): string => (ETIQUETAS as Record<string, string>)[clave] ?? clave;

export const ordenarPorNombre = (jugadores: JugadorDelPlantel[]): JugadorDelPlantel[] =>
  [...jugadores].sort((a, b) => a.nombreLimpio.localeCompare(b.nombreLimpio, 'es'));

/** Cómo arranca la toma de un día: lo ya guardado, y lo que no tiene fila queda sin tomar. */
export function tarjetasIniciales(jugadores: JugadorDelPlantel[], guardado: Entrenamiento | null): Tarjeta[] {
  const estados = new Map((guardado?.filas ?? []).map((f) => [f.jugadorId, f.estado]));
  return jugadores.map((j) => ({ jugadorId: j.id, estado: estados.get(j.id) ?? null }));
}

/** Un toque: de presente pasa a ausente; de cualquier otro (incluido sin tomar y justificada) a presente. */
export const tocarTarjeta = (tarjetas: Tarjeta[], jugadorId: string): Tarjeta[] =>
  tarjetas.map((t) => (t.jugadorId === jugadorId ? { ...t, estado: alternar(t.estado) as Estado } : t));

export const ponerEstado = (tarjetas: Tarjeta[], jugadorId: string, estado: Estado): Tarjeta[] =>
  tarjetas.map((t) => (t.jugadorId === jugadorId ? { ...t, estado } : t));

export const contar = (tarjetas: Tarjeta[]): { total: number; presentes: number; sinTomar: number } =>
  contarEstados(tarjetas);

export const filasAGuardar = (tarjetas: Tarjeta[]): { jugadorId: string; estado: EstadoAsistencia }[] =>
  filasParaGuardar(tarjetas);

/** ¿Hay algo distinto de lo que se cargó? Con «no hubo entrenamiento» las marcas no cuentan: no se guardan. */
export function hayCambios(d: { inicial: Tarjeta[]; actual: Tarjeta[]; hubo: boolean; huboInicial: boolean }): boolean {
  return d.hubo !== d.huboInicial || (d.hubo && huboCambios(d.inicial, d.actual));
}

export const lesionDe = (lesiones: Lesion[], jugadorId: string): Lesion[] => lesiones.filter((l) => l.jugadorId === jugadorId);

export const estabaLesionado = (lesiones: Lesion[], fecha: string): boolean => lesionadoEn(lesiones, fecha);

/** Qué ofrece el menú de un chico ese día: justificada, lesión nueva o dar el alta (id de la lesión abierta). */
export function accionesDelMenu(estado: Estado, lesiones: Lesion[], fecha: string): {
  justificada: boolean;
  lesionar: boolean;
  altaDe: string | null;
} {
  return accionesDeTarjeta({ estado, lesiones, fecha });
}

/** Un día futuro, vacío o mal escrito no se puede tomar: la base lo rechaza (FECHA_FUTURA). */
export const esFechaTomable = (texto: string, hoy: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(texto) && texto <= hoy;

/** «mié 29/10»: el día de la semana ayuda a reconocer el entrenamiento. */
export function textoDeFecha(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = new Date(a, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '');
  return `${dia} ${d}/${m}`;
}

export type DetalleDelDia =
  | { tipo: 'sin-entrenamiento' }
  | { tipo: 'sin-tomar' }
  | { tipo: 'tomado'; presentes: number; tomados: number };

/** Un día de la lista del historial: cuántos vinieron de los que se tomaron. */
export function detalleDelDia(dia: Entrenamiento): DetalleDelDia {
  const r = resumenDelDia(dia) as { hubo: boolean; presentes: number; tomados: number };
  if (!r.hubo) return { tipo: 'sin-entrenamiento' };
  if (!r.tomados) return { tipo: 'sin-tomar' };
  return { tipo: 'tomado', presentes: r.presentes, tomados: r.tomados };
}
