import { describe, expect, it } from 'vitest';
import type { PlantelDelClub } from '../datos/repositorio';
import { plantelesVisibles } from './visibles';

const p = (id: string, categoria: string): PlantelDelClub => ({ id, categoria, categoriaCodigo: null, codigoCabb: null, temporadaId: null });
const todos = [p('a', 'Sub 15'), p('b', 'Sub 9'), p('c', 'Sub 13')];

describe('plantelesVisibles', () => {
  it('el entrenador puro ve sólo los asignados', () => {
    const r = plantelesVisibles(todos, { esEntrenador: true, esCoordinador: false }, new Set(['c']));
    expect(r.map((x) => x.id)).toEqual(['c']);
  });

  it('quien coordina ve todos, aunque también entrene', () => {
    const r = plantelesVisibles(todos, { esEntrenador: true, esCoordinador: true }, new Set(['c']));
    expect(r).toHaveLength(3);
  });

  it('ordena por categoría con los números en orden natural y sin tocar la lista original', () => {
    const r = plantelesVisibles(todos, { esEntrenador: false, esCoordinador: true }, new Set());
    expect(r.map((x) => x.categoria)).toEqual(['Sub 9', 'Sub 13', 'Sub 15']);
    expect(todos[0].id).toBe('a');
  });
});
