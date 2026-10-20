import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const prompt = readFileSync(new URL('../google/PROMPT-NAVEGADOR.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('el prompt cita las reglas: cuenta de la Comisión, no publicar y permisos que acepta Tomás', () => {
  assert.match(prompt, /Sólo la cuenta de la Comisión Básquet/);
  assert.match(prompt, /Nunca publiques nada en la web/);
  assert.match(prompt, /Los permisos de los scripts los acepto yo/);
});

test('el prompt no deja tocar lo existente ni copiar datos de menores', () => {
  assert.match(prompt, /No toques nada de lo que ya existe/);
  assert.match(prompt, /no cambies sus permisos/);
  assert.match(prompt, /Nunca abras ni copies datos de menores/);
});

test('el prompt cierra con una prueba de DNIs inventados, limpieza y el informe con links', () => {
  assert.match(prompt, /Etapa 6 — Prueba con DNIs inventados/);
  assert.match(prompt, /Etapa 7 — Limpieza/);
  assert.match(prompt, /Etapa 8 — Informe final/);
  assert.match(prompt, /\*\*Links\*\*/);
});

test('el prompt arma todo en el orden que exigen las dependencias', () => {
  const orden = ['Etapa 1 — Carpetas', 'Etapa 2 — Formularios', 'Etapa 3 — Planillas y Tablero', 'Etapa 4 — Script de carpetas', 'Etapa 5 — Script del Tablero', 'Etapa 5b — Script de envío a Semillero', 'Etapa 6'];
  const posiciones = orden.map((t) => prompt.indexOf(t));
  assert.ok(posiciones.every((p) => p >= 0), 'falta una etapa');
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
});

test('el prompt instala el envío a Semillero y deja el token fuera del alcance del agente', () => {
  const etapa = prompt.slice(prompt.indexOf('Etapa 5b'), prompt.indexOf('Etapa 6 — Prueba'));
  assert.match(etapa, /script\.external_request/);
  assert.match(etapa, /El token no lo ves ni lo escribís vos/);
  assert.match(etapa, /google\/apps-script-semillero\//);
  // Los permisos de Drive y formularios no los pide este script: se le dice que frene si aparecen.
  assert.match(etapa, /Si pide Drive, formularios, Gmail u otra cosa, no sigas/);
  assert.ok(!/SEMILLERO_TOKEN['"]?\s*[=:]\s*['"][A-Za-z0-9_-]{20,}/.test(prompt));
});
