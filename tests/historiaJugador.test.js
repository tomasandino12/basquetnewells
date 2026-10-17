import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUENTES, temporadaDeFecha, agruparHistoria } from '../src/data/historiaJugador.js';

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
  const datos = { ...base(), corporales: [{ fecha: '2026-01-10', peso: 60 }] };
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
  datos.corporales = [{ fecha: '2026-06-01', peso: 61 }];
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
