// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Que Semillero cargue sin saltos (pedido de Tomás, 17/11/2026). Se lee el texto de los archivos
 * (no hay navegador en las pruebas): si una de estas piezas se saca, el salto vuelve sin que nada falle.
 */
const estilos = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8');
const configuracion = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '');

describe('tipografías de respaldo', () => {
  const css = sinComentarios(estilos);

  it('cada familia propia tiene una de respaldo con medidas y va segunda en la pila', () => {
    expect(css).toMatch(/--font-titulo: 'Barlow Condensed', 'Barlow Condensed Respaldo',/);
    expect(css).toMatch(/--font-cuerpo: 'DM Sans', 'DM Sans Respaldo',/);
    for (const familia of ['Barlow Condensed Respaldo', 'DM Sans Respaldo']) {
      const caras = css.match(new RegExp(`@font-face\\{font-family:'${familia}'[^}]*\\}`, 'g')) ?? [];
      expect(caras.length, familia).toBeGreaterThanOrEqual(2);
      for (const cara of caras) {
        for (const dato of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) expect(cara, `${familia} sin ${dato}`).toContain(dato);
        expect(cara, `${familia} parte de una letra del sistema`).toContain('src:local(');
      }
    }
  });

  it('los pesos reales de cada fuente tienen su cara de respaldo', () => {
    for (const peso of ['600', '700']) expect(css).toContain(`'Barlow Condensed Respaldo';font-weight:${peso};`);
    expect(css).toContain("'DM Sans Respaldo';font-weight:400 500;");
    expect(css).toContain("'DM Sans Respaldo';font-weight:600 700;");
  });
});

describe('esqueletos y precarga', () => {
  it('el esqueleto brilla con transform, un número finito de pasadas, y queda quieto (DESIGN.md: nada en loop)', () => {
    const css = sinComentarios(estilos);
    const regla = css.match(/\.esqueleto::after \{[^}]*\}/)?.[0] ?? '';
    expect(regla).toContain('animation: esqueleto-brillo 1.5s ease-in-out 4;');
    expect(regla).not.toContain('infinite');
    expect(css).toMatch(/@keyframes esqueleto-brillo \{ from \{ transform: translateX\(-100%\); \} \}/);
  });

  it('la precarga de fuentes arma los links con las direcciones con hash del armado', () => {
    for (const fuente of ['barlow-condensed-latin-700-normal', 'barlow-condensed-latin-600-normal', 'dm-sans-latin-400-normal', 'dm-sans-latin-600-normal']) {
      expect(configuracion).toContain(fuente);
    }
    expect(configuracion).toContain("rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: ''");
    expect(configuracion).toContain('precargarFuentes()');
  });
});
