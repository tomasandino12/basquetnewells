import { temporadaMasReciente } from '@datos/coordinacion.js';
import type { CategoriaDelCatalogo, Temporada } from '../datos/repositorioCoord';
import type { PlantelDelClub } from '../datos/repositorio';

interface Entrada {
  planteles: PlantelDelClub[];
  asignados: Set<string>;
  catalogo: CategoriaDelCatalogo[];
  temporadas: Temporada[];
}

/**
 * Las categorías a cargo de un entrenador, en el orden del catálogo. La de la temporada actual va
 * sola («Sub 13»); la de otra temporada lleva el año («Sub 13 2025»), así no se confunden.
 */
export function categoriasDelEntrenador({ planteles, asignados, catalogo, temporadas }: Entrada): string[] {
  const orden = new Map(catalogo.map((c) => [c.codigo, c.orden]));
  const nombreTemporada = new Map(temporadas.map((t) => [t.id, t.nombre]));
  const actual = temporadaMasReciente(temporadas) as Temporada | null;
  const posicion = (p: PlantelDelClub) => (p.categoriaCodigo ? orden.get(p.categoriaCodigo) : undefined) ?? Infinity;
  return planteles
    .filter((p) => asignados.has(p.id))
    .sort((a, b) => posicion(a) - posicion(b))
    .map((p) => (p.temporadaId === actual?.id ? p.categoria : `${p.categoria} ${(p.temporadaId && nombreTemporada.get(p.temporadaId)) ?? ''}`.trim()));
}
