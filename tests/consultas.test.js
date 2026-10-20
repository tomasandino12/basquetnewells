import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { htmlConsultas } from '../src/ui/consultas.js';

/**
 * /consultas es la dirección FIJA del QR impreso: tiene que llevar siempre al
 * formulario de consultas vigente aunque la coordinación lo cambie, y si no
 * hay ninguno, decirlo con claridad (no una página en blanco ni un error).
 * Spec portal v2 y pedido de Tomás (cartel con QR para captar jugadores).
 */

const pagina = readFileSync('public/consultas.html', 'utf8');
const app = readFileSync('public/index.html', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const importMapDe = (html) => html.replace(/\r\n/g, '\n').match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];

test('vercel.json sirve /consultas con la página y sin caché', () => {
  assert.equal(vercel.rewrites.find((r) => r.source === '/consultas')?.destination, '/public/consultas.html');
  for (const ruta of ['/consultas', '/public/consultas.html']) {
    const cache = vercel.headers.filter((h) => h.source === ruta).flatMap((h) => h.headers).find((h) => h.key.toLowerCase() === 'cache-control')?.value ?? '';
    assert.match(cache, /\bno-store\b/, ruta);
  }
});

test('la página no se indexa, es mobile y lleva el mismo import map y la configuración de la app', () => {
  assert.match(pagina, /<meta name="robots" content="noindex">/);
  assert.match(pagina, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.equal(importMapDe(pagina), importMapDe(app));
  assert.match(pagina, /<script src="\/public\/config\.js"><\/script>/);
  assert.doesNotMatch(pagina, /rel="manifest"|serviceWorker/);
});

test('carga el reenvío del login primero y después su arranque', () => {
  const scripts = [...pagina.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['/public/config.js', '/src/ui/portalEntrada.js', '/src/ui/consultasArranque.js']);
});

test('tiene dónde mostrar el mensaje y un enlace al portal aunque falle el JavaScript', () => {
  assert.match(pagina, /id="consultas-estado"/);
  assert.match(pagina, /<noscript>[\s\S]*href="\/"[\s\S]*<\/noscript>/);
});

test('consultas.js sólo pide datos por el repositorio y sólo redirige a lo que resolverConsultas validó', () => {
  const codigo = readFileSync('src/ui/consultas.js', 'utf8');
  const imports = [...codigo.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.filter((i) => /repos\/|cliente|supabase/.test(i)), []);
  assert.match(codigo, /from '\.\.\/data\/repositorio\.js'/);
  assert.doesNotMatch(codigo, /\bfetch\s*\(/);
  assert.equal((codigo.match(/location\.replace\(/g) ?? []).length, 1);
  assert.match(codigo, /location\.replace\(r\.url\)/);
  const guarda = codigo.indexOf('destinoDeAuth(');
  assert.ok(guarda > 0 && guarda < codigo.indexOf('resolverConsultas('), 'no consulta si la URL es la vuelta de un login');
});

test('los tres estados dicen qué pasa y qué hacer, y nunca dejan al visitante sin salida', () => {
  const redirigir = htmlConsultas({ estado: 'redirigir', url: 'https://forms.gle/AbC' }).toString();
  assert.match(redirigir, /Te llevamos al formulario/);
  assert.match(redirigir, /<a [^>]*href="https:\/\/forms\.gle\/AbC"/);

  const sin = htmlConsultas({ estado: 'sin-formulario' }).toString();
  assert.match(sin, /no hay un formulario de consultas abierto/i);
  assert.match(sin, /href="\/"/);
  assert.doesNotMatch(sin, /forms\.gle/);

  const error = htmlConsultas({ estado: 'error' }).toString();
  assert.match(error, /No pudimos abrir/);
  assert.match(error, /Probá de nuevo/);
  assert.match(error, /href="\/"/);
});

test('lo que se muestra va escapado: el enlace no puede romper el atributo', () => {
  const out = htmlConsultas({ estado: 'redirigir', url: 'https://forms.gle/a"onclick="x' }).toString();
  assert.doesNotMatch(out, /"onclick="/);
  assert.match(out, /&quot;/);
});

test('con el contacto configurado, "sin formulario" ofrece escribirle al coordinador', () => {
  const sin = htmlConsultas({ estado: 'sin-formulario' }, 'https://wa.me/5493410000000').toString();
  assert.match(sin, /href="https:\/\/wa\.me\/5493410000000"/);
});
