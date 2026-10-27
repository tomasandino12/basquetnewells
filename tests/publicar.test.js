import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { esPrivado } from '../scripts/publicar.mjs';

test('esPrivado reconoce carpetas enteras y archivos exactos', () => {
  assert.ok(esPrivado('docs/privado/SEGURIDAD-LANZAMIENTO.md'));
  assert.ok(esPrivado('docs/legal/acuerdo-datos-club.md'));
  assert.ok(esPrivado('docs/SEGURIDAD-LANZAMIENTO.md'));
  assert.ok(!esPrivado('docs/guias/BACKUP.md'));
  assert.ok(!esPrivado('public/legal/privacidad.html'));
});

// El repo es público: si un archivo privado vuelve a versionarse, la copia
// pública lo saca de la historia, pero el repo de trabajo lo mostraría igual.
test('ningún archivo privado está versionado', () => {
  const versionados = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  assert.deepEqual(versionados.filter(esPrivado), []);
});
