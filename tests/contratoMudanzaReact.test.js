import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La mudanza a React convive con la app actual sin tocarla: lo nuevo vive en
 * web/, fuera de lo que el navegador carga (/public y /src). Desde el 04/11
 * Vercel lo arma en cada deploy y lo publica aparte, en /nueva, para que Tomás
 * vaya viendo los cambios (nadie usa la app todavía). La app vieja se sigue
 * sirviendo igual. Si un test de acá falla, alguien mezcló la mudanza con lo
 * que ve la gente.
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

test('el deploy arma web/ y la publica solo en /nueva, sin dejar el código ni lo instalado', () => {
  const v = json('vercel.json');
  assert.equal(v.framework, undefined);
  assert.equal(v.outputDirectory, '.', 'la app vieja se sirve desde la raíz (/public y /src)');
  assert.equal(v.installCommand, 'cd web && npm ci');
  assert.equal(v.buildCommand, 'cd web && npm run build && cd .. && rm -rf nueva && mv web/dist nueva && rm -rf web');
  const destino = Object.fromEntries(v.rewrites.map((r) => [r.source, r.destination]));
  assert.equal(destino['/'], '/public/portal.html');
  assert.equal(destino['/app'], '/public/index.html');
  assert.equal(destino['/nueva'], '/nueva/index.html');
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

test('desde /app sólo se llega a /nueva por pantallaNueva.js, detrás del interruptor y con respaldo', () => {
  // Etapa 2: la app vieja puede abrir Plantel y la ficha nuevas. Es la única puerta.
  const puertas = archivos('src').filter((p) => /\.(js|html)$/.test(p))
    .filter((p) => /['"`]\/nueva\b/.test(leer(p))).map((p) => p.replaceAll('\\', '/')).sort();
  assert.deepEqual(puertas, ['src/data/interruptorNueva.js'], 'la dirección de /nueva vive en un solo módulo');
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

test('el salto a /nueva: al tocar Plantel u Hoy, y al entrar sólo una vez por pestaña', () => {
  const main = leer('src/ui/main.js');
  assert.equal((main.match(/abrirEnNueva\(/g) ?? []).length, 2, 'sólo Plantel y Hoy en main.js');
  assert.match(main, /onTab: async \(id\) => \{\s*if \(id === 'p-plantel' && await abrirEnNueva[^\n]*\r?\n\s*if \(id === 'p-hoy' && await abrirEnNueva/);
  // Desde el 09/11/2026 también al entrar (Tomás abría /app y seguía viendo lo viejo).
  assert.equal((main.match(/abrirAlEntrar\(/g) ?? []).length, 1, 'un solo salto al entrar');
  const puerta = leer('src/ui/pantallaNueva.js');
  assert.match(puerta, /sessionStorage\.getItem\(CLAVE_YA_SALTO\)\) return false/, 'una vez por pestaña: volver desde /nueva no rebota');
  assert.match(puerta, /window\.location\.replace\(destino\)/, 'al entrar, replace: el atrás no rebota');
});

test('/nueva queda fuera del service worker de /app y no se cachea en el navegador', () => {
  const v = json('vercel.json');
  const sw = v.headers.find((h) => h.source === '/public/sw.js').headers.find((x) => x.key === 'Service-Worker-Allowed');
  assert.equal(sw.value, '/app', 'el service worker no intercepta /nueva: sin copia sin conexión');
  const sinCache = v.headers.filter((h) => h.headers.some((x) => x.key === 'Cache-Control' && x.value === 'no-store')).map((h) => h.source);
  assert.ok(sinCache.includes('/nueva') && sinCache.includes('/nueva/index.html'));
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
