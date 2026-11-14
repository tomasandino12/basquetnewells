import { serieSaltoDelPlantel, serieSprintDelPlantel, serieYoyoDelPlantel } from '@datos/fisicoDelPlantel.js';
import { DISTANCIAS_SPRINT } from '@datos/sprint.js';
import { TESTS_SALTO } from '@datos/salto.js';

// Lo puro de la pantalla Datos: textos y armado de bloques. Sin React ni red, así se prueba solo.

/** «2026-05-01» → «01/05/26». A mano: new Date('2026-05-01') es UTC y se corre un día. */
export function fechaConAnio(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
}

/** «2026-05-01» → «01/05». */
export function fechaDiaMes(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

export const minutosLegibles = (segundos: number) => `${Math.round(segundos / 60)}′`;

/**
 * «El primero concentra más de la mitad de los minutos.» Con un solo partido es común que uno solo
 * supere el 50 %: «Los primeros 1 jugadores» no es castellano. Sin nadie que concentre, no se dice nada.
 */
export function lecturaDeReparto(jugadoresQueConcentranLaMitad: number, que: string): string {
  const n = jugadoresQueConcentranLaMitad;
  if (n === 0) return '';
  const sujeto = n === 1 ? 'El primero' : `Los primeros ${n} jugadores`;
  const verbo = n === 1 ? 'concentra' : 'concentran';
  return `${sujeto} ${verbo} más de la mitad de ${que}.`;
}

/** El cambio de un bloque de fuerza, con el signo escrito: «+12%», «−3%», «0%». */
export function signoDePorcentaje(pct: number): string {
  const n = Math.round(pct);
  return n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : '0%';
}

export const chicos = (n: number) => `${n} ${n === 1 ? 'chico' : 'chicos'}`;

const coma = (n: number, decimales: number) => n.toFixed(decimales).replace('.', ',');
const miles = new Intl.NumberFormat('es-AR');

const NOMBRE_TEST_SALTO: Record<string, string> = { cmj: 'CMJ (manos en la cadera)', abalakov: 'Abalakov (brazos libres)' };

export interface PuntoDePrueba {
  fecha: string;
  valor: number;
  chicos: number;
}

export interface BloqueDePrueba {
  id: string;
  titulo: string;
  nota: string;
  serie: PuntoDePrueba[];
  /** El sprint se guarda en milisegundos y se dibuja en segundos. */
  escala: number;
  unidad: string;
  decimales: number;
  texto: (valor: number) => string;
}

/**
 * Una prueba por bloque (velocidad de cada distancia, Yo-Yo, cada salto): título, cómo se escribe un
 * valor y su serie. Sólo quedan las que el club ya cargó: si no usa una, no ocupa lugar.
 */
export function bloquesDePruebas(sprint: unknown[], yoyo: unknown[], salto: unknown[]): BloqueDePrueba[] {
  const lista: BloqueDePrueba[] = [
    ...[...DISTANCIAS_SPRINT].reverse().map((d: number) => ({
      id: `sprint-${d}`,
      titulo: `Velocidad · ${d} + ${d} metros`,
      nota: 'Tiempo de ida y vuelta: baja cuando mejoran.',
      serie: serieSprintDelPlantel(sprint, d) as PuntoDePrueba[],
      escala: 1000,
      unidad: 's',
      decimales: 1,
      texto: (v: number) => `${coma(v / 1000, 1)} s`,
    })),
    {
      id: 'yoyo',
      titulo: 'Resistencia · Yo-Yo',
      nota: 'Metros recorridos hasta el final del test.',
      serie: serieYoyoDelPlantel(yoyo) as PuntoDePrueba[],
      escala: 1,
      unidad: 'm',
      decimales: 0,
      texto: (v: number) => `${miles.format(Math.round(v))} m`,
    },
    ...(TESTS_SALTO as string[]).map((t) => ({
      id: `salto-${t}`,
      titulo: `Salto · ${NOMBRE_TEST_SALTO[t] ?? t}`,
      nota: 'Altura del mejor salto de cada chico.',
      serie: serieSaltoDelPlantel(salto, t) as PuntoDePrueba[],
      escala: 1,
      unidad: 'cm',
      decimales: 0,
      texto: (v: number) => `${coma(v, 1)} cm`,
    })),
  ];
  return lista.filter((b) => b.serie.length > 0);
}
