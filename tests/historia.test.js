import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titulos, epocas, datosPublicables, datosPendientes, epocaDeAnio, microDato } from '../src/data/historia.js';

const AÑOS_EXACTOS = [
  1943, 1944, 1945, 1946, 1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954,
  1977, 1978, 1983,
];

test('quince títulos con los años exactos', () => {
  const ts = titulos();
  assert.equal(ts.length, 15);
  assert.deepEqual(ts.map((t) => t.anio), AÑOS_EXACTOS);
  // El de 1983 es del Clausura: ese año hubo dos campeones y no se puede mostrar sin aclararlo.
  assert.equal(ts.find((t) => t.anio === 1983).torneo, 'Clausura');
  assert.equal(ts.filter((t) => t.torneo).length, 1);
  assert.deepEqual(ts.map((t) => t.numero), AÑOS_EXACTOS.map((_, i) => i + 1));
});

test('todo dato publicable tiene fuente', () => {
  const publicables = datosPublicables();
  assert.ok(publicables.length > 0);
  for (const d of publicables) {
    const f = d.fuente;
    assert.ok(f, `${d.id ?? d.anio} sin fuente`);
    for (const campo of ['medio', 'titulo', 'url']) {
      assert.ok(typeof f[campo] === 'string' && f[campo].trim(), `${d.id ?? d.anio}: fuente sin ${campo}`);
    }
    assert.match(f.url, /^https:\/\//, `${d.id ?? d.anio}: la URL tiene que ser https`);
    // La fecha de publicación si se conoce; si no, la fecha en que se consultó la página.
    assert.ok(f.fecha || f.consultada, `${d.id ?? d.anio}: fuente sin fecha`);
  }
  // Los títulos también salen publicados, así que también cargan su fuente.
  for (const t of titulos()) assert.ok(t.fuente?.url, `título ${t.anio} sin fuente`);
});

test('los pendientes no se publican', () => {
  const todos = [...titulos(), ...epocas()];
  // Hay datos pendientes en el módulo (copas, resultados, planteles)…
  const publicables = datosPublicables();
  assert.ok(publicables.every((d) => !d.pendiente));
  // …y ninguno llega a lo que se muestra: ni por datosPublicables ni por microDato.
  assert.ok(todos.every((d) => !d.pendiente));
  for (let anio = 1920; anio <= 2000; anio++) {
    const m = microDato(anio);
    if (m) assert.ok(!m.pendiente && m.fuente, `microDato(${anio}) devolvió algo sin fuente`);
  }
  // Un pendiente no lleva texto inventado: sólo dice qué falta confirmar.
  const pendientes = datosPendientes();
  assert.ok(pendientes.length >= 5);
  for (const p of pendientes) {
    assert.equal(p.pendiente, true);
    assert.ok(p.falta, `${p.id} no dice qué falta confirmar`);
    assert.equal(p.texto, undefined, `${p.id} tiene texto sin fuente`);
    assert.equal(p.fuente, undefined, `${p.id} tiene fuente: ya no sería pendiente`);
  }
});

test('epocaDeAnio ubica cada título', () => {
  for (const t of titulos()) {
    const e = epocaDeAnio(t.anio);
    assert.ok(e, `${t.anio} sin época`);
    assert.equal(e.id, t.epoca, `${t.anio}`);
    assert.ok(e.desde <= t.anio && t.anio <= e.hasta);
  }
  // 1950 es título de los 12 seguidos aunque también tenga su hito mundialista.
  assert.equal(epocaDeAnio(1950).id, 'doce-seguidos');
  assert.equal(epocaDeAnio(1990).id, 'el-cubierto');
  assert.equal(epocaDeAnio(1960), null);
  // Las épocas siguen el orden de la línea de tiempo.
  assert.deepEqual(epocas().map((e) => e.id), ['doce-seguidos', 'del-vecchio', 'la-vuelta', 'la-15', 'el-cubierto']);
});

test('microDato cae al de la época', () => {
  // Año sin dato propio: devuelve el principal de su época.
  const m1946 = microDato(1946);
  assert.equal(m1946.id, 'doce-seguidos');
  assert.equal(m1946.epoca, 'doce-seguidos');
  assert.equal(microDato(1978).id, 'la-vuelta');
  // Año con dato propio: gana el propio.
  assert.equal(microDato(1950).id, 'del-vecchio-mundial-1950');
  assert.equal(microDato(1983).id, 'clausura-1983');
  assert.equal(microDato(1990).id, 'cubierto-mundial-1990');
  // Fuera de toda época y sin dato propio, no hay nada que mostrar.
  assert.equal(microDato(1960), null);
});
