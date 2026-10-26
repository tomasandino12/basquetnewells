import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * La Content-Security-Policy de vercel.json sólo deja correr scripts del
 * propio dominio y el import map inline, identificado por su hash. Tocar un
 * espacio del import map cambia el hash y la app queda en blanco en
 * producción, sin que nada falle en local (la CSP la pone Vercel). Este test
 * es el que avisa.
 */

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// El parser de HTML normaliza CRLF a LF antes de calcular el hash.
const html = readFileSync(path.join(raiz, 'public', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const HOST_GTAG = 'https://www.googletagmanager.com';
const HOSTS_ANALYTICS = ['https://www.google-analytics.com', 'https://analytics.google.com', 'https://region1.google-analytics.com', HOST_GTAG];
const vercel = JSON.parse(readFileSync(path.join(raiz, 'vercel.json'), 'utf8'));

// Hay DOS políticas, una por ruta: la estricta de /app (la app con datos de
// menores, sin ningún host de Google Analytics) y la amplia del resto del sitio
// (portal, /privacidad, /terminos, /consultas), que suma los hosts de Analytics.
// Vercel no documenta qué header gana si dos reglas con la misma key coinciden
// con la misma ruta, así que las reglas no se pueden superponer: ver
// 'cada ruta recibe exactamente una CSP'.
const RUTA_APP = '/app';
const RUTA_PORTAL = '/';

// Traduce los `source` de vercel.json a regex. Sólo entiende las formas que usa
// este archivo (literales, `/:nombre*` y grupos `(...)`) y falla ante otra, para
// no dar por buena una regla que no se interpretó.
function fuenteARegex(source) {
  let re = '';
  let profundidad = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (profundidad === 0 && source.startsWith('/:', i)) {
      const m = source.slice(i).match(/^\/:\w+\*/);
      assert.ok(m, `source no soportado en el test: ${source}`);
      re += '(?:/.*)?';
      i += m[0].length - 1;
    } else if (c === '(') { profundidad++; re += c; }
    else if (c === ')') { profundidad--; re += c; }
    else if (profundidad > 0 || /[A-Za-z0-9/_-]/.test(c)) re += c;
    else if (c === '.') re += '\\.';
    else assert.fail(`source no soportado en el test: ${source}`);
  }
  return new RegExp(`^${re}/?$`);
}

// Los valores de Content-Security-Policy de las reglas que coinciden con la ruta.
function cspsDe(ruta) {
  return (vercel.headers ?? [])
    .filter((regla) => fuenteARegex(regla.source).test(ruta))
    .flatMap((regla) => regla.headers)
    .filter((h) => h.key.toLowerCase() === 'content-security-policy')
    .map((h) => h.value);
}

function csp(ruta = RUTA_APP) {
  const valores = cspsDe(ruta);
  assert.equal(valores.length, 1, `${ruta} tiene ${valores.length} CSP, tiene que tener una`);
  return valores[0];
}

function directiva(nombre, ruta = RUTA_APP) {
  const d = csp(ruta).split(';').map((s) => s.trim()).find((s) => s.startsWith(`${nombre} `));
  return d ? d.split(/\s+/).slice(1) : null;
}

test('el hash del import map está en script-src', () => {
  const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(m, 'no hay import map');
  const hash = `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`;
  assert.ok(directiva('script-src')?.includes(hash), `script-src no tiene ${hash}: actualizarlo en vercel.json`);
});

test('no hay otros scripts inline: sólo el import map', () => {
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter((m) => !/type="importmap"/.test(m[1]));
  assert.deepEqual(inline.map((m) => m[0]), []);
});

test('script-src no abre la puerta a inline, eval ni CDNs', () => {
  const s = directiva('script-src');
  assert.ok(s, 'falta script-src');
  for (const prohibido of ["'unsafe-inline'", "'unsafe-eval'", 'https:', '*']) assert.ok(!s.includes(prohibido), prohibido);
  assert.deepEqual(s.filter((v) => !v.startsWith("'sha256-")), ["'self'"]);
  // La del portal suma el gtag.js de Google Analytics y nada más.
  assert.deepEqual(directiva('script-src', RUTA_PORTAL).filter((v) => !v.startsWith("'sha256-")), ["'self'", HOST_GTAG]);
});

test('el import map apunta a archivos que existen en public/vendor', () => {
  const mapa = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  for (const [nombre, ruta] of Object.entries(mapa)) {
    assert.match(ruta, /^\/public\/vendor\//, nombre);
    assert.ok(existsSync(path.join(raiz, ruta)), `${nombre}: falta ${ruta} (npm run vendor)`);
  }
});

// El calendario del portal le pide los eventos a la API de Google Calendar.
// Además de Supabase, es el único host de connect-src en /app; el portal suma
// los de Google Analytics.
test('connect-src: Supabase y la API de Google Calendar, nada más (más Analytics en el portal)', async () => {
  const { HOST_AGENDA } = await import('../src/data/agenda.js');
  const url = readFileSync(path.join(raiz, 'public', 'config.js'), 'utf8').match(/SUPABASE_URL = '([^']+)'/)[1];
  const otros = directiva('connect-src').filter((h) => h !== "'self'" && h !== url && h !== url.replace('https://', 'wss://'));
  assert.deepEqual(otros, [`https://${HOST_AGENDA}`]);
  const delPortal = directiva('connect-src', RUTA_PORTAL).filter((h) => h !== "'self'" && h !== url && h !== url.replace('https://', 'wss://'));
  assert.deepEqual(delPortal, [`https://${HOST_AGENDA}`, ...HOSTS_ANALYTICS]);
});

test('connect-src llega al proyecto de Supabase que usa la app', () => {
  const url = readFileSync(path.join(raiz, 'public', 'config.js'), 'utf8').match(/SUPABASE_URL = '([^']+)'/)[1];
  assert.ok(directiva('connect-src')?.includes(url), `connect-src sin ${url}`);
});

