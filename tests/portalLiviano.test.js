import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

/**
 * El portal es lo primero que ve una familia con el celular y mala señal: no
 * puede bajar `xlsx` (~1 MB sin comprimir, sólo sirve para importar planillas
 * en la app). Llegaba a través de parserCabb.js, que importaba `clavearNombre`
 * desde la capa de datos. Este test recorre el grafo de módulos del portal.
 */
test('el portal no importa xlsx ni ningún parser de planillas', async () => {
  const { metafile } = await build({
    entryPoints: ['src/ui/portalArranque.js'], bundle: true, format: 'esm', write: false, logLevel: 'error',
    external: ['xlsx', '@supabase/supabase-js'], metafile: true,
  });
  const modulos = Object.keys(metafile.inputs);
  const importanXlsx = modulos.filter((m) => metafile.inputs[m].imports.some((i) => i.path === 'xlsx'));
  assert.deepEqual(importanXlsx, [], 'el portal arrastra xlsx por estos módulos');
  assert.deepEqual(modulos.filter((m) => m.startsWith('src/parser/')), [], 'el portal arrastra un parser de planillas');
});
