import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkCarpetaEnDrive } from '../src/data/enlacesGoogle.js';
import { esEnlaceWeb } from '../src/data/enlaces.js';

test('arma la búsqueda en Drive sin la coma', () => {
  assert.equal(
    linkCarpetaEnDrive('Pérez, Juan Martín'),
    'https://drive.google.com/drive/search?q=P%C3%A9rez%20Juan%20Mart%C3%ADn',
  );
  assert.ok(esEnlaceWeb(linkCarpetaEnDrive('Pérez, Juan')));
});

test('el link nunca lleva dígitos', () => {
  const link = linkCarpetaEnDrive('Pérez, Juan 12345678');
  assert.doesNotMatch(decodeURIComponent(link.split('q=')[1]), /\d/);
  assert.equal(link, 'https://drive.google.com/drive/search?q=P%C3%A9rez%20Juan');
});

test('sin nombre no hay link', () => {
  for (const v of [null, undefined, '', '  ', ', 123']) assert.equal(linkCarpetaEnDrive(v), null);
});

test('un nombre con caracteres de URL queda escapado', () => {
  const link = linkCarpetaEnDrive('Lo&pez, A=b#c');
  assert.equal(new URL(link).searchParams.get('q'), 'Lo&pez A=b#c');
});
