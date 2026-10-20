import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AFECCIONES } from '../src/data/emergencias.js';

// La lista cerrada de alertas vive en el check de 0059 y en emergencias.js;
// la seguridad de la tabla, sólo en el SQL. Si alguien cambia un lado, falla.
const sql = readFileSync('supabase/migrations/0059_temporada_y_emergencia.sql', 'utf8').replace(/\r\n/g, '\n');

test('afecciones iguales en SQL y JS', () => {
  const m = /alertas text\[\] not null default '\{\}' check \(alertas <@ array\[([\s\S]*?)\]::text\[\]\)/.exec(sql);
  assert.ok(m, 'no encontré el check de alertas');
  const enBase = [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]);
  assert.deepEqual(enBase, AFECCIONES.map(([codigo]) => codigo));
});

test('confirmar_pases inserta la pertenencia nueva antes de cerrar las viejas', () => {
  const cuerpo = /create function confirmar_pases[\s\S]*?\$fn\$;/.exec(sql)[0];
  const inserta = cuerpo.indexOf('insert into public.pertenencia');
  const cierra = cuerpo.indexOf('update public.pertenencia');
  assert.ok(inserta > 0 && cierra > inserta, 'el cierre tiene que ir después del insert');
});

test('funciones nuevas sin execute para anon', () => {
  const escapar = (t) => t.replace(/[()]/g, (c) => `\\${c}`);
  for (const f of ['abrir_temporada(uuid, text)', 'pases_de_temporada(uuid)', 'confirmar_pases(uuid, jsonb)',
    'importar_emergencias(jsonb)', 'emergencias_del_plantel(uuid)']) {
    assert.match(sql, new RegExp(`revoke execute on function ${escapar(f)}\\s+from public, anon;`), f);
    assert.match(sql, new RegExp(`grant execute on function ${escapar(f)}\\s+to authenticated;`), f);
  }
});

test('emergencia sin grant de delete y con RLS', () => {
  assert.match(sql, /revoke all on emergencia_jugador from anon, authenticated;/);
  assert.match(sql, /alter table emergencia_jugador enable row level security;/);
  assert.doesNotMatch(sql, /grant [^;]*delete[^;]* on emergencia_jugador/);
  assert.doesNotMatch(sql, /for delete[^;]*/);
});

test('las funciones definer fijan el search_path', () => {
  for (const m of sql.matchAll(/create function (\w+)\([^)]*\)[\s\S]*?as \$fn\$/g)) {
    if (/security definer/.test(m[0])) assert.match(m[0], /set search_path = ''/, m[1]);
  }
});
