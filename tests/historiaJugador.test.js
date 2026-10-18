import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FUENTES, temporadaDeFecha, agruparHistoria, comoLlega, comoTermino, totalesDePartidos, resumenDeTemporada,
  historiaDesdeJson,
} from '../src/data/historiaJugador.js';

// Un chico que estuvo en U15 2025 y hoy está en U17 2026.
const T25 = { id: 't25', nombre: '2025' };
const T26 = { id: 't26', nombre: '2026' };
const base = () => ({
  temporadas: [T25, T26],
  planteles: [
    { id: 'u15-25', temporadaId: 't25', categoria: 'U15M', profes: ['Ana'] },
    { id: 'u17-26', temporadaId: 't26', categoria: 'U17M', profes: ['Beto', 'Caro'] },
  ],
  pertenencias: [
    { plantelId: 'u15-25', temporadaId: 't25', desde: '2025-03-01', hasta: '2025-12-15' },
    { plantelId: 'u17-26', temporadaId: 't26', desde: '2026-03-01', hasta: null },
  ],
});

const grupo = (grupos, temporadaId) => grupos.find((g) => g.temporada?.id === temporadaId);

test('ordena de la temporada más reciente a la más vieja', () => {
  const grupos = agruparHistoria(base());
  assert.deepEqual(grupos.map((g) => g.temporada.nombre), ['2026', '2025']);
  assert.deepEqual(grupo(grupos, 't25').categorias, ['U15M']);
  assert.deepEqual(grupo(grupos, 't26').profes, ['Beto', 'Caro']);
});

test('un partido y un plan físico caen en la temporada de su plantel', () => {
  const datos = {
    ...base(),
    partidos: [{ plantelId: 'u15-25', fecha: '2025-05-10', pts: 8 }],
    planFisico: [{ plantelId: 'u17-26', sesiones: 12 }],
  };
  const grupos = agruparHistoria(datos);
  assert.equal(grupo(grupos, 't25').fuentes.partidos.length, 1);
  assert.equal(grupo(grupos, 't26').fuentes.partidos.length, 0);
  assert.equal(grupo(grupos, 't26').fuentes.planFisico[0].sesiones, 12);
});

test('una carga y un material caen por fecha en el rango de la pertenencia', () => {
  const datos = {
    ...base(),
    cargas: [{ fecha: '2025-08-01', ejercicio: 'Sentadilla', kg: 30 }, { fecha: '2026-04-01', ejercicio: 'Sentadilla', kg: 35 }],
    recursos: [{ fecha: '2025-12-15', titulo: 'Movilidad' }],
  };
  const grupos = agruparHistoria(datos);
  assert.deepEqual(grupo(grupos, 't25').fuentes.cargas.map((c) => c.kg), [30]);
  assert.deepEqual(grupo(grupos, 't26').fuentes.cargas.map((c) => c.kg), [35]);
  // El último día de la pertenencia todavía cuenta.
  assert.equal(grupo(grupos, 't25').fuentes.recursos.length, 1);
});

test('temporadaDeFecha: la pertenencia vigente llega hasta hoy y una fecha nula no se ubica', () => {
  const { pertenencias, temporadas } = base();
  assert.equal(temporadaDeFecha('2030-01-01', pertenencias, temporadas), 't26');
  assert.equal(temporadaDeFecha('2026-03-01T10:00:00Z', pertenencias, temporadas), 't26');
  assert.equal(temporadaDeFecha(null, pertenencias, temporadas), null);
  assert.equal(temporadaDeFecha('2026-01-10', pertenencias, temporadas), null);
});

test('una fecha fuera de todo rango va a sin temporada, al final', () => {
  const datos = { ...base(), corporales: [{ fechaMedicion: '2026-01-10', pesoKg: 60 }] };
  const grupos = agruparHistoria(datos);
  const ultimo = grupos.at(-1);
  assert.equal(ultimo.temporada, null);
  assert.deepEqual(ultimo.categorias, []);
  assert.equal(ultimo.fuentes.corporales.length, 1);
});

test('sin datos sueltos no hay grupo sin temporada', () => {
  assert.ok(agruparHistoria(base()).every((g) => g.temporada));
});

test('citado en dos categorías: una temporada con las dos', () => {
  const datos = base();
  datos.planteles.push({ id: 'u21-26', temporadaId: 't26', categoria: 'U21M', profes: ['Caro', 'Dani'] });
  datos.pertenencias.push({ plantelId: 'u21-26', temporadaId: 't26', desde: '2026-05-01', hasta: null });
  datos.corporales = [{ fechaMedicion: '2026-06-01', pesoKg: 61 }];
  const grupos = agruparHistoria(datos);
  assert.equal(grupos.length, 2);
  const g26 = grupo(grupos, 't26');
  assert.deepEqual(g26.categorias, ['U17M', 'U21M']);
  assert.deepEqual(g26.profes, ['Beto', 'Caro', 'Dani']);
  assert.equal(g26.fuentes.corporales.length, 1);
});

