import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  METRICAS, ESTADOS, MAX_POR_JUGADOR, MAX_DE_EQUIPO, metricasPara,
  valorReal, totalesDelEquipo, vincularPrevias, validarPrevia,
  prepararPayloadPrevia, textoDeMision, textoDelValor,
  previaDesdeFila, misionDesdeFila, estadisticaDeMisionDesdeFila, COLUMNAS_ESTADISTICA_DE_MISION,
  logrosDelEquipo, misionesConPrevia,
} from '../src/data/misiones.js';
import { LIMITE } from '../src/data/limites.js';

const COLUMNAS_PROHIBIDAS = /^(pts|val|mas_menos|min_segundos|puntos_propios)$|anotados|intentados|porcentaje|recibid/;

test('métricas no incluyen puntos ni tiro', () => {
  for (const m of METRICAS) {
    assert.doesNotMatch(m.columna, COLUMNAS_PROHIBIDAS, m.clave);
    assert.doesNotMatch(m.etiqueta.toLowerCase(), /anotad|tiro|porcentaje|%/, m.clave);
  }
  // Los únicos puntos que se pueden elegir son los del rival, y sólo para el equipo.
  assert.deepEqual(METRICAS.filter((m) => /punto/i.test(m.etiqueta)).map((m) => m.clave), ['puntos_rival']);
});

test('sentido fijo por métrica', () => {
  const comoMaximo = METRICAS.filter((m) => m.sentido === 'como_maximo').map((m) => m.clave).sort();
  assert.deepEqual(comoMaximo, ['fal', 'per', 'puntos_rival']);
  for (const m of METRICAS) assert.ok(['al_menos', 'como_maximo'].includes(m.sentido), m.clave);
});

test('puntos_rival sólo en equipo', () => {
  assert.ok(!metricasPara('jugador').some((m) => m.clave === 'puntos_rival'));
  assert.ok(metricasPara('equipo').some((m) => m.clave === 'puntos_rival'));
  assert.equal(metricasPara('jugador').length, METRICAS.length - 1);
});

test('estados y topes', () => {
  assert.deepEqual(ESTADOS.map((e) => e.id), ['logrado', 'en_proceso', 'no_logrado']);
  assert.equal(MAX_POR_JUGADOR, 2);
  assert.equal(MAX_DE_EQUIPO, 3);
});

test('valorReal: sin fila es sin dato, 0 es 0', () => {
  const mision = { metrica: 'reb_tot', valor: 5 };
  assert.equal(valorReal(mision, undefined, {}), null);
  assert.equal(valorReal(mision, { rebTot: null }, {}), null);
  assert.equal(valorReal(mision, { rebTot: 0 }, {}), 0);
  assert.equal(valorReal(mision, { rebTot: 7 }, {}), 7);
  assert.equal(valorReal({ metrica: 'tap', valor: 1 }, { tapCometidos: 2 }, {}), 2);
  assert.equal(valorReal({ texto: 'hablar en defensa' }, { rebTot: 7 }, {}), null);
});

test('valorReal: puntos del rival salen del partido', () => {
  const m = { metrica: 'puntos_rival', valor: 59 };
  assert.equal(valorReal(m, undefined, { puntosRival: 58 }), 58);
  assert.equal(valorReal(m, undefined, { puntosRival: null }), null);
  assert.equal(valorReal(m, undefined, null), null);
});

test('totalesDelEquipo: suma y nulo contagia', () => {
  const filas = [
    { rebTot: 3, ast: 1, per: 0, falCometidas: null },
    { rebTot: 4, ast: 2, per: 2, falCometidas: 3 },
  ];
  const t = totalesDelEquipo(filas);
  assert.equal(t.rebTot, 7);
  assert.equal(t.ast, 3);
  assert.equal(t.per, 2);
  assert.equal(t.falCometidas, null);
  // Sin boxscore no hay totales: no es un equipo con cero rebotes.
  assert.equal(totalesDelEquipo([]).rebTot, null);
});

test('valorReal de equipo con los totales', () => {
  const t = totalesDelEquipo([{ rec: 2 }, { rec: 3 }]);
  assert.equal(valorReal({ metrica: 'rec', valor: 4 }, t, {}), 5);
});

const partido = (id, fecha, rivalNombre = null, plantelId = 'p1') => ({ id, fecha, rivalNombre, plantelId });
const previa = (id, fecha, rival = null, partidoId = null, plantelId = 'p1') => ({ id, fecha, rival, partidoId, plantelId });

