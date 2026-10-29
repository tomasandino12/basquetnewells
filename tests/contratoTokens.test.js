import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Las pantallas piden el ROL de un color (--texto, --sup, --borde...) y no el
 * de paleta (--tinta, --blanco, --linea...): el tema oscuro redefine sólo los
 * roles. Estos tests leen el CSS como texto y cuidan que nadie vuelva a la
 * paleta en una pantalla y la deje clara en el tema oscuro.
 */
const leer = (n) => readFileSync(`public/css/${n}.css`, 'utf8');
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = leer('tokens');

const ROLES = [
  'fondo-app', 'sup', 'sup-hundida', 'texto', 'texto-2', 'borde', 'pista', 'fondo-chip-t',
  'graf-texto', 'graf-eje', 'graf-rejilla', 'graf-cancha',
];

/** Los pares selector { cuerpo } del CSS, también los de dentro de un @media. */
function reglas(texto) {
  return [...sinComentarios(texto).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), cuerpo: m[2] }));
}

test('cada token de rol está definido en :root', () => {
  const raiz = sinComentarios(tokens).match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const faltan = ROLES.filter((r) => !new RegExp(`--${r}\\s*:`).test(raiz));
  assert.deepEqual(faltan, []);
});

// Lo que es siempre igual, con cualquier tema: la pizarra (un "papel"), la hoja
// de impresión, la barra de navegación (negra) y lo que lleva su propio color
// de fondo fijo.
const EXCEPCIONES = [
  /^(svg\.pz|\.pz)/, // pizarra
  /^\.nav\b/, // barra de abajo: negra
  /\.jugada-impresion|\.ji-/, // impresión
  /^\.test-fila\.hecho \.ic$/, // texto blanco sobre el verde
  /^\.rec-filo-sello$/, // sello negro con letras blancas
  /^\.crono-aviso$/, // texto oscuro sobre el amarillo de aviso
  /^\.cabecera\b/, /^\.toast\b/, /\.publico\b/,
];
const PALETA = /var\(--(papel|blanco|tinta|gris|linea)\)/;

test('las pantallas no usan --papel/--blanco/--tinta/--gris/--linea fuera de las excepciones', () => {
  const malos = [];
  for (const archivo of ['base', 'layout', 'componentes']) {
    for (const { selector, cuerpo } of reglas(leer(archivo))) {
      if (!PALETA.test(cuerpo)) continue;
      // Con varios selectores separados por coma, todos tienen que ser excepción.
      const partes = selector.split(',').map((s) => s.trim());
      if (partes.every((p) => EXCEPCIONES.some((e) => e.test(p)))) continue;
      malos.push(`${archivo}.css: ${selector} → ${cuerpo.match(PALETA)[0]}`);
    }
  }
  assert.deepEqual(malos, []);
});
