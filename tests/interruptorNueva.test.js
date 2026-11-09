import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVE_NUEVA, CLAVE_PLANTEL, direccionNueva, normalizarNueva, plantelSeguro } from '../src/data/interruptorNueva.js';

test("prendido por defecto: sólo 'no' lo apaga", () => {
  assert.equal(normalizarNueva('no'), 'no');
  for (const v of [null, undefined, '', 'si', 'No', 'true', '1', 1, true, {}, ' no']) {
    assert.equal(normalizarNueva(v), 'si', `${JSON.stringify(v)} es prendido`);
  }
});

test('las claves guardadas son las de siempre', () => {
  assert.equal(CLAVE_NUEVA, 'semillero.nueva');
  assert.equal(CLAVE_PLANTEL, 'semillero.plantel');
});

test('direcciones limpias, sin ids: Hoy y Plantel', () => {
  assert.equal(direccionNueva({ pantalla: 'hoy' }), '/app/hoy');
  assert.equal(direccionNueva({ plantelId: 'abc-123', pantalla: 'hoy' }), '/app/hoy', 'la categoría no va en la dirección');
  assert.equal(direccionNueva({ plantelId: 'abc-123' }), '/app/plantel');
  assert.equal(direccionNueva(), '/app/plantel');
});

test('la ficha va con ?jugador= (la nueva lo cambia por el nombre) y un id raro se ignora', () => {
  assert.equal(direccionNueva({ jugadorId: 'j_9' }), '/app/plantel?jugador=j_9');
  assert.equal(direccionNueva({ jugadorId: 'a&b=1' }), '/app/plantel');
});

test('sólo se guarda una categoría con forma de id', () => {
  assert.equal(plantelSeguro('abc-123'), 'abc-123');
  for (const v of [undefined, null, '', 'a/b', '../app', 'x?y=1', 'a#b', 'https://malo.com', 'x'.repeat(65), 5]) {
    assert.equal(plantelSeguro(v), null, JSON.stringify(v));
  }
});
