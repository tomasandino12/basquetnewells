import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';

/**
 * El service worker es lo único que puede dejar datos guardados en el
 * celular sin que nadie lo note. Lo que estos tests atan:
 * - nada de otro origen (Supabase, Google) pasa por la caché: dejaría datos
 *   de menores en el dispositivo y mostraría datos viejos;
 * - /src y el CSS no se interceptan: sin hash en el nombre, servirlos de la
 *   caché deja al celular con HTML nuevo y JS viejo después de un deploy;
 * - la versión del caché es el hash de los archivos que sí se cachean, así
 *   que cambiar un vendor sin tocar sw.js hace fallar este test.
 */

const RAIZ = process.cwd();
const CODIGO = readFileSync('public/sw.js', 'utf8');
const ORIGEN = 'https://app-semillero.vercel.app';

function archivosFijos() {
  const lista = ['public/escudo.png'];
  const recorrer = (dir) => {
    for (const f of readdirSync(dir)) {
      const ruta = `${dir}/${f}`;
      if (statSync(ruta).isDirectory()) recorrer(ruta); else lista.push(ruta);
    }
  };
  for (const d of ['public/vendor', 'public/fonts', 'public/icons']) recorrer(d);
  return lista.sort();
}

// CRLF → LF antes de hashear: git en Windows convierte los de texto (el SVG,
// los .mjs) y en Linux no; sin esto la versión dependería de la máquina.
function versionEsperada() {
  const h = createHash('sha256');
  for (const ruta of archivosFijos()) {
    h.update(`${ruta}\n`).update(readFileSync(path.join(RAIZ, ruta), 'latin1').replace(/\r\n/g, '\n'), 'latin1');
  }
  return h.digest('hex').slice(0, 12);
}

