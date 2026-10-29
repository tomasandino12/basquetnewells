import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nombreDeHoja, filasDePlanilla, ENCABEZADOS_INICIO, ENCABEZADOS_FIN,
} from '../src/data/planillaAsistencia.js';
import { resumenDelDia } from '../src/data/asistencia.js';

const dia = (fecha, hubo, filas = []) => ({ id: fecha, fecha, hubo, filas });
const fila = (jugadorId, estado) => ({ jugadorId, estado });

test('encabezados iguales a la planilla del área', () => {
  const [encabezado] = filasDePlanilla({
    jugadores: [{ id: 'a', nombreLimpio: 'A, A' }],
    entrenamientos: [dia('2026-10-05', true, [fila('a', 'presente')]), dia('2026-10-07', true, [fila('a', 'ausente')])],
    lesiones: [],
  });
  assert.deepEqual(encabezado, [
    'Jugador', 'DNI', 'SOCIO NUM', '% Asistencia', 'Estado',
    '5/10', '7/10',
    'Total Entrenamientos', 'Entrenamientos Asistidos', 'Días Sin Entrenamiento',
    'Faltas Justificadas (J)', 'Días de Lesión (L)', '% LESION',
  ]);
  assert.deepEqual(ENCABEZADOS_INICIO.length + ENCABEZADOS_FIN.length, 11);
});

test('nombre de hoja recortado a 31', () => {
  assert.equal(nombreDeHoja({ categoriaCodigo: 'U15M', temporada: '2026' }), 'U15 - MASCULINO (2012 y 2011)');
  // "MAYORES - MASCULINO (2004 y antes)" mide 34: Excel no admite más de 31.
  const mayores = nombreDeHoja({ categoriaCodigo: 'MAY_M', temporada: '2026' });
  assert.equal(mayores.length, 31);
  assert.ok(mayores.startsWith('MAYORES - MASCULINO'));
  // Sin una temporada que sea un año no se inventan los años; sin código, se usa la categoría.
  assert.equal(nombreDeHoja({ categoriaCodigo: 'U13M', temporada: 'Apertura' }), 'U13 - MASCULINO');
  assert.equal(nombreDeHoja({ categoriaCodigo: 'raro', categoria: 'Cat: [x]/y' }), 'Cat   x  y');
});

test('un día SE es columna con SE para todos', () => {
  const [, ...filas] = filasDePlanilla({
    jugadores: [{ id: 'a', nombreLimpio: 'A, A' }, { id: 'b', nombreLimpio: 'B, B' }],
    entrenamientos: [dia('2026-10-05', true, [fila('a', 'presente'), fila('b', 'ausente')]), dia('2026-10-06', false)],
    lesiones: [],
  });
  assert.deepEqual(filas.map((f) => f[5]), ['P', 'A']);
  assert.deepEqual(filas.map((f) => f[6]), ['SE', 'SE']);
  // El SE no cuenta como entrenamiento: total 1, y 1 día sin entrenamiento.
  assert.deepEqual(filas[0].slice(7), [1, 1, 1, 0, 0, '0.00%']);
});

test('jugador que entró a mitad de año queda vacío antes', () => {
  const [, ...filas] = filasDePlanilla({
    jugadores: [{ id: 'viejo', nombreLimpio: 'A, A' }, { id: 'nuevo', nombreLimpio: 'B, B' }],
    entrenamientos: [
      dia('2026-03-02', true, [fila('viejo', 'presente')]),
      dia('2026-03-04', true, [fila('viejo', 'presente')]),
      dia('2026-08-03', true, [fila('viejo', 'ausente'), fila('nuevo', 'presente')]),
    ],
    lesiones: [],
  });
  assert.deepEqual(filas[1].slice(5, 8), ['', '', 'P']);
  // Los días vacíos no cuentan: el nuevo tiene 1 de 1, no 1 de 3.
  assert.equal(filas[1][3], '100.00%');
  assert.equal(filas[1][8], 1);
  assert.equal(filas[0][3], '66.67%');
});

test('porcentaje con formato 61.70%', () => {
  // 29 presentes de 47: 61.702...
  const entrenamientos = Array.from({ length: 47 }, (_, i) =>
    dia(`2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, true,
      [fila('a', i < 29 ? 'presente' : 'ausente')]));
  const [, f] = filasDePlanilla({ jugadores: [{ id: 'a', nombreLimpio: 'A, A' }], entrenamientos, lesiones: [] });
  assert.equal(f[3], '61.70%');
  assert.equal(f[4], '🔴 Alerta');
});

test('lesión: L, P / L, A / J, A y los totales de la planilla', () => {
  const [, f] = filasDePlanilla({
    jugadores: [{ id: 'a', nombreLimpio: 'A, A' }],
    entrenamientos: [
      dia('2026-10-05', true, [fila('a', 'presente')]),
      dia('2026-10-12', true, [fila('a', 'presente')]),
      dia('2026-10-14', true, [fila('a', 'ausente')]),
      dia('2026-10-19', true, [fila('a', 'justificada')]),
      dia('2026-10-26', true, []),
    ],
    lesiones: [{ jugadorId: 'a', desde: '2026-10-12', hasta: '2026-10-19' }],
  });
  assert.deepEqual(f.slice(5, 10), ['P', 'L, P', 'L, A', 'J, A', '']);
  // total 4 (el último día no se tomó), asistidos 2, sin entrenamiento 0, justificadas 1, días de lesión 2.
  assert.deepEqual(f.slice(10), [4, 2, 0, 1, 2, '50.00%']);
});

test('sin ningún entrenamiento tomado, porcentajes vacíos y sin datos', () => {
  const [, f] = filasDePlanilla({ jugadores: [{ id: 'a', nombreLimpio: 'A, A' }], entrenamientos: [dia('2026-10-05', true)], lesiones: [] });
  assert.equal(f[3], '');
  assert.equal(f[4], 'Sin datos');
});

test('resumenDelDia cuenta los presentes de los que se tomaron', () => {
  assert.deepEqual(resumenDelDia(dia('2026-10-05', false)), { hubo: false, presentes: 0, tomados: 0 });
  assert.deepEqual(
    resumenDelDia(dia('2026-10-05', true, [fila('a', 'presente'), fila('b', 'justificada'), fila('c', 'presente')])),
    { hubo: true, presentes: 2, tomados: 3 },
  );
  assert.deepEqual(resumenDelDia(dia('2026-10-05', true)), { hubo: true, presentes: 0, tomados: 0 });
});
