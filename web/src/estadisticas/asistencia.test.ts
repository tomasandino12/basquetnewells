import { describe, expect, it } from 'vitest';
import type { Entrenamiento } from '../datos/repositorio';
import { asistenciaPorChico, asistenciaPorDia, grillaDeAsistencia } from './asistencia';

const dia = (fecha: string, filas: [string, 'presente' | 'ausente' | 'justificada'][], hubo = true): Entrenamiento => ({
  id: fecha, fecha, hubo, filas: filas.map(([jugadorId, estado]) => ({ jugadorId, estado })),
});

const LISTA = [
  dia('2026-10-03', [['a', 'presente'], ['b', 'ausente']]),
  dia('2026-10-01', [['a', 'ausente'], ['b', 'presente']]),
  dia('2026-10-02', [], true),
  dia('2026-10-04', [['a', 'presente']], false),
  dia('2026-10-05', [['a', 'presente'], ['b', 'justificada']]),
];

describe('asistencia', () => {
  it('por día: sólo los días que hubo y con alguien marcado, del más viejo al más nuevo', () => {
    expect(asistenciaPorDia(LISTA)).toEqual([
      { fecha: '2026-10-01', presentes: 1, marcados: 2, pct: 50 },
      { fecha: '2026-10-03', presentes: 1, marcados: 2, pct: 50 },
      { fecha: '2026-10-05', presentes: 1, marcados: 2, pct: 50 },
    ]);
  });

  it('por chico: porcentaje, avisos, faltas y la racha hasta el último; el que nunca estuvo marcado no aparece', () => {
    const [a, b] = asistenciaPorChico(LISTA, ['b', 'a', 'z']);
    expect(a).toMatchObject({ jugadorId: 'a', presentes: 2, faltas: 1, avisos: 0, dias: 3, pct: 67, racha: 2 });
    expect(b).toMatchObject({ jugadorId: 'b', presentes: 1, faltas: 1, avisos: 1, pct: 33, racha: 0 });
    expect(asistenciaPorChico(LISTA, ['z'])).toEqual([]);
  });

  it('la grilla toma los últimos N días y deja null donde el chico no estaba marcado', () => {
    const g = grillaDeAsistencia([...LISTA, dia('2026-10-07', [['a', 'presente']])], ['a', 'b'], 2);
    expect(g.fechas).toEqual(['2026-10-05', '2026-10-07']);
    expect(g.filas[1]).toEqual({ jugadorId: 'b', estados: ['justificada', null] });
  });
});
