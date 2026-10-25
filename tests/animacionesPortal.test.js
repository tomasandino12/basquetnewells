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

test('parallax: con línea de tiempo de CSS lo hace el CSS; sin ella, el módulo, y sólo con .js-anim', () => {
  assert.match(css, /@supports \(animation-timeline:scroll\(\)\)\{\s*\.js-anim \.portal-heroe-foto\{transform:translateY\(18%\) scale\(1\.1\)/);
  assert.match(modulo, /export function iniciarParallax\(\)/);
  assert.match(modulo, /CSS\?\.supports\?\.\('animation-timeline: scroll\(\)'\)/);
  assert.match(modulo, /\{ passive: true \}/);
});

test('la entrada del hero sólo existe bajo .js-anim y usa los tiempos de tokens.css', () => {
  assert.doesNotMatch(css, /(^|\})\s*\.entra\s*\{/, '.entra sin .js-anim animaría con JS apagado');
  assert.match(css, /\.js-anim \.entra\{animation:subir var\(--dur-rise\) var\(--ease-salida\) backwards;animation-delay:calc\(var\(--retardo-entrada\) \+ var\(--i\) \* var\(--paso-entrada\)\)\}/);
  assert.match(css, /\.js-anim \.portal-heroe \.linea > span\{animation:subir-linea var\(--dur-linea\)/);
});

test('el hero: botones de al menos 56px, título que se achica con el alto de la pantalla y corte diagonal de 2.5rem', () => {
  const tokens = readFileSync('public/css/tokens.css', 'utf8');
  assert.match(css, /\.portal-accion\{[^}]*min-height:3\.5rem/);
  assert.match(tokens, /--fs-hero:clamp\([^;]*svh/, 'sin el alto, en una pantalla baja los botones quedan abajo del pliegue');
  assert.match(css, /\.portal-heroe h1\{font-size:var\(--fs-hero\)/);
  assert.match(css, /\.portal-heroe\{[^}]*clip-path:polygon\(0 0,100% 0,100% 100%,0 calc\(100% - 2\.5rem\)\)/);
  assert.match(css, /\.portal-heroe\{[^}]*min-height:min\(100svh,/);
});
