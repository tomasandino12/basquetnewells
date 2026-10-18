import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FUENTES } from '../src/data/historiaJugador.js';

/**
 * El permiso nuevo de la historia del jugador (0056) tiene que quedar aislado
 * en una función y ser fácil de auditar: este test falla si la migración toca
 * una policy, otorga algo sobre una tabla, o si la función deja de chequear la
 * regla antes de devolver nada. También compara las claves del jsonb con
 * FUENTES de historiaJugador.js: una fuente nueva va en los dos lados.
 *
 * Modelo: tests/contratoAccesoJugador.test.js.
 */

const leer = (ruta) => readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');
const sql = leer('supabase/migrations/0056_historia_jugador.sql');

/** Sin comentarios de línea: un `grant` dentro de un comentario no otorga nada. */
const sinComentarios = (s) => s.replace(/--.*$/gm, '');
const codigo = sinComentarios(sql);

/** Lo que no es una fuente: el marco para ubicar las fuentes en temporadas. */
const MARCO = ['planteles', 'temporadas', 'pertenencias'];

/** Las claves de primer nivel de jsonb_build_object: las que abren con 4 espacios. */
function clavesDevueltas() {
  return [...codigo.matchAll(/^ {4}'([a-zA-Z]+)',\s/gm)].map((m) => m[1]);
}

test('0056 no crea, cambia ni borra policies', () => {
  assert.doesNotMatch(codigo, /\b(create|alter|drop)\s+policy\b/i);
  assert.doesNotMatch(codigo, /row\s+level\s+security/i);
});

test('0056 no otorga nada sobre tablas ni las altera', () => {
  assert.doesNotMatch(codigo, /grant\s+(select|insert|update|delete|all|truncate|references|trigger)\b/i);
  assert.doesNotMatch(codigo, /\balter\s+table\b/i);
  assert.doesNotMatch(codigo, /\b(insert\s+into|update\s+public\.|delete\s+from)\b/i);
});

test('la función es security definer con search_path vacío', () => {
  assert.match(codigo, /create or replace function historia_del_jugador\(p_jugador_id uuid\)\s+returns jsonb\s+language plpgsql\s+stable\s+security definer\s+set search_path = ''/);
});

test('el grant execute es sólo a authenticated', () => {
  assert.match(codigo, /revoke execute on function historia_del_jugador\(uuid\) from public, anon;/);
  const grants = [...codigo.matchAll(/grant\s+execute\s+on\s+function\s+([a-z_]+)\([^)]*\)\s+to\s+([^;]+);/gi)];
  assert.deepEqual(grants.map((g) => [g[1], g[2].trim()]), [['historia_del_jugador', 'authenticated']]);
});

test('la regla usa es_entrenador, pertenencia vigente y puede_ver_plantel, antes de armar nada', () => {
  const regla = codigo.indexOf("errcode = '42501'");
  const datos = codigo.indexOf('return jsonb_build_object(');
  assert.ok(regla > 0 && regla < datos, 'el chequeo tiene que ir antes del return');
  const antes = codigo.slice(0, regla);
  assert.match(antes, /m\.es_entrenador/);
  assert.match(antes, /p\.hasta is null/);
  assert.match(antes, /public\.puede_ver_plantel\(p\.plantel_id\)/);
  // D1: el coordinador no tiene una rama propia.
  assert.doesNotMatch(antes, /es_coordinador/);
});

test('cada clave del jsonb está en FUENTES, y al revés', () => {
  const devueltas = clavesDevueltas();
  assert.deepEqual(devueltas.filter((c) => MARCO.includes(c)).sort(), [...MARCO].sort());
  assert.deepEqual(
    devueltas.filter((c) => !MARCO.includes(c)).sort(),
    FUENTES.map((f) => f.clave).sort(),
  );
});
