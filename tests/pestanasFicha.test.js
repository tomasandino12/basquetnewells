import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PESTANAS_FICHA, SECCIONES_FICHA, PESTANA_INICIAL, pestanaAlEntrar, pestanaVecina,
} from '../src/data/pestanasFicha.js';

const ids = PESTANAS_FICHA.map((p) => p.id);

test('son cuatro pestañas y la primera que se abre es Físico', () => {
  assert.deepEqual(PESTANAS_FICHA.map((p) => p.titulo), ['Físico', 'Tiro', 'Partidos', 'Historia']);
  assert.equal(PESTANA_INICIAL, 'fisico');
});

test('cada sección cae en una pestaña que existe, y ninguna pestaña queda vacía', () => {
  for (const [seccion, pestana] of Object.entries(SECCIONES_FICHA)) {
    assert.ok(ids.includes(pestana), `${seccion} apunta a ${pestana}, que no es una pestaña`);
  }
  for (const id of ids) {
    assert.ok(Object.values(SECCIONES_FICHA).includes(id), `la pestaña ${id} no tiene secciones`);
  }
});

test('la ficha llena cada sección declarada y arma las pestañas accesibles', () => {
  const src = readFileSync('src/ui/pantallas/fichaJugador.js', 'utf8');
  for (const seccion of Object.keys(SECCIONES_FICHA)) {
    assert.ok(src.includes(`sec('${seccion}')`), `la ficha nunca llena la sección ${seccion}`);
  }
  assert.match(src, /role="tablist"/);
  assert.match(src, /role="tabpanel"/);
  assert.match(src, /aria-selected/);
});

test('al entrar abre la última usada, o Físico si no hay una válida', () => {
  assert.equal(pestanaAlEntrar(null), 'fisico');
  assert.equal(pestanaAlEntrar('tiro'), 'tiro');
  assert.equal(pestanaAlEntrar('cualquiera'), 'fisico');
});

test('las flechas pasan a la vecina y dan la vuelta', () => {
  assert.equal(pestanaVecina('fisico', 1), 'tiro');
  assert.equal(pestanaVecina('historia', 1), 'fisico');
  assert.equal(pestanaVecina('fisico', -1), 'historia');
});
