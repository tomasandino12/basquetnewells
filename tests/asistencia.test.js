import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  codigoDelDia, resumenDeAsistencia, semaforo, lesionadoEn, textoDeLesion,
  entrenamientoDesdeFila, lesionDesdeFila,
} from '../src/data/asistencia.js';

test('codigoDelDia cubre los seis códigos', () => {
  assert.equal(codigoDelDia({ hubo: false }), 'SE');
  assert.equal(codigoDelDia({ hubo: true, estado: 'presente' }), 'P');
  assert.equal(codigoDelDia({ hubo: true, estado: 'ausente' }), 'A');
  assert.equal(codigoDelDia({ hubo: true, estado: 'justificada' }), 'J, A');
  assert.equal(codigoDelDia({ hubo: true, estado: 'presente', lesionado: true }), 'L, P');
  assert.equal(codigoDelDia({ hubo: true, estado: 'ausente', lesionado: true }), 'L, A');
  assert.equal(codigoDelDia({ hubo: true }), '', 'sin fila no es ausente');
});

test('resumen ignora los días sin entrenamiento', () => {
  const r = resumenDeAsistencia([
    { hubo: true, estado: 'presente' },
    { hubo: false },
    { hubo: false },
    { hubo: true, estado: 'ausente' },
  ]);
  assert.equal(r.total, 2);
  assert.equal(r.sinEntrenamiento, 2);
  assert.equal(r.pctAsistencia, 50);
});

test('la falta justificada no suma asistencia', () => {
  const r = resumenDeAsistencia([
    { hubo: true, estado: 'presente' },
    { hubo: true, estado: 'justificada' },
  ]);
  assert.equal(r.asistidos, 1);
  assert.equal(r.justificadas, 1);
  assert.equal(r.pctAsistencia, 50);
});

test('lesionado que vino cuenta como asistido', () => {
  const r = resumenDeAsistencia([
    { hubo: true, estado: 'presente', lesionado: true },
    { hubo: true, estado: 'ausente', lesionado: true },
  ]);
  assert.equal(r.asistidos, 1);
  assert.equal(r.diasLesion, 2);
  assert.equal(r.pctLesion, 100);
});

test('el porcentaje nunca supera 100 (caso de la planilla)', () => {
  // La planilla a mano contaba "L, A" también como asistencia y pasaba de 100.
  const dias = Array.from({ length: 10 }, () => ({ hubo: true, estado: 'ausente', lesionado: true }));
  dias.push({ hubo: true, estado: 'presente' });
  const r = resumenDeAsistencia(dias);
  assert.ok(r.pctAsistencia <= 100);
  assert.ok(r.pctLesion <= 100);
  assert.equal(resumenDeAsistencia([{ hubo: true, estado: 'presente' }]).pctAsistencia, 100);
});

test('semáforo en 69.9, 70, 84.9 y 85', () => {
  assert.equal(semaforo(69.9), 'alerta');
  assert.equal(semaforo(70), 'regular');
  assert.equal(semaforo(84.9), 'regular');
  assert.equal(semaforo(85), 'excelente');
  assert.equal(semaforo(0), 'alerta');
});

test('sin entrenamientos el porcentaje es null', () => {
  const r = resumenDeAsistencia([{ hubo: false }, { hubo: true }]);
  assert.equal(r.total, 0);
  assert.equal(r.pctAsistencia, null);
  assert.equal(r.pctLesion, null);
  assert.equal(semaforo(r.pctAsistencia), 'sin_datos');
  assert.equal(resumenDeAsistencia([]).pctAsistencia, null);
});

test('lesionadoEn con alta abierta y con alta el mismo día', () => {
  const abierta = [{ desde: '2026-10-12', hasta: null }];
  assert.equal(lesionadoEn(abierta, '2026-10-11'), false);
  assert.equal(lesionadoEn(abierta, '2026-10-12'), true);
  assert.equal(lesionadoEn(abierta, '2027-01-01'), true);

  const conAlta = [{ desde: '2026-10-12', hasta: '2026-10-20' }];
  assert.equal(lesionadoEn(conAlta, '2026-10-19'), true);
  assert.equal(lesionadoEn(conAlta, '2026-10-20'), false, 'el día del alta ya está sano');
  assert.equal(lesionadoEn([], '2026-10-12'), false);
});

test('textoDeLesion sin zona y con lado no_aplica', () => {
  assert.equal(textoDeLesion({ desde: '2026-10-12' }), 'Lesionado desde el 12/10');
  assert.equal(
    textoDeLesion({ desde: '2026-10-12', zona: 'tobillo', lado: 'derecho' }),
    'Lesionado desde el 12/10 · tobillo derecho',
  );
  assert.equal(
    textoDeLesion({ desde: '2026-03-05', zona: 'cabeza', lado: 'no_aplica' }),
    'Lesionado desde el 5/3 · cabeza',
  );
  assert.equal(
    textoDeLesion({ desde: '2026-10-12', zona: 'muneca_mano', lado: null }),
    'Lesionado desde el 12/10 · muñeca o mano',
  );
});

test('los mappers pasan a camelCase y respetan el null', () => {
  assert.deepEqual(
    entrenamientoDesdeFila({
      id: 'e1', fecha: '2026-10-28', hubo: true,
      asistencia: [{ jugador_id: 'j1', estado: 'presente' }],
    }),
    { id: 'e1', fecha: '2026-10-28', hubo: true, filas: [{ jugadorId: 'j1', estado: 'presente' }] },
  );
  assert.deepEqual(entrenamientoDesdeFila({ id: 'e2', fecha: '2026-10-27', hubo: false }).filas, []);
  assert.deepEqual(
    lesionDesdeFila({ id: 'l1', jugador_id: 'j1', desde: '2026-10-12', hasta: null, zona: null, lado: null, tipo: null }),
    { id: 'l1', jugadorId: 'j1', desde: '2026-10-12', hasta: null, zona: null, lado: null, tipo: null },
  );
});
