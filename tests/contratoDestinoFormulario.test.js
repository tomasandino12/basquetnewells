import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESTINOS } from '../src/data/formulariosPortal.js';

/**
 * 0061 le agrega a cada formulario del portal un `destino` (consultas o
 * colaboradores) para que el portal sepa cuál es cuál aunque la coordinación
 * los reordene o cambie el título, y para que la dirección fija del QR
 * (/consultas) lleve siempre al de consultas vigente.
 *
 * Lo que este test ata, sobre el estado final de la función pública:
 * - anon sigue ejecutando UNA sola función y no recibe nada sobre la tabla;
 * - la función devuelve título, texto, enlace y destino de filas ACTIVAS;
 * - hay a lo sumo un formulario por destino y por club;
 * - la lista de destinos del SQL es la de src/data/formulariosPortal.js.
 * El contrato de 0058 (tests/contratoFormularioPortal.test.js) sigue valiendo
 * para esa migración: una migración aplicada no se edita.
 */

const sql = readFileSync('supabase/migrations/0061_destino_formulario_portal.sql', 'utf8').replace(/\r\n/g, '\n');
const codigo = sql.replace(/--.*$/gm, '');
const plano = (s) => s.replace(/\s+/g, ' ').trim();

test('0061 agrega la columna destino con un check de los destinos de entonces (y nulo)', () => {
  assert.match(plano(codigo), /alter table formulario_portal add column destino text, add constraint formulario_portal_destino_valido check \(destino in \('consultas', 'colaboradores'\)\);/);
});

// 0062 rehace el check con inscripción y comprobante, y 0063 suma recaudación.
// La lista de la app se compara con la ÚLTIMA migración que lo define: las
// anteriores quedan como se aplicaron.
const sinComentarios = (archivo) => readFileSync(`supabase/migrations/${archivo}`, 'utf8').replace(/\r\n/g, '\n').replace(/--.*$/gm, '');
const sql62 = sinComentarios('0062_destinos_inscripcion_comprobante.sql');
const sql63 = sinComentarios('0063_destino_recaudacion.sql');
const destinosDelCheck = (s) => [...s.match(/check \(destino in \(([^)]*)\)\)/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
const REHACE_EL_CHECK = /alter table formulario_portal drop constraint formulario_portal_destino_valido, add constraint formulario_portal_destino_valido check \(destino in \([^)]*\)\);/;

test('0062: el check admite los cuatro destinos de entonces, y sólo toca ese check', () => {
  assert.match(plano(sql62), REHACE_EL_CHECK);
  assert.deepEqual(destinosDelCheck(sql62), ['consultas', 'colaboradores', 'inscripcion', 'comprobante']);
  assert.doesNotMatch(sql62, /\b(grant|revoke|policy|function)\b/i);
  for (const m of sql62.matchAll(/alter\s+table\s+(\w+)/gi)) assert.equal(m[1], 'formulario_portal');
});

test('0063: el check admite exactamente los destinos de la app (con recaudación), y sólo toca ese check', () => {
  assert.match(plano(sql63), REHACE_EL_CHECK);
  assert.deepEqual(destinosDelCheck(sql63), DESTINOS.map((d) => d.clave));
  assert.ok(destinosDelCheck(sql63).includes('recaudacion'));
  assert.doesNotMatch(sql63, /\b(grant|revoke|policy|function)\b/i);
  for (const m of sql63.matchAll(/alter\s+table\s+(\w+)/gi)) assert.equal(m[1], 'formulario_portal');
});

test('el rollback de 0063 desmarca recaudación antes de volver al check de 0062', () => {
  const rollback = readFileSync('tests/rollback0063.sql', 'utf8').replace(/\r\n/g, '\n');
  const desmarca = rollback.indexOf("update formulario_portal set destino = null where destino = 'recaudacion'");
  const check = rollback.indexOf("check (destino in ('consultas', 'colaboradores', 'inscripcion', 'comprobante'))");
  assert.ok(desmarca >= 0 && check > desmarca);
  assert.match(rollback, /version = '0063'/);
});

