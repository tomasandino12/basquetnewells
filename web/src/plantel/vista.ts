import type { Jugador, Posicion } from './tipos';

export const POSICIONES: Posicion[] = ['Base', 'Escolta', 'Alero', 'Ala-pívot', 'Pívot'];

// Sin tildes y en minúscula, para que «ramirez» encuentre «Ramírez».
const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function nombreCompleto(j: Jugador): string {
  return `${j.nombre} ${j.apellido}`;
}

/** Busca por nombre, apellido o número y filtra por posición; ordena por apellido. */
export function filtrarPlantel(jugadores: Jugador[], texto: string, posicion: Posicion | null): Jugador[] {
  const q = plano(texto.trim());
  return jugadores
    .filter((j) => (posicion ? j.posicion === posicion : true))
    .filter((j) => !q || plano(nombreCompleto(j)).includes(q) || String(j.numero ?? '') === q)
    .sort((a, b) => a.apellido.localeCompare(b.apellido, 'es'));
}

/** «12,4» o «—» si no se sabe: un hueco no es un cero. */
export function cifra(valor: number | null, decimales = 1): string {
  return valor === null ? '—' : valor.toFixed(decimales).replace('.', ',');
}

export function porcentaje(valor: number | null): string {
  return valor === null ? '—' : `${Math.round(valor)}%`;
}
