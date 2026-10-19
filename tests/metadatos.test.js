import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * El dominio de producción está escrito a mano en varios archivos: el
 * canonical y el og:* de cada página, el Sitemap: de robots.txt y los <loc>
 * del sitemap. Nada falla si se desincronizan — la página sigue andando, y la
 * tarjeta de WhatsApp sale mal o Google indexa la URL equivocada semanas
 * después. Este test los compara todos.
 *
 * Hay dos páginas: el portal del básquet en / (portal.html) y Semillero, la
 * app, en /app (index.html). Cada una tiene su propio canonical.
 */

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...partes) => readFileSync(path.join(raiz, ...partes), 'utf8');
const portal = leer('public', 'portal.html');
const app = leer('public', 'index.html');
const robots = leer('public', 'robots.txt');
const sitemap = leer('public', 'sitemap.xml');
const vercel = JSON.parse(leer('vercel.json'));

/** El content= de un <meta property="og:..."> de una página. */
const og = (html, propiedad) => html.match(new RegExp(`<meta property="${propiedad}" content="([^"]*)">`))?.[1] ?? null;
const meta = (html, nombre) => html.match(new RegExp(`<meta name="${nombre}" content="([^"]*)">`))?.[1] ?? null;
const canonicalDe = (html) => html.match(/<link rel="canonical" href="([^"]*)">/)?.[1] ?? null;

const sitio = canonicalDe(portal);
const PAGINAS = [
  ['el portal', portal, /^https:\/\/[^/]+\/$/],
  ['la app', app, /^https:\/\/[^/]+\/app$/],
];

test('cada página tiene un canonical absoluto: el portal en la raíz y la app en /app', () => {
  for (const [nombre, html, forma] of PAGINAS) {
    const c = canonicalDe(html);
    assert.ok(c, `${nombre}: falta <link rel="canonical">`);
    assert.match(c, forma, `${nombre}: canonical inesperado (${c})`);
  }
  assert.equal(canonicalDe(app), `${sitio}app`, 'las dos páginas tienen que ser del mismo dominio');
});

test('og:url apunta al canonical de su página', () => {
  for (const [nombre, html] of PAGINAS) assert.equal(og(html, 'og:url'), canonicalDe(html), nombre);
});

test('el título y la descripción no se desincronizan con los de Open Graph', () => {
  for (const [nombre, html] of PAGINAS) {
    assert.equal(og(html, 'og:title'), html.match(/<title>([^<]*)<\/title>/)[1].replace(/&#39;/g, "'"), nombre);
    assert.equal(og(html, 'og:description'), meta(html, 'description'), nombre);
  }
});

test('og:image es absoluta, del mismo dominio, y el archivo existe, con las medidas del PNG', () => {
  for (const [nombre, html] of PAGINAS) {
    const imagen = og(html, 'og:image');
    assert.ok(imagen?.startsWith(sitio), `${nombre}: og:image tiene que colgar de ${sitio}: quien la busca es un servidor ajeno, no el navegador`);
    const ruta = imagen.slice(sitio.length - 1); // deja la barra inicial
    assert.ok(existsSync(path.join(raiz, ruta)), `${nombre}: falta ${ruta}`);
    // Cabecera IHDR de un PNG: ancho y alto en big-endian, en los bytes 16 y 20.
    const png = readFileSync(path.join(raiz, ruta));
    assert.equal(og(html, 'og:image:width'), String(png.readUInt32BE(16)), nombre);
    assert.equal(og(html, 'og:image:height'), String(png.readUInt32BE(20)), nombre);
  }
});

test('robots.txt y el sitemap declaran el mismo sitio y listan las dos páginas', () => {
  assert.equal(robots.match(/^Sitemap:\s*(\S+)/m)?.[1], `${sitio}sitemap.xml`);
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes(sitio), 'el sitemap no lista el portal');
  assert.ok(locs.includes(`${sitio}app`), 'el sitemap no lista /app');
});

test('robots.txt no bloquea /public: Google necesita el CSS y el JS para ver las páginas', () => {
  const bloqueados = [...robots.matchAll(/^Disallow:\s*(\S*)/gm)].map((m) => m[1]);
  assert.deepEqual(bloqueados, [], 'un Disallow acá le esconde a Google el CSS, el JS y el canonical');
});

test('vercel.json sirve robots.txt y sitemap.xml desde la raíz', () => {
  // Viven en public/, pero un buscador sólo los pide en la raíz del dominio;
  // sin el rewrite quedan en 404 y no se entera nadie.
  for (const archivo of ['robots.txt', 'sitemap.xml']) {
    const regla = vercel.rewrites?.find((r) => r.source === `/${archivo}`);
    assert.equal(regla?.destination, `/public/${archivo}`, `falta el rewrite de /${archivo}`);
  }
});

test('vercel.json reescribe / al portal y /app a la app', () => {
  const destino = (origen) => vercel.rewrites.find((r) => r.source === origen)?.destination;
  assert.equal(destino('/'), '/public/portal.html');
  assert.equal(destino('/app'), '/public/index.html');
});

test('las dos páginas se sirven sin caché, para que cada CSP nueva llegue', () => {
  // Guardado, el HTML se revalida con el ETag y el 304 no trae la CSP.
  for (const ruta of ['/', '/app', '/public/index.html', '/public/portal.html']) {
    const reglas = vercel.headers.filter((h) => h.source === ruta).flatMap((h) => h.headers);
    const cache = reglas.find((h) => h.key.toLowerCase() === 'cache-control')?.value ?? '';
    assert.match(cache, /\bno-store\b/, `${ruta} sin Cache-Control: no-store`);
  }
});