test('vincularPrevias: fijado / fecha / rival / ambiguo / sin_partido', () => {
  const partidos = [
    partido('a', '2026-10-18', 'Rosario Central'),
    partido('b', '2026-10-25', 'Talleres'),
    partido('c', '2026-10-25', 'Atlético Fisherton'),
    partido('d', '2026-11-01', 'Sportivo'),
    partido('e', '2026-11-01', 'Sportivo'),
    partido('f', '2026-11-08', 'Otro'),
  ];
  const r = vincularPrevias([
    previa('x1', '2026-10-18'),
    previa('x2', '2026-10-25', 'fisherton'),
    previa('x3', '2026-11-01', 'Sportivo'),
    previa('x4', '2026-12-01'),
    previa('x5', '2026-09-01', null, 'f'),
  ], partidos);
  assert.deepEqual(r.get('x1'), { partidoId: 'a', motivo: 'fecha' });
  assert.deepEqual(r.get('x2'), { partidoId: 'c', motivo: 'rival' });
  assert.deepEqual(r.get('x3'), { partidoId: null, motivo: 'ambiguo' });
  assert.deepEqual(r.get('x4'), { partidoId: null, motivo: 'sin_partido' });
  assert.deepEqual(r.get('x5'), { partidoId: 'f', motivo: 'fijado' });
});

test('vincularPrevias: dos partidos el mismo día y sin rival es ambiguo', () => {
  const r = vincularPrevias([previa('x', '2026-10-25')], [partido('b', '2026-10-25', 'A'), partido('c', '2026-10-25', 'B')]);
  assert.deepEqual(r.get('x'), { partidoId: null, motivo: 'ambiguo' });
});

test('un partido fijado no se ofrece a otra previa', () => {
  const partidos = [partido('a', '2026-10-18', 'Central')];
  const r = vincularPrevias([previa('x1', '2026-10-18', null, 'a'), previa('x2', '2026-10-18')], partidos);
  assert.deepEqual(r.get('x1'), { partidoId: 'a', motivo: 'fijado' });
  assert.deepEqual(r.get('x2'), { partidoId: null, motivo: 'sin_partido' });
});

test('vincularPrevias: dos previas que reclaman el mismo partido quedan ambiguas', () => {
  const r = vincularPrevias([previa('x1', '2026-10-18'), previa('x2', '2026-10-18')], [partido('a', '2026-10-18', 'Central')]);
  assert.equal(r.get('x1').motivo, 'ambiguo');
  assert.equal(r.get('x2').motivo, 'ambiguo');
});

test('vincularPrevias: no cruza planteles', () => {
  const r = vincularPrevias([previa('x', '2026-10-18')], [partido('a', '2026-10-18', 'Central', 'otro')]);
  assert.equal(r.get('x').motivo, 'sin_partido');
});

const borrador = (extra = {}) => ({
  previaId: 'pv', clubId: 'c', plantelId: 'p1', fecha: '2026-10-18', rival: '',
  misionesJugador: [], misionesEquipo: [], ...extra,
});

test('validarPrevia: un borrador correcto pasa', () => {
  const r = validarPrevia(borrador({
    misionesJugador: [
      { id: 'm1', jugadorId: 'j1', metrica: 'reb_tot', valor: 5 },
      { id: 'm2', jugadorId: 'j1', texto: 'defender al base de ellos' },
    ],
    misionesEquipo: [{ id: 'e1', metrica: 'puntos_rival', valor: 59 }],
  }));
  assert.deepEqual(r, { ok: true, errores: [] });
});

test('validarPrevia: más de 2 por jugador, valor no entero, texto y métrica a la vez', () => {
  const mal = validarPrevia(borrador({
    misionesJugador: [
      { id: 'm1', jugadorId: 'j1', metrica: 'reb_tot', valor: 5 },
      { id: 'm2', jugadorId: 'j1', metrica: 'ast', valor: 2 },
      { id: 'm3', jugadorId: 'j1', metrica: 'rec', valor: 1 },
    ],
  }));
  assert.equal(mal.ok, false);
  assert.ok(mal.errores.some((e) => /2 misiones/.test(e)));

  assert.equal(validarPrevia(borrador({ misionesJugador: [{ id: 'm', jugadorId: 'j', metrica: 'ast', valor: 2.5 }] })).ok, false);
  assert.equal(validarPrevia(borrador({ misionesJugador: [{ id: 'm', jugadorId: 'j', metrica: 'ast', valor: -1 }] })).ok, false);
  assert.equal(validarPrevia(borrador({ misionesJugador: [{ id: 'm', jugadorId: 'j', metrica: 'ast', valor: null }] })).ok, false);
  assert.equal(validarPrevia(borrador({ misionesJugador: [{ id: 'm', jugadorId: 'j', metrica: 'ast', valor: 2, texto: 'x' }] })).ok, false);
  assert.equal(validarPrevia(borrador({ misionesJugador: [{ id: 'm', jugadorId: 'j', texto: '   ' }] })).ok, false);
});

test('validarPrevia: métricas fuera de lugar y topes', () => {
  assert.equal(validarPrevia(borrador({ misionesJugador: [{ id: 'm', jugadorId: 'j', metrica: 'puntos_rival', valor: 50 }] })).ok, false);
  assert.equal(validarPrevia(borrador({ misionesJugador: [{ id: 'm', jugadorId: 'j', metrica: 'pts', valor: 10 }] })).ok, false);
  const cuatro = Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, texto: `objetivo ${i}` }));
  assert.equal(validarPrevia(borrador({ misionesEquipo: cuatro })).ok, false);
  assert.equal(validarPrevia(borrador({ misionesJugador: [{ id: 'm', jugadorId: 'j', texto: 'x'.repeat(LIMITE.textoMision + 1) }] })).ok, false);
  assert.equal(validarPrevia(borrador({ rival: 'x'.repeat(LIMITE.rival + 1) })).ok, false);
  assert.equal(validarPrevia(borrador({ fecha: '' })).ok, false);
});

