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

test('animaciones.js revela una sola vez, vale para lo armado después (revelar) y muestra todo sin IntersectionObserver', () => {
  assert.match(modulo, /unobserve\(entrada\.target\)/);
  assert.match(modulo, /typeof IntersectionObserver !== 'undefined'/);
  assert.match(modulo, /export function revelar\(raiz\)/);
  assert.match(modulo, /else nodo\.classList\.add\('visto'\)/, 'sin observador, todo queda visible');
  assert.match(modulo, /const REVELABLES = '\.rise'/);
});

test('la cinta corre sólo bajo .js-anim, con la mitad de la pista y pausable; sin animación se desliza a mano', () => {
  assert.match(css, /\.js-anim \.portal-cinta-pista\.anda\{transform:translateX\(-50%\);animation:marcha var\(--dur-cinta\) linear infinite\}/);
  assert.match(css, /@keyframes marcha\{from\{transform:translateX\(0\)\}\}/);
  assert.match(css, /\.portal-cinta\.pausada \.portal-cinta-pista\{animation-play-state:paused\}/);
  assert.match(css, /@media \(hover:hover\)\{\.portal-cinta:hover \.portal-cinta-pista\{animation-play-state:paused\}\}/);
  assert.match(css, /html:not\(\.js-anim\) \.portal-cinta-banda\{overflow-x:auto\}/);
  assert.match(css, /html:not\(\.js-anim\) \.portal-cinta-fila\[aria-hidden\]\{display:none\}/);
  assert.match(css, /\.portal-cinta-pausa\{[^}]*width:var\(--tap\);height:var\(--tap\)/);
  assert.match(modulo, /export function iniciarCintaPausa\(\)/);
  assert.match(modulo, /toggle\('pausada'\)/);
});

test('"Lo que viene" es una sección con foto que entra con .rise, ya no un ticket girado', () => {
  const pagina = readFileSync('public/portal.html', 'utf8');
  assert.match(pagina, /<section class="[^"]*\brise\b[^"]*" id="lo-que-viene"/);
  assert.doesNotMatch(css, /\.sticker/);
  assert.match(css, /\.portal-prox-foto img\{[^}]*filter:grayscale\(1\) contrast\(1\.25\)/, 'duotono como las categorías');
  assert.match(css, /\.portal-prox-foto::before\{[^}]*background:var\(--club\);mix-blend-mode:multiply;opacity:\.35/);
});

test('el tipo de evento no se dice sólo con el color: cada uno tiene su forma en el mes y su ícono en el detalle', () => {
  for (const tipo of ['evento', 'charla', 'entrenamiento']) {
    assert.match(css, new RegExp(`\\.portal-puntos i\\.tipo-${tipo}`), tipo);
  }
  assert.match(css, /\.portal-ley li\.tipo-partido::before\{border-radius:50%\}/);
  assert.match(css, /clip-path:polygon\(50% 0,100% 100%,0 100%\)/);
  assert.match(css, /\.portal-tipo-ico svg\{width:1rem;height:1rem/);
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
  assert.match(css, /\.portal-heroe\{[^}]*min-height:calc\(100svh - var\(--alto-cinta\)\)/, 'el hero deja justo el lugar de la cinta en la primera pantalla');
  assert.match(css, /\.portal-cinta\{[^}]*height:var\(--alto-cinta\)/, 'la cinta mide lo que el hero le deja');
});

test('la barra fija: aparece al pasar el hero POR ARRIBA, oculta es inert y no depende de .js-anim', () => {
  const desde = modulo.indexOf('export function iniciarDock');
  const cuerpo = modulo.slice(desde);
  assert.match(cuerpo, /!entrada\.isIntersecting && entrada\.boundingClientRect\.top < 0/);
  assert.match(cuerpo, /toggleAttribute\('inert', !visible\)/);
  assert.doesNotMatch(cuerpo, /js-anim/, 'con movimiento reducido igual tiene que aparecer');
  assert.match(css, /\.portal-dock\{[^}]*env\(safe-area-inset-bottom\)[^}]*backdrop-filter:blur\(12px\)/);
  assert.match(css, /\.portal-dock\.visible\{transform:none\}/);
  assert.match(css, /\.portal-pie \.pie-legal\{[^}]*padding:[^;}]*calc\(5\.5rem \+ env\(safe-area-inset-bottom\)\)/, 'la barra no tapa el pie: el pie le deja lugar');
  assert.match(css, /\.portal-dock-btn\{[^}]*min-height:3rem/);
});

