// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Se lee el archivo tal cual: con `?raw` Vitest entrega el CSS vacío.
const css = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8');
const diseno = readFileSync(new URL('../../DESIGN.md', import.meta.url), 'utf8');

/** Valor de un token dentro de un bloque (`:root` o el del tema oscuro). */
function token(bloque: 'claro' | 'oscuro', nombre: string): string | undefined {
  const inicio = css.indexOf(bloque === 'claro' ? ':root {' : "[data-tema='oscuro'] {");
  const texto = css.slice(inicio, css.indexOf('}', inicio));
  return new RegExp(`${nombre}:\\s*([^;]+);`).exec(texto)?.[1].trim();
}

describe('tokens del tema contra DESIGN.md', () => {
  // [token de web, token de DESIGN.md, valor que DESIGN.md documenta]
  const claro: Array<[string, string, string]> = [
    ['--club', '--club', '#D9122E'],
    ['--club-osc', '--primario-osc', '#A00D22'],
    ['--club-cl', '--primario-cl', '#FFEBEE'],
    ['--fondo', '--papel', '#F3F1ED'],
    ['--sup-2', '--fondo-chip', '#EFECE6'],
    ['--linea', '--linea', '#DFDBD3'],
    ['--tinta', '--tinta', '#131316'],
    ['--gris', '--gris', '#6E6B66'],
    ['--borde-control', '--borde-control', '#85817A'],
    ['--sube', '--sube', '#15794F'],
    ['--sube-fondo', '--sube-fondo', '#E1F0E9'],
    ['--baja', '--baja', '#985E0C'],
    ['--baja-fondo', '--baja-fondo', '#F6ECD9'],
  ];

  it.each(claro)('%s (claro) vale lo que dice DESIGN.md', (mio, suyo, valor) => {
    expect(token('claro', mio)).toBe(valor);
    expect(diseno).toMatch(new RegExp(`\`${suyo}\`[^\\n]*${valor}`, 'i'));
  });

  it('el tema oscuro usa las superficies públicas de DESIGN.md', () => {
    expect(token('oscuro', '--fondo')).toBe('#0D0D10');
    expect(token('oscuro', '--sup')).toBe('#17171C');
    expect(token('oscuro', '--linea')).toBe('#2B2B34');
    expect(token('oscuro', '--club-texto')).toBe('#E34D62');
    expect(token('oscuro', '--sube')).toBe('#4FD69C');
    for (const v of ['#0D0D10', '#17171C', '#2B2B34', '#E34D62', '#4FD69C']) expect(diseno).toContain(v);
  });

  it('el tema oscuro redefine los colores que cambian de rol', () => {
    for (const t of ['--fondo', '--sup', '--tinta', '--gris', '--sube', '--baja', '--club-cl']) {
      expect(token('oscuro', t), t).toBeDefined();
    }
  });

  it('no hay animaciones fuera de transform y opacity', () => {
    expect(css).not.toMatch(/transition(-property)?:\s*all/);
  });
});
