import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVE_NUEVA, RUTA_NUEVA, direccionNueva, normalizarNueva } from '../src/data/interruptorNueva.js';

test("prendido por defecto: sólo 'no' lo apaga", () => {
  assert.equal(normalizarNueva('no'), 'no');
  for (const v of [null, undefined, '', 'si', 'No', 'true', '1', 1, true, {}, ' no']) {
    assert.equal(normalizarNueva(v), 'si', `${JSON.stringify(v)} es prendido`);
  }
});

test('Hoy va al resumen nuevo del plantel', () => {
  assert.equal(direccionNueva({ plantelId: 'abc-123', pantalla: 'hoy' }), '/app#/hoy/abc-123');
  assert.equal(direccionNueva({ plantelId: '../x', pantalla: 'hoy' }), '/app#/');
});

test('la clave guardada es la de siempre', () => {
  assert.equal(CLAVE_NUEVA, 'semillero.nueva');
});

test('la dirección lleva al plantel, y a la ficha si hay jugador', () => {
  assert.equal(direccionNueva({ plantelId: 'abc-123' }), '/app#/plantel/abc-123');
  assert.equal(direccionNueva({ plantelId: 'abc-123', jugadorId: 'j_9' }), '/app#/plantel/abc-123?jugador=j_9');
});

test('sin plantel o con un id raro va a la lista de planteles', () => {
  for (const plantelId of [undefined, null, '', 'a/b', '../app', 'x?y=1', 'a#b', 'https://malo.com', 'x'.repeat(65), 5]) {
    assert.equal(direccionNueva({ plantelId }), `${RUTA_NUEVA}#/`, JSON.stringify(plantelId));
  }
  assert.equal(direccionNueva(), `${RUTA_NUEVA}#/`);
});

test('un jugador con id raro se ignora, el plantel queda', () => {
  assert.equal(direccionNueva({ plantelId: 'p1', jugadorId: 'a&b=1' }), '/app#/plantel/p1');
});

test('la dirección siempre es del mismo origen', () => {
  assert.ok(direccionNueva({ plantelId: 'p1' }).startsWith('/app#'));
});
