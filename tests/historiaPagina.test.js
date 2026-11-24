import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { titulos, datosPublicables, datosPendientes, epocas } from '../src/data/historia.js';
import { htmlLinea, htmlEstrellas, htmlFicha, htmlArchivo } from '../src/ui/historia.js';

/**
 * La página pública /historia: lo que no cambia con los datos (la CSP no admite scripts en
 * línea, las rutas existen) y que lo que se pinta salga sólo de lo publicable.
 */

const pagina = readFileSync('public/historia.html', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));

test('historia.html no lleva scripts en línea y el 15 del encabezado coincide con los datos', () => {
  const enLinea = [...pagina.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)];
  assert.deepEqual(enLinea.map((m) => m[0]), []);
  assert.match(pagina, new RegExp(`id="hist-contador">${titulos().length}<`));
});

test('/historia tiene su rewrite, su no-store y su lugar en el sitemap', () => {
  assert.ok(vercel.rewrites.some((r) => r.source === '/historia' && r.destination === '/public/historia.html'));
  for (const ruta of ['/historia', '/public/historia.html']) {
    const h = vercel.headers.filter((x) => x.source === ruta).flatMap((x) => x.headers);
    assert.match(h.find((x) => x.key === 'Cache-Control')?.value ?? '', /no-store/, ruta);
  }
  assert.match(readFileSync('public/sitemap.xml', 'utf8'), /<loc>https:\/\/basquetnewells\.com\.ar\/historia<\/loc>/);
});

test('la vitrina deja el punto de enganche para la copa 3D y la leyenda obligatoria', () => {
  assert.match(pagina, /id="vitrina"/);
  assert.match(pagina, /id="vitrina-escenario"/);
  assert.match(pagina, /Recreación inspirada en la copa actual de la Asociación Rosarina/);
});

test('la línea de tiempo muestra todas las épocas y nunca un dato pendiente', () => {
  const salida = String(htmlLinea('doce-seguidos'));
  for (const e of epocas()) assert.ok(salida.includes(`data-epoca="${e.id}"`), e.id);
  for (const p of datosPendientes()) assert.ok(!salida.includes(p.falta), p.id);
  for (const h of datosPublicables().filter((d) => d.texto && d.epoca)) {
    assert.ok(salida.includes(h.texto), h.id);
  }
});

test('cada hito publicado lleva su fuente como link', () => {
  for (const e of epocas()) {
    const salida = String(htmlArchivo(e));
    const links = (salida.match(/class="fuente"/g) ?? []).length;
    assert.ok(links >= salida.split('<article').length - 1, e.id);
  }
});

test('las 15 estrellas y la ficha de 1983 con su aclaración del torneo', () => {
  assert.equal((String(htmlEstrellas()).match(/class="estrella"/g) ?? []).length, 15);
  const ficha = String(htmlFicha(1983));
  assert.match(ficha, /Torneo regular/);
  assert.match(ficha, /Apertura/);
});

test('la ficha de un año sin dato propio usa el de su época y lo dice', () => {
  assert.match(String(htmlFicha(1944)), /Dato de la época/);
  assert.doesNotMatch(String(htmlFicha(1946)), /Dato de la época/);
});