test('una temporada sin pertenencia pero con datos (partido de citado) aparece igual', () => {
  const datos = base();
  datos.temporadas.push({ id: 't24', nombre: '2024' });
  datos.planteles.push({ id: 'u13-24', temporadaId: 't24', categoria: 'U13M', profes: [] });
  datos.partidos = [{ plantelId: 'u13-24', fecha: '2024-09-01' }];
  const grupos = agruparHistoria(datos);
  assert.deepEqual(grupos.map((g) => g.temporada.nombre), ['2026', '2025', '2024']);
  assert.deepEqual(grupo(grupos, 't24').categorias, ['U13M']);
});

test('una fuente vacía o ausente queda como lista vacía', () => {
  const grupos = agruparHistoria(base());
  for (const g of grupos) {
    for (const { clave } of FUENTES) assert.deepEqual(g.fuentes[clave], []);
  }
});

test('agregar una clave a FUENTES no cambia las demás', () => {
  const datos = {
    ...base(),
    partidos: [{ plantelId: 'u15-25', fecha: '2025-05-10' }],
    cargas: [{ fecha: '2026-04-01', kg: 35 }],
    misiones: [{ plantelId: 'u17-26', texto: 'Cerrar el rebote' }],
  };
  const sin = agruparHistoria(datos);
  const con = agruparHistoria(datos, [...FUENTES, { clave: 'misiones', ubicar: 'plantel' }]);
  for (let i = 0; i < sin.length; i++) {
    const { misiones, ...resto } = con[i].fuentes;
    assert.deepEqual(resto, sin[i].fuentes);
  }
  assert.equal(grupo(con, 't26').fuentes.misiones.length, 1);
  // Lo que no está en FUENTES no se cuela.
  assert.equal(grupo(sin, 't26').fuentes.misiones, undefined);
});

test('FUENTES declara cómo se ubica cada una', () => {
  assert.deepEqual(
    FUENTES.map((f) => f.clave),
    ['planFisico', 'cargas', 'recursos', 'saltos', 'sprints', 'yoyos', 'corporales', 'tiro', 'partidos'],
  );
  assert.ok(FUENTES.every((f) => f.ubicar === 'plantel' || f.ubicar === 'fecha'));
});

/* ---------- Task 2: cómo llega, cómo terminó, totales y resumen ---------- */

// Tiempo de vuelo de 500 ms → 30,7 cm; de 450 ms → 24,8 cm (salto.js).
const conDatos2025 = () => ({
  ...base(),
  saltos: [
    { sesionId: 's1', plantelId: 'u15-25', fecha: '2025-06-01', testSalto: 'cmj', intento: 1, tiempoVueloMs: 450 },
    { sesionId: 's2', plantelId: 'u15-25', fecha: '2025-11-01', testSalto: 'cmj', intento: 1, tiempoVueloMs: 500 },
    { sesionId: 's2', plantelId: 'u15-25', fecha: '2025-11-01', testSalto: 'cmj', intento: 2, tiempoVueloMs: 480 },
    { sesionId: 's3', plantelId: 'u15-25', fecha: '2025-11-01', testSalto: 'abalakov', intento: 1, tiempoVueloMs: 520 },
    // Ya en U17: no es "cómo llega".
    { sesionId: 's4', plantelId: 'u17-26', fecha: '2026-04-01', testSalto: 'cmj', intento: 1, tiempoVueloMs: 530 },
  ],
  sprints: [
    { sesionId: 'p1', plantelId: 'u15-25', fecha: '2025-10-01', distanciaM: 20, intento: 1, tiempoMs: 3600, origen: 'propio' },
    { sesionId: 'p1', plantelId: 'u15-25', fecha: '2025-10-01', distanciaM: 20, intento: 2, tiempoMs: 3500, origen: 'propio' },
    { sesionId: 'p2', plantelId: 'u15-25', fecha: '2025-11-10', distanciaM: 30, intento: 1, tiempoMs: 4800, origen: 'propio' },
  ],
  yoyos: [
    { sesionId: 'y1', plantelId: 'u15-25', fecha: '2025-09-01', idas: 40, origen: 'propio' },
    // Ausente en la última: no borra el dato anterior.
    { sesionId: 'y2', plantelId: 'u15-25', fecha: '2025-11-20', idas: null, origen: 'propio' },
  ],
  corporales: [
    { fechaMedicion: '2025-04-01', alturaCm: 165, pesoKg: 55 },
    { fechaMedicion: '2025-10-01', alturaCm: 168, pesoKg: null },
  ],
  cargas: [
    { clave: 'sentadilla', nombre: 'Sentadilla', kg: 20, fecha: '2025-05-01' },
    { clave: 'sentadilla', nombre: 'Sentadilla', kg: 25, fecha: '2025-09-01' },
  ],
  tiro: [
    { sesionId: 'b1', plantelId: 'u15-25', fecha: '2025-08-01', posicion: 1, anotados: 6, intentos: 10 },
    { sesionId: 'b1', plantelId: 'u15-25', fecha: '2025-08-01', posicion: 2, anotados: 4, intentos: 10 },
    // La última batería fue una ausencia completa: vale la anterior.
    { sesionId: 'b2', plantelId: 'u15-25', fecha: '2025-11-01', posicion: 1, anotados: null, intentos: null },
  ],
});

