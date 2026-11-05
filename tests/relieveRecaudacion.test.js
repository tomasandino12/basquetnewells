import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * El relieve dorado de la banda de Recaudación reemplaza al cuadrado girado:
 * un solo recurso por sección. Se lee como texto (no hay navegador en los tests).
 */
const portal = readFileSync('public/portal.html', 'utf8');
const css = readFileSync('public/css/publico.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const js = readFileSync('public/js/relieve.js', 'utf8');

test('la banda ya no tiene el cuadrado girado', () => {
  assert.doesNotMatch(css, /\.portal-rec::before/);
});

test('el relieve es un archivo externo y diferido: la CSP no admite scripts en línea', () => {
  assert.match(portal, /<script defer src="\/public\/js\/relieve\.js"><\/script>/);
});

test('el relieve respeta reducir movimiento, ahorro de datos y la pausa fuera de pantalla', () => {
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /saveData/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /document\.hidden/);
});

test('el relieve usa los colores dorados del estilo y se apaga hacia el texto', () => {
  const tokens = readFileSync('public/css/tokens.css', 'utf8');
  for (const t of ['--oro-base', '--oro-index', '--oro-hot']) assert.match(tokens, new RegExp(`${t}:`));
  assert.match(css, /\.portal-rec\.m-costados canvas\.topo\{[^}]*mask-image/);
  assert.match(css, /\.portal-rec\.m-esquina canvas\.topo\{[^}]*mask-image/);
  assert.match(css, /canvas\.topo\{[^}]*pointer-events:none/);
});
