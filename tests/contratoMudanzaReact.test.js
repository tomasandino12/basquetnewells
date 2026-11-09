import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La mudanza a React: lo nuevo vive en web/, fuera de lo que carga la app de
 * siempre (/public y /src). Vercel lo arma en cada deploy. Desde el 09/11/2026
 * la nueva ES /app (lo pidió Tomás: «que aparezca en /app que es lo que
 * estamos armando») y la de siempre vive en /app/clasica para lo que todavía
 * no se mudó (H-175). /nueva queda como redirección a /app.
 */

const leer = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(leer(p));
const archivos = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name === 'node_modules' || e.name === 'dist') return [];
  const p = join(dir, e.name);
  return e.isDirectory() ? archivos(p) : [p];
});

test('web/ se sube al deploy sin lo instalado ni lo armado en la compu', () => {
  const lineas = leer('.vercelignore').split(/\r?\n/).map((l) => l.trim());
  assert.ok(!lineas.includes('web/'), 'web/ tiene que subirse: Vercel la arma');
  for (const l of ['web/node_modules/', 'web/dist/', '/package.json', '/package-lock.json']) {
    assert.ok(lineas.includes(l), `.vercelignore tiene que listar ${l}`);
  }
  assert.ok(!lineas.includes('package.json'), 'sin «/», package.json deja afuera también web/package.json');
});

test('el deploy arma web/ y la sirve en /app; la de siempre queda en /app/clasica', () => {
  const v = json('vercel.json');
  assert.equal(v.framework, undefined);
  assert.equal(v.outputDirectory, '.', 'la app vieja se sirve desde la raíz (/public y /src)');
  assert.equal(v.installCommand, 'cd web && npm ci');
  assert.equal(v.buildCommand, 'cd web && npm run build && cd .. && rm -rf nueva && mv web/dist nueva && rm -rf web');
  const destino = Object.fromEntries(v.rewrites.map((r) => [r.source, r.destination]));
  assert.equal(destino['/'], '/public/portal.html');
  assert.equal(destino['/app'], '/nueva/index.html', 'la app nueva es /app');
  assert.equal(destino['/app/clasica'], '/public/index.html', 'la de siempre, para lo que no se mudó');
  assert.equal(destino['/nueva'], undefined);
  assert.deepEqual(v.redirects, [{ source: '/nueva', destination: '/app', permanent: false }], 'los enlaces viejos a /nueva van a /app');
  assert.ok(!JSON.stringify(v.rewrites).includes('web/'), 'nada se sirve directo desde web/');
  assert.match(leer('web/vite.config.ts'), /base: '\/nueva\/'/, 'lo armado tiene que pedir sus archivos en /nueva/');
});

