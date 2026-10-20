import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIMITES_ESTADO, ESTADOS_PAGO, EMPAREJAMIENTOS } from '../src/data/estadoInscripcion.js';
import { clavearNombre } from '../src/parser/parserCabb.js';

/**
 * 0060 es lo primero de afuera que escribe en la base: estas reglas viven en
 * el SQL (que las hace cumplir) y en JS (el panel y el script). Si cambian de
 * un lado sólo, falla acá.
 */

const sql = readFileSync('supabase/migrations/0060_estado_inscripcion.sql', 'utf8').replace(/\r\n/g, '\n');

const numero = (re) => {
  const m = re.exec(sql);
  assert.ok(m, `no está en la migración: ${re}`);
  return Number(m[1]);
};

test('los límites del SQL coinciden con LIMITES_ESTADO', () => {
  assert.equal(numero(/char_length\(apellido\) <= (\d+)/), LIMITES_ESTADO.nombre);
  assert.equal(numero(/char_length\(nombre\) <= (\d+)/), LIMITES_ESTADO.nombre);
  assert.equal(numero(/char_length\(btrim\(v_f->>'apellido'\)\) not between 1 and (\d+)/), LIMITES_ESTADO.nombre);
  assert.equal(numero(/char_length\(categoria_texto\) <= (\d+)/), LIMITES_ESTADO.categoria);
  assert.equal(numero(/char_length\(v_f->>'categoria'\) > (\d+)/), LIMITES_ESTADO.categoria);
  assert.equal(numero(/not between 1 and (\d+)\) then\n\s+raise exception 'ENVIO_INVALIDO: % \(hasta/), LIMITES_ESTADO.encabezado);
  assert.equal(numero(/jsonb_array_length\(p_envio->v_texto\) > (\d+)/), LIMITES_ESTADO.encabezados);
  assert.equal(numero(/jsonb_array_length\(v_filas\) > (\d+)/), LIMITES_ESTADO.filas);
  assert.equal(numero(/fila between 2 and (\d+)/), LIMITES_ESTADO.fila);
  assert.equal(numero(/octet_length\(p_envio::text\) > (\d+)/), LIMITES_ESTADO.bytes);
});

test('los estados de pago son los mismos', () => {
  const m = /not in \(('[a-z_]+'(?:, '[a-z_]+')*)\)+ then\n\s+raise exception 'ENVIO_INVALIDO: documentos o pagos/.exec(sql);
  assert.ok(m, 'no encuentro la lista de estados de pago');
  assert.deepEqual(m[1].split(', ').map((s) => s.slice(1, -1)), [...ESTADOS_PAGO]);
});

test('el panel conoce todos los emparejamientos que devuelve la base', () => {
  const lectura = sql.slice(sql.indexOf('create function estado_inscripcion_del_club'), sql.indexOf('create function conexion_google_del_club'));
  const enBase = [...lectura.matchAll(/'(ok|homonimo|sin_ficha|sin_tablero)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(enBase)].sort(), [...EMPAREJAMIENTOS].sort());
});

test('clave_inscripcion traduce cada letra igual que clavearNombre', () => {
  const m = /translate\(coalesce\(p_texto, ''\),\n\s+'([^']+)',\n\s+'([^']+)'\)/.exec(sql);
  assert.ok(m, 'no encuentro el translate de clave_inscripcion');
  const [desde, hacia] = [[...m[1]], [...m[2]]];
  assert.equal(desde.length, hacia.length);
  desde.forEach((letra, i) => assert.equal(clavearNombre(letra), hacia[i].toUpperCase(), letra));
  // Las letras con tilde del castellano tienen que estar todas.
  for (const letra of 'áéíóúüñÁÉÍÓÚÜÑ') assert.ok(desde.includes(letra), letra);
});

test('ninguna de las tablas nuevas tiene grant a anon ni authenticated', () => {
  assert.doesNotMatch(sql, /grant [^;]* on (table )?(conexion_google|estado_inscripcion)\b/);
  assert.match(sql, /revoke all on conexion_google from anon, authenticated;/);
  assert.match(sql, /revoke all on estado_inscripcion from anon, authenticated;/);
  assert.match(sql, /alter table conexion_google enable row level security;/);
  assert.match(sql, /alter table estado_inscripcion enable row level security;/);
});

test('empujar_estado_google es la única función ejecutable por anon', () => {
  const aAnon = [...sql.matchAll(/grant execute on function (\w+)\([^)]*\)\s+to ([^;]+);/g)]
    .filter((m) => /\banon\b/.test(m[2]))
    .map((m) => m[1]);
  assert.deepEqual(aAnon, ['empujar_estado_google']);
  for (const f of ['rotar_conexion_google', 'desconectar_google', 'estado_inscripcion_del_club', 'conexion_google_del_club']) {
    assert.match(sql, new RegExp(`revoke execute on function ${f}\\(uuid\\)\\s+from public, anon;`), f);
  }
});

test('el envío rechaza textos con un DNI', () => {
  assert.equal([...sql.matchAll(/~ '\[0-9\]\{7\}'/g)].length, 2);
  assert.match(sql, /raise exception 'PARECE_DNI'/);
});