// El marcador de salto reproduce el video elegido como objectURL. Sin
// media-src rige default-src 'self', que bloquea blob:, y el video queda en
// negro sólo en producción.
test('media-src deja reproducir el video local del marcador y nada más', () => {
  assert.deepEqual(directiva('media-src'), ['blob:']);
});

// Si el navegador guarda el HTML, lo revalida con el ETag, y el 304 de Vercel
// no trae la CSP: el navegador sigue aplicando la cabecera vieja aunque
// vercel.json cambie, hasta que cambie el HTML. Pasó con media-src.
test('el HTML no se guarda en caché, para que cada CSP nueva llegue', () => {
  for (const ruta of ['/', '/public/index.html']) {
    const reglas = vercel.headers.filter((h) => h.source === ruta).flatMap((h) => h.headers);
    const cache = reglas.find((h) => h.key.toLowerCase() === 'cache-control')?.value ?? '';
    assert.match(cache, /\bno-store\b/, `${ruta} sin Cache-Control: no-store`);
  }
});

test('no se puede embeber la app en otra página', () => {
  assert.deepEqual(directiva('frame-ancestors'), ["'none'"]);
});

// Las fuentes viven en public/fonts/: pedirlas a Google le pasaba la IP de
// cada persona que abre la app, algo que la política de privacidad no cubre.
test('las fuentes se sirven desde el propio dominio, sin Google Fonts', () => {
  assert.deepEqual(directiva('font-src'), ["'self'"]);
  assert.deepEqual(directiva('style-src'), ["'self'", "'unsafe-inline'"]);
  assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
  const tokens = readFileSync(path.join(raiz, 'public', 'css', 'tokens.css'), 'utf8');
  const archivos = [...tokens.matchAll(/url\((\/public\/fonts\/[^)]+)\)/g)].map((m) => m[1]);
  assert.equal(archivos.length, 10);
  for (const ruta of archivos) assert.ok(existsSync(path.join(raiz, ruta)), `falta ${ruta}`);
});

// El calendario del portal ya no es un iframe de Google: lo arma la página con
// los eventos que pide a la API (connect-src). frame-src deja YouTube sin
// cookies y el mapa de "Dónde se entrena" (www.google.com/maps, que el portal
// carga recién cuando la persona toca "Ver mapa").
test('frame-src sólo deja YouTube sin cookies y el mapa de Google, sin comodines', () => {
  const f = directiva('frame-src');
  assert.ok(f, 'falta frame-src');
  assert.ok(!f.some((v) => v.includes('*') || v === 'https:'), f.join(' '));
  assert.deepEqual([...f].sort(), ['https://www.google.com', 'https://www.youtube-nocookie.com']);
});