/** Corre sw.js en un contexto con un `self`, `caches` y `fetch` de mentira. */
function cargar({ red = async () => new Response('red'), guardado = {} } = {}) {
  const oyentes = {};
  const puestos = [];
  const borrados = [];
  const cache = {
    match: async (req) => guardado[typeof req === 'string' ? req : new URL(req.url).pathname] ?? undefined,
    put: async (req, res) => { puestos.push(typeof req === 'string' ? req : req.url); },
  };
  const ctx = {
    URL, Request, Response, Promise, console,
    fetch: red,
    caches: {
      open: async () => cache,
      match: cache.match,
      keys: async () => Object.keys(guardado.__nombres ?? {}),
      delete: async (n) => { borrados.push(n); return true; },
    },
    self: {
      location: new URL(`${ORIGEN}/public/sw.js`),
      addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(CODIGO, ctx);
  const evaluar = (expr) => vm.runInContext(expr, ctx);
  /** Dispara un fetch y devuelve la respuesta, o null si el SW no intervino. */
  async function pedir(url, { metodo = 'GET', modo = 'no-cors' } = {}) {
    let respuesta = null;
    const pendientes = [];
    oyentes.fetch({
      request: { url, method: metodo, mode: modo, clone() { return this; } },
      respondWith: (p) => { respuesta = p; },
      waitUntil: (p) => pendientes.push(p),
    });
    const r = respuesta ? await respuesta : null;
    await Promise.all(pendientes);
    return r;
  }
  return { oyentes, puestos, borrados, evaluar, pedir };
}

const estrategia = (url, metodo = 'GET', modo = 'no-cors') =>
  cargar().evaluar(`estrategia(new URL(${JSON.stringify(url)}), ${JSON.stringify(metodo)}, ${JSON.stringify(modo)}, ${JSON.stringify(ORIGEN)})`);

test('otro origen no se intercepta (Supabase, Google)', async () => {
  for (const url of ['https://lseqvbtdzebomxwtqhwu.supabase.co/rest/v1/jugadores', 'wss://lseqvbtdzebomxwtqhwu.supabase.co/realtime',
    'https://calendar.google.com/calendar/embed?src=x', 'https://www.youtube-nocookie.com/embed/x']) {
    assert.equal(estrategia(url), null, url);
    assert.equal(estrategia(url, 'GET', 'navigate'), null, url);
  }
  const sw = cargar();
  assert.equal(await sw.pedir('https://lseqvbtdzebomxwtqhwu.supabase.co/rest/v1/jugadores'), null);
  assert.deepEqual(sw.puestos, []);
});

test('POST y otros métodos no se interceptan', () => {
  assert.equal(estrategia(`${ORIGEN}/app`, 'POST', 'navigate'), null);
  assert.equal(estrategia(`${ORIGEN}/public/vendor/xlsx.mjs`, 'PUT'), null);
});

test('una navegación a la app es red-primero', () => {
  assert.equal(estrategia(`${ORIGEN}/app`, 'GET', 'navigate'), 'red-primero');
  assert.equal(estrategia(`${ORIGEN}/app?code=abc`, 'GET', 'navigate'), 'red-primero');
});

test('el portal y las páginas legales no se interceptan: el service worker es sólo de /app', () => {
  for (const ruta of ['/', '/?utm_source=whatsapp', '/privacidad', '/terminos', '/public/portal.html', '/public/legal/privacidad.html']) {
    assert.equal(estrategia(`${ORIGEN}${ruta}`, 'GET', 'navigate'), null, ruta);
  }
});

test('src, css y config.js no se interceptan', () => {
  for (const ruta of ['/src/ui/main.js', '/src/data/portal.js', '/public/css/publico.css', '/public/config.js', '/public/index.html', '/public/manifest.webmanifest']) {
    assert.equal(estrategia(`${ORIGEN}${ruta}`), null, ruta);
  }
});

test('vendor, fuentes, íconos y escudo son cache-primero', () => {
  for (const ruta of ['/public/vendor/supabase-js.mjs', '/public/fonts/inter-latin-400-normal.woff2', '/public/icons/icono-192.png', '/public/escudo.png']) {
    assert.equal(estrategia(`${ORIGEN}${ruta}`), 'cache-primero', ruta);
  }
});

test('sólo se guarda /app sin query: la vuelta del login con ?code= no', async () => {
  const sw = cargar();
  await sw.pedir(`${ORIGEN}/app`, { modo: 'navigate' });
  await sw.pedir(`${ORIGEN}/app?code=abc`, { modo: 'navigate' });
  await sw.pedir(`${ORIGEN}/`, { modo: 'navigate' });
  assert.deepEqual(sw.puestos, ['/app']);
});

test('sin red, la navegación cae a la copia de /app', async () => {
  const sw = cargar({ red: async () => { throw new TypeError('sin red'); }, guardado: { '/app': new Response('copia') } });
  const r = await sw.pedir(`${ORIGEN}/app?code=abc`, { modo: 'navigate' });
  assert.equal(await r.text(), 'copia');
});

test('con red, la navegación siempre trae lo nuevo aunque haya copia', async () => {
  const sw = cargar({ guardado: { '/app': new Response('vieja') } });
  const r = await sw.pedir(`${ORIGEN}/app`, { modo: 'navigate' });
  assert.equal(await r.text(), 'red');
});

test('una respuesta con error no se guarda', async () => {
  const sw = cargar({ red: async () => new Response('no', { status: 500 }) });
  await sw.pedir(`${ORIGEN}/public/vendor/xlsx.mjs`);
  await sw.pedir(`${ORIGEN}/app`, { modo: 'navigate' });
  assert.deepEqual(sw.puestos, []);
});

test('VERSION coincide con el hash de los archivos cacheados', () => {
  assert.equal(cargar().evaluar('VERSION'), versionEsperada(),
    'cambió un archivo de vendor/, fonts/, icons/ o el escudo: actualizar VERSION en public/sw.js');
});

test('activate borra los cachés propios de otra versión y nada más', async () => {
  const actual = `inferiores-${versionEsperada()}`;
  const sw = cargar({ guardado: { __nombres: { 'inferiores-viejo': 1, [actual]: 1, 'de-otro': 1 } } });
  const pendientes = [];
  sw.oyentes.activate({ waitUntil: (p) => pendientes.push(p) });
  await Promise.all(pendientes);
  assert.deepEqual(sw.borrados, ['inferiores-viejo']);
});

test('Vercel sirve sw.js sin caché y con alcance /app', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const h = vercel.headers.filter((x) => x.source === '/public/sw.js').flatMap((x) => x.headers);
  const valor = (k) => h.find((x) => x.key.toLowerCase() === k)?.value;
  assert.equal(valor('service-worker-allowed'), '/app');
  assert.match(valor('cache-control') ?? '', /no-cache/);
});

test('pwa.js registra con alcance /app y no usa fetch ni el repositorio', () => {
  const codigo = readFileSync('src/ui/pwa.js', 'utf8');
  assert.match(codigo, /register\('\/public\/sw\.js', \{ scope: '\/app' \}\)/);
  assert.doesNotMatch(codigo, /\bfetch\s*\(|repositorio|repos\//);
  assert.match(readFileSync('src/ui/main.js', 'utf8'), /registrarServiceWorker\(\)/);
});
