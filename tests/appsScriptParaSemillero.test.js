import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tablero = readFileSync(new URL('../google/sheets/TABLERO.md', import.meta.url), 'utf8');

// Contrato con el importador de cuentas-familia (spec, "Planilla Para Semillero").
const ENCABEZADOS = ['Apellido', 'Nombre', 'Fecha de nacimiento', 'Categoría', 'Mail del responsable', 'Rama'];

function bloqueTrasTitulo(titulo) {
  const desde = tablero.indexOf(titulo);
  assert.ok(desde >= 0, `falta la sección "${titulo}"`);
  const m = tablero.slice(desde).match(/```\n([\s\S]*?)\n```/);
  assert.ok(m, 'falta el bloque de código');
  return m[1];
}

test('los encabezados de Para Semillero son los 6 de la spec, en orden', () => {
  const linea = bloqueTrasTitulo('### Encabezados exactos').trim();
  assert.deepEqual(linea.split(' | '), ENCABEZADOS);
});

test('Para Semillero no lleva el DNI', () => {
  assert.ok(!/DNI/i.test(bloqueTrasTitulo('### Encabezados exactos')));
});

test('las fórmulas usan nombres de función en español', () => {
  for (const fn of ['CONTAR.SI.CONJUNTO', 'UNICOS', 'FILTRO', 'HIPERVINCULO', 'IMPORTRANGE', 'TRANSPONER']) {
    assert.ok(tablero.includes(fn), `falta ${fn}`);
  }
  for (const en of ['COUNTIFS', 'HYPERLINK(', 'UNIQUE(', 'FILTER(', 'IFERROR', 'TRANSPOSE', 'VLOOKUP', 'XLOOKUP']) {
    assert.ok(!tablero.includes(en), `quedó ${en} en inglés`);
  }
});

test('nunca se manda a publicar en la web', () => {
  assert.match(tablero, /Nunca \*Archivo → Compartir → Publicar en la web\*/);
});
