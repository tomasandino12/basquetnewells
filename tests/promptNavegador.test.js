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
  const orden = ['Etapa 1 — Carpetas', 'Etapa 2 — Formularios', 'Etapa 3 — Planillas y Tablero', 'Etapa 4 — Script de carpetas', 'Etapa 5 — Script del Tablero', 'Etapa 5b — Envío a Semillero', 'Etapa 6'];
  const posiciones = orden.map((t) => prompt.indexOf(t));
  assert.ok(posiciones.every((p) => p >= 0), 'falta una etapa');
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones);
});

test('el prompt activa el envío a Semillero en el mismo proyecto del Tablero y deja el token fuera del alcance del agente', () => {
  const desde = prompt.indexOf('Etapa 5 — Script del Tablero');
  const etapas = prompt.slice(desde, prompt.indexOf('Etapa 6 — Prueba'));
  assert.match(etapas, /`estado\.gs`, `semillero\.gs`/);
  assert.match(etapas, /script\.external_request/);
  assert.match(etapas, /\*\*cuatro\*\*/);
  assert.match(etapas, /El token no lo ves ni lo escribís vos/);
  assert.match(etapas, /\*\*este mismo\*\* proyecto/);
  // El permiso amplio de hojas (todas las planillas de la cuenta) es una señal de frenar.
  assert.match(etapas, /todas tus hojas de cálculo/);
  assert.ok(!prompt.includes('apps-script-semillero'));
  assert.ok(!/SEMILLERO_TOKEN['"]?\s*[=:]\s*['"][A-Za-z0-9_-]{20,}/.test(prompt));
});
