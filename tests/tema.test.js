import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVE_TEMA, normalizarTema } from '../src/data/tema.js';

test("'oscuro' se respeta", () => {
  assert.equal(normalizarTema('oscuro'), 'oscuro');
});

test('valor raro o vacío da claro', () => {
  for (const v of [null, undefined, '', 'claro', 'Oscuro', 'dark', 'true', 1, {}, ' oscuro']) {
    assert.equal(normalizarTema(v), 'claro', `${JSON.stringify(v)} es claro`);
  }
});

test('la clave guardada es la de siempre', () => {
  assert.equal(CLAVE_TEMA, 'semillero.tema');
});
