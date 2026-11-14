import { describe, expect, it } from 'vitest';
import { categoriasDelEntrenador } from './categorias';

const plantel = (id: string, categoria: string, categoriaCodigo: string | null, temporadaId: string | null) => ({
  id, categoria, categoriaCodigo, codigoCabb: null, temporadaId,
});
const CATALOGO = [
  { codigo: 'U13', nombre: 'Sub 13', orden: 1 },
  { codigo: 'U15', nombre: 'Sub 15', orden: 2 },
  { codigo: 'U17', nombre: 'Sub 17', orden: 3 },
];
const TEMPORADAS = [{ id: 't-25', nombre: '2025' }, { id: 't-26', nombre: '2026' }];

describe('categorías a cargo de un entrenador', () => {
  it('sólo las asignadas, en el orden del catálogo y no en el de la lista', () => {
    const planteles = [plantel('a', 'Sub 17', 'U17', 't-26'), plantel('b', 'Sub 13', 'U13', 't-26'), plantel('c', 'Sub 15', 'U15', 't-26')];
    expect(categoriasDelEntrenador({ planteles, asignados: new Set(['a', 'b']), catalogo: CATALOGO, temporadas: TEMPORADAS })).toEqual(['Sub 13', 'Sub 17']);
  });

  it('la de otra temporada lleva el año; la de la temporada actual va sola', () => {
    const planteles = [plantel('a', 'Sub 13', 'U13', 't-25'), plantel('b', 'Sub 15', 'U15', 't-26')];
    expect(categoriasDelEntrenador({ planteles, asignados: new Set(['a', 'b']), catalogo: CATALOGO, temporadas: TEMPORADAS })).toEqual(['Sub 13 2025', 'Sub 15']);
  });

  it('una categoría fuera del catálogo va al final, sin romper', () => {
    const planteles = [plantel('a', 'Mini', null, 't-26'), plantel('b', 'Sub 13', 'U13', 't-26')];
    expect(categoriasDelEntrenador({ planteles, asignados: new Set(['a', 'b']), catalogo: CATALOGO, temporadas: TEMPORADAS })).toEqual(['Sub 13', 'Mini']);
  });

  it('sin asignaciones no hay nada', () => {
    expect(categoriasDelEntrenador({ planteles: [plantel('a', 'Sub 13', 'U13', 't-26')], asignados: new Set(), catalogo: CATALOGO, temporadas: TEMPORADAS })).toEqual([]);
  });
});
