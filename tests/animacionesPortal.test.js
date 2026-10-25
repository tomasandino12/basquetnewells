import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Las animaciones del portal se leen como texto (no hay navegador en los
 * tests). Se atan las promesas que, si se rompen, dejan la página sin contenido.
 */
const anim = readFileSync('public/js/anim.js', 'utf8');
const css = readFileSync('public/css/publico.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const modulo = readFileSync('src/ui/animaciones.js', 'utf8');

test('anim.js no prende nada con movimiento reducido ni sin IntersectionObserver', () => {
  assert.match(anim, /prefers-reduced-motion: reduce/);
  assert.match(anim, /'IntersectionObserver' in window/);
  assert.match(anim, /classList\.add\('js-anim'\)/);
});

test('anim.js se apaga solo si el módulo no avisó: nunca contenido invisible', () => {
  assert.match(anim, /data-anim-lista/);
  assert.match(anim, /classList\.remove\('js-anim'\)/);
  assert.match(modulo, /setAttribute\('data-anim-lista'/);
});

test('lo oculto de entrada vive sólo bajo .js-anim y con reduced-motion queda visible', () => {
  const sueltas = css.match(/(^|\})\s*\.rise\s*\{[^}]*opacity\s*:\s*0/g);
  assert.equal(sueltas, null, '.rise sin .js-anim dejaría el contenido invisible si falla el JS');
  assert.match(css, /\.js-anim \.rise\{opacity:0;/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\s*\.js-anim \.rise\{opacity:1;transform:none\}/);
});

test('animaciones.js revela una sola vez y muestra todo si no hay IntersectionObserver', () => {
  assert.match(modulo, /unobserve\(entrada\.target\)/);
  assert.match(modulo, /typeof IntersectionObserver === 'undefined'/);
  assert.match(modulo, /e\.classList\.add\('visto'\)/);
});
