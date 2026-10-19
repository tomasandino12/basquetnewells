import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PATRON_ENLACE_FORMULARIO, enlaceFormulario } from '../src/data/portal.js';

/**
 * 0058 es la primera migración que le da algo al visitante sin sesión (0027:
 * "anon no tiene nada que hacer con las tablas"). Lo aprobó Tomás con una
 * condición: que lo que ve el anónimo sea lo mínimo. Este test lee la
 * migración y falla si:
 * - anon recibe algo más que `execute` de formularios_publicos;
 * - la función devuelve algo más que título, texto y enlace de filas activas;
 * - los grants sobre la tabla no son exactamente los declarados (sin delete);
 * - el check del enlace se separa del patrón que usa la página.
 * Spec: docs/superpowers/specs/2026-10-18-portal-v2-design.md §3.
 */

const sql = readFileSync('supabase/migrations/0058_formulario_portal.sql', 'utf8').replace(/\r\n/g, '\n');
const codigo = sql.replace(/--.*$/gm, '');
const plano = (s) => s.replace(/\s+/g, ' ').trim();

function cuerpoDe(nombre) {
  const desde = codigo.indexOf(`create function ${nombre}(`);
  assert.ok(desde >= 0, `no encontré "create function ${nombre}("`);
  const hasta = codigo.indexOf('\n$fn$;', desde);
  assert.ok(hasta > desde, `no encontré el cierre de ${nombre}`);
  return codigo.slice(desde, hasta);
}

test('los grants sobre formulario_portal son exactamente estos, por columna y sin delete', () => {
  const grants = [...codigo.matchAll(/grant\s+(select|insert|update|delete|all|truncate|references|trigger)\b[^;]*;/gi)].map((m) => plano(m[0]));
  assert.deepEqual(grants, [
    'grant select on formulario_portal to authenticated;',
    'grant insert (club_id, titulo, texto, enlace, orden, activo) on formulario_portal to authenticated;',
    'grant update (titulo, texto, enlace, orden, activo) on formulario_portal to authenticated;',
  ]);
  assert.match(codigo, /revoke\s+all\s+on\s+formulario_portal\s+from\s+anon,\s*authenticated;/i);
});

test('anon sólo ejecuta formularios_publicos: ningún otro grant lo nombra', () => {
  const aAnon = [...codigo.matchAll(/grant\s+[^;]*\bto\s+[^;]*\banon\b[^;]*;/gi)].map((m) => plano(m[0]));
  assert.deepEqual(aAnon, ['grant execute on function formularios_publicos(uuid) to anon, authenticated;']);
  assert.match(codigo, /revoke\s+execute\s+on\s+function\s+formularios_publicos\(uuid\)\s+from\s+public;/i);
});

test('nadie borra: no hay grant ni policy de delete', () => {
  assert.doesNotMatch(codigo, /grant\s+[^;]*\bdelete\b/i);
  assert.doesNotMatch(codigo, /for\s+delete/i);
});

test('escribe sólo coordinación del club, y lee sólo coordinación del club', () => {
  const policies = [...codigo.matchAll(/create\s+policy\s+(\w+)\s+on\s+formulario_portal\s+for\s+(\w+)([^;]*);/gi)];
  assert.deepEqual(policies.map((m) => m[2].toLowerCase()).sort(), ['insert', 'select', 'update']);
  for (const m of policies) assert.match(m[3], /es_coordinador_de\(formulario_portal\.club_id\)/, m[1]);
});

test('formularios_publicos devuelve sólo título, texto y enlace de las filas activas del club pedido', () => {
  const cuerpo = cuerpoDe('formularios_publicos');
  assert.match(cuerpo, /returns table\s*\(\s*titulo text,\s*texto text,\s*enlace text\s*\)/);
  assert.match(cuerpo, /security definer/);
  assert.match(cuerpo, /set search_path = ''/);
  assert.match(cuerpo, /select f\.titulo, f\.texto, f\.enlace\s+from public\.formulario_portal f/);
  assert.match(cuerpo, /where f\.club_id = p_club and f\.activo/);
  assert.match(cuerpo, /order by f\.orden/);
  assert.match(cuerpo, /limit \d+/);
  assert.doesNotMatch(cuerpo, /creado_por|actualizado_por|jugador|miembro_club|auth\./);
});

test('el check del enlace usa el mismo patrón que la página', () => {
  const m = sql.match(/constraint formulario_portal_enlace_google check \(enlace ~ '([^']+)'\)/);
  assert.ok(m, 'falta el check formulario_portal_enlace_google');
  assert.equal(m[1], PATRON_ENLACE_FORMULARIO);
});

test('con el patrón del SQL, la base y la página aceptan y rechazan lo mismo', () => {
  const base = new RegExp(sql.match(/check \(enlace ~ '([^']+)'\)/)[1]);
  const casos = [
    'https://forms.gle/AbC123', 'https://docs.google.com/forms/d/e/1FAIpQ/viewform', 'https://docs.google.com/forms/d/e/1/viewform?usp=sf_link',
    'http://forms.gle/AbC123', 'https://forms.gle/', 'https://forms.gle', 'https://FORMS.GLE/x', 'https://forms.gle.evil.com/x',
    'https://evil@forms.gle/x', 'https://docs.google.com/document/d/1', 'https://forms.gle/a b', 'https://forms.gle/a"b', 'javascript:alert(1)',
    ' https://forms.gle/x',
  ];
  for (const c of casos) assert.equal(base.test(c), enlaceFormulario(c) !== null, c);
});

test('la autoría y las fechas las pone la base: el trigger sella cada alta y cada cambio', () => {
  assert.match(codigo, /create trigger formulario_portal_sellar\s+before insert or update on formulario_portal/);
  const sellar = codigo.slice(codigo.indexOf('create function sellar_formulario_portal('));
  assert.match(sellar, /new\.actualizado_por := auth\.uid\(\);/);
  assert.match(sellar, /new\.actualizado_en := now\(\);/);
  assert.match(codigo, /revoke\s+execute\s+on\s+function\s+sellar_formulario_portal\(\)\s+from\s+public,\s*anon,\s*authenticated;/i);
});

test('0058 no toca nada que no sea suyo', () => {
  assert.doesNotMatch(codigo, /(drop|alter)\s+policy/i);
  for (const m of codigo.matchAll(/alter\s+table\s+(\w+)/gi)) assert.equal(m[1], 'formulario_portal');
  for (const m of codigo.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(\w+)/gi)) {
    assert.ok(['sellar_formulario_portal', 'formularios_publicos'].includes(m[1]), m[1]);
  }
  assert.doesNotMatch(codigo, /alter\s+default\s+privileges/i);
});
