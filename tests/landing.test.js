import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * La landing es HTML escrito a mano y no hay navegador en los tests: se lee
 * index.html como texto, como en metadatos.test.js, y se comprueban las
 * promesas de la spec que se rompen sin que nada avise.
 */
const html = readFileSync('public/index.html', 'utf8');
const landing = html.match(/<section class="vista" id="v-landing">[\s\S]*?<\/section>/)?.[0] ?? '';
const hero = landing.match(/<div class="hero">[\s\S]*?<div class="acciones-landing">/)?.[0] ?? '';

test('el anillo del escudo es decorativo (aria-hidden)', () => {
  assert.match(hero, /<svg[^>]*class="anillo"[^>]*aria-hidden="true"/);
  assert.match(hero, /<img[^>]*escudo\.png[^>]*alt=""/);
});

test('el texto del anillo usa textLength para llenar el círculo con cualquier nombre', () => {
  const texto = hero.match(/<textPath[^>]*>/)?.[0] ?? '';
  assert.match(texto, /lengthAdjust="spacing"/);
  const largo = Number(texto.match(/textLength="(\d+(?:\.\d+)?)"/)?.[1]);
  const radio = Number(hero.match(/<path id="circulo-anillo"[^>]*a(\d+(?:\.\d+)?),/)?.[1]);
  assert.ok(largo > 0 && radio > 0, 'no se encontró textLength o el radio del círculo');
  // Tolerancia de 1 unidad: textLength se escribe redondeado.
  assert.ok(Math.abs(largo - 2 * Math.PI * radio) < 1, `textLength ${largo} vs circunferencia ${(2 * Math.PI * radio).toFixed(1)}`);
});

test('el nombre del club también está como texto en el hero', () => {
  assert.match(hero, /<div class="club">[^<]*Newell&#39;s Old Boys<\/div>/);
});

const beneficios = [...landing.matchAll(/<div class="(ben(?: [^"]*)?)"([^>]*)>[\s\S]*?<div class="t">([^<]*)<\/div>/g)]
  .map((m) => ({ clases: m[1].split(' '), demo: m[2].match(/data-demo="([\w-]+)"/)?.[1], titulo: m[3] }));

test('la landing tiene 6 beneficios en su orden', () => {
  assert.deepEqual(beneficios.map((b) => b.titulo), [
    'El plantel se arma solo',
    'El trabajo no se pierde',
    'Estadísticas con historia',
    'Las jugadas del club',
    'Los ejercicios quedan en el club',
    'Pensada para el celular',
  ]);
  assert.deepEqual(beneficios.map((b) => b.clases.includes('ancha') ? 'ancha' : b.clases.includes('alta') ? 'alta' : ''),
    ['ancha', 'alta', 'ancha', 'ancha', '', '']);
});

test('4 beneficios llevan data-demo', () => {
  assert.deepEqual(beneficios.map((b) => b.demo), ['plantel', 'temporadas', 'tiro', 'jugadas', undefined, undefined]);
});

