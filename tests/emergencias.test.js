import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parsearEmergencias, COLUMNAS } from '../src/parser/parserEmergencias.js';
import {
  AFECCIONES, leerAfecciones, recortar, cruzarEmergencias, filasParaImportarEmergencias,
} from '../src/data/emergencias.js';
import { LIMITE } from '../src/data/limites.js';

// Planilla en memoria y nombres inventados: ningún dato real en el repo.
function planilla(filas, encabezado = COLUMNAS) {
  const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...filas]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Emergencias');
  return XLSX.write(libro, { type: 'array', bookType: 'xlsx' });
}
const fila = (o = {}) => [
  o.nombre ?? 'Zztest Uno', o.fecha ?? '06/05/2012', o.tel ?? '341 555-0000', o.urg ?? 'Zztest tía 341 555-0001',
  o.afec ?? '', o.alerg ?? '', o.med ?? '', o.ind ?? '', o.os ?? '',
];
const filaParseada = (o = {}) => ({
  fila: 2, nombre: 'Zztest Uno', fechaNacimiento: '2012-05-06', telefonoAdulto: '341 555-0000',
  contactoUrgencia: 'x', afecciones: '', alergias: '', medicacion: '', indicacion: '', obraSocial: '', ...o,
});

test('el parser lee las 9 columnas y tipa la fecha', () => {
  const r = parsearEmergencias(planilla([fila({ afec: 'Asma, Epilepsia', os: 'ZZTEST OS' })]), 'e.xlsx');
  assert.equal(r.exito, true);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].fechaNacimiento, '2012-05-06');
  assert.equal(r.filas[0].afecciones, 'Asma, Epilepsia');
  assert.equal(r.filas[0].obraSocial, 'ZZTEST OS');
});

test('fila sin fecha o sin nombre se saltea con aviso; fila en blanco, en silencio', () => {
  const r = parsearEmergencias(planilla([fila({ fecha: 'ayer' }), fila({ nombre: '' }), Array(9).fill(null)]));
  assert.equal(r.filas.length, 0);
  assert.equal(r.advertencias.length, 2);
});

test('faltan columnas: error claro', () => {
  const r = parsearEmergencias(planilla([['a']], ['Apellido y nombre']));
  assert.equal(r.exito, false);
  assert.match(r.errores[0], /ENCABEZADOS_INVALIDOS/);
});

test('el parser rechaza la planilla Para Semillero', () => {
  const r = parsearEmergencias(planilla([], ['Apellido', 'Nombre', 'Fecha de nacimiento', 'Categoría', 'Mail del responsable', 'Rama']));
  assert.equal(r.exito, false);
});

test('afecciones de Forms a la lista cerrada', () => {
  assert.deepEqual(leerAfecciones('Desmayos, Pérdida de conocimiento traumática, ASMA, Asma').alertas,
    ['desmayos', 'perdida_conocimiento', 'asma']);
  assert.deepEqual(leerAfecciones('').alertas, []);
  assert.deepEqual(leerAfecciones(null).alertas, []);
  // Las ocho de la lista están todas.
  assert.equal(leerAfecciones(AFECCIONES.map(([, e]) => e).join(', ')).alertas.length, 8);
});

test('afección desconocida avisa y no se guarda', () => {
  const r = leerAfecciones('Asma, Gripe');
  assert.deepEqual(r.alertas, ['asma']);
  assert.deepEqual(r.desconocidas, ['gripe']);
});

test('texto largo se recorta con aviso', () => {
  assert.deepEqual(recortar('  ', 10), { texto: null, recortado: false });
  assert.deepEqual(recortar('corto', 10), { texto: 'corto', recortado: false });
  const r = recortar('x'.repeat(400), LIMITE.textoSalud);
  assert.equal(r.texto.length, LIMITE.textoSalud);
  assert.equal(r.recortado, true);
});

const PLANTEL = [
  { id: 'j1', nombreLimpio: 'ZZTEST, UNO', fechaNacimiento: '2012-05-06' },
  { id: 'j2', nombreLimpio: 'ZZTEST, DOS', fechaNacimiento: null },
  { id: 'j3', nombreLimpio: 'ZZTEST, TRES', fechaNacimiento: '2011-01-01' },
];

test('cruza aunque el nombre venga invertido o con acentos', () => {
  const r = cruzarEmergencias([filaParseada({ nombre: 'Uno Zztest' }), filaParseada({ fila: 3, nombre: 'ZZTÉST, DOS', fechaNacimiento: '2010-10-10' })], PLANTEL);
  assert.deepEqual(r.cruzadas.map((c) => c.jugadorId), ['j1', 'j2']); // j2 no tiene fecha: alcanza el nombre
  assert.deepEqual(r.sinCruzar, []);
});

test('misma persona con otra fecha no cruza', () => {
  const r = cruzarEmergencias([filaParseada({ nombre: 'Zztest Tres', fechaNacimiento: '2012-01-01' })], PLANTEL);
  assert.equal(r.cruzadas.length, 0);
  assert.match(r.sinCruzar[0].motivo, /nadie/);
});

test('dos chicos que coinciden no se adivinan', () => {
  const r = cruzarEmergencias([filaParseada()], [...PLANTEL, { id: 'j9', nombreLimpio: 'UNO, ZZTEST', fechaNacimiento: null }]);
  assert.equal(r.cruzadas.length, 0);
  assert.match(r.sinCruzar[0].motivo, /dos chicos/);
});

test('texto largo y afección fuera de lista dan aviso y el resto se guarda', () => {
  const r = cruzarEmergencias([filaParseada({ afecciones: 'Asma, Gripe', medicacion: 'm'.repeat(500), alergias: '' })], PLANTEL);
  assert.equal(r.cruzadas.length, 1);
  assert.deepEqual(r.cruzadas[0].alertas, ['asma']);
  assert.equal(r.cruzadas[0].medicacion.length, LIMITE.textoSalud);
  assert.equal(r.cruzadas[0].alergias, null);
  assert.equal(r.advertencias.length, 2);
});

test('lo que se manda no lleva nombre ni fila', () => {
  const r = cruzarEmergencias([filaParseada()], PLANTEL);
  const [f] = filasParaImportarEmergencias(r.cruzadas);
  assert.deepEqual(Object.keys(f).sort(), [
    'alergias', 'alertas', 'contactoUrgencia', 'indicacion', 'jugadorId', 'medicacion', 'obraSocial', 'telefonoAdulto',
  ]);
});

import { enlaceTelefono, etiquetasDeAlertas } from '../src/data/emergencias.js';

test('el teléfono escrito a mano se vuelve un link para llamar', () => {
  assert.equal(enlaceTelefono('341 555-0000'), 'tel:3415550000');
  assert.equal(enlaceTelefono('Zztest tía (0341) 15-555-0001'), 'tel:0341155550001');
  assert.equal(enlaceTelefono('+54 9 341 555 0002'), 'tel:+5493415550002');
  assert.equal(enlaceTelefono('sin número'), null);
  assert.equal(enlaceTelefono('12345'), null);
  assert.equal(enlaceTelefono(null), null);
});

test('las alertas se muestran con su etiqueta y en el orden de la lista', () => {
  assert.deepEqual(etiquetasDeAlertas(['asma', 'epilepsia']), ['Epilepsia', 'Asma']);
  assert.deepEqual(etiquetasDeAlertas([]), []);
  assert.deepEqual(etiquetasDeAlertas(undefined), []);
});
