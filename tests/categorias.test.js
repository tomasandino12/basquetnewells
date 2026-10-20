import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoriaPorNacimiento, ramaDeCodigos, temporadaComoAnio, CATEGORIAS_SEMILLERO, aniosDeCategoria, textoAnios,
} from '../src/data/categorias.js';

const grupo = (anio, temporada = 2026) => categoriaPorNacimiento(`${anio}-06-15`, temporada, 'M').grupo;

test('grupos 2026 por año', () => {
  // La tabla que confirman los formularios del club, borde por borde.
  const esperado = {
    2020: 'ESCUELITA', 2019: 'ESCUELITA',
    2018: 'U9', 2017: 'U9',
    2016: 'U11', 2015: 'U11',
    2014: 'U13', 2013: 'U13',
    2012: 'U15', 2011: 'U15',
    2010: 'U17', 2009: 'U17',
    2008: 'U21', 2005: 'U21',
    2004: 'MAYORES', 1990: 'MAYORES',
  };
  for (const [anio, g] of Object.entries(esperado)) assert.equal(grupo(Number(anio)), g, `nacido en ${anio}`);
});

test('U21 abarca cuatro años', () => {
  assert.deepEqual([2008, 2007, 2006, 2005].map((a) => grupo(a)), ['U21', 'U21', 'U21', 'U21']);
  assert.equal(grupo(2009), 'U17');
  assert.equal(grupo(2004), 'MAYORES');
});

test('al pasar a 2027 todo corre un año', () => {
  assert.equal(grupo(2013, 2027), 'U15'); // segundo año de U13 → sube
  assert.equal(grupo(2014, 2027), 'U13'); // primer año de U13 → se queda
  assert.equal(grupo(2005, 2027), 'MAYORES');
  assert.equal(grupo(2020, 2027), 'ESCUELITA');
});

test('código de Semillero por rama', () => {
  assert.equal(categoriaPorNacimiento('2013-01-01', 2026, 'M').codigo, 'U13M');
  assert.equal(categoriaPorNacimiento('2011-12-31', 2026, 'MASCULINO').codigo, 'U15M');
  assert.equal(categoriaPorNacimiento('2009-05-05', 2026, 'm').codigo, 'U17M');
  assert.equal(categoriaPorNacimiento('2006-05-05', 2026, 'M').codigo, 'U21M');
  assert.equal(categoriaPorNacimiento('1999-05-05', 2026, 'M').codigo, 'MAY_M');
  assert.equal(categoriaPorNacimiento('1999-05-05', 2026, 'Femenino').codigo, 'MAY_F');
});

test('categorías que no existen dan null con motivo', () => {
  const u15f = categoriaPorNacimiento('2012-03-03', 2026, 'F');
  assert.equal(u15f.grupo, 'U15');
  assert.equal(u15f.codigo, null);
  assert.match(u15f.motivo, /no tiene U15 femenino/);
  assert.equal(categoriaPorNacimiento('2016-03-03', 2026, 'M').codigo, null);
  assert.equal(categoriaPorNacimiento('2020-03-03', 2026, 'M').codigo, null);
  // Si el club suma la categoría por SQL, aparece sola.
  const conU15F = [...CATEGORIAS_SEMILLERO, 'U15F'];
  assert.equal(categoriaPorNacimiento('2012-03-03', 2026, 'F', conU15F).codigo, 'U15F');
});

test('sin fecha, sin rama o con fecha imposible', () => {
  const sinFecha = categoriaPorNacimiento(null, 2026, 'M');
  assert.deepEqual([sinFecha.grupo, sinFecha.codigo], [null, null]);
  assert.match(sinFecha.motivo, /fecha/);
  const sinRama = categoriaPorNacimiento('2012-03-03', 2026, '');
  assert.equal(sinRama.grupo, 'U15');
  assert.equal(sinRama.codigo, null);
  assert.match(sinRama.motivo, /rama/);
  assert.equal(categoriaPorNacimiento('2027-01-01', 2026, 'M').codigo, null);
  assert.equal(categoriaPorNacimiento('15/03/2012', 2026, 'M').grupo, null);
});

test('temporada que no es año', () => {
  assert.equal(temporadaComoAnio('2026'), 2026);
  assert.equal(temporadaComoAnio(2027), 2027);
  assert.equal(temporadaComoAnio('2026/27'), null);
  assert.equal(temporadaComoAnio(''), null);
  const r = categoriaPorNacimiento('2012-03-03', 'Apertura', 'M');
  assert.equal(r.codigo, null);
  assert.match(r.motivo, /temporada/);
});

test('rama desde los planteles vigentes', () => {
  assert.equal(ramaDeCodigos(['U15M']), 'M');
  assert.equal(ramaDeCodigos(['U17M', 'U21M']), 'M');
  assert.equal(ramaDeCodigos(['MAY_F']), 'F');
  assert.equal(ramaDeCodigos(['U21M', 'MAY_F']), null);
  assert.equal(ramaDeCodigos([]), null);
  assert.equal(ramaDeCodigos(undefined), null);
});

test('años de nacimiento de cada grupo: los mismos bordes que categoriaPorNacimiento', () => {
  const texto = (g, t = 2026) => textoAnios(aniosDeCategoria(g, t));
  assert.equal(texto('ESCUELITA'), '2019 en adelante');
  assert.equal(texto('U9'), '2017 y 2018');
  assert.equal(texto('U13'), '2013 y 2014');
  assert.equal(texto('U21'), '2005 a 2008');
  assert.equal(texto('MAYORES'), '2004 y antes');
  assert.equal(texto('U9', 2027), '2018 y 2019');
  // Cada año del rango cae en ese grupo, y los de afuera no.
  for (const g of ['ESCUELITA', 'U9', 'U11', 'U13', 'U15', 'U17', 'U21', 'MAYORES']) {
    const { viejo, nuevo } = aniosDeCategoria(g, 2026);
    if (viejo != null) assert.equal(grupo(viejo), g);
    if (nuevo != null) assert.equal(grupo(nuevo), g);
    if (viejo != null) assert.notEqual(grupo(viejo - 1), g);
    if (nuevo != null) assert.notEqual(grupo(nuevo + 1), g);
  }
});

test('años de un grupo desconocido o temporada que no es año: null', () => {
  assert.equal(aniosDeCategoria('U10', 2026), null);
  assert.equal(aniosDeCategoria('U9', 'Apertura'), null);
  assert.equal(textoAnios(null), '');
});