const demos = [...landing.matchAll(/<div class="demo [^"]*"[^>]*>([\s\S]*?)<div class="t">/g)].map((m) => m[1]);

test('las demos no llevan rótulo de ejemplo: se entienden solas', () => {
  assert.ok(demos.length >= 2, 'no se encontraron demos');
  for (const d of demos) assert.doesNotMatch(d, /ejemplo/i);
});

test('la línea de tiempo usa categorías que existen: dos años en una y después el pase', () => {
  const filas = [...landing.matchAll(/<li>((?:U|Sub-)\d+) · (\d{4}) · Profe [A-Z]<\/li>/g)].map((m) => [m[1], Number(m[2])]);
  assert.deepEqual(filas, [['U13', 2025], ['U13', 2026], ['U15', 2027]]);
});

test('la curva de tiro tiene 10 puntos y termina más arriba de donde empieza', () => {
  const puntos = (landing.match(/<polyline class="curva-demo" points="([^"]+)"/)?.[1] ?? '')
    .trim().split(/\s+/).map((p) => p.split(',').map(Number));
  assert.equal(puntos.length, 10);
  // En SVG el eje y crece hacia abajo: "más arriba" es una y menor.
  assert.ok(puntos.at(-1)[1] < puntos[0][1]);
});

test('la cifra del salto está en su valor final en el HTML', () => {
  // Sin JS o con movimiento reducido la cifra no cuenta: tiene que estar ya en 42.
  assert.match(landing, /<span id="cifra-salto">42<\/span>/);
});

test('todo beneficio con data-demo trae su demo', () => {
  const conDemo = [...landing.matchAll(/<div class="demo demo-([\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(conDemo, beneficios.filter((b) => b.demo).map((b) => b.demo));
});

// ---- Bloque "básquet" para las familias (spec 2026-10-16-portal-pwa) ----

test('el bloque básquet está dentro de la landing, después de los botones y antes del bento', () => {
  const iAcciones = landing.indexOf('<div class="acciones-landing">');
  const iBasquet = landing.indexOf('<div class="basquet"');
  const iBento = landing.indexOf('<div class="beneficios">');
  assert.ok(iAcciones > 0 && iBasquet > iAcciones && iBento > iBasquet, `orden: ${iAcciones} ${iBasquet} ${iBento}`);
  assert.match(landing.slice(iBasquet, iBento), /Para los profes/);
});

test('el bloque básquet no usa anclas #: el hash lo lee la recuperación de clave', () => {
  const bloque = landing.slice(landing.indexOf('<div class="basquet"'), landing.indexOf('<div class="beneficios">'));
  assert.doesNotMatch(bloque, /href="#/);
});

test('portalLanding.js no pide datos: ni repositorio, ni repos, ni Supabase', () => {
  const codigo = readFileSync('src/ui/portalLanding.js', 'utf8');
  const imports = [...codigo.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.filter((i) => /repositorio|repos\/|cliente|supabase/.test(i)), []);
  assert.doesNotMatch(codigo, /\bfetch\s*\(/);
});

test('sin URL de inscripción la tarjeta dice Próximamente', async () => {
  const { htmlInscripcion } = await import('../src/ui/portalLanding.js');
  const out = htmlInscripcion(null).toString();
  assert.match(out, /Próximamente/);
  assert.doesNotMatch(out, /<a /);
  assert.match(htmlInscripcion('https://evil.com/forms/x').toString(), /Próximamente/);
});

test('el enlace de inscripción abre en otra pestaña con rel=noopener', async () => {
  const { htmlInscripcion } = await import('../src/ui/portalLanding.js');
  const out = htmlInscripcion('https://forms.gle/AbC123').toString();
  assert.match(out, /<a [^>]*href="https:\/\/forms\.gle\/AbC123"/);
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener"/);
});

test('sin ID cada calendario dice Próximamente y no hay iframe', async () => {
  const { htmlCalendarios } = await import('../src/ui/portalLanding.js');
  const out = htmlCalendarios([{ titulo: 'Partidos', id: null }, { titulo: 'Eventos', id: 'roto' }]).toString();
  assert.equal(out.match(/Próximamente/g)?.length, 2);
  assert.doesNotMatch(out, /<iframe/);
});

test('con ID el calendario es un iframe perezoso, con título y en sandbox', async () => {
  const { htmlCalendarios } = await import('../src/ui/portalLanding.js');
  const out = htmlCalendarios([{ titulo: 'Partidos <b>', id: 'abc@group.calendar.google.com' }]).toString();
  const iframe = out.match(/<iframe[^>]*>/)?.[0] ?? '';
  assert.match(iframe, /src="https:\/\/calendar\.google\.com\/calendar\/embed\?/);
  assert.match(iframe, /loading="lazy"/);
  assert.match(iframe, /title="Calendario: Partidos &lt;b&gt;"/);
  assert.match(iframe, /sandbox="[^"]*allow-scripts/);
  assert.doesNotMatch(iframe, /allow-top-navigation/);
  assert.doesNotMatch(out, /<b>/);
});
