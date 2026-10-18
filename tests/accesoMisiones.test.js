import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Dónde vive el flujo de misiones. El primer lanzamiento lo dejó dentro de
 * DATOS y ni su autor lo encontraba: el profe en la cancha mira PLANTEL (los
 * chicos a los que les arma las misiones) y HOY (lo primero que abre).
 * Este test no mide estilo, ata la ubicación para que no se vuelva a esconder.
 */

const leer = (p) => readFileSync(p, 'utf8');

test('Plantel y Hoy muestran el bloque de misiones', () => {
  for (const archivo of ['src/ui/pantallas/plantel.js', 'src/ui/pantallas/hoy.js']) {
    const codigo = leer(archivo);
    assert.match(codigo, /cargarBloqueMisiones\(/, archivo);
    assert.match(codigo, /from '\.\/misionesAcceso\.js'/, archivo);
  }
});

test('Plantel muestra la lista de previas y Hoy sólo la tarjeta', () => {
  assert.match(leer('src/ui/pantallas/plantel.js'), /cargarBloqueMisiones\('plantel-misiones', club, plantel, \{ lista: true \}\)/);
  assert.doesNotMatch(leer('src/ui/pantallas/hoy.js'), /lista: true/);
});

test('Hoy lo muestra en las tres versiones de la pantalla', () => {
  const hoy = leer('src/ui/pantallas/hoy.js');
  assert.equal([...hoy.matchAll(/id="hoy-misiones"/g)].length, 3);
  assert.equal([...hoy.matchAll(/cargarBloqueMisiones\('hoy-misiones'/g)].length, 3);
});

test('Datos ya no tiene el bloque de misiones', () => {
  assert.doesNotMatch(leer('src/ui/pantallas/datos.js'), /isione/);
});
