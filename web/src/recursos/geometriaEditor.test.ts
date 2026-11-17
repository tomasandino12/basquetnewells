import { describe, expect, it } from 'vitest';
import { MARGEN, W, altoDe } from '@datos/geometriaCancha.js';
import type { DatosDePizarra } from '../datos/repositorio';
import { fichaEnPunto, puntoDesdeToque } from './geometriaEditor';

const datos: DatosDePizarra = {
  cancha: 'media',
  fichas: [
    { id: 'a1', tipo: 'ataque', numero: 1, x: 0.5, y: 0.5 },
    { id: 'a2', tipo: 'ataque', numero: 2, x: 0.8, y: 0.5 },
  ],
  pasos: [],
};

describe('geometría del editor', () => {
  it('el centro del dibujo es el centro de la cancha, aunque sobren franjas a los costados', () => {
    const alto = altoDe('media') as number;
    const proporcion = ((W as number) + (MARGEN as number) * 2) / (alto + (MARGEN as number) * 2);
    const caja = { left: 10, top: 20, width: 600 * proporcion + 200, height: 600 };
    const p = puntoDesdeToque(caja, 'media', caja.left + caja.width / 2, caja.top + caja.height / 2);
    expect(p.x).toBeCloseTo(0.5, 3);
    expect(p.y).toBeCloseTo(0.5, 3);
  });

  it('recorta a la cancha más la banda de afuera', () => {
    const p = puntoDesdeToque({ left: 0, top: 0, width: 300, height: 300 }, 'media', -5000, 9000);
    expect(p.x).toBeLessThan(0);
    expect(p.x).toBeGreaterThan(-0.2);
    expect(p.y).toBeGreaterThan(1);
    expect(p.y).toBeLessThan(1.3);
  });

  it('encuentra la ficha tocada y devuelve null si el toque cae lejos', () => {
    const alto = altoDe('media') as number;
    const pos = new Map<string, { x: number; y: number }>();
    expect(fichaEnPunto(datos, pos, 0.5 * (W as number) + 3, 0.5 * alto - 2)).toBe('a1');
    expect(fichaEnPunto(datos, pos, 0.8 * (W as number), 0.5 * alto)).toBe('a2');
    expect(fichaEnPunto(datos, pos, 0.65 * (W as number), 0.2 * alto)).toBeNull();
  });

  it('usa la posición del paso en vez de la de la formación inicial', () => {
    const alto = altoDe('media') as number;
    const pos = new Map([['a1', { x: 0.1, y: 0.1 }]]);
    expect(fichaEnPunto(datos, pos, 0.1 * (W as number), 0.1 * alto)).toBe('a1');
    expect(fichaEnPunto(datos, pos, 0.5 * (W as number), 0.5 * alto)).toBeNull();
  });
});