// El portal (public/portal.html) también lee la base, así que lleva el mismo
// import map. Si alguien lo toca en un solo lado, el hash cambia y el portal
// queda sin formularios en producción (la CSP la pone Vercel, no el local).
test('el import map del portal tiene su hash en script-src y no hay otros scripts inline', () => {
  const portal = readFileSync(path.join(raiz, 'public', 'portal.html'), 'utf8').replace(/\r\n/g, '\n');
  const m = portal.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(m, 'el portal no tiene import map');
  const hash = `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`;
  assert.ok(directiva('script-src', RUTA_PORTAL)?.includes(hash), `script-src no tiene ${hash} del portal`);
  // El JSON-LD (type="application/ld+json") es un bloque de datos: el navegador no lo ejecuta ni la CSP lo evalúa.
  const inline = [...portal.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter((x) => !/type="(importmap|application\/ld\+json)"/.test(x[1]));
  assert.deepEqual(inline.map((x) => x[0]), []);
});

// Lo mismo para /consultas: lee la lista de formularios, así que lleva el mismo import map.
test('el import map de /consultas tiene su hash en script-src y no hay otros scripts inline', () => {
  const pagina = readFileSync(path.join(raiz, 'public', 'consultas.html'), 'utf8').replace(/\r\n/g, '\n');
  const m = pagina.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(m, 'consultas.html no tiene import map');
  const hash = `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`;
  assert.ok(directiva('script-src', '/consultas')?.includes(hash), `script-src no tiene ${hash} de consultas.html`);
  const inline = [...pagina.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter((x) => !/type="importmap"/.test(x[1]));
  assert.deepEqual(inline.map((x) => x[0]), []);
});

// Google Analytics 4 va SÓLO en el portal: la app (menores) y las páginas
// internas no cargan analitica.js. Tiene que ser un archivo externo y diferido
// (la CSP no deja inline, y así no pesa en el LCP).
test('Google Analytics se carga sólo en el portal, desde un script externo diferido', () => {
  const portal = readFileSync(path.join(raiz, 'public', 'portal.html'), 'utf8');
  assert.match(portal, /<script defer src="\/public\/js\/analitica\.js"><\/script>/);
  for (const otra of ['index.html', 'consultas.html', 'legal/privacidad.html', 'legal/terminos.html']) {
    const contenido = readFileSync(path.join(raiz, 'public', otra), 'utf8');
    assert.doesNotMatch(contenido, /analitica\.js|googletagmanager|gtag/, `${otra} no puede cargar Analytics`);
  }
  const js = readFileSync(path.join(raiz, 'public', 'js', 'analitica.js'), 'utf8');
  assert.match(js, /G-5DDKGTFXTC/);
});

// Lo que protege a los menores: la CSP que recibe la app no menciona Analytics.
const RUTAS_APP = ['/app', '/app/', '/app/cualquier/cosa', '/public/index.html', '/public/sw.js'];
const RUTAS_SITIO = ['/', '/privacidad', '/terminos', '/consultas', '/public/portal.html', '/public/legal/privacidad.html', '/public/legal/terminos.html', '/public/consultas.html', '/public/js/analitica.js'];

test('cada ruta recibe exactamente una CSP: las reglas no se pisan ni se combinan', () => {
  for (const ruta of [...RUTAS_APP, ...RUTAS_SITIO, '/appx', '/application', '/src/ui/portal.js', '/robots.txt']) csp(ruta);
});

test('la CSP de /app (y de todo lo que cuelga de /app) no tiene hosts de Google Analytics', () => {
  for (const ruta of RUTAS_APP) {
    const politica = csp(ruta);
    for (const h of HOSTS_ANALYTICS) assert.ok(!politica.includes(h), `${ruta} habilita ${h}`);
    assert.doesNotMatch(politica, /google-analytics|analytics\.google|googletagmanager/, ruta);
  }
});

test('la CSP del portal y del resto del sitio habilita los hosts de Analytics', () => {
  for (const ruta of RUTAS_SITIO) {
    const politica = csp(ruta);
    for (const h of HOSTS_ANALYTICS) assert.ok(politica.includes(h), `${ruta} no habilita ${h}`);
  }
});

// La amplia es la estricta más Analytics: si alguien toca una y se olvida de la
// otra, se desfasan sin que nada falle en local (la CSP la pone Vercel).
test('la CSP amplia es igual a la estricta salvo por los hosts de Analytics', () => {
  const sinAnalytics = HOSTS_ANALYTICS.reduce((p, h) => p.split(` ${h}`).join(''), csp(RUTA_PORTAL));
  assert.equal(sinAnalytics, csp(RUTA_APP));
});

test('analitica.js reporta WhatsApp, inscripción, colaborar e Instagram con link_url y section', () => {
  const portal = readFileSync(path.join(raiz, 'public', 'portal.html'), 'utf8');
  const js = readFileSync(path.join(raiz, 'public', 'js', 'analitica.js'), 'utf8');
  for (const e of ['click_whatsapp', 'click_instagram']) assert.ok(js.includes(`'${e}'`), e);
  assert.match(js, /link_url: a\.href, section: seccionDe\(a\)/);
  // Instagram: el enlace visible del pie; el evento sale del destino.
  const pie = portal.match(/<footer class="portal-pie">[\s\S]*?<\/footer>/)[0];
  assert.match(pie, /<a href="https:\/\/www\.instagram\.com\/basquetnewells" target="_blank" rel="noopener">Seguinos en Instagram<\/a>/);
  // Inscripción (hero y barra fija) y colaborar (recaudación y sumate) se marcan en portal.html.
  assert.equal([...portal.matchAll(/data-evento="click_inscripcion"/g)].length, 2);
  assert.equal([...portal.matchAll(/data-evento="click_colaborar"/g)].length, 2);
});
