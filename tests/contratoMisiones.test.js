import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESTADOS, MAX_DE_EQUIPO, MAX_POR_JUGADOR, metricasPara } from '../src/data/misiones.js';
import { LIMITE } from '../src/data/limites.js';

/**
 * Las métricas, los estados, los topes y los largos de las misiones viven en
 * src/data/misiones.js (lo que ofrece la pantalla) y en los check de
 * 0055_misiones_partido.sql (lo que acepta la base). Si se desincronizan, la
 * pantalla ofrece algo que la base rechaza, o la base deja entrar una métrica
 * de anotación que el club pidió no usar.
 *
 * Los largos los compara también contratoLimites.test.js (0055 está en
 * TABLAS_NUEVAS); acá se repiten para que el test de misiones diga qué columna
 * de qué tabla se desincronizó.
 */

const ARCHIVO = '0055_misiones_partido.sql';
const sql = readFileSync(`supabase/migrations/${ARCHIVO}`, 'utf8').replace(/\r\n/g, '\n');

function tabla(nombre) {
  const m = sql.match(new RegExp(`create table ${nombre} \\(\\n([\\s\\S]*?)\\n\\);`));
  assert.ok(m, `no encontré create table ${nombre} en ${ARCHIVO}`);
  return m[1];
}

const valoresDe = (cuerpo, columna) => {
  const m = cuerpo.match(new RegExp(`^\\s+${columna} text check \\(${columna} in \\(([^)]*)\\)\\)`, 'm'));
  assert.ok(m, `no encontré el check de ${columna}`);
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
};

const largoDe = (cuerpo, columna) => {
  const m = cuerpo.match(new RegExp(`^\\s+${columna} text check \\(char_length\\(${columna}\\) <= (\\d+)\\)`, 'm'));
  assert.ok(m, `no encontré el largo de ${columna}`);
  return Number(m[1]);
};

const claves = (ambito) => metricasPara(ambito).map((m) => m.clave).sort();

test('métricas del check = METRICAS', () => {
  assert.deepEqual(valoresDe(tabla('mision_jugador'), 'metrica'), claves('jugador'));
  assert.deepEqual(valoresDe(tabla('mision_equipo'), 'metrica'), claves('equipo'));
});

test('la base no acepta puntos ni tiro', () => {
  for (const t of ['mision_jugador', 'mision_equipo']) {
    for (const v of valoresDe(tabla(t), 'metrica')) {
      assert.doesNotMatch(v, /^pts$|puntos_propios|anotados|intentados|porcentaje/, `${t}: ${v}`);
    }
  }
});

test('estados del check = ESTADOS', () => {
  const ids = ESTADOS.map((e) => e.id).sort();
  assert.deepEqual(valoresDe(tabla('mision_jugador'), 'estado'), ids);
  assert.deepEqual(valoresDe(tabla('mision_equipo'), 'estado'), ids);
});

test('orden ≤ MAX_*', () => {
  assert.match(tabla('mision_jugador'), new RegExp(`orden smallint not null check \\(orden between 1 and ${MAX_POR_JUGADOR}\\)`));
  assert.match(tabla('mision_equipo'), new RegExp(`orden smallint not null check \\(orden between 1 and ${MAX_DE_EQUIPO}\\)`));
});

test('largos del check = LIMITE', () => {
  assert.equal(largoDe(tabla('previa_partido'), 'rival'), LIMITE.rival);
  for (const t of ['mision_jugador', 'mision_equipo']) {
    assert.equal(largoDe(tabla(t), 'texto'), LIMITE.textoMision, t);
    assert.equal(largoDe(tabla(t), 'comentario'), LIMITE.comentarioMision, t);
  }
});

test('RLS y revoke en las tres tablas', () => {
  for (const t of ['previa_partido', 'mision_jugador', 'mision_equipo']) {
    assert.match(sql, new RegExp(`alter table ${t} enable row level security;`), t);
    assert.match(sql, new RegExp(`revoke all on ${t} from anon, authenticated;`), t);
    // Autoría y evaluación las sella la base: el cliente no las manda.
    const grants = [...sql.matchAll(new RegExp(`grant (?:insert|update) \\(([^)]*)\\) on ${t} to authenticated;`, 'g'))];
    assert.ok(grants.length >= 2, t);
    for (const g of grants) assert.doesNotMatch(g[1], /creado_|evaluado_/, t);
  }
});

test('el coordinador no lee misiones individuales', () => {
  const m = sql.match(/create policy mision_jugador_ver[\s\S]*?;\n/);
  assert.ok(m);
  assert.doesNotMatch(m[0], /es_coordinador_de/);
});

test('las RPC son security invoker, chequean el permiso y no se otorgan a anon', () => {
  for (const f of ['guardar_previa', 'evaluar_misiones']) {
    const cuerpo = sql.match(new RegExp(String.raw`create function ${f}\(payload jsonb\)[\s\S]*?\n\$\$;`));
    assert.ok(cuerpo, f);
    assert.match(cuerpo[0], /security invoker/, f);
    assert.doesNotMatch(cuerpo[0], /security definer/, f);
    // El coordinador ve la previa: sin este chequeo, un payload vacío "pasa".
    assert.match(cuerpo[0], /puede_escribir_plantel\(v_plantel_id\)/, f);
    // La base nunca decide un estado: sólo copia el que manda el profe.
    assert.doesNotMatch(cuerpo[0], /estado\s*=\s*'/, f);
    assert.match(sql, new RegExp(String.raw`revoke execute on function ${f}\(jsonb\) from public, anon;`), f);
    assert.match(sql, new RegExp(String.raw`grant  execute on function ${f}\(jsonb\) to authenticated;`), f);
  }
});
