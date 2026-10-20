import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  proponerPases, agruparPases, filasParaConfirmar, NO_SIGUE, DESPUES,
} from '../src/data/pasesDeTemporada.js';

const PLANTELES_2027 = [
  { id: 'p13', categoriaCodigo: 'U13M' },
  { id: 'p15', categoriaCodigo: 'U15M' },
  { id: 'p17', categoriaCodigo: 'U17M' },
  { id: 'p21', categoriaCodigo: 'U21M' },
  { id: 'pmm', categoriaCodigo: 'MAY_M' },
  { id: 'pmf', categoriaCodigo: 'MAY_F' },
];
const chico = (anioNacimiento, codigos, jugadorId = 'j') => ({ jugadorId, nombreLimpio: 'ZZTEST, Chico', anioNacimiento, codigos });
const proponer = (c) => proponerPases([c], PLANTELES_2027, 2027)[0];

test('sube de categoría al cambiar de año', () => {
  const r = proponer(chico(2013, ['U13M']));
  assert.equal(r.propuesto, 'p15');
  assert.equal(r.sube, true);
});

test('segundo año se queda', () => {
  const r = proponer(chico(2014, ['U13M']));
  assert.equal(r.propuesto, 'p13');
  assert.equal(r.sube, false);
});

test('la rama sale de los planteles vigentes', () => {
  assert.equal(proponer(chico(1999, ['MAY_F'])).propuesto, 'pmf');
  assert.equal(proponer(chico(2005, ['U21M'])).propuesto, 'pmm');
});

test('sin fecha queda para decidir', () => {
  const r = proponer(chico(null, ['U17M']));
  assert.equal(r.propuesto, null);
  assert.match(r.motivo, /fecha/);
});

test('categoría inexistente queda para decidir', () => {
  const r = proponer(chico(2018, ['U13M']));
  assert.equal(r.propuesto, null);
  assert.match(r.motivo, /U9/);
  const sinRama = proponer(chico(2012, ['U15M', 'MAY_F']));
  assert.equal(sinRama.propuesto, null);
  assert.match(sinRama.motivo, /masculino o femenino/);
});

test('un plantel que no se abrió en la temporada nueva no se propone', () => {
  const r = proponerPases([chico(2012, ['U15M'])], PLANTELES_2027.filter((p) => p.id !== 'p15'), 2027)[0];
  assert.equal(r.propuesto, null);
});

test('agrupa: primero los que hay que decidir, después por plantel', () => {
  const pases = proponerPases([chico(2012, ['U15M'], 'a'), chico(null, ['U17M'], 'b'), chico(2013, ['U13M'], 'c')], PLANTELES_2027, 2027);
  const grupos = agruparPases(pases, PLANTELES_2027);
  assert.deepEqual(grupos.map((g) => g.plantelId), [null, 'p15']);
  assert.deepEqual(grupos[1].filas.map((f) => f.jugadorId), ['a', 'c']);
});

test('decidir después no se manda; no sigue manda plantel null', () => {
  assert.deepEqual(filasParaConfirmar([
    { jugadorId: 'a', eleccion: 'p15' },
    { jugadorId: 'b', eleccion: DESPUES },
    { jugadorId: 'c', eleccion: NO_SIGUE },
    { jugadorId: 'd', eleccion: '' },
  ]), [{ jugadorId: 'a', plantelId: 'p15' }, { jugadorId: 'c', plantelId: null }]);
});
