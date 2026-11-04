import { describe, expect, it } from 'vitest';
import { plantelDemo } from '../mocks/plantelDemo';
import { cifra, filtrarPlantel, porcentaje } from './vista';

describe('filtrarPlantel', () => {
  it('sin filtros devuelve a todos, ordenados por apellido', () => {
    const r = filtrarPlantel(plantelDemo, '', null);
    expect(r).toHaveLength(plantelDemo.length);
    expect(r[0].apellido).toBe('Acosta');
  });

  it('busca sin importar tildes ni mayúsculas', () => {
    expect(filtrarPlantel(plantelDemo, 'BENITEZ', null).map((j) => j.id)).toEqual(['j2']);
    expect(filtrarPlantel(plantelDemo, 'dominguez', null).map((j) => j.id)).toEqual(['j4']);
  });

  it('busca por número exacto', () => {
    expect(filtrarPlantel(plantelDemo, '12', null).map((j) => j.id)).toEqual(['j5']);
  });

  it('filtra por posición y combina con la búsqueda', () => {
    expect(filtrarPlantel(plantelDemo, '', 'Pívot').map((j) => j.id).sort()).toEqual(['j5', 'j9']);
    expect(filtrarPlantel(plantelDemo, 'gael', 'Pívot')).toHaveLength(1);
    expect(filtrarPlantel(plantelDemo, 'gael', 'Base')).toHaveLength(0);
  });

  it('no muta la lista original', () => {
    const antes = plantelDemo.map((j) => j.id);
    filtrarPlantel(plantelDemo, '', null);
    expect(plantelDemo.map((j) => j.id)).toEqual(antes);
  });
});

describe('formatos', () => {
  it('un dato que no se sabe se muestra como raya, nunca como cero', () => {
    expect(cifra(null)).toBe('—');
    expect(porcentaje(null)).toBe('—');
    expect(cifra(0)).toBe('0,0');
  });

  it('usa coma decimal', () => {
    expect(cifra(11.4)).toBe('11,4');
    expect(porcentaje(31.4)).toBe('31%');
  });
});
