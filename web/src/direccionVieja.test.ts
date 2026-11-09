import { describe, expect, it } from 'vitest';
import { direccionLimpia } from './direccionVieja';

describe('direcciones viejas con #', () => {
  it('saca el id de la categoría de la dirección y lo guarda', () => {
    const guardados: string[] = [];
    expect(direccionLimpia('#/hoy/20000000-0000-0000-0000-000000000004', '/app', (id) => guardados.push(id))).toBe('/app/hoy');
    expect(direccionLimpia('#/plantel/p-1?jugador=j-1', '/app', (id) => guardados.push(id))).toBe('/app/plantel?jugador=j-1');
    expect(direccionLimpia('#/asistencia/p-1/historial', '/app', (id) => guardados.push(id))).toBe('/app/asistencia/historial');
    expect(guardados).toEqual(['20000000-0000-0000-0000-000000000004', 'p-1', 'p-1']);
  });

  it('las demás pierden el # y sin # no cambia nada', () => {
    expect(direccionLimpia('#/maqueta/plantel', '/app', () => {})).toBe('/app/maqueta/plantel');
    expect(direccionLimpia('', '/app', () => {})).toBeNull();
    expect(direccionLimpia('#type=recovery', '/app', () => {})).toBeNull();
  });
});
