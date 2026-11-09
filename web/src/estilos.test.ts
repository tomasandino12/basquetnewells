// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Se lee el archivo tal cual: con `?raw` Vitest entrega el CSS vacío.
const css = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8');
const diseno = readFileSync(new URL('../../DESIGN.md', import.meta.url), 'utf8');
const seccion = diseno.slice(diseno.indexOf('# Sistema de la app nueva'));

/** Valor de un token dentro de un bloque (`:root` o el del tema oscuro). */
function token(bloque: 'claro' | 'oscuro', nombre: string): string | undefined {
  const inicio = css.indexOf(bloque === 'claro' ? ':root {' : "[data-tema='oscuro'] {");
  const texto = css.slice(inicio, css.indexOf('}', inicio));
  return new RegExp(`${nombre}:\s*([^;]+);`).exec(texto)?.[1].trim();
}

/** Filas de la tabla de DESIGN.md: token → [claro, oscuro]. Las de dos tokens (`a` / `b`) se separan. */
function tabla(): Map<string, [string, string]> {
  const filas = new Map<string, [string, string]>();
  for (const linea of seccion.split('\n')) {
    const celdas = linea.split('|').map((c) => c.trim());
    if (celdas.length < 5 || !celdas[1].startsWith('`--')) continue;
    const nombres = celdas[1].split('/').map((n) => n.replace(/`/g, '').trim());
    const claros = celdas[2].split('/').map((v) => v.replace(/`/g, '').trim());
    const oscuros = celdas[3].split('/').map((v) => v.replace(/`/g, '').trim());
    nombres.forEach((n, i) => filas.set(n, [claros[i], oscuros[i]]));
  }
  return filas;
}

describe('tokens de web contra DESIGN.md (sistema de la app nueva)', () => {
  const filas = [...tabla()];

  it('la tabla de DESIGN.md tiene los tokens de la paleta', () => {
    expect(filas.length).toBeGreaterThanOrEqual(20);
  });

  it.each(filas)('%s vale lo que dice DESIGN.md en los dos temas', (nombre, [claro, oscuro]) => {
    expect(token('claro', nombre)?.toUpperCase()).toBe(claro.toUpperCase());
    expect((token('oscuro', nombre) ?? token('claro', nombre))?.toUpperCase()).toBe(oscuro.toUpperCase());
  });

  it('el tema oscuro redefine los colores que cambian de rol', () => {
    for (const t of ['--fondo', '--sup', '--tinta', '--gris', '--sube', '--baja', '--club-cl', '--bordo']) {
      expect(token('oscuro', t), t).toBeDefined();
    }
  });

  it('no hay animaciones fuera de transform y opacity', () => {
    expect(css).not.toMatch(/transition(-property)?:\s*all/);
  });
});
