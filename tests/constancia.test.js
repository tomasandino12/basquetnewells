import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asistenciaSeguida,
  mejorRacha,
  TIPOS_DE_PRACTICA,
  semanaDePracticas,
  vecesEnLaSemana,
  recursosPracticables,
  vistaDeAsistencia,
} from '../src/data/constancia.js';

test('asistenciaSeguida: un día sin tomar no suma ni corta', () => {
  assert.equal(asistenciaSeguida([true, false, true, true, null, true]), 3);
  assert.equal(asistenciaSeguida([null, null]), 0);
});

test('asistenciaSeguida: una falta corta', () => {
  assert.equal(asistenciaSeguida([true, true, false]), 0);
  assert.equal(asistenciaSeguida([false, true, true]), 2);
});

test('mejorRacha: la más larga de la lista', () => {
  // Aunque ya se haya cortado: la mejor no es la actual.
  assert.equal(mejorRacha([true, true, null, true, false, true]), 3);
  assert.equal(mejorRacha([false, false]), 0);
  assert.equal(mejorRacha([]), 0);
});

// 2026-11-22 es domingo: su semana va del lunes 16 al domingo 22.
test('TIPOS_DE_PRACTICA: los dos que acepta la base', () => {
  assert.deepEqual(TIPOS_DE_PRACTICA, ['recurso', 'fisico']);
});

test('semanaDePracticas: arranca el lunes y marca futuros', () => {
  // Miércoles 18/11: lunes y martes ya pasaron, jueves a domingo todavía no.
  const semana = semanaDePracticas(
    [{ fecha: '2026-11-16', recursoId: 'r1' }, { fecha: '2026-11-18', recursoId: 'r1' }],
    '2026-11-18',
  );
  assert.deepEqual(semana.map((d) => d.fecha), [
    '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
  ]);
  assert.deepEqual(semana.map((d) => d.hecho), [true, false, true, false, false, false, false]);
  assert.deepEqual(semana.map((d) => d.esHoy), [false, false, true, false, false, false, false]);
  assert.deepEqual(semana.map((d) => d.futuro), [false, false, false, true, true, true, true]);
  // Domingo es el último día de su semana, no el primero de la que viene.
  assert.equal(semanaDePracticas([], '2026-11-22')[0].fecha, '2026-11-16');
  assert.equal(semanaDePracticas([], '2026-11-16')[0].fecha, '2026-11-16');
  // Cruza el fin de mes sin depender de la zona del equipo.
  assert.equal(semanaDePracticas([], '2026-12-02')[0].fecha, '2026-11-30');
});

test('semanaDePracticas: dos prácticas el mismo día son un bloque', () => {
  const semana = semanaDePracticas(
    [{ fecha: '2026-11-17', recursoId: 'r1' }, { fecha: '2026-11-17', recursoId: 'r2' }],
    '2026-11-18',
  );
  assert.equal(semana.length, 7);
  assert.equal(semana.filter((d) => d.hecho).length, 1);
});

test('vecesEnLaSemana: cuenta sólo esta semana', () => {
  const marcas = [
    { fecha: '2026-11-15', recursoId: 'r1' }, // domingo de la semana anterior
    { fecha: '2026-11-16', recursoId: 'r1' },
    { fecha: '2026-11-18', recursoId: 'r1' },
    { fecha: '2026-11-18', recursoId: 'r2' }, // otro recurso
  ];
  assert.equal(vecesEnLaSemana(marcas, 'r1', '2026-11-19'), 2);
  assert.equal(vecesEnLaSemana(marcas, 'r2', '2026-11-19'), 1);
  assert.equal(vecesEnLaSemana(marcas, 'r3', '2026-11-19'), 0);
  assert.equal(vecesEnLaSemana(marcas, 'r1', '2026-11-23'), 0); // ya es otra semana
});

test('recursosPracticables: sin lectura', () => {
  const recursos = [
    { id: 'a', tipo: 'tiro' },
    { id: 'b', tipo: 'lectura' },
    { id: 'c', tipo: null }, // los viejos no tienen tipo y se pueden practicar
    { id: 'd', tipo: 'fisico' },
  ];
  assert.deepEqual(recursosPracticables(recursos).map((r) => r.id), ['a', 'c', 'd']);
  assert.deepEqual(recursosPracticables([]), []);
});

function dias(...pares) {
  return pares.map(([fecha, vino]) => ({ fecha, vino }));
}

test('vistaDeAsistencia: ultimos son los 10 últimos tomados o no', () => {
  const todos = [];
  for (let d = 1; d <= 12; d++) todos.push([`2026-11-${String(d).padStart(2, '0')}`, d === 8 ? null : true]);
  const v = vistaDeAsistencia(dias(...todos), 'ultimos', '2026-11-22');
  // Cuenta 10 entrenamientos desde el final aunque uno no se haya tomado.
  assert.equal(v.dias.length, 10);
  assert.equal(v.dias[0].fecha, '2026-11-03');
  assert.equal(v.dias[9].fecha, '2026-11-12');
  assert.equal(v.vino, 9);
  assert.equal(v.tomadas, 9);
});

test('vistaDeAsistencia: mes y anio cortan por fecha', () => {
  const lista = dias(
    ['2025-12-20', true],
    ['2026-10-30', true],
    ['2026-11-03', true],
    ['2026-11-10', false],
    ['2026-11-17', true],
    ['2026-11-19', true],
    ['2026-11-30', true], // todavía no llegó: no entra
  );
  const mes = vistaDeAsistencia(lista, 'mes', '2026-11-20');
  assert.deepEqual(mes.dias.map((d) => d.fecha), ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-19']);
  assert.equal(mes.vino, 3);
  assert.equal(mes.tomadas, 4);
  assert.equal(mes.mejorRacha, 2);

  const anio = vistaDeAsistencia(lista, 'anio', '2026-11-20');
  assert.deepEqual(anio.dias.map((d) => d.fecha), [
    '2026-10-30', '2026-11-03', '2026-11-10', '2026-11-17', '2026-11-19',
  ]);
  assert.equal(anio.vino, 4);
  assert.equal(anio.tomadas, 5);
  // La racha de hoy no depende del período que se mira: es la de toda su historia.
  assert.equal(anio.racha, 2);
  assert.equal(mes.racha, 2);
});

test('vistaDeAsistencia: null no cuenta como tomada', () => {
  const v = vistaDeAsistencia(
    dias(['2026-11-03', true], ['2026-11-05', null], ['2026-11-07', false], ['2026-11-10', null]),
    'mes',
    '2026-11-20',
  );
  assert.equal(v.dias.length, 4); // los huecos se ven en la grilla
  assert.equal(v.dias[1].vino, null); // y siguen siendo null, nunca false
  assert.equal(v.vino, 1);
  assert.equal(v.tomadas, 2);
  assert.equal(v.racha, 0); // la falta del 7 corta; el null del 10 no la reanuda
  assert.equal(v.mejorRacha, 1);
  // Sin nada tomado no hay racha ni «viniste a 0 de 0» disfrazado: tomadas es 0.
  const vacia = vistaDeAsistencia(dias(['2026-11-05', null]), 'ultimos', '2026-11-20');
  assert.equal(vacia.tomadas, 0);
  assert.equal(vacia.vino, 0);
  assert.equal(vacia.racha, 0);
});

test('vistaDeAsistencia: una vista desconocida es un error, no un período vacío', () => {
  assert.throws(() => vistaDeAsistencia([], 'semana', '2026-11-20'), /vista/);
});