test('el carrusel: snap, duotono suave en CSS (grises + un poco del color del club), flechas sólo con mouse y la marcada con aro y "Su categoría"', () => {
  assert.match(css, /\.portal-carrusel-pista\{[^}]*overflow-x:auto;scroll-snap-type:x mandatory/);
  assert.match(css, /\.portal-card\{[^}]*scroll-snap-align:start/);
  assert.match(css, /\.portal-card img\{[^}]*filter:grayscale\(1\) contrast\(1\.25\)/);
  assert.match(css, /\.portal-card::before\{[^}]*background:var\(--club\);mix-blend-mode:multiply;opacity:\.35/);
  assert.match(css, /@media \(hover:hover\)\{\.portal-carrusel-flechas\{display:flex\}\}/);
  assert.match(css, /\.portal-card button\[aria-pressed="true"\]\{box-shadow:inset 0 0 0 3px var\(--sobre-oscuro\)\}/);
  assert.match(css, /\[aria-pressed="true"\] > \.portal-card-su\{display:flex\}/);
  assert.match(css, /\.portal-card-su\{[^}]*display:none/);
});

test('recaudación es una franja dorada a todo el ancho y sin foto; Sumate tampoco lleva foto de fondo (el rojo queda en el hero)', () => {
  const pagina = readFileSync('public/portal.html', 'utf8');
  for (const id of ['recaudacion', 'colaborar']) {
    const seccion = pagina.match(new RegExp(`<section [^>]*id="${id}"[\\s\\S]*?</section>`))[0];
    assert.doesNotMatch(seccion, /<img /, id);
  }
  // Fuera de la columna central, para ir de borde a borde.
  const antes = pagina.slice(0, pagina.indexOf('id="recaudacion"'));
  assert.ok(antes.lastIndexOf('</div>') > antes.lastIndexOf('<div class="portal-cuerpo">'), 'recaudación va fuera de .portal-cuerpo');
  assert.doesNotMatch(pagina, /portal-foto-card|class="portal-banda"/);
  assert.match(css, /\.portal-rec\{[^}]*background:var\(--pub-oro-fondo\)/);
  assert.match(css, /\.portal-rec-btn\{[^}]*background:var\(--dorado\);color:var\(--pub-fondo\)/);
});

test('el borde rasgado aparece una sola vez (arriba del pie) y es decorativo', () => {
  const pagina = readFileSync('public/portal.html', 'utf8');
  assert.equal((pagina.match(/class="portal-rasgado"/g) ?? []).length, 1);
  assert.match(pagina, /<footer class="portal-pie">\s*<div class="portal-rasgado" aria-hidden="true"><\/div>\s*<div class="pie-legal">/);
  assert.match(css, /\.portal-rasgado\{[^}]*clip-path:polygon\(/);
});

test('las secciones entran al scrollear: .rise en las que tienen contenido propio, y el calendario ya tenía el suyo', () => {
  const pagina = readFileSync('public/portal.html', 'utf8');
  for (const id of ['categorias', 'colaborar', 'sede', 'formularios', 'club', 'sponsors']) {
    assert.match(pagina, new RegExp(`<section class="[^"]*\\brise\\b[^"]*" id="${id}"`), id);
  }
  assert.match(pagina, /id="portal-calendario" class="rise"/);
});
