import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIPOS_DE_PRACTICA } from '../src/data/constancia.js';

/**
 * La constancia del jugador (spec 2026-11-22, §1, §2 y §4) guarda datos de
 * menores. Este test lee 0068 y falla si alguien le abre la tabla a un rol, si
 * las funciones del jugador dejan de pasar por mi_jugador(), si marcar_practica
 * empieza a aceptar una fecha o si el conteo del profe nombra jugadores o pierde
 * el piso de 3 cuentas. Modelo: tests/contratoAperturaRecurso.test.js y
 * tests/contratoMaterial.test.js.
 */

const sql = readFileSync('supabase/migrations/0068_constancia_jugador.sql', 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = sql.replace(/--.*$/gm, '');

function cuerpoDe(nombre) {
  const desde = sinComentarios.indexOf(`create function ${nombre}(`);
  assert.ok(desde >= 0, `no encontré "create function ${nombre}(": ¿cambió la migración?`);
  const hasta = sinComentarios.indexOf('\n$fn$;', desde);
  assert.ok(hasta > desde, `no encontré el cierre de ${nombre}`);
  return sinComentarios.slice(desde, hasta);
}

test('practica_jugador: cerrada a todos', () => {
  assert.doesNotMatch(sinComentarios, /grant\s+(select|insert|update|delete|all|truncate)\b/i);
  assert.doesNotMatch(sinComentarios, /create\s+policy/i);
  assert.match(sinComentarios, /alter table practica_jugador enable row level security/i);
  assert.match(sinComentarios, /revoke all on practica_jugador from public, anon, authenticated/i);
});

test('tipos de práctica: SQL y JS iguales', () => {
  const ancla = 'tipo text not null check (tipo in (';
  const desde = sinComentarios.indexOf(ancla);
  assert.ok(desde >= 0, `no encontré "${ancla}": ¿cambió la migración?`);
  const tipos = [...sinComentarios.slice(desde, sinComentarios.indexOf(')', desde)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...tipos].sort(), [...TIPOS_DE_PRACTICA].sort());
});

test('funciones del jugador pasan por mi_jugador', () => {
  for (const nombre of ['mis_practicas', 'marcar_practica', 'mi_asistencia']) {
    const cuerpo = cuerpoDe(nombre);
    assert.match(cuerpo, /security definer/, `${nombre} sin security definer`);
    assert.match(cuerpo, /set search_path = ''/, `${nombre} sin search_path vacío`);
    assert.match(cuerpo, /v_jugador uuid := public\.mi_jugador\(\)/, `${nombre} no arranca por mi_jugador()`);
    assert.match(cuerpo, /if v_jugador is null then\s+return null;/, `${nombre} no devuelve null sin cuenta`);
    assert.doesNotMatch(cuerpo, /p_jugador/, `${nombre}: el jugador no puede elegir de quién`);
  }
});

test('marcar_practica: la fecha la pone el servidor', () => {
  assert.match(sinComentarios, /create function marcar_practica\(p_recurso_id uuid, p_hecho boolean\)/);
  const cuerpo = cuerpoDe('marcar_practica');
  assert.doesNotMatch(cuerpo, /p_fecha|p_dia/, 'no puede recibir la fecha');
  assert.match(cuerpo, /v_hoy date := \(now\(\) at time zone 'America\/Argentina\/Buenos_Aires'\)::date;/);
  // Insert y borrado usan sólo hoy; y sólo recursos que se le enviaron a él.
  assert.match(cuerpo, /select e\.jugador_id, e\.club_id, v_hoy, 'recurso', e\.recurso_id/);
  assert.match(cuerpo, /where e\.recurso_id = p_recurso_id and e\.jugador_id = v_jugador/);
  assert.match(cuerpo, /p\.fecha = v_hoy/);
});

test('practicas_del_plantel: sin ids y con mínimo 3', () => {
  const cuerpo = cuerpoDe('practicas_del_plantel');
  assert.match(cuerpo, /if not public\.puede_ver_plantel\(p_plantel_id\) then\s+return null;/);
  const salida = cuerpo.slice(cuerpo.indexOf('select jsonb_build_object'));
  assert.doesNotMatch(salida, /jugador|nombre|user_id/i, 'la salida no puede nombrar jugadores');
  assert.match(cuerpo, /c_minimo constant integer := 3;/);
  for (const clave of ['marcaronEstaSemana', 'estaSemana', 'algunaVez']) {
    assert.match(cuerpo, new RegExp(`'${clave}',[^\\n]*>= c_minimo`), `${clave} sin el piso de cuentas`);
  }
});

test('mi_asistencia: sin motivo, aviso, lesión ni quién marcó en la salida', () => {
  const cuerpo = cuerpoDe('mi_asistencia');
  const salida = cuerpo.slice(cuerpo.indexOf('select jsonb_agg'), cuerpo.indexOf('from (', cuerpo.indexOf('select jsonb_agg')));
  assert.match(salida, /jsonb_build_object\('fecha', d\.fecha, 'vino', d\.vino\)/);
  assert.doesNotMatch(salida, /motivo|estado|marcado_por|lesion|zona/i);
});

test('mi_asistencia: las reglas de cada día, en orden', () => {
  const cuerpo = cuerpoDe('mi_asistencia');
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
  // Un día por fecha, sólo días en que hubo práctica, y últimos 12 meses.
  assert.match(cuerpo, /group by e\.fecha/);
  assert.match(cuerpo, /where e\.hubo/);
  assert.match(cuerpo, /interval '12 months'/);
});

test('el borrado: sin pertenencia vigente y al cerrarse la cuenta', () => {
  assert.match(sinComentarios, /create trigger pertenencia_borra_practicas\s+after update or delete on pertenencia/);
  assert.match(sinComentarios, /create trigger cuenta_jugador_borra_practicas\s+after update on cuenta_jugador/);
  assert.match(sinComentarios, /when \(old\.hasta is null and new\.hasta is not null\)/);
  assert.match(sinComentarios, /not exists \(select 1 from public\.pertenencia pe\s+where pe\.jugador_id = old\.jugador_id and pe\.hasta is null\)/);
});

test('si se borra el recurso, el día practicado queda', () => {
  assert.match(sinComentarios, /references recurso \(club_id, id\) on delete set null \(recurso_id\)/);
});
