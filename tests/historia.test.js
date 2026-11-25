import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titulos, epocas, datosPublicables, datosPendientes, epocaDeAnio, microDato, momentos, hitoDeTitulo, resumenDeTitulos, placasDeCopa, piezasDeVitrina } from '../src/data/historia.js';

const AÑOS_EXACTOS = [
  1943, 1944, 1945, 1946, 1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954,
  1977, 1978, 1983,
];

test('quince títulos con los años exactos', () => {
  const ts = titulos();
  assert.equal(ts.length, 15);
  assert.deepEqual(ts.map((t) => t.anio), AÑOS_EXACTOS);
  // 1983 tuvo dos campeones: el de Newell's es el torneo regular y no se puede mostrar sin aclararlo.
  assert.equal(ts.find((t) => t.anio === 1983).torneo, 'Torneo regular');
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
  assert.ok(pendientes.length >= 1);
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
  assert.deepEqual(epocas().map((e) => e.id), ['doce-seguidos', 'invicto-1948', 'del-vecchio', 'la-vuelta', 'la-15', 'el-cubierto']);
});

test('microDato cae al de la época', () => {
  // Año sin dato propio: devuelve el principal de su época.
  const m1945 = microDato(1945);
  assert.equal(m1945.id, 'doce-seguidos');
  assert.equal(m1945.epoca, 'doce-seguidos');
  // Año con dato propio: gana el propio.
  assert.equal(microDato(1950).id, 'del-vecchio-mundial-1950');
  assert.equal(microDato(1983).id, 'campeon-1983');
  assert.equal(microDato(1948).id, 'campania-1948');
  assert.equal(microDato(1977).id, 'maquina-1977');
  assert.equal(microDato(1990).id, 'cubierto-mundial-1990');
  // Fuera de toda época y sin dato propio, no hay nada que mostrar.
  assert.equal(microDato(1960), null);
});

test('las cifras del encabezado salen de los títulos', () => {
  assert.deepEqual(resumenDeTitulos(), { total: 15, racha: { cantidad: 12, desde: 1943, hasta: 1954 }, primero: 1943, ultimo: 1983 });
});

test('los momentos no son títulos y el dato propio de un año nunca es un momento', () => {
  assert.deepEqual(momentos().map((m) => m.anio), [1926, 1950, 1990]);
  assert.ok(momentos().every((m) => m.fuente?.url));
  // 1950 es año de título, pero lo que se cuenta de él es el momento de Del Vecchio: la tarjeta del título no lo repite.
  assert.equal(hitoDeTitulo(1950), null);
  assert.equal(hitoDeTitulo(1948).tecnico, 'Héctor Carrozo');
  assert.equal(hitoDeTitulo(1944), null);
});

test('el Cubierto lleva sus dos sedes mundiales con fuente', () => {
  const c = momentos().find((m) => m.id === 'cubierto-mundial-1990');
  assert.deepEqual(c.sedes, ['Mundial FIBA 1990 · Grupo B', 'Mundial FIBA U17 2018']);
  // Cada sede tiene su respaldo: la de 1990 en la fuente principal y la de 2018 en las otras.
  assert.match(c.fuente.url, /Estadio_Cubierto/);
  const urls = c.otrasFuentes.map((f) => f.url);
  assert.ok(urls.includes('https://en.wikipedia.org/wiki/2018_FIBA_Under-17_Basketball_World_Cup'));
  assert.ok(urls.includes('https://www.fiba.basketball/world/u17/2018/news/draw-results-in-for-fiba-u17-basketball-world-cup-2018'));
  for (const f of [c.fuente, ...c.otrasFuentes]) {
    assert.match(f.url, /^https:\/\//);
    assert.ok(f.medio && f.titulo && (f.fecha || f.consultada), `${f.medio}: fuente incompleta`);
  }
  // Los medios se distinguen para que los badges no digan dos veces lo mismo.
  const medios = [c.fuente, ...c.otrasFuentes].map((f) => f.medio);
  assert.equal(new Set(medios).size, medios.length);
});

test('cada título tiene su placa', () => {
  const placas = placasDeCopa();
  const ts = titulos();
  assert.equal(placas.length, ts.length);
  assert.deepEqual(placas.map((p) => p.anio), ts.map((t) => t.anio));
  assert.deepEqual(placas.map((p) => p.numero), ts.map((t) => t.numero));
  // Ninguna se superpone: los ángulos son distintos y entran en una vuelta (-π, π).
  const angulos = placas.map((p) => p.angulo);
  assert.equal(new Set(angulos.map((a) => a.toFixed(6))).size, placas.length);
  for (const a of angulos) assert.ok(a > -Math.PI && a < Math.PI);
  // Simétricas respecto del frente: la del medio (1950) mira justo de frente.
  assert.ok(Math.abs(placas[7].angulo) < 1e-9);
  assert.ok(Math.abs(placas[0].angulo + placas[14].angulo) < 1e-9);
});

test('la vitrina alterna dos piezas, cada una con su leyenda de recreación', () => {
  const piezas = piezasDeVitrina();
  assert.deepEqual(piezas.map((p) => p.id), ['copa', 'medalla']);
  assert.deepEqual(piezas.map((p) => p.etiqueta), ['Trofeo ARBB', 'Medalla oficial']);
  for (const p of piezas) assert.match(p.leyenda, /^Recreación inspirada en la (copa|medalla) actual de la Asociación Rosarina$/);
  // Es una copia: tocarla no cambia la lista.
  piezas[0].etiqueta = 'x';
  assert.equal(piezasDeVitrina()[0].etiqueta, 'Trofeo ARBB');
});
