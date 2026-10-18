/*
 * Service worker de Inferiores. Existe para que el sitio se pueda instalar en
 * el celular, no para que la app ande sin conexión (fuera de alcance).
 * Reglas y porqués en docs/superpowers/specs/2026-10-16-portal-pwa-design.md;
 * las ata tests/serviceWorker.test.js.
 *
 * - Otro origen (Supabase, Google) NO se intercepta: nunca entra a la caché.
 *   Guardar respuestas de Supabase dejaría datos de menores en el celular.
 * - /src y el CSS NO se interceptan: no llevan hash en el nombre, y servirlos
 *   de la caché dejaría HTML nuevo con JS viejo después de un deploy. Siguen
 *   con el no-cache de vercel.json, como antes de que existiera este archivo.
 * - El HTML va red-primero; la copia de / sólo se usa sin conexión.
 * - Lo que no cambia entre deploys (vendor, fuentes, íconos, escudo) va
 *   caché-primero, en un caché con la versión en el nombre.
 *
 * VERSION es el hash de esos archivos fijos: si cambia uno (npm run vendor),
 * el test falla y dice el valor nuevo. Plan de escape si esto rompe algo: ver
 * docs/SEGURIDAD-LANZAMIENTO.md.
 *
 * Script clásico y no módulo: Safari tardó en aceptar service workers módulo.
 */
const VERSION = 'fc450fe3a8ef';
const PREFIJO = 'inferiores-';
const CACHE = PREFIJO + VERSION;
const FIJOS = /^\/public\/(?:vendor|fonts|icons)\/|^\/public\/escudo\.png$/;

function estrategia(url, metodo, modo, origen) {
  if (metodo !== 'GET' || url.origin !== origen) return null;
  if (modo === 'navigate') return 'red-primero';
  if (FIJOS.test(url.pathname)) return 'cache-primero';
  return null;
}

async function redPrimero(pedido, url) {
  try {
    const respuesta = await fetch(pedido);
    // Sólo la portada limpia: nunca la vuelta del login (?code=, #access_token).
    if (respuesta.ok && url.pathname === '/' && !url.search) {
      const cache = await caches.open(CACHE);
      await cache.put('/', respuesta.clone());
    }
    return respuesta;
  } catch (error) {
    const copia = await (await caches.open(CACHE)).match('/');
    if (copia) return copia;
    throw error;
  }
}

async function cachePrimero(pedido) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(pedido);
  if (guardada) return guardada;
  const respuesta = await fetch(pedido);
  if (respuesta.ok) await cache.put(pedido, respuesta.clone());
  return respuesta;
}

self.addEventListener('install', () => {
  // Sin esperar a que se cierren las pestañas: el deploy entra al recargar.
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith(PREFIJO) && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  const cual = estrategia(url, pedido.method, pedido.mode, self.location.origin);
  if (cual === 'red-primero') evento.respondWith(redPrimero(pedido, url));
  else if (cual === 'cache-primero') evento.respondWith(cachePrimero(pedido));
});
