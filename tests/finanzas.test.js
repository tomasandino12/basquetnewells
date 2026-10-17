import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montoDesdeTexto, montoParaBase, formatearPesos, MONTO_MAX_CENTAVOS,
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
