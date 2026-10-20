import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

/**
 * Íconos de la app instalada. Son genéricos (una pelota) a propósito: el
 * escudo no suma usos nuevos hasta que el club lo apruebe (spec portal-pwa).
 * Android e iOS eligen el ícono por las medidas declaradas: si el PNG no mide
 * lo que dice, el sistema lo estira o lo ignora sin avisar.
 */

const ICONOS = {
  'public/icons/icono-192.png': 192,
  'public/icons/icono-512.png': 512,
  'public/icons/icono-maskable-512.png': 512,
  'public/icons/apple-touch-icon.png': 180,
};

function medidas(ruta) {
  const b = readFileSync(ruta);
  assert.equal(b.toString('latin1', 1, 4), 'PNG', `${ruta} no es PNG`);
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
}

const huella = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex');

test('cada PNG tiene las medidas que dice su nombre', () => {
  for (const [ruta, lado] of Object.entries(ICONOS)) {
    assert.ok(existsSync(ruta), `falta ${ruta}`);
    assert.deepEqual(medidas(ruta), { ancho: lado, alto: lado }, ruta);
  }
});

test('ningún ícono de la PWA es el escudo', () => {
  const escudo = huella('public/escudo.png');
  for (const ruta of [...Object.keys(ICONOS), 'public/icons/icono.svg']) assert.notEqual(huella(ruta), escudo, ruta);
  assert.doesNotMatch(readFileSync('public/icons/icono.svg', 'utf8'), /escudo/i);
});

test('el SVG fuente es cuadrado', () => {
  assert.match(readFileSync('public/icons/icono.svg', 'utf8'), /<svg[^>]*viewBox="0 0 512 512"/);
});
