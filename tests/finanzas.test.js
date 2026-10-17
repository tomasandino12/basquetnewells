import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montoDesdeTexto, montoParaBase, formatearPesos, MONTO_MAX_CENTAVOS,
  resumenDelPeriodo, rangoDelMes, mesVecino, nombreDelMes, validarRubro, nombreRepetido,
} from '../src/data/finanzas.js';

/*
 * La plata se maneja en centavos enteros: 0,10 + 0,20 en coma flotante no da
 * 0,30. Estos tests fijan el formato que acepta la carga (el argentino, con
 * punto de miles y coma decimal) y los mensajes de lo que rechaza.
 */

test('acepta 1.234,50 como 123450 centavos', () => {
  assert.deepEqual(montoDesdeTexto('1.234,50'), { centavos: 123450 });
  assert.deepEqual(montoDesdeTexto('1234,50'), { centavos: 123450 });
  assert.deepEqual(montoDesdeTexto('  1.234,5  '), { centavos: 123450 });
  assert.deepEqual(montoDesdeTexto('$ 1.234,50'), { centavos: 123450 });
});

test('acepta enteros con y sin punto de miles', () => {
  assert.deepEqual(montoDesdeTexto('1234'), { centavos: 123400 });
  assert.deepEqual(montoDesdeTexto('1.234'), { centavos: 123400 });
  assert.deepEqual(montoDesdeTexto('1.234.567'), { centavos: 123456700 });
  assert.deepEqual(montoDesdeTexto('0,01'), { centavos: 1 });
});

test('rechaza punto ambiguo con mensaje de coma', () => {
  for (const texto of ['12.5', '1.23', '1234.50', '1.2345', '1.234.5']) {
    const r = montoDesdeTexto(texto);
    assert.equal(r.centavos, undefined, texto);
    assert.match(r.error, /coma/, texto);
  }
});

test('rechaza más de dos decimales', () => {
  assert.match(montoDesdeTexto('10,505').error, /dos cifras/);
  assert.match(montoDesdeTexto('1.234,567').error, /dos cifras/);
});

test('rechaza cero, negativo y vacío', () => {
  assert.match(montoDesdeTexto('').error, /Escribí un monto/);
  assert.match(montoDesdeTexto('   ').error, /Escribí un monto/);
  assert.match(montoDesdeTexto(null).error, /Escribí un monto/);
  assert.match(montoDesdeTexto('0').error, /mayor que cero/);
  assert.match(montoDesdeTexto('0,00').error, /mayor que cero/);
  assert.match(montoDesdeTexto('-500').error, /sin signo/);
});

test('rechaza notación científica y letras', () => {
  for (const texto of ['1e2', '0x10', 'mil', '12abc', '1,2,3', ',50', '1.234,', 'Infinity']) {
    const r = montoDesdeTexto(texto);
    assert.equal(r.centavos, undefined, texto);
    assert.ok(r.error, texto);
  }
});

test('rechaza por encima del tope de numeric(12,2)', () => {
  assert.deepEqual(montoDesdeTexto('9.999.999.999,99'), { centavos: MONTO_MAX_CENTAVOS });
  assert.match(montoDesdeTexto('10.000.000.000').error, /demasiado grande/);
  assert.match(montoDesdeTexto('99999999999999999999').error, /demasiado grande/);
});

test('montoParaBase arma el texto sin coma flotante', () => {
  assert.equal(montoParaBase(123450), '1234.50');
  assert.equal(montoParaBase(1), '0.01');
  assert.equal(montoParaBase(70), '0.70');
  assert.equal(montoParaBase(MONTO_MAX_CENTAVOS), '9999999999.99');
});

test('formatearPesos pone signo en texto además del color', () => {
  assert.equal(formatearPesos(123450), '$ 1.234,50');
  assert.equal(formatearPesos(5), '$ 0,05');
  assert.equal(formatearPesos(123456700), '$ 1.234.567,00');
  assert.equal(formatearPesos(123450, { signo: true }), '+ $ 1.234,50');
  assert.equal(formatearPesos(-50000, { signo: true }), '− $ 500,00');
  assert.equal(formatearPesos(-50000), '− $ 500,00');
  assert.equal(formatearPesos(0, { signo: true }), '$ 0,00');
});

/* ---------- Resumen del período ---------- */

const RUBROS = [
  { id: 'r-pat', nombre: 'Patrocinios', tipo: 'ingreso', activo: true },
  { id: 'r-rifa', nombre: 'Rifas', tipo: 'ingreso', activo: false },
  { id: 'r-arb', nombre: 'Arbitrajes', tipo: 'egreso', activo: true },
  { id: 'r-can', nombre: 'Alquiler de cancha', tipo: 'egreso', activo: true },
  { id: 'r-mat', nombre: 'Material', tipo: 'egreso', activo: true },
];

const mov = (id, rubroId, centavos, extra = {}) => ({ id, rubroId, centavos, borradoEn: null, ...extra });