test('el rollback de 0062 desmarca los dos destinos nuevos antes de volver al check de 0061', () => {
  const rollback = readFileSync('tests/rollback0062.sql', 'utf8').replace(/\r\n/g, '\n');
  const desmarca = rollback.indexOf("update formulario_portal set destino = null where destino in ('inscripcion', 'comprobante')");
  const check = rollback.indexOf("check (destino in ('consultas', 'colaboradores'))");
  assert.ok(desmarca >= 0 && check > desmarca);
  assert.match(rollback, /version = '0062'/);
});

test('a lo sumo un formulario por destino y por club: índice único parcial', () => {
  assert.match(plano(codigo), /create unique index formulario_portal_destino_unico on formulario_portal \(club_id, destino\) where destino is not null;/);
});

test('los únicos grants nuevos son la columna destino, para authenticated; nada para anon sobre la tabla', () => {
  const grants = [...codigo.matchAll(/grant\s+(select|insert|update|delete|all|truncate|references|trigger)\b[^;]*;/gi)].map((m) => plano(m[0]));
  assert.deepEqual(grants, [
    'grant insert (destino) on formulario_portal to authenticated;',
    'grant update (destino) on formulario_portal to authenticated;',
  ]);
  assert.doesNotMatch(codigo, /grant\s+[^;]*\bon\s+formulario_portal\s+to\s+[^;]*\banon\b/i);
  assert.doesNotMatch(codigo, /grant\s+[^;]*\bdelete\b/i);
});

test('la función pública se rehace con la columna nueva y anon sigue ejecutando sólo esa', () => {
  assert.match(codigo, /drop function formularios_publicos\(uuid\);/);
  const desde = codigo.indexOf('create function formularios_publicos(');
  assert.ok(desde >= 0, 'falta el create function');
  const hasta = codigo.indexOf('\n$fn$;', desde);
  const cuerpo = codigo.slice(desde, hasta);
  assert.match(cuerpo, /returns table\s*\(\s*titulo text,\s*texto text,\s*enlace text,\s*destino text\s*\)/);
  assert.match(cuerpo, /security definer/);
  assert.match(cuerpo, /set search_path = ''/);
  assert.match(cuerpo, /select f\.titulo, f\.texto, f\.enlace, f\.destino\s+from public\.formulario_portal f/);
  assert.match(cuerpo, /where f\.club_id = p_club and f\.activo/);
  assert.match(cuerpo, /order by f\.orden/);
  assert.match(cuerpo, /limit \d+/);
  assert.doesNotMatch(cuerpo, /creado_por|actualizado_por|jugador|miembro_club|auth\./);
  const aAnon = [...codigo.matchAll(/grant\s+[^;]*\bto\s+[^;]*\banon\b[^;]*;/gi)].map((m) => plano(m[0]));
  assert.deepEqual(aAnon, ['grant execute on function formularios_publicos(uuid) to anon, authenticated;']);
  assert.match(codigo, /revoke\s+execute\s+on\s+function\s+formularios_publicos\(uuid\)\s+from\s+public;/i);
});

test('0061 no toca nada que no sea suyo: ninguna policy, ninguna otra tabla ni función', () => {
  assert.doesNotMatch(codigo, /(create|drop|alter)\s+policy/i);
  for (const m of codigo.matchAll(/alter\s+table\s+(\w+)/gi)) assert.equal(m[1], 'formulario_portal');
  for (const m of codigo.matchAll(/(?:create|drop)\s+function\s+(\w+)/gi)) assert.equal(m[1], 'formularios_publicos');
  assert.doesNotMatch(codigo, /alter\s+default\s+privileges/i);
});

test('el rollback de 0061 deja la función como en 0058 y quita la columna', () => {
  const rollback = readFileSync('tests/rollback0061.sql', 'utf8').replace(/\r\n/g, '\n');
  assert.match(rollback, /drop function if exists formularios_publicos\(uuid\)/);
  assert.match(rollback, /returns table \(titulo text, texto text, enlace text\)/);
  assert.match(rollback, /drop index if exists formulario_portal_destino_unico/);
  assert.match(rollback, /drop column if exists destino/);
  assert.match(rollback, /version = '0061'/);
});
