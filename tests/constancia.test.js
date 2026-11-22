import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asistenciaSeguida, mejorRacha } from '../src/data/constancia.js';

test('asistenciaSeguida: un día sin tomar no suma ni corta', () => {
  assert.equal(asistenciaSeguida([true, false, true, true, null, true]), 3);
  assert.equal(asistenciaSeguida([null, null]), 0);
});

test('asistenciaSeguida: una falta corta', () => {
  assert.equal(asistenciaSeguida([true, true, false]), 0);
  assert.equal(asistenciaSeguida([false, true, true]), 2);
});

test('mejorRacha: la más larga de la lista', () => {
  // Aunque ya se haya cortado: la mejor no es la actual.
  assert.equal(mejorRacha([true, true, null, true, false, true]), 3);
  assert.equal(mejorRacha([false, false]), 0);
  assert.equal(mejorRacha([]), 0);
});
