import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESTADOS, ZONAS, LADOS, TIPOS } from '../src/data/asistencia.js';

/**
 * Las listas de estado, zona, lado y tipo viven en los check de 0064 (los hace
 * cumplir la base) y en src/data/asistencia.js (lo que ofrece la pantalla). Si
 * se desincronizan, la pantalla ofrece algo que la base rechaza o al revés.
 * Además fija lo que la migración promete sobre privacidad: el coordinador
 * recibe sólo agregados, anon nada, y la lesión no tiene texto libre.
 */

const sql = readFileSync('supabase/migrations/0064_asistencia.sql', 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/--[^\n]*/g, '');
const ordenados = (xs) => [...xs].sort();

/** El texto entre el paréntesis que abre en `ancla` y el que lo cierra. */
function parentesisDe(texto, ancla) {
  const desde = texto.indexOf(ancla);
  assert.ok(desde >= 0, `no encontré "${ancla}" en 0064_asistencia.sql: ¿cambió la migración?`);
  let i = texto.indexOf('(', desde);
  const inicio = i + 1;
  for (let nivel = 0; i < texto.length; i++) {
    if (texto[i] === '(') nivel++;
    if (texto[i] === ')' && --nivel === 0) return texto.slice(inicio, i);
  }
  throw new Error(`paréntesis sin cerrar después de "${ancla}"`);
}

const lista = (ancla) => [...parentesisDe(sql, ancla).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

test('las listas de estado/zona/lado/tipo de la migración coinciden con src/data/asistencia.js', () => {
  assert.deepEqual(ordenados(lista('check (estado in')), ordenados(ESTADOS));
  assert.deepEqual(ordenados(lista('check (zona in')), ordenados(ZONAS));
  assert.deepEqual(ordenados(lista('check (lado in')), ordenados(LADOS));
  assert.deepEqual(ordenados(lista('check (tipo in')), ordenados(TIPOS));
});

test('asistencia_del_club no devuelve jugador_id ni nombres', () => {
  const desde = sql.indexOf('create function asistencia_del_club');
  assert.ok(desde >= 0);
  const columnas = parentesisDe(sql.slice(desde), 'returns table')
    .split(',').map((c) => c.trim().split(/\s+/)[0]);
  assert.deepEqual(columnas, ['plantel_id', 'categoria', 'entrenamientos', 'pct']);

  const cuerpo = sql.slice(desde, sql.indexOf('$fn$;', desde));
  assert.doesNotMatch(cuerpo, /public\.jugador\b|public\.lesion\b|nombre|auth\.users/);
});

test('0064 no otorga nada a anon', () => {
  for (const sentencia of sql.split(';')) {
    if (/^\s*grant\b/i.test(sentencia)) assert.doesNotMatch(sentencia, /\banon\b|\bpublic\s*$/i, sentencia.trim());
  }
  for (const tabla of ['entrenamiento', 'asistencia', 'lesion']) {
    assert.match(sql, new RegExp(`revoke all on ${tabla} from anon, authenticated`));
  }
});

test('lesion no tiene columnas de texto libre', () => {
  const cuerpo = parentesisDe(sql, 'create table lesion');
  const columnasDeTexto = cuerpo.split('\n').filter((l) => /^\s*\w+ text\b/.test(l));
  assert.deepEqual(columnasDeTexto.map((l) => l.trim().split(' ')[0]), ['zona', 'lado', 'tipo']);
  for (const l of columnasDeTexto) assert.match(l, /check \(\w+ in \(/, l.trim());
});

test('0064 sólo crea policies y RLS sobre sus tres tablas', () => {
  const propias = new Set(['entrenamiento', 'asistencia', 'lesion']);
  const tocadas = [
    ...sql.matchAll(/(?:create|drop|alter) policy \w+ on (\w+)/g),
    ...sql.matchAll(/alter table (\w+)/g),
  ].map((m) => m[1]);
  assert.ok(tocadas.length > 0);
  for (const t of tocadas) assert.ok(propias.has(t), `toca ${t}`);
});
