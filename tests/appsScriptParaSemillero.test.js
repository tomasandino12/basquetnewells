import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Con core.autocrlf el .md puede llegar con CRLF; el bloque se busca con \n.
const tablero = readFileSync(new URL('../google/sheets/TABLERO.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

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
  for (const fn of ['CONTAR.SI.CONJUNTO', 'UNIQUE', 'FILTER(', 'SI.ERROR', 'HIPERVINCULO', 'IMPORTRANGE', 'TRANSPONER']) {
    assert.ok(tablero.includes(fn), `falta ${fn}`);
  }
  for (const en of ['COUNTIFS', 'HYPERLINK(', 'IFERROR', 'SIERROR', 'UNICOS', 'FILTRO(', 'TRANSPOSE', 'VLOOKUP', 'XLOOKUP']) {
    assert.ok(!tablero.includes(en), `quedó ${en} en inglés`);
  }
});

test('nunca se manda a publicar en la web', () => {
  assert.match(tablero, /Nunca \*Archivo → Compartir → Publicar en la web\*/);
});

// Contrato con "Emergencias para Semillero" (google/PRECARGA-2026.md).
const ENCABEZADOS_EMERGENCIAS = ['Apellido y nombre', 'Fecha de nacimiento', 'Teléfono del adulto', 'Contacto de urgencia', 'Afecciones', 'Alergias', 'Medicación', 'Indicación médica', 'Obra social'];

test('los encabezados de Emergencias para Semillero son los 9 del contrato, en orden', () => {
  const linea = bloqueTrasTitulo('### Encabezados exactos de emergencias').trim();
  assert.deepEqual(linea.split(' | '), ENCABEZADOS_EMERGENCIAS);
});

test('Emergencias para Semillero no lleva DNI, afiliado, grupo sanguíneo ni domicilio', () => {
  assert.ok(!/DNI|afiliado|sangu|domicilio/i.test(bloqueTrasTitulo('### Encabezados exactos de emergencias')));
});

test('el tablero ya no lee una pestaña Reinscripción ni Aranceles', () => {
  assert.ok(!/'Reinscripción'!|\bAranceles!/.test(tablero));
});

test('Pagos suma las columnas de pago con formulario propio y Buscar las muestra todas', () => {
  assert.match(tablero, /Pago con formulario propio/);
  assert.match(tablero, /TRANSPONER\(Pagos!\$B\$1:\$Z\$1\)/);
});
