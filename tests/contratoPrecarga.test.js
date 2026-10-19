import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLUMNAS } from '../src/parser/parserInscriptos.js';

// El prompt de google/PRECARGA-2026.md arma la planilla que lee el importador:
// si cambian los encabezados de un lado, el otro tiene que enterarse.
const md = readFileSync(new URL('../google/PRECARGA-2026.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const encabezados = md.split('\n').filter((l) => l.includes(' | ') && !l.trimStart().startsWith('-') && !/^\d+\./.test(l));

test('la precarga usa los encabezados del importador', () => {
  const lineaSemillero = encabezados.find((l) => l.startsWith('Apellido | Nombre'));
  assert.ok(lineaSemillero, 'falta la línea de encabezados de Para Semillero');
  assert.deepEqual(lineaSemillero.split(' | ').slice(0, COLUMNAS.length), COLUMNAS);
});

test('el prompt no pide DNI ni datos de salud en Para Semillero', () => {
  const lineaSemillero = encabezados.find((l) => l.startsWith('Apellido | Nombre'));
  assert.doesNotMatch(lineaSemillero, /DNI|salud|afiliado|domicilio/i);
  assert.match(md, /NO incluyas DNI/);
  assert.match(md, /Descargar → Microsoft Excel/);
});
