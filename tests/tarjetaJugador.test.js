import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosDeTarjeta, claseDeNivel } from '../src/data/tarjetaJugador.js';

test('sin nada medido ni asistencia, todo queda en null (nunca en cero)', () => {
  assert.deepEqual(datosDeTarjeta(), {
    alturaCm: null, pesoKg: null, pctAsistencia: null, nivelAsistencia: null, lesionado: false,
  });
});

test('toma altura y peso vigentes y redondea el porcentaje', () => {
  const d = datosDeTarjeta({
    medicion: { alturaCm: { valor: 182 }, pesoKg: null },
    asistencia: { resumen: { pctAsistencia: 86.6 }, nivel: 'excelente', lesionAbierta: null },
  });
  assert.equal(d.alturaCm, 182);
  assert.equal(d.pesoKg, null);
  assert.equal(d.pctAsistencia, 87);
  assert.equal(d.nivelAsistencia, 'excelente');
  assert.equal(d.lesionado, false);
});

test('una asistencia en 0 % es un dato; sin entrenamientos tomados no lo es', () => {
  const cero = datosDeTarjeta({ asistencia: { resumen: { pctAsistencia: 0 }, nivel: 'alerta', lesionAbierta: null } });
  assert.equal(cero.pctAsistencia, 0);
  const sin = datosDeTarjeta({ asistencia: { resumen: { pctAsistencia: null }, nivel: 'sin_datos', lesionAbierta: null } });
  assert.equal(sin.pctAsistencia, null);
  assert.equal(sin.nivelAsistencia, null);
});

test('una lesión abierta marca al jugador como lesionado', () => {
  const d = datosDeTarjeta({ asistencia: { resumen: { pctAsistencia: null }, nivel: 'sin_datos', lesionAbierta: { desde: '2026-10-01' } } });
  assert.equal(d.lesionado, true);
});

test('claseDeNivel devuelve la clase del chip o null', () => {
  assert.equal(claseDeNivel('excelente'), 'sube');
  assert.equal(claseDeNivel('regular'), 'baja');
  assert.equal(claseDeNivel('alerta'), 'alerta');
  assert.equal(claseDeNivel('sin_datos'), null);
  assert.equal(claseDeNivel(null), null);
});
