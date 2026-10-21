import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const prompt = readFileSync(new URL('../google/PROMPT-NORMALIZAR.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tablero = readFileSync(new URL('../google/sheets/TABLERO.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const formularios = readFileSync(new URL('../google/formularios/FORMULARIOS.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('el prompt de normalizar cita las reglas de siempre', () => {
  assert.match(prompt, /Los formularios viejos no se tocan/);
  assert.match(prompt, /Los permisos de los scripts los acepto yo/);
  assert.match(prompt, /No abras ni copies datos de menores/);
});

test('Base normaliza apellido y nombre sin tocar las respuestas crudas', () => {
  assert.match(tablero, /MAYUSC\(ESPACIOS\('Inscripción'!E2:E\)\)/);
  assert.match(tablero, /NOMPROPIO\(ESPACIOS\('Inscripción'!F2:F\)\)/);
});

test('Revisar tiene las listas de invertidos y duplicados, con qué hacer', () => {
  assert.match(tablero, /`G1` `Posible nombre y apellido invertidos/);
  assert.match(tablero, /`I1` `Posible chico duplicado/);
  assert.match(tablero, /Correcciones 2026/);
});

test('Inscripción y Comprobante avisan que vale el último envío', () => {
  const confirmaciones = formularios.match(/\*\*Mensaje de confirmación:\*\*[^\n]*tomamos el último[^\n]*/g) || [];
  assert.equal(confirmaciones.length, 2);
});

test('Apellido y Nombre llevan ayuda y rechazan números en los tres formularios con DNI', () => {
  assert.equal((formularios.match(/\| Apellido del jugador \|[^\n]*Ej\.: GONZÁLEZ/g) || []).length, 3);
  assert.equal((formularios.match(/\| Nombre del jugador \|[^\n]*Ej\.: Juan Martín \(sin el apellido\)/g) || []).length, 3);
});
