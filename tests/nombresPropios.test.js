import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { nombrePropio } from '../src/data/nombres.js';
import * as XLSX from 'xlsx';
import { parsearInscriptos, COLUMNAS } from '../src/parser/parserInscriptos.js';

const g = vm.createContext({});
vm.runInContext(readFileSync(new URL('../google/apps-script/nombres.gs', import.meta.url), 'utf8'), g);

// Contrato: la app y el script de Google normalizan igual.
test('src/data/nombres.js y nombres.gs dan lo mismo', () => {
  for (const t of ['juan  MARTÍN', 'maría DE los ángeles', 'de la torre', "o'brien-pérez", '  ', '', null, 'ANA']) {
    assert.equal(nombrePropio(t), g.nombrePropio(t), String(t));
  }
});

test('el importador de Semillero normaliza apellido y nombre', () => {
  const hoja = XLSX.utils.aoa_to_sheet([COLUMNAS, ['gonzález', 'JUAN  martín', '03/04/2012', 'U13 - MIXTO (2014 y 2013)', 'a@b.com', 'Masculino']]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Para Semillero');
  const salida = parsearInscriptos(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }));
  assert.equal(salida.filas[0].apellido, 'González');
  assert.equal(salida.filas[0].nombre, 'Juan Martín');
});
