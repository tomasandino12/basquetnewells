import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESTINOS_DE_MEDIR, pantallaPedida } from '../src/data/interruptorNueva.js';

// Lo que llega por la dirección nunca se usa como id de pantalla sin pasar por la lista cerrada.

test('cada test pedido abre su pantalla', () => {
  assert.equal(pantallaPedida('?desde=nueva&ir=tiro'), 'p-medir-bateria');
  assert.equal(pantallaPedida('?desde=nueva&ir=salto'), 'p-medir-salto');
  assert.equal(pantallaPedida('?ir=sprint'), 'p-medir-sprint');
  assert.equal(pantallaPedida('ir=yoyo'), 'p-medir-yoyo');
  assert.equal(pantallaPedida('?ir=medir'), 'p-medir');
});

test('sin pedido, o con uno que no está en la lista, no abre nada', () => {
  assert.equal(pantallaPedida(''), null);
  assert.equal(pantallaPedida(undefined), null);
  assert.equal(pantallaPedida('?desde=nueva'), null);
  assert.equal(pantallaPedida('?ir=p-admin'), null);
  assert.equal(pantallaPedida('?ir=constructor'), null);
  assert.equal(pantallaPedida('?ir=__proto__'), null);
});

test('todos los destinos son pantallas de Medir', () => {
  for (const id of Object.values(DESTINOS_DE_MEDIR)) assert.match(id, /^p-medir/);
});
