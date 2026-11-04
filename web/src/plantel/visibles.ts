import type { PlantelDelClub, Roles } from '../datos/repositorio';

/**
 * Qué planteles muestra la lista: el entrenador puro, sólo los asignados (como el modo entrenar
 * de la app actual); quien coordina, todos los del club. La base ya filtra lo que no se puede ver:
 * esto sólo ordena la pantalla.
 */
export function plantelesVisibles(
  planteles: PlantelDelClub[],
  roles: Roles,
  asignados: ReadonlySet<string>,
): PlantelDelClub[] {
  const lista = roles.esEntrenador && !roles.esCoordinador ? planteles.filter((p) => asignados.has(p.id)) : planteles;
  return [...lista].sort((a, b) => a.categoria.localeCompare(b.categoria, 'es', { numeric: true }));
}
