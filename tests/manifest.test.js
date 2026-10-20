import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * El manifest hace instalable el sitio. Lo que se rompe sin aviso: un ícono
 * que no existe o mide otra cosa (Chrome deja de ofrecer instalar), y un
 * start_url distinto de la URL a la que vuelve el login (urlDeRetorno() en
 * repos/auth.js): la app instalada abriría en un lugar y el login la
 * devolvería a otro, y habría que tocar las URLs de Supabase Auth.
 */

const html = readFileSync('public/index.html', 'utf8');
const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));

function medidasPng(ruta) {
  const b = readFileSync(ruta);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

test('el manifest es JSON válido con id, start_url y scope en /app', () => {
  assert.equal(manifest.start_url, '/app');
  assert.equal(manifest.scope, '/app');
  assert.equal(manifest.id, '/app');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name.length <= 12, 'short_name largo se corta bajo el ícono');
});

test('los colores del manifest son los del theme-color del head', () => {
  const theme = html.match(/<meta name="theme-color" content="([^"]+)">/)?.[1];
  assert.equal(manifest.theme_color, theme);
  assert.equal(manifest.background_color, theme);
});

test('cada ícono del manifest existe y coincide en medidas', () => {
  assert.ok(manifest.icons.some((i) => i.sizes === '192x192' && !i.purpose?.includes('maskable')), 'falta 192 any');
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && !i.purpose?.includes('maskable')), 'falta 512 any');
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'falta maskable');
  for (const i of manifest.icons) {
    const ruta = i.src.replace(/^\//, '');
    assert.ok(existsSync(ruta), `falta ${i.src}`);
    assert.equal(medidasPng(ruta), i.sizes, i.src);
    assert.equal(i.type, 'image/png', i.src);
  }
});

test('index.html enlaza un solo manifest y existe uno solo en el repo', () => {
  assert.deepEqual(html.match(/<link rel="manifest"[^>]*>/g), ['<link rel="manifest" href="/public/manifest.webmanifest">']);
  const enPublic = readdirSync('public').filter((f) => /manifest/i.test(f));
  assert.deepEqual(enPublic, ['manifest.webmanifest']);
});

test('iPhone: apple-touch-icon de 180 y modo app', () => {
  const href = html.match(/<link rel="apple-touch-icon" href="([^"]+)">/)?.[1];
  assert.equal(href, '/public/icons/apple-touch-icon.png');
  assert.equal(medidasPng(href.slice(1)), '180x180');
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="[^"]{1,12}">/);
});

test('start_url coincide con la URL a la que vuelve el login', () => {
  // urlDeRetorno() = origin + pathname: abierta desde el ícono, pathname es "/app".
  const auth = readFileSync(path.join('src', 'data', 'repos', 'auth.js'), 'utf8');
  assert.match(auth, /return window\.location\.origin \+ window\.location\.pathname;/);
  assert.equal(new URL(manifest.start_url, 'https://x.test').pathname, '/app');
});
