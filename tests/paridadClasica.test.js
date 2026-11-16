import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

/**
 * La lista de paridad (docs/desarrollo/paridad-clasica.md) es lo que impide olvidarse una función
 * al mudar la app de siempre a la nueva. Este test la vigila:
 *  - cada pantalla registrada en la vieja tiene su fila;
 *  - una marca ✅ la respalda una prueba que existe y nombra lo que dice (no se marca a ojo);
 *  - la vieja sólo puede desaparecer si no queda ninguna fila sin ✅.
 */

const DOC = 'docs/desarrollo/paridad-clasica.md';
const REGISTRO = 'src/ui/pantallas/registro.js';
const ESTADOS = ['✅', '🔎', '⬜'];

const filas = () =>
  readFileSync(DOC, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\|\s*(p|x)-[\w-]+\s*\|/.test(l))
    .map((l) => {
      const celdas = l.split('|').slice(1, -1).map((c) => c.trim());
      const estado = celdas.find((c) => ESTADOS.includes(c)) ?? null;
      const pruebas = [...l.matchAll(/`([^`]+?)::([^`]+?)`/g)].map((m) => ({ archivo: m[1], texto: m[2] }));
      return { id: celdas[0], estado, pruebas, tanda: celdas.at(-1) };
    });

test('cada pantalla registrada en la app de siempre figura en la lista de paridad', { skip: !existsSync(REGISTRO) }, () => {
  const registradas = [...readFileSync(REGISTRO, 'utf8').matchAll(/registrarPantalla\('(p-[\w-]+)'/g)].map((m) => m[1]);
  assert.ok(registradas.length >= 40, 'no se leyó el registro de pantallas');
  const ids = new Set(filas().map((f) => f.id));
  const faltan = registradas.filter((id) => !ids.has(id));
  assert.deepEqual(faltan, [], `Faltan filas en ${DOC}: ${faltan.join(', ')}`);
});

test('la lista no repite ni inventa filas de pantallas', { skip: !existsSync(REGISTRO) }, () => {
  const registradas = new Set([...readFileSync(REGISTRO, 'utf8').matchAll(/registrarPantalla\('(p-[\w-]+)'/g)].map((m) => m[1]));
  const ids = filas().map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'hay ids repetidos');
  const sobran = ids.filter((id) => id.startsWith('p-') && !registradas.has(id));
  assert.deepEqual(sobran, [], `Filas de pantallas que no existen en el registro: ${sobran.join(', ')}`);
});

test('cada fila tiene un estado válido y las que faltan dicen en qué tanda se mudan', () => {
  for (const f of filas()) {
    assert.ok(f.estado, `${f.id}: estado inválido (usar ${ESTADOS.join(' / ')})`);
    if (f.estado === '⬜') assert.match(f.tanda, /[1-4]/, `${f.id}: falta decir la tanda`);
  }
});

test('cada ✅ cita pruebas que existen y que nombran lo que dicen', () => {
  const marcadas = filas().filter((f) => f.estado === '✅');
  assert.ok(marcadas.length > 0);
  for (const f of marcadas) {
    assert.ok(f.pruebas.length > 0, `${f.id}: está en ✅ pero no cita ninguna prueba`);
    for (const { archivo, texto } of f.pruebas) {
      assert.ok(existsSync(archivo), `${f.id}: no existe ${archivo}`);
      assert.ok(readFileSync(archivo, 'utf8').includes(texto), `${f.id}: ${archivo} no contiene «${texto}»`);
    }
  }
});

test('la app de siempre sólo se puede borrar con toda la lista en ✅', { skip: existsSync(REGISTRO) }, () => {
  const sinMarca = filas().filter((f) => f.estado !== '✅').map((f) => f.id);
  assert.deepEqual(sinMarca, [], `Se borró la vieja pero quedan sin verificar: ${sinMarca.join(', ')}`);
});
