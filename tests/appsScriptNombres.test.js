import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/**
 * google/apps-script/nombres.gs se pega a mano en el editor de Apps Script,
 * así que no puede usar import/export: son funciones globales. Acá lo
 * corremos en un contexto aislado y tomamos esas globales.
 */
const codigo = readFileSync(new URL('../google/apps-script/nombres.gs', import.meta.url), 'utf8');
const g = vm.createContext({});
vm.runInContext(codigo, g);

// 18/10/2026 14:30 en Argentina (UTC-3)
const FECHA = new Date(Date.UTC(2026, 9, 18, 17, 30));

test('normaliza DNI con puntos y espacios', () => {
  assert.equal(g.normalizarDni(' 11.111.111 '), '11111111');
  assert.equal(g.normalizarDni('1 234 567'), '1234567');
  assert.equal(g.normalizarDni('22-222-222'), '22222222');
});

test('acepta DNI de 7 y 8 dígitos', () => {
  assert.equal(g.dniValido('1234567'), true);
  assert.equal(g.dniValido('11111111'), true);
});

test('rechaza DNI de 6 y de 9 dígitos y con letras', () => {
  assert.equal(g.dniValido('123456'), false);
  assert.equal(g.dniValido('123456789'), false);
  assert.equal(g.dniValido('A1234567'), false);
  assert.equal(g.dniValido(''), false);
  assert.equal(g.dniValido(null), false);
});

test('arma nombre de carpeta con el apellido en mayúsculas', () => {
  assert.equal(g.nombreCarpeta('  sánchez  ', 'pedro  ', '11111111'), 'SÁNCHEZ, pedro — 11111111');
  assert.equal(g.nombreCarpeta('de la Torre', 'Ana  María', '1234567'), 'DE LA TORRE, Ana María — 1234567');
});

test('nombre de archivo usa el título de la pregunta y la fecha', () => {
  assert.equal(
    g.nombreArchivo('DNI jugador frente', '', 'Sánchez', FECHA, 'foto.JPG'),
    'DNI jugador frente - SÁNCHEZ - 2026-10-18 14.30.jpg'
  );
});

test('suma el concepto cuando hay', () => {
  assert.equal(
    g.nombreArchivo('Comprobante de pago', 'Arancel octubre 2026', 'Sánchez', FECHA, 'comprobante.pdf'),
    'Comprobante de pago - Arancel octubre 2026 - SÁNCHEZ - 2026-10-18 14.30.pdf'
  );
});

test('sin extensión en el original, el nombre no termina en punto', () => {
  assert.equal(g.nombreArchivo('Foto del jugador', '', 'Paz', FECHA, 'imagen'), 'Foto del jugador - PAZ - 2026-10-18 14.30');
});

test('dos fechas distintas dan nombres distintos', () => {
  const otra = new Date(FECHA.getTime() + 60 * 1000);
  assert.notEqual(
    g.nombreArchivo('DNI jugador frente', '', 'Paz', FECHA, 'a.jpg'),
    g.nombreArchivo('DNI jugador frente', '', 'Paz', otra, 'a.jpg')
  );
});

test('la fecha es la de Argentina aunque cambie el día en UTC', () => {
  // 01:15 UTC del 19/10 = 22:15 del 18/10 en Argentina
  const noche = new Date(Date.UTC(2026, 9, 19, 1, 15));
  assert.match(g.nombreArchivo('X', '', 'Paz', noche, 'a.jpg'), /2026-10-18 22\.15/);
});

test('limpia barras y caracteres raros del título', () => {
  assert.equal(g.limpiarParaNombre('Pase / constancia: "club"'), 'Pase constancia club');
  assert.equal(g.limpiarParaNombre('a\\b\u0007c'), 'a b c');
});

test('recorta títulos muy largos', () => {
  assert.equal(g.limpiarParaNombre('x'.repeat(200)).length, 80);
});

test('encuentra el DNI al final del nombre de carpeta', () => {
  assert.equal(g.dniDeCarpeta('SÁNCHEZ, Pedro — 11111111'), '11111111');
  assert.equal(g.dniDeCarpeta('PAZ, Ana — 1234567'), '1234567');
  assert.equal(g.dniDeCarpeta('Carpeta cualquiera'), null);
});

test('no confunde 1234567 con 11234567', () => {
  assert.equal(g.dniDeCarpeta('PAZ, Ana — 11234567'), '11234567');
  assert.notEqual(g.dniDeCarpeta('PAZ, Ana — 11234567'), '1234567');
});
