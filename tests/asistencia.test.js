import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  codigoDelDia, resumenDeAsistencia, semaforo, lesionadoEn, textoDeLesion,
  entrenamientoDesdeFila, lesionDesdeFila,
  estadoInicial, alternar, contarEstados, filasParaGuardar, huboCambios, accionesDeTarjeta,
  asistenciaDelJugador,
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

test('estado inicial: lesionado aparece marcado y sin fila queda sin tomar', () => {
  const jugadores = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const filas = [{ jugadorId: 'b', estado: 'justificada' }];
  const lesiones = [
    { jugadorId: 'a', desde: '2026-10-12', hasta: null },
    { jugadorId: 'c', desde: '2026-09-01', hasta: '2026-09-20' },
  ];
  assert.deepEqual(estadoInicial(jugadores, filas, lesiones, '2026-10-28'), [
    { jugadorId: 'a', estado: null, lesionado: true },
    { jugadorId: 'b', estado: 'justificada', lesionado: false },
    { jugadorId: 'c', estado: null, lesionado: false },
  ]);
  // Un día viejo marca a quien estaba lesionado entonces, no a quien lo está hoy.
  assert.equal(estadoInicial(jugadores, [], lesiones, '2026-09-10')[2].lesionado, true);
  assert.equal(estadoInicial(jugadores, [], lesiones, '2026-09-10')[0].lesionado, false);
});

test('un toque alterna presente y ausente, y la justificada pasa a presente', () => {
  assert.equal(alternar(null), 'presente');
  assert.equal(alternar('presente'), 'ausente');
  assert.equal(alternar('ausente'), 'presente');
  assert.equal(alternar('justificada'), 'presente');
});

test('contar y guardar: los sin tomar no llevan fila', () => {
  const t = [
    { jugadorId: 'a', estado: 'presente' },
    { jugadorId: 'b', estado: 'ausente' },
    { jugadorId: 'c', estado: null },
  ];
  assert.deepEqual(contarEstados(t), { total: 3, presentes: 1, sinTomar: 1 });
  assert.deepEqual(filasParaGuardar(t), [
    { jugadorId: 'a', estado: 'presente' },
    { jugadorId: 'b', estado: 'ausente' },
  ]);
});

test('huboCambios detecta lo marcado y no cuenta lo igual', () => {
  const inicial = [{ jugadorId: 'a', estado: null }, { jugadorId: 'b', estado: 'presente' }];
  assert.equal(huboCambios(inicial, inicial.map((x) => ({ ...x }))), false);
  assert.equal(huboCambios(inicial, [{ jugadorId: 'a', estado: 'presente' }, inicial[1]]), true);
});

test('el menú de la tarjeta ofrece justificada y lesión según el caso', () => {
  const abierta = [{ id: 'l1', desde: '2026-10-12', hasta: null }];
  const cerrada = [{ id: 'l2', desde: '2026-10-01', hasta: '2026-10-20' }];
  const hoy = '2026-10-28';

  assert.deepEqual(accionesDeTarjeta({ estado: null, lesiones: [], fecha: hoy }),
    { justificada: true, lesionar: true, altaDe: null });
  assert.equal(accionesDeTarjeta({ estado: 'justificada', lesiones: [], fecha: hoy }).justificada, false);

  // Con una lesión abierta no se ofrece "Se lesionó" y sí el alta.
  assert.deepEqual(accionesDeTarjeta({ estado: 'ausente', lesiones: abierta, fecha: hoy }),
    { justificada: true, lesionar: false, altaDe: 'l1' });

  // Corregir un día anterior a la lesión abierta: ni lesión nueva ni alta.
  assert.deepEqual(accionesDeTarjeta({ estado: null, lesiones: abierta, fecha: '2026-10-05' }),
    { justificada: true, lesionar: false, altaDe: null });

  // Un período ya cerrado que cubre ese día: no se superpone otro.
  assert.equal(accionesDeTarjeta({ estado: null, lesiones: cerrada, fecha: '2026-10-10' }).lesionar, false);
  assert.equal(accionesDeTarjeta({ estado: null, lesiones: cerrada, fecha: hoy }).lesionar, true);
});

test('asistenciaDelJugador: sólo cuenta sus filas, marca sus lesiones y no mezcla las de otro', () => {
  const entrenamientos = [
    { fecha: '2026-10-05', hubo: true, filas: [{ jugadorId: 'a', estado: 'presente' }, { jugadorId: 'b', estado: 'ausente' }] },
    { fecha: '2026-10-07', hubo: false, filas: [] },
    { fecha: '2026-10-09', hubo: true, filas: [{ jugadorId: 'a', estado: 'ausente' }] },
    { fecha: '2026-10-12', hubo: true, filas: [{ jugadorId: 'b', estado: 'presente' }] },
  ];
  const lesiones = [
    { id: 1, jugadorId: 'a', desde: '2026-10-08', hasta: null, zona: 'tobillo', lado: 'derecho', tipo: null },
    { id: 2, jugadorId: 'b', desde: '2026-10-01', hasta: '2026-10-04', zona: null, lado: null, tipo: null },
  ];
  const r = asistenciaDelJugador(entrenamientos, lesiones, 'a');
  assert.equal(r.resumen.total, 2);
  assert.equal(r.resumen.asistidos, 1);
  assert.equal(r.resumen.sinEntrenamiento, 1);
  assert.equal(r.resumen.diasLesion, 1, 'sólo el 9/10 cae dentro de su lesión');
  assert.equal(r.nivel, 'alerta');
  assert.equal(r.lesionAbierta.id, 1);
});

test('asistenciaDelJugador: sin entrenamientos tomados no inventa un 0 %', () => {
  const r = asistenciaDelJugador(
    [{ fecha: '2026-10-05', hubo: true, filas: [{ jugadorId: 'b', estado: 'presente' }] }],
    [],
    'a',
  );
  assert.equal(r.resumen.total, 0);
  assert.equal(r.resumen.pctAsistencia, null);
  assert.equal(r.nivel, 'sin_datos');
  assert.equal(r.lesionAbierta, null);
});
