import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPOS_RUBRO, MONTO_MAX_CENTAVOS } from '../src/data/finanzas.js';

/**
 * Las reglas de finanzas viven en dos lugares: 0054_finanzas.sql (la base las
 * hace cumplir) y src/data/finanzas.js (lo que ofrece y valida la pantalla).
 * Este test lee el SQL y compara, y además fija lo que no puede aflojarse sin
 * que alguien lo decida: sin delete, sin escritura del cliente en el rastro y
 * sin tocar policies de otras tablas.
 *
 * Si la migración se renumera antes del push, actualizar la ruta.
 */

const MIGRACION = 'supabase/migrations/0054_finanzas.sql';
const sql = readFileSync(MIGRACION, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = sql.replace(/--[^\n]*/g, '');

test('TIPOS_RUBRO coincide con el check de rubro.tipo', () => {
  const m = /tipo text not null check \(tipo in \(([^)]*)\)\)/.exec(sql);
  assert.ok(m, `no encontré el check de tipo en ${MIGRACION}`);
  const enBase = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  assert.deepEqual([...enBase].sort(), [...TIPOS_RUBRO].sort());
});

test('MONTO_MAX_CENTAVOS coincide con numeric(12,2)', () => {
  const m = /monto numeric\((\d+),(\d+)\)/.exec(sql);
  assert.ok(m, 'no encontré monto numeric(p,s)');
  const [, precision, escala] = m.map(Number);
  assert.equal(escala, 2);
  assert.equal(MONTO_MAX_CENTAVOS, 10 ** precision - 1);
});

test('0054 no tiene grant de delete ni de insert en movimiento_cambio', () => {
  assert.doesNotMatch(sinComentarios, /grant[^;]*\bdelete\b/i);
  assert.doesNotMatch(sinComentarios, /create policy[^;]*for delete/i);
  for (const g of sinComentarios.matchAll(/grant ([^;]*) on movimiento_cambio/g)) {
    assert.equal(g[1].trim(), 'select', `grant inesperado en movimiento_cambio: ${g[1]}`);
  }
  assert.doesNotMatch(sinComentarios, /create policy \w+ on movimiento_cambio\s+for (insert|update)/);
});

test('0054 no crea ni altera policies de otras tablas', () => {
  const propias = new Set(['rubro', 'movimiento', 'movimiento_cambio']);
  for (const m of sinComentarios.matchAll(/(?:create|alter|drop) policy (?:if exists )?\w+ on (\w+)/g)) {
    assert.ok(propias.has(m[1]), `policy sobre ${m[1]}`);
  }
  for (const m of sinComentarios.matchAll(/alter table (\w+)/g)) {
    assert.ok(propias.has(m[1]), `alter table ${m[1]}`);
  }
});

test('el tipo de un rubro y el club de un movimiento no tienen grant de update', () => {
  const update = (tabla) => {
    const m = new RegExp(`grant update \\(([^)]*)\\) on ${tabla} to`).exec(sinComentarios);
    assert.ok(m, `falta el grant de update de ${tabla}`);
    return m[1].split(',').map((c) => c.trim());
  };
  assert.ok(!update('rubro').includes('tipo'));
  assert.ok(!update('rubro').includes('club_id'));
  assert.ok(!update('movimiento').includes('club_id'));
  assert.ok(!update('movimiento').includes('borrado_por'));
});

test('las tres tablas se leen sólo con es_coordinador_de', () => {
  for (const tabla of ['rubro', 'movimiento', 'movimiento_cambio']) {
    const lectura = new RegExp(`create policy \\w+ on ${tabla}\\s+for select using \\(es_coordinador_de\\(${tabla}\\.club_id\\)\\);`);
    assert.match(sinComentarios, lectura, tabla);
  }
});
