import { describe, expect, it } from 'vitest';
import { TEMAS } from '@datos/temas.js';
import { TIPOS_JUGADA } from '@datos/jugadas.js';
import { colorDeTema, colorDeTipo } from './colores';

describe('colores de tema y de tipo', () => {
  it('cada tema de la lista tiene su color y no se repiten (salvo «otro», que es neutro)', () => {
    const colores = (TEMAS as { id: string }[]).filter((t) => t.id !== 'otro').map((t) => colorDeTema(t.id));
    expect(new Set(colores).size).toBe(colores.length);
    for (const c of colores) expect(c).toMatch(/^bg-\S+ text-\S+/);
  });

  it('cada tipo de jugada tiene color, y uno que ya no existe se ve neutro en vez de romper', () => {
    for (const t of TIPOS_JUGADA as { clave: string }[]) expect(colorDeTipo(t.clave)).toMatch(/^bg-/);
    expect(colorDeTema('un-tema-viejo')).toBe(colorDeTema('otro'));
    expect(colorDeTema(null)).toBe(colorDeTema('otro'));
    expect(colorDeTipo(undefined)).toBe(colorDeTipo('otro'));
  });

  it('usa solo colores de la paleta: ningún valor suelto', () => {
    const todo = [...(TEMAS as { id: string }[]).map((t) => colorDeTema(t.id)), ...(TIPOS_JUGADA as { clave: string }[]).map((t) => colorDeTipo(t.clave))].join(' ');
    expect(todo).not.toMatch(/#[0-9a-f]{3,8}|\[.*\]/i);
  });
});