test('prepararPayloadPrevia: orden por jugador y nulos explícitos', () => {
  const p = prepararPayloadPrevia(borrador({
    rival: '  Central ',
    misionesJugador: [
      { id: 'm1', jugadorId: 'j1', metrica: 'reb_tot', valor: 5 },
      { id: 'm2', jugadorId: 'j2', texto: ' hablar en defensa ' },
      { id: 'm3', jugadorId: 'j1', texto: 'cortar' },
    ],
    misionesEquipo: [{ id: 'e1', metrica: 'per', valor: 12 }],
  }));
  assert.equal(p.rival, 'Central');
  assert.deepEqual(p.misionesJugador, [
    { id: 'm1', jugadorId: 'j1', orden: 1, metrica: 'reb_tot', valor: 5, texto: null },
    { id: 'm2', jugadorId: 'j2', orden: 1, metrica: null, valor: null, texto: 'hablar en defensa' },
    { id: 'm3', jugadorId: 'j1', orden: 2, metrica: null, valor: null, texto: 'cortar' },
  ]);
  assert.deepEqual(p.misionesEquipo, [{ id: 'e1', orden: 1, metrica: 'per', valor: 12, texto: null }]);
  assert.equal(prepararPayloadPrevia(borrador()).rival, null);
});

test('textos sin jerga', () => {
  assert.equal(textoDeMision({ metrica: 'reb_tot', valor: 5 }), 'Al menos 5 rebotes');
  assert.equal(textoDeMision({ metrica: 'fal', valor: 1 }), 'Como máximo 1 falta');
  assert.equal(textoDeMision({ metrica: 'puntos_rival', valor: 59 }), 'El rival hace como máximo 59 puntos');
  assert.equal(textoDeMision({ texto: 'defender al base' }), 'defender al base');
  assert.equal(textoDelValor({ metrica: 'reb_tot', valor: 5 }, 7), '7 rebotes · misión: al menos 5');
  assert.equal(textoDelValor({ metrica: 'ast', valor: 2 }, 1), '1 asistencia · misión: al menos 2');
  assert.equal(textoDelValor({ metrica: 'ast', valor: 2 }, null), 'sin dato · misión: al menos 2');
  assert.equal(textoDelValor({ texto: 'hablar' }, null), null);
});

test('mappers: camelCase y la misión de equipo sin jugador', () => {
  assert.deepEqual(previaDesdeFila({ id: 'p', club_id: 'c', plantel_id: 'pl', fecha: '2026-10-18', rival: null, partido_id: null }),
    { id: 'p', clubId: 'c', plantelId: 'pl', fecha: '2026-10-18', rival: null, partidoId: null });
  const m = misionDesdeFila({ id: 'm', previa_id: 'p', orden: 1, metrica: 'per', valor: 10, texto: null, estado: null, comentario: null });
  assert.equal(m.jugadorId, null);
  assert.equal(m.previaId, 'p');
  const e = estadisticaDeMisionDesdeFila({ jugador_id: 'j', reb_tot: 0, tap_cometidos: null, fal_cometidas: 3 });
  assert.equal(e.rebTot, 0);
  assert.equal(e.tapCometidos, null);
  assert.equal(e.falCometidas, 3);
  assert.doesNotMatch(COLUMNAS_ESTADISTICA_DE_MISION, /pts|anotados|puntos/);
});

test('logrosDelEquipo: sólo los logrados, del más reciente al más viejo', () => {
  const previas = [
    { id: 'a', fecha: '2026-10-11', rival: 'A', plantelId: 'p' },
    { id: 'b', fecha: '2026-10-18', rival: 'B', plantelId: 'p' },
  ];
  const misiones = [
    { id: '1', previaId: 'a', orden: 1, estado: 'logrado' },
    { id: '2', previaId: 'b', orden: 2, estado: 'logrado' },
    { id: '3', previaId: 'b', orden: 1, estado: 'logrado' },
    { id: '4', previaId: 'b', orden: 3, estado: 'en_proceso' },
    { id: '5', previaId: 'x', orden: 1, estado: 'logrado' },
  ];
  assert.deepEqual(logrosDelEquipo(previas, misiones).map((m) => m.id), ['3', '2', '1']);
  assert.equal(logrosDelEquipo(previas, misiones)[0].rival, 'B');
});

test('misionesConPrevia: orden cronológico con fecha y rival', () => {
  const previas = [{ id: 'a', fecha: '2026-10-11', rival: null, partidoId: 'pa' }, { id: 'b', fecha: '2026-10-18', rival: 'B', partidoId: null }];
  const r = misionesConPrevia([{ id: '1', previaId: 'a', orden: 1 }, { id: '2', previaId: 'b', orden: 1 }], previas);
  assert.deepEqual(r.map((m) => [m.id, m.fecha, m.partidoId]), [['2', '2026-10-18', null], ['1', '2026-10-11', 'pa']]);
});
