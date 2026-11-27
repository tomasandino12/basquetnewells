import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { inclinacionPorVelocidad, posicionDeLaCopa, iniciarCopaCursor, CONSULTA_MOUSE } from '../src/ui/copaCursor.js';

/**
 * La vista previa de la copa que sigue al puntero en el portal (src/ui/copaCursor.js, public/css/publico.css,
 * public/portal.html) y el recorte liviano que usa (scripts/copa-arbb/cursor.py).
 */

const leer = (ruta) => readFileSync(ruta, 'utf8');
const portal = leer('public/portal.html');
const css = leer('public/css/publico.css');
const modulo = leer('src/ui/copaCursor.js');

test('la inclinación es proporcional a la velocidad horizontal y nunca pasa de ±8°', () => {
  assert.equal(inclinacionPorVelocidad(0), 0);
  assert.ok(inclinacionPorVelocidad(4) > 0 && inclinacionPorVelocidad(4) < 8);
  assert.equal(inclinacionPorVelocidad(-4), -inclinacionPorVelocidad(4));
  assert.equal(inclinacionPorVelocidad(500), 8);
  assert.equal(inclinacionPorVelocidad(-500), -8);
});

test('la copa va 24 px a la derecha y 20 px arriba del puntero, y no se sale de la ventana', () => {
  const tam = { ancho: 100, alto: 140 };
  assert.deepEqual(posicionDeLaCopa(500, 400, tam, { ancho: 1200 }), { x: 524, y: 380 });
  // Pegado al borde derecho: pasa al otro lado del puntero.
  const derecha = posicionDeLaCopa(1150, 400, tam, { ancho: 1200 });
  assert.ok(derecha.x + tam.ancho < 1150, 'queda a la izquierda del puntero');
  // Pegado al borde de arriba: baja lo justo para entrar entera.
  assert.ok(posicionDeLaCopa(500, 30, tam, { ancho: 1200 }).y >= tam.alto);
});

// Un mínimo de DOM falso para ver qué se instala (y qué no) según el puntero.
function entornoFalso({ mouse, reducido = false }) {
  const registro = { oyentes: [], flotantes: 0 };
  const objetivo = () => ({
    addEventListener: (n) => registro.oyentes.push(n),
    removeEventListener() {},
  });
  const objetivos = [objetivo(), objetivo()];
  const elemento = () => {
    const e = { style: {}, classList: { add() {}, remove() {} }, append() {}, remove() {}, setAttribute() {}, addEventListener() {}, removeEventListener() {} };
    return e;
  };
  const doc = {
    querySelectorAll: () => objetivos,
    createElement: () => { registro.flotantes++; return elemento(); },
    body: { append() {} },
    addEventListener: (n) => registro.oyentes.push(`doc:${n}`),
    removeEventListener() {},
  };
  const win = {
    matchMedia: (q) => ({ matches: q === CONSULTA_MOUSE ? mouse : reducido }),
    innerWidth: 1200,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
  };
  return { doc, win, registro };
}

test('en el celular (sin hover ni puntero fino) no se instala nada: ni listeners ni elemento flotante', () => {
  const { doc, win, registro } = entornoFalso({ mouse: false });
  iniciarCopaCursor(doc, win)();
  assert.equal(registro.oyentes.length, 0);
  assert.equal(registro.flotantes, 0);
});

test('con mouse, sólo se escucha mouseenter y mouseleave; el movimiento recién se escucha al entrar', () => {
  const { doc, win, registro } = entornoFalso({ mouse: true });
  const quitar = iniciarCopaCursor(doc, win);
  assert.deepEqual(registro.oyentes.sort(), ['mouseenter', 'mouseenter', 'mouseleave', 'mouseleave']);
  quitar();
});

test('el módulo mueve la copa sólo con translate3d, interpola con lerp 0,16 y respeta prefers-reduced-motion', () => {
  assert.match(modulo, /translate3d\(/);
  assert.match(modulo, /const LERP = 0\.16;/);
  assert.match(modulo, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(modulo, /prefers-reduced-motion: reduce/);
  assert.match(modulo, /requestAnimationFrame/);
  assert.match(modulo, /cancelAnimationFrame/);
  assert.doesNotMatch(modulo, /cursor:\s*url/);
  assert.match(leer('src/ui/portalArranque.js'), /iniciarCopaCursor\(\);/);
});

test('el portal marca como disparadores la tarjeta y el enlace del palmarés, y trae la copa asomada para el celular', () => {
  assert.equal([...portal.matchAll(/href="\/historia"[^>]*data-vista-copa/g)].length, 2);
  assert.match(portal, /class="ph-copa"[^>]*aria-hidden="true"><img src="\/public\/img\/historia\/copa-cursor-preview\.webp"[^>]*loading="lazy"/);
  assert.match(portal, /15 Títulos · Vitrina 3D/);
});

test('el CSS: flotante fijo, sin captar el mouse, por encima de todo, sólo con mouse; la copa asomada, sólo sin hover', () => {
  assert.match(css, /@media \(hover:hover\) and \(pointer:fine\)\{\s*\.copa-cursor\{[^}]*position:fixed;top:0;left:0;z-index:9999;[^}]*pointer-events:none/);
  // Los colores viven en tokens.css (lo exige estilosTokens.test.js): el rótulo es #0A0A0C al 82 % con punto #E30613.
  assert.match(css, /\.cc-rotulo\{[^}]*var\(--copa-rotulo-fondo\)/);
  assert.match(css, /\.cc-rotulo::before\{[^}]*var\(--copa-rojo\)/);
  assert.match(css, /drop-shadow\(0 12px 24px var\(--copa-sombra\)\)/);
  const tokens = leer('public/css/tokens.css');
  assert.match(tokens, /--copa-rojo:#E30613;/);
  assert.match(tokens, /--copa-rotulo-fondo:rgba\(10,10,12,\.82\);/);
  assert.match(tokens, /--copa-sombra:rgba\(0,0,0,\.65\);/);
  assert.match(css, /\.ph-copa\{display:none\}/);
  assert.match(css, /@media not all and \(hover:hover\) and \(pointer:fine\)\{\s*\.ph-copa\{/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\s*\.ph-copa::before\{animation:none/);
});

test('el recorte de la copa pesa menos de 25 KB, mide 220 px de alto y trae canal alfa', () => {
  const ruta = 'public/img/historia/copa-cursor-preview.webp';
  assert.ok(statSync(ruta).size < 25 * 1024, `pesa ${statSync(ruta).size} bytes`);
  const b = readFileSync(ruta);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  assert.equal(b.toString('ascii', 12, 16), 'VP8X', 'formato extendido (con alfa)');
  assert.ok(b[20] & 0x10, 'el bit de alfa está prendido');
  const alto = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
  assert.equal(alto, 220);
});
