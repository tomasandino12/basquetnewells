import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La mudanza a React convive con la app actual sin tocarla: lo nuevo vive en
 * web/, fuera de lo que el navegador carga (/public y /src), no se sube al
 * deploy y no cambia cómo se sirve la app. Si un test de acá falla, alguien
 * mezcló la mudanza con lo que ve la gente.
 */

const leer = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(leer(p));
const archivos = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name === 'node_modules' || e.name === 'dist') return [];
  const p = join(dir, e.name);
  return e.isDirectory() ? archivos(p) : [p];
});

test('web/ queda afuera del deploy', () => {
  const lineas = leer('.vercelignore').split(/\r?\n/).map((l) => l.trim());
  assert.ok(lineas.includes('web/'), '.vercelignore tiene que listar web/');
});

test('el deploy sigue siendo estático: sin armado, sin framework, sin rutas hacia web/', () => {
  const v = json('vercel.json');
  for (const clave of ['buildCommand', 'outputDirectory', 'framework', 'installCommand']) {
    assert.equal(v[clave], undefined, `vercel.json no debe fijar ${clave}`);
  }
  assert.ok(!JSON.stringify(v).includes('web/'), 'vercel.json no enruta hacia web/');
});

test('la app vieja no carga nada de web/ ni de React', () => {
  const html = leer('public/index.html');
  assert.ok(!/web\/|react/i.test(html), 'public/index.html no referencia web/ ni React');
  const rotos = archivos('src').filter((p) => /\.(js|css|html)$/.test(p))
    .filter((p) => /from\s*['"](react|react-dom)|\.\.\/web\/|\/web\//.test(leer(p)));
  assert.deepEqual(rotos, [], `src/ no importa de React ni de web/:\n  ${rotos.join('\n  ')}`);
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