test('los totales cuadran con datos de prueba', () => {
  // A mano: ingresos 150.000 + 23.456,78 = 173.456,78; egresos 12.000 +
  // 12.000 + 45.000 = 69.000; resultado 104.456,78.
  const r = resumenDelPeriodo([
    mov('1', 'r-pat', 15000000),
    mov('2', 'r-pat', 2345678),
    mov('3', 'r-arb', 1200000),
    mov('4', 'r-arb', 1200000),
    mov('5', 'r-can', 4500000),
  ], RUBROS);
  assert.equal(r.ingresos, 17345678);
  assert.equal(r.egresos, 6900000);
  assert.equal(r.resultado, 10445678);
  assert.deepEqual(r.porRubro, [
    { rubroId: 'r-pat', nombre: 'Patrocinios', tipo: 'ingreso', total: 17345678, cantidad: 2 },
    { rubroId: 'r-can', nombre: 'Alquiler de cancha', tipo: 'egreso', total: 4500000, cantidad: 1 },
    { rubroId: 'r-arb', nombre: 'Arbitrajes', tipo: 'egreso', total: 2400000, cantidad: 2 },
  ]);
});

test('un movimiento borrado no suma', () => {
  const r = resumenDelPeriodo([
    mov('1', 'r-pat', 10000),
    mov('2', 'r-pat', 99999, { borradoEn: '2026-10-05T12:00:00Z' }),
    mov('3', 'r-mat', 5000, { borradoEn: '2026-10-05T12:00:00Z' }),
  ], RUBROS);
  assert.equal(r.ingresos, 10000);
  assert.equal(r.egresos, 0);
  assert.deepEqual(r.porRubro.map((x) => [x.rubroId, x.cantidad]), [['r-pat', 1]]);
});

test('rubro inactivo con movimientos del mes aparece', () => {
  const r = resumenDelPeriodo([mov('1', 'r-rifa', 30000)], RUBROS);
  assert.equal(r.ingresos, 30000);
  assert.equal(r.porRubro[0].nombre, 'Rifas');
});

test('resultado negativo cuando egresos superan ingresos', () => {
  const r = resumenDelPeriodo([mov('1', 'r-pat', 10000), mov('2', 'r-can', 25000)], RUBROS);
  assert.equal(r.resultado, -15000);
});

test('mes sin movimientos da ceros', () => {
  assert.deepEqual(resumenDelPeriodo([], RUBROS), { ingresos: 0, egresos: 0, resultado: 0, porRubro: [] });
});

test('suma en centavos no arrastra error de coma flotante', () => {
  const r = resumenDelPeriodo([mov('1', 'r-pat', 10), mov('2', 'r-pat', 20)], RUBROS);
  assert.equal(r.ingresos, 30);
  assert.equal(formatearPesos(r.ingresos), '$ 0,30');
});

test('un movimiento de un rubro desconocido rompe en vez de sumar a ciegas', () => {
  assert.throws(() => resumenDelPeriodo([mov('1', 'r-nada', 100)], RUBROS), /RUBRO_DESCONOCIDO/);
});

test('rangoDelMes cruza diciembre a enero', () => {
  assert.deepEqual(rangoDelMes(2026, 10), { desde: '2026-10-01', hasta: '2026-11-01' });
  assert.deepEqual(rangoDelMes(2026, 12), { desde: '2026-12-01', hasta: '2027-01-01' });
  assert.deepEqual(mesVecino(2026, 12, 1), { anio: 2027, mes: 1 });
  assert.deepEqual(mesVecino(2027, 1, -1), { anio: 2026, mes: 12 });
  assert.deepEqual(mesVecino(2026, 6, 1), { anio: 2026, mes: 7 });
});

test('nombreDelMes en castellano', () => {
  assert.equal(nombreDelMes(2026, 10), 'octubre 2026');
  assert.equal(nombreDelMes(2027, 1), 'enero 2027');
});

/* ---------- Rubros ---------- */

test('validarRubro recorta el nombre y exige tipo de la lista', () => {
  assert.deepEqual(validarRubro({ nombre: '  Arbitrajes ', tipo: 'egreso' }), { fila: { nombre: 'Arbitrajes', tipo: 'egreso' } });
  assert.match(validarRubro({ nombre: '   ', tipo: 'egreso' }).error, /nombre/);
  assert.match(validarRubro({ nombre: 'Rifas', tipo: '' }).error, /ingreso o egreso/);
  assert.match(validarRubro({ nombre: 'Rifas', tipo: 'transferencia' }).error, /ingreso o egreso/);
  assert.match(validarRubro({ nombre: 'x'.repeat(61), tipo: 'ingreso' }).error, /60/);
});

test('nombreRepetido no distingue mayúsculas y saltea el propio', () => {
  const rubros = [{ id: 'a', nombre: 'Arbitrajes' }, { id: 'b', nombre: 'Rifas' }];
  assert.equal(nombreRepetido(rubros, 'arbitrajes'), true);
  assert.equal(nombreRepetido(rubros, 'Arbitrajes', 'a'), false);
  assert.equal(nombreRepetido(rubros, 'Cuotas'), false);
});
