// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contraste } from './contraste';

// Cada par de texto y fondo de la paleta se mide en los dos temas (H-170): si un valor nuevo
// no se lee, falla acá y se corrige el valor, no la prueba.
const css = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8');

function bloque(tema: 'claro' | 'oscuro'): string {
  const inicio = css.indexOf(tema === 'claro' ? ':root {' : "[data-tema='oscuro'] {");
  return css.slice(inicio, css.indexOf('}', inicio));
}
const leer = (texto: string, nombre: string) => new RegExp(`${nombre}:\\s*(#[0-9A-Fa-f]{6})\\s*;`).exec(texto)?.[1];
/** Valor en el tema; los tokens que no cambian en oscuro se toman del claro. */
function valor(tema: 'claro' | 'oscuro', nombre: string): string {
  const v = (tema === 'oscuro' ? leer(bloque('oscuro'), nombre) : undefined) ?? leer(bloque('claro'), nombre);
  if (!v) throw new Error(`${nombre} no tiene un color #RRGGBB`);
  return v;
}

describe('contraste', () => {
  it('mide como WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
    expect(contraste('#FFFFFF', '#777777')).toBeCloseTo(4.48, 1);
  });

  const textos: Array<[string, string]> = [
    ['--tinta', '--fondo'],
    ['--tinta', '--sup'],
    ['--tinta', '--sup-2'],
    ['--gris', '--fondo'],
    ['--gris', '--sup'],
    ['--club-texto', '--fondo'],
    ['--club-texto', '--sup'],
    ['--sobre-lima', '--lima'],
    ['--sobre-club', '--club'],
    ['--sube', '--sube-fondo'],
    ['--baja', '--baja-fondo'],
    ['--sobre-negro', '--negro'],
  ];

  for (const tema of ['claro', 'oscuro'] as const) {
    it.each(textos)(`${tema}: %s sobre %s se lee (4,5:1)`, (texto, fondo) => {
      expect(contraste(valor(tema, texto), valor(tema, fondo))).toBeGreaterThanOrEqual(4.5);
    });

    it(`${tema}: el borde de lo que se toca se ve (3:1)`, () => {
      expect(contraste(valor(tema, '--borde-control'), valor(tema, '--sup'))).toBeGreaterThanOrEqual(3);
      expect(contraste(valor(tema, '--borde-control'), valor(tema, '--fondo'))).toBeGreaterThanOrEqual(3);
    });
  }
});
