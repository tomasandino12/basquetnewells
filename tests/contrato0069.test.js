import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 0069 ajusta dos funciones del jugador (B-31): mis_recursos() suma tipo y
 * frecuencia_semanal, y mi_asistencia() deja afuera los días de antes de que
 * el chico entrara al plantel. Son datos de menores: este test falla si 0069
 * abre una tabla, si mis_recursos deja de filtrar por el propio jugador o
 * pierde sus permisos al recrearse, o si mi_asistencia cambia la salida o la
 * regla de cada día que fijó 0068 (tests/contratoConstancia.test.js).
 */

const sql = readFileSync('supabase/migrations/0069_constancia_ajustes.sql', 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = sql.replace(/--.*$/gm, '');

function cuerpoDe(nombre) {
  const m = new RegExp(`create (or replace )?function ${nombre}\\(`).exec(sinComentarios);
  assert.ok(m, `no encontré la definición de ${nombre}: ¿cambió la migración?`);
  const hasta = sinComentarios.indexOf('\n$fn$;', m.index);
  assert.ok(hasta > m.index, `no encontré el cierre de ${nombre}`);
  return sinComentarios.slice(m.index, hasta);
}

test('0069 no abre ninguna tabla', () => {
  assert.doesNotMatch(sinComentarios, /grant\s+(select|insert|update|delete|all|truncate)\b/i);
  assert.doesNotMatch(sinComentarios, /create\s+policy/i);
  assert.doesNotMatch(sinComentarios, /alter\s+table/i);
});

test('mis_recursos: trae tipo y frecuencia, sólo de lo que le mandaron a él', () => {
  const cuerpo = cuerpoDe('mis_recursos');
  assert.match(cuerpo, /tipo text, frecuencia_semanal smallint\)/);
  assert.match(cuerpo, /security definer/);
  assert.match(cuerpo, /set search_path = ''/);
  assert.match(cuerpo, /v_jugador uuid := public\.mi_jugador\(\)/);
  assert.match(cuerpo, /if v_jugador is null then\s+return;/);
  assert.match(cuerpo, /where e\.jugador_id = v_jugador/);
  assert.doesNotMatch(cuerpo, /p_jugador/);
});

test('mis_recursos: se recrea con los mismos permisos que 0030', () => {
  assert.match(sinComentarios, /drop function mis_recursos\(\);/);
  assert.match(sinComentarios, /revoke execute on function mis_recursos\(\) from public, anon;/);
  assert.match(sinComentarios, /grant execute on function mis_recursos\(\) to authenticated;/);
  // Nada más se otorga en 0069: mi_asistencia conserva los permisos de 0068.
  const otorgadas = [...sinComentarios.matchAll(/grant\s+execute\s+on\s+function\s+([a-z_]+)/gi)].map((m) => m[1]);
  assert.deepEqual(otorgadas, ['mis_recursos']);
});

test('mi_asistencia: misma salida y misma regla de cada día que 0068', () => {
  const cuerpo = cuerpoDe('mi_asistencia');
  assert.match(cuerpo, /create or replace function mi_asistencia\(\)\s+returns jsonb/);
  assert.match(cuerpo, /v_jugador uuid := public\.mi_jugador\(\)/);
  assert.match(cuerpo, /if v_jugador is null then\s+return null;/);
  const salida = cuerpo.slice(cuerpo.indexOf('select jsonb_agg'), cuerpo.indexOf('from (', cuerpo.indexOf('select jsonb_agg')));
  assert.match(salida, /jsonb_build_object\('fecha', d\.fecha, 'vino', d\.vino\)/);
  assert.doesNotMatch(salida, /motivo|estado|marcado_por|lesion|zona/i);
  const casos = [
    /when bool_or\(a\.estado = 'presente'\) then true/,
    /when exists \(select 1 from public\.lesion l[\s\S]*?\) then null/,
    /when bool_or\(a\.estado in \('ausente', 'justificada'\)\) then false/,
    /else null/,
  ];
  let desde = 0;
  for (const caso of casos) {
    const m = caso.exec(cuerpo.slice(desde));
    assert.ok(m, `falta o está fuera de orden: ${caso}`);
    desde += m.index + m[0].length;
  }
  assert.match(cuerpo, /group by e\.fecha/);
  assert.match(cuerpo, /where e\.hubo/);
  assert.match(cuerpo, /interval '12 months'/);
});

test('mi_asistencia: antes del alta sólo entra un día que el profe tomó', () => {
  const cuerpo = cuerpoDe('mi_asistencia');
  assert.match(cuerpo, /pe\.desde <= e\.fecha or exists \(\s*select 1 from public\.asistencia a2\s+where a2\.entrenamiento_id = e\.id and a2\.jugador_id = v_jugador\)/);
});
