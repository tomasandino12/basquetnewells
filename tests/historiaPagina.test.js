import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { titulos, datosPublicables, datosPendientes, epocas, momentos } from '../src/data/historia.js';
import { htmlLinea, htmlEstrellas, htmlFicha, htmlCifras } from '../src/ui/historia.js';

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

test('la línea histórica tiene un bloque por época (las solapadas van dentro) y nunca un dato pendiente', () => {
  const salida = String(htmlLinea());
  for (const e of epocas().filter((x) => !x.solapada)) assert.ok(salida.includes(`<section class="epoca" data-epoca="${e.id}"`), e.id);
  for (const p of datosPendientes()) assert.ok(!salida.includes(p.falta), p.id);
  for (const h of datosPublicables().filter((d) => d.texto)) assert.ok(salida.includes(h.texto), h.id);
});

test('cada título es una tarjeta con su estrella, y los momentos no llevan estrella ni número de título', () => {
  const salida = String(htmlLinea());
  assert.equal((salida.match(/<article class="t-card/g) ?? []).length, titulos().length);
  assert.equal((salida.match(/class="t-estrella"/g) ?? []).length, titulos().length);
  assert.equal((salida.match(/<article class="momento"/g) ?? []).length, momentos().length);
  // Los 12 seguidos son una sola tira: el texto de la época se dice una vez, no en cada tarjeta.
  const intro = datosPublicables().find((d) => d.id === 'doce-seguidos').texto;
  assert.equal(salida.split(intro).length - 1, 1);
  // 1983 lleva su aclaración como etiqueta de la tarjeta.
  assert.match(salida, /class="t-torneo">Torneo regular</);
});

test('cada tarjeta con dato publicado lleva su fuente como link', () => {
  const salida = String(htmlLinea());
  const tarjetas = salida.split(/<article class="(?:t-card con-historia|momento)/).slice(1);
  assert.ok(tarjetas.length >= 8);
  for (const t of tarjetas) assert.match(t.split('</article>')[0], /class="fuente"/);
});

test('el panel de cifras sale de los datos', () => {
  const salida = String(htmlCifras());
  assert.match(salida, /Títulos de Primera<\/dt><dd>15</);
  assert.match(salida, /<dd>12<small>1943–1954<\/small>/);
  assert.match(salida, /Primer título<\/dt><dd>1943</);
  assert.match(salida, /Último título<\/dt><dd>1983</);
});

test('el dorado queda sólo en las estrellas y en el filete de la vitrina', () => {
  // Regla nueva de Tomás (24/11): el dorado es de las estrellas (un título ganado) y de algún filete de la vitrina.
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const permitidos = /^(\.hist-vitrina|\.t-estrella|\.estrella|\.estrellas)/;
  const conDorado = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => /--dorado|--pub-oro-fondo/.test(m[2]));
  assert.ok(conDorado.length > 0);
  for (const [, cabeza, cuerpo] of conDorado) {
    // En un @media de una sola regla el selector está adentro.
    const selectores = cabeza.trim().startsWith('@media') ? cuerpo.split('{')[0] : cabeza;
    for (const sel of selectores.split(',').map((x) => x.trim())) assert.match(sel, permitidos, `dorado fuera de las estrellas: ${sel}`);
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