test('la app vieja no carga nada de web/ ni de React', () => {
  const html = leer('public/index.html');
  assert.ok(!/web\/|react/i.test(html), 'public/index.html no referencia web/ ni React');
  const rotos = archivos('src').filter((p) => /\.(js|css|html)$/.test(p))
    .filter((p) => /from\s*['"](react|react-dom)|\.\.\/web\/|\/web\//.test(leer(p)));
  assert.deepEqual(rotos, [], `src/ no importa de React ni de web/:\n  ${rotos.join('\n  ')}`);
});

test('desde la de siempre sólo se pasa a la nueva por pantallaNueva.js, detrás del interruptor y con respaldo', () => {
  const puertas = archivos('src').filter((p) => /\.(js|html)$/.test(p))
    .filter((p) => /['"`]\/nueva\b|['"`]\/app\/clasica/.test(leer(p))).map((p) => p.replaceAll('\\', '/')).sort();
  assert.deepEqual(puertas, ['src/data/interruptorNueva.js'], 'las direcciones de las dos apps viven en un solo módulo');
  assert.match(leer('src/data/interruptorNueva.js'), /RUTA_NUEVA = '\/app'[\s\S]*RUTA_CLASICA = '\/app\/clasica'/);
  const ui = archivos('src/ui').filter((p) => /\.js$/.test(p))
    .filter((p) => /pantallaNueva\.js/.test(leer(p))).map((p) => p.replaceAll('\\', '/')).sort();
  assert.deepEqual(ui, ['src/ui/main.js', 'src/ui/pantallas/miPerfil.js', 'src/ui/pantallas/registro.js']);
  const puerta = leer('src/ui/pantallaNueva.js');
  assert.match(puerta, /if \(!nuevaPrendida\(\)\) return false/, 'apagado no hace nada');
  assert.match(puerta, /method: 'HEAD'/, 'comprueba que /nueva responda antes de irse (respaldo)');
  const m = leer('src/data/interruptorNueva.js');
  // Desde el 08/11/2026 prendido por defecto (lo pidió Tomás: ver el rediseño en /app); se apaga en Mi perfil.
  assert.match(m, /normalizarNueva\(valor\)[\s\S]*valor === 'no' \? 'no' : 'si'/, 'prendido por defecto, sólo "no" lo apaga');
});

test('la de siempre pasa a la nueva al tocar Plantel u Hoy, y al entrar salvo que venga de la nueva', () => {
  const main = leer('src/ui/main.js');
  assert.equal((main.match(/abrirEnNueva\(/g) ?? []).length, 2, 'sólo Plantel y Hoy en main.js');
  assert.match(main, /onTab: async \(id\) => \{\s*if \(id === 'p-plantel' && await abrirEnNueva[^\n]*\r?\n\s*if \(id === 'p-hoy' && await abrirEnNueva/);
  assert.equal((main.match(/abrirAlEntrar\(/g) ?? []).length, 1, 'un solo salto al entrar');
  const puerta = leer('src/ui/pantallaNueva.js');
  assert.match(puerta, /if \(vieneDeLaNueva\(window\.location\.search\)\) return false/, 'la nueva la mandó a propósito: no rebota');
  // La nueva enlaza a la de siempre siempre con ?desde=nueva, desde un solo lugar.
  assert.match(leer('web/src/clasica.ts'), /APP_DE_SIEMPRE = `\$\{RUTA_CLASICA\}\?desde=nueva`/);
  const sueltos = archivos('web/src').filter((p) => /\.tsx?$/.test(p) && !/\.test\./.test(p))
    .filter((p) => /['"`]\/app\//.test(leer(p))).map((p) => p.replaceAll('\\', '/'));
  assert.deepEqual(sueltos, [], 'nada enlaza a /app/ a mano: va por APP_DE_SIEMPRE');
  assert.match(puerta, /window\.location\.replace\(destino\)/, 'al entrar, replace: el atrás no rebota');
});

test('/app y /app/clasica no se guardan en el navegador', () => {
  const v = json('vercel.json');
  const sw = v.headers.find((h) => h.source === '/public/sw.js').headers.find((x) => x.key === 'Service-Worker-Allowed');
  assert.equal(sw.value, '/app');
  const sinCache = v.headers.filter((h) => h.headers.some((x) => x.key === 'Cache-Control' && x.value === 'no-store')).map((h) => h.source);
  for (const r of ['/app', '/app/clasica', '/nueva/index.html']) assert.ok(sinCache.includes(r), r);
});

test('la vuelta del login llega a /app y la nueva se la pasa a la de siempre', () => {
  assert.match(leer('src/data/repos/auth.js'), /pathname\.startsWith\('\/app'\) \? '\/app'/, 'redirect permitido en Supabase: /app');
  assert.match(leer('web/src/clasica.ts'), /destinoDeAuth\(search, hash\)/);
  assert.match(leer('web/src/main.tsx'), /if \(!reenviarSiCorresponde\(\)\)/, 'antes de dibujar nada');
});

test('el package.json de la raíz no cambió de forma: sin React y con versiones exactas', () => {
  const p = json('package.json');
  const todas = { ...p.dependencies, ...p.devDependencies };
  for (const n of Object.keys(todas)) assert.ok(!/^(react|vite|tailwindcss|typescript|vitest)/.test(n), `${n} va en web/package.json`);
  assert.equal(p.scripts['test:q'], 'node --test --test-reporter=dot "tests/*.test.js"');
});

test('las dependencias de web/ van con versión exacta (sin ^, ~ ni rangos)', () => {
  const p = json('web/package.json');
  const flojas = Object.entries({ ...p.dependencies, ...p.devDependencies })
    .filter(([, v]) => !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v));
  assert.deepEqual(flojas, [], `Versiones sin fijar: ${flojas.map(([n, v]) => `${n}@${v}`).join(', ')}`);
});

test('web/ no usa enlaces simbólicos ni junctions', () => {
  const enlaces = [];
  const mirar = (dir) => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules') continue;
      const p = join(dir, e);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) enlaces.push(p);
      else if (st.isDirectory()) mirar(p);
    }
  };
  if (existsSync('web')) mirar('web');
  assert.deepEqual(enlaces, []);
});

test('la pantalla de ejemplo no habla con Supabase ni con repos', () => {
  const rotos = archivos('web/src').filter((p) => /\.(ts|tsx)$/.test(p))
    .filter((p) => /supabase|data\/repos|cliente/.test(leer(p)));
  assert.deepEqual(rotos, [], 'Los datos entran por repositorio.js, no directo');
});
