import { bloquesDeLineas, diaDeLaSemana, estadoDePlan, formatearKg, pesoSugeridoDeCarga } from '@datos/escalones.js';
import type { LineaFisico, PlanFisico, SesionFisico } from '../datos/repositorio';

/** Lógica pura de las pantallas de Físico: qué texto lleva cada cosa. Sin red ni pantalla. */

export type PlanConRango = PlanFisico & { desde: string; hasta: string };

/** «09/11»: el día y el mes de una fecha AAAA-MM-DD. */
export function fechaCorta(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

export function rangoDePlan(plan: { desde: string; hasta: string }): string {
  return plan.desde === plan.hasta ? fechaCorta(plan.desde) : `${fechaCorta(plan.desde)} al ${fechaCorta(plan.hasta)}`;
}

export function textoDeEstado(plan: { desde: string; hasta: string }, hoy: string): string {
  const estado = estadoDePlan(plan, hoy);
  if (estado === 'en_curso') return 'En curso';
  if (estado === 'proximo') return `Empieza el ${fechaCorta(plan.desde)}`;
  return `Terminó el ${fechaCorta(plan.hasta)}`;
}

/** «Lun 09/11», o «Hoy · Lun 09/11» si es hoy. */
export function diaDeSesion(fecha: string, hoy: string): string {
  const dia = `${(diaDeLaSemana(fecha) as string).slice(0, 3)} ${fechaCorta(fecha)}`;
  const mayuscula = dia.charAt(0).toUpperCase() + dia.slice(1);
  return fecha === hoy ? `Hoy · ${mayuscula}` : mayuscula;
}

/** «Lunes 09/11»: el día entero, para el título de la sesión. */
export function tituloDeSesion(fecha: string): string {
  const dia = diaDeLaSemana(fecha) as string;
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fechaCorta(fecha)}`;
}

export function resumenDeSesion(s: SesionFisico): string {
  const n = s.lineas.length;
  const bloques = bloquesDeLineas(s.lineas) as string[];
  return `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}${bloques.length ? ` · ${bloques.join(', ')}` : ''}`;
}

/** Cuántas sesiones del plan ya pasaron (antes de hoy) y cuántas hay: para la barra de avance. */
export function avanceDelPlan(sesiones: { fecha: string }[], hoy: string): { hechas: number; total: number } {
  return { hechas: sesiones.filter((s) => s.fecha < hoy).length, total: sesiones.length };
}

/** La sesión de hoy o, si no hay, la que sigue. */
export function proximaSesion<T extends { fecha: string }>(sesiones: T[], hoy: string): T | null {
  return sesiones.find((s) => s.fecha >= hoy) ?? null;
}

export function esPesoCorporal(carga: string | null): boolean {
  return carga != null && /^\s*PC\b/i.test(carga);
}

/** La carga como se lee de lejos: «10 kg» o «PC». Lo que no es ni una ni otra se muestra tal cual el archivo. */
export function cargaCorta(carga: string | null): string | null {
  if (carga == null || !carga.trim()) return null;
  if (esPesoCorporal(carga)) return 'PC';
  const kg = pesoSugeridoDeCarga(carga) as number | null;
  return kg != null ? `${formatearKg(kg)} kg` : carga.trim();
}

/** La línea de abajo de un ejercicio: series, reps y pausa, más la carga del archivo si dice algo que «10 kg» no. */
export function detalleChico(l: LineaFisico): string {
  const corta = cargaCorta(l.cargaSugerida);
  const sinEspacios = (t: string | null) => t?.replace(/\s/g, '').toLowerCase() ?? null;
  const cruda = sinEspacios(l.cargaSugerida) === sinEspacios(corta) ? null : (l.cargaSugerida?.trim() ?? null);
  return [
    l.series != null ? `${l.series} ${l.series === 1 ? 'serie' : 'series'}` : null,
    l.reps,
    l.pausa ? `pausa ${l.pausa}` : null,
    cruda && !esPesoCorporal(cruda) ? cruda : null,
  ].filter(Boolean).join(' · ');
}

/** Lo que dice la tarjeta del ejercicio sobre su escalón: los de peso corporal no lo muestran. */
export function textoDeEscalon(l: LineaFisico, paso: number | null): string {
  if (esPesoCorporal(l.cargaSugerida)) return 'peso corporal';
  return paso != null ? `Escalón ${formatearKg(paso)} kg` : 'Sin escalón';
}

/** «Apellido, Nombre» → «Apellido, N.»: en una fila angosta con un peso enorme, el apellido es lo que identifica. */
export function nombreCorto(nombreLimpio: string): string {
  const [apellido, nombre] = String(nombreLimpio).split(',');
  if (nombre == null) return String(nombreLimpio);
  const inicial = nombre.trim()[0];
  return inicial ? `${apellido.trim()}, ${inicial}.` : apellido.trim();
}

/** Un ejercicio y el que sigue/anterior en la misma sesión, para recorrerlos de a uno. */
export function vecinos<T extends { id: string }>(lineas: T[], id: string): { indice: number; anterior: T | null; siguiente: T | null } {
  const indice = lineas.findIndex((l) => l.id === id);
  return { indice, anterior: indice > 0 ? lineas[indice - 1] : null, siguiente: indice >= 0 && indice < lineas.length - 1 ? lineas[indice + 1] : null };
}
