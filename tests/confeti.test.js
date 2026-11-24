import test from 'node:test';
import assert from 'node:assert/strict';
import { piezasDeConfeti, VARIANTES_CONFETI } from '../src/data/confeti.js';
import { htmlSello, AGRADECIMIENTOS } from '../src/ui/celebracion.js';

// Un "azar" fijo que recorre 0, 0.1, … 0.9 en bucle: las piezas salen siempre iguales.
const fijo = () => {
  let i = 0;
  return () => (i++ % 10) / 10;
};

test('piezasDeConfeti: la cantidad pedida, con 40 por defecto', () => {
  assert.equal(piezasDeConfeti(7, fijo()).length, 7);
  assert.equal(piezasDeConfeti().length, 40);
});

test('piezasDeConfeti: todo dentro de los rangos y con variantes válidas, aun con el azar en los extremos', () => {
  for (const azar of [() => 0, () => 0.999999, Math.random]) {
    for (const p of piezasDeConfeti(60, azar)) {
      assert.ok(p.dx >= -220 && p.dx <= 220);
      assert.ok(p.caida >= 160 && p.caida <= 300);
      assert.ok(Math.abs(p.giro) >= 240 && Math.abs(p.giro) <= 720);
      assert.ok(p.tam >= 8 && p.tam <= 14);
      assert.ok(p.demora >= 0 && p.demora <= 140);
      assert.ok(Number.isInteger(p.variante) && p.variante >= 0 && p.variante < VARIANTES_CONFETI);
    }
  }
});

test('piezasDeConfeti: con el mismo azar da las mismas piezas, y salen de todas las variantes', () => {
  assert.deepEqual(piezasDeConfeti(40, fijo()), piezasDeConfeti(40, fijo()));
  const usadas = new Set(piezasDeConfeti(60, Math.random).map((p) => p.variante));
  assert.equal(usadas.size, VARIANTES_CONFETI);
});

test('htmlSello: el escudo del club tal cual y el gracias de cada botón; sin clave conocida, nada', () => {
  assert.equal(AGRADECIMIENTOS.sumarte, '¡Gracias por sumarte!');
  assert.equal(AGRADECIMIENTOS.colaborar, '¡Gracias por colaborar!');
  for (const clave of Object.keys(AGRADECIMIENTOS)) {
    const out = htmlSello(clave).toString();
    assert.match(out, /<img src="\/public\/escudo\.png" alt="" width="72" height="72">/, 'el mismo escudo de siempre, decorativo');
    assert.ok(out.includes(`<b>${AGRADECIMIENTOS[clave]}</b>`));
  }
  assert.equal(htmlSello('otra').toString(), '');
  assert.equal(htmlSello('__proto__').toString(), '');
});
