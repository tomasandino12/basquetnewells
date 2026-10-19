import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FUNCIONES_OTORGADAS, DE_LA_FAMILIA } from '../src/data/accesoFamilia.js';

/**
 * La frontera de datos de la familia (spec 2026-10-18 §4): no lee ninguna
 * tabla de dominio, sólo ejecuta funciones. Este test lee 0057 y falla si
 * otorga algo no declarado en src/data/accesoFamilia.js, si abre la tabla de
 * vínculos al cliente o si toca una policy que no es suya.
 *
 * Modelo: tests/contratoAccesoJugador.test.js.
 */

const sql = readFileSync('supabase/migrations/0057_cuentas_familia.sql', 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s) => s.replace(/--.*$/gm, '');
const codigo = sinComentarios(sql);
const ordenados = (xs) => [...xs].sort();

function funcionesOtorgadas(s) {
  return [...s.matchAll(/grant\s+execute\s+on\s+function\s+([a-z_]+)\s*\([^)]*\)\s+to\s+([^;]+);/gi)]
    .filter((m) => /\bauthenticated\b/.test(m[2]))
    .map((m) => m[1]);
}

function cuerpoDe(nombre) {
  const desde = codigo.indexOf(`create function ${nombre}(`);
  assert.ok(desde >= 0, `no encontré "create function ${nombre}(": ¿cambió la migración?`);
  const hasta = codigo.indexOf('\n$fn$;', desde);
  assert.ok(hasta > desde, `no encontré el cierre de ${nombre}`);
  return codigo.slice(desde, hasta);
}

test('los grant execute de 0057 son exactamente los declarados', () => {
  assert.deepEqual(ordenados(funcionesOtorgadas(codigo)), ordenados(FUNCIONES_OTORGADAS));
});

test('vinculo_familia no tiene ningún grant ni policy: sólo se toca por funciones', () => {
  assert.doesNotMatch(codigo, /grant\s+[^;]*\bon\s+vinculo_familia\b/i);
  assert.doesNotMatch(codigo, /create\s+policy\s+\w+\s+on\s+vinculo_familia\b/i);
  assert.match(codigo, /revoke\s+all\s+on\s+vinculo_familia\s+from\s+anon,\s*authenticated/i);
});

test('los únicos grants sobre tablas son los de responsable_jugador, por columna', () => {
  const grants = [...codigo.matchAll(/grant\s+(select|insert|update|delete|all|truncate)\b[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, ' '));
  assert.deepEqual(grants, [
    'grant select, delete on responsable_jugador to authenticated;',
    'grant insert (club_id, jugador_id, email) on responsable_jugador to authenticated;',
  ]);
});

test('0057 no toca policies existentes: sólo crea policies sobre sus tablas nuevas', () => {
  assert.doesNotMatch(codigo, /(drop|alter)\s+policy/i);
  for (const m of codigo.matchAll(/create\s+policy\s+\w+\s+on\s+(\w+)/gi)) {
    assert.equal(m[1], 'responsable_jugador');
  }
  for (const m of codigo.matchAll(/alter\s+table\s+(\w+)/gi)) {
    assert.ok(['responsable_jugador', 'vinculo_familia'].includes(m[1]), `alter table ${m[1]}`);
  }
});

test('lo de la familia mira sólo a quien llama, y vincular exige mail verificado', () => {
  for (const nombre of DE_LA_FAMILIA) {
    assert.match(cuerpoDe(nombre), /auth\.uid\(\)/, nombre);
  }
  assert.match(cuerpoDe('vincular_por_mail'), /email_confirmed_at\s+is\s+not\s+null/);
});

test('mis_chicos no lee ninguna tabla de estadísticas, mediciones ni misiones', () => {
  const cuerpo = cuerpoDe('mis_chicos');
  assert.doesNotMatch(cuerpo, /estadistica_|medicion_|mision_|previa_partido|recurso|plan_fisico/);
});

test('las funciones definer fijan search_path vacío', () => {
  for (const m of codigo.matchAll(/create function (\w+)\([^)]*\)[\s\S]*?\$fn\$/g)) {
    if (/security definer/.test(m[0])) assert.match(m[0], /set search_path = ''/, m[1]);
  }
});
