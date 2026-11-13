import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HORARIOS, horarioDe, textoApertura, INSCRIPCION_ABRE } from '../src/data/portalConfig.js';
import { PORTAL } from '../src/data/portal.js';

test('cada categoría del portal toma su horario de portalConfig', () => {
  for (const c of PORTAL.categorias) {
    assert.equal(c.horario, horarioDe(c.grupo, c.rama), `${c.grupo} ${c.rama}`);
  }
  // Ningún horario suelto sin categoría que lo use.
  const claves = new Set(PORTAL.categorias.map((c) => `${c.grupo}|${c.rama}`));
  for (const k of Object.keys(HORARIOS)) assert.ok(claves.has(k), `horario huérfano: ${k}`);
});

test('horarioDe devuelve null si no hay categoría o no pasaron el horario', () => {
  assert.equal(horarioDe('U99', 'Mixto'), null);
  assert.equal(horarioDe('MAYORES', 'Femenino'), null);
});

test('la fecha de apertura es null o una fecha AAAA-MM-DD válida', () => {
  assert.ok(INSCRIPCION_ABRE === null || textoApertura('2999-01-01') !== null);
  assert.equal(PORTAL.inscripcionAbre, INSCRIPCION_ABRE);
});

test('textoApertura avisa sólo si la fecha es válida y futura', () => {
  const hoy = new Date(2027, 0, 15);
  assert.equal(textoApertura('2027-02-01', hoy), 'Abre el 01/02');
  assert.equal(textoApertura('2027-01-15', hoy), null); // hoy: manda la base
  assert.equal(textoApertura('2026-12-01', hoy), null);
  assert.equal(textoApertura('2027-02-30', hoy), null); // no existe
  assert.equal(textoApertura('1/2/2027', hoy), null);
  assert.equal(textoApertura(null, hoy), null);
});