test('cómo llega toma lo último anterior a la temporada actual', () => {
  const llega = comoLlega(conDatos2025());
  const cmj = llega.saltos.find((s) => s.test === 'cmj');
  assert.equal(cmj.fecha, '2025-11-01');
  assert.equal(Math.round(cmj.alturaCm * 10) / 10, 30.7);
  assert.equal(llega.altura.valor, 168);
  assert.equal(llega.peso.valor, 55);
  assert.equal(llega.peso.fecha, '2025-04-01');
  assert.deepEqual(llega.yoyo, { fecha: '2025-09-01', idas: 40 });
  assert.deepEqual(llega.cargas, [{ nombre: 'Sentadilla', kg: 25, fecha: '2025-09-01' }]);
  assert.deepEqual(llega.tiro, { fecha: '2025-08-01', anotados: 10, intentos: 20 });
  assert.equal(llega.vacio, false);
});

test('cómo llega sin mediciones da null, no 0', () => {
  const llega = comoLlega(base());
  assert.equal(llega.altura, null);
  assert.equal(llega.peso, null);
  assert.equal(llega.yoyo, null);
  assert.equal(llega.tiro, null);
  assert.deepEqual(llega.saltos, []);
  assert.deepEqual(llega.sprints, []);
  assert.deepEqual(llega.cargas, []);
  assert.equal(llega.vacio, true);
});

test('cómo llega sin pertenencia vigente es null: no hay a qué llegar', () => {
  const datos = conDatos2025();
  datos.pertenencias = datos.pertenencias.map((p) => ({ ...p, hasta: p.hasta ?? '2026-06-01' }));
  assert.equal(comoLlega(datos), null);
});

test('el salto se separa por test y el sprint por distancia', () => {
  const llega = comoLlega(conDatos2025());
  assert.deepEqual(llega.saltos.map((s) => s.test), ['cmj', 'abalakov']);
  assert.deepEqual(llega.sprints.map((s) => [s.distanciaM, s.tiempoMs]), [[20, 3500], [30, 4800]]);
  assert.equal(llega.sprints[0].velocidad, 5.7);
});

test('cómo terminó usa sólo lo de esa temporada', () => {
  const grupos = agruparHistoria(conDatos2025());
  const termino26 = comoTermino(grupos.find((g) => g.temporada.id === 't26'));
  assert.equal(termino26.saltos[0].fecha, '2026-04-01');
  assert.equal(termino26.sprints.length, 0);
  assert.equal(termino26.peso, null);
});

test('totales de partidos: un total de puros nulos es null, no 0', () => {
  const t = totalesDePartidos([
    { pts: null, minSegundos: null, dosAnotados: null, dosIntentados: null },
    { pts: null, minSegundos: null },
  ]);
  assert.equal(t.jugados, 2);
  assert.equal(t.puntos, null);
  assert.equal(t.minutos, null);
  assert.equal(t.dos, null);
});

test('totales de partidos suman sólo lo leído, en anotados de intentados', () => {
  const t = totalesDePartidos([
    { pts: 10, minSegundos: 1200, dosAnotados: 3, dosIntentados: 7, libresAnotados: 4, libresIntentados: 4 },
    { pts: null, minSegundos: 600, dosAnotados: 2, dosIntentados: 3 },
  ]);
  assert.equal(t.puntos, 10);
  assert.equal(t.minutos, 30);
  assert.deepEqual([t.dos.anotados, t.dos.intentos], [5, 10]);
  assert.equal(t.tres, null);
  assert.deepEqual(totalesDePartidos([]), { jugados: 0, puntos: null, minutos: null, dos: null, tres: null, libres: null });
});

test('el resumen nombra el plan físico antes que los partidos', () => {
  const datos = conDatos2025();
  datos.planFisico = [{ plantelId: 'u15-25', sesiones: 24 }];
  datos.recursos = [{ fecha: '2025-05-01', titulo: 'Movilidad' }];
  datos.partidos = [{ plantelId: 'u15-25', fecha: '2025-05-10' }, { plantelId: 'u15-25', fecha: '2025-06-10' }];
  const g25 = agruparHistoria(datos).find((g) => g.temporada?.id === 't25');
  assert.equal(resumenDeTemporada(g25), 'Plan físico: 24 sesiones · 1 material · 8 mediciones físicas · 2 partidos');
});

test('el resumen de una temporada vacía no inventa ceros', () => {
  const g26 = agruparHistoria(base()).find((g) => g.temporada.id === 't26');
  assert.equal(resumenDeTemporada(g26), 'Sin plan físico · Sin mediciones físicas');
});

test('historiaDesdeJson completa las listas que falten y no inventa claves', () => {
  const h = historiaDesdeJson({ temporadas: [T25], partidos: [{ pts: null }], otra: [1] });
  assert.deepEqual(h.temporadas, [T25]);
  assert.deepEqual(h.partidos, [{ pts: null }]);
  assert.deepEqual(h.cargas, []);
  assert.deepEqual(h.planteles, []);
  assert.equal(h.otra, undefined);
  assert.deepEqual(historiaDesdeJson(null).saltos, []);
});
