import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parsearInscriptos, leerFecha, COLUMNAS } from '../src/parser/parserInscriptos.js';
import { mapearCategoria, normalizarMail, inscriptosDelPlantel } from '../src/data/inscriptos.js';

// La planilla se arma en memoria: así el test no depende de un binario y no
// hay nombres reales en ningún lado.
function planilla(filas, encabezado = COLUMNAS) {
  const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...filas]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Para Semillero');
  return XLSX.write(libro, { type: 'array', bookType: 'xlsx' });
}

const U15 = 'U15 - MASCULINO (2012 y 2011)';

test('lee las columnas de la planilla', () => {
  const r = parsearInscriptos(planilla([['Pérez', 'Juan', '03/04/2012', U15, 'padre@ejemplo.com', 'Masculino']]));
  assert.equal(r.exito, true);
  assert.deepEqual(r.filas[0], {
    fila: 2, apellido: 'Pérez', nombre: 'Juan', fechaNacimiento: '2012-04-03',
    categoriaTexto: U15, mail: 'padre@ejemplo.com', rama: 'Masculino',
  });
});

test('falta una columna: error claro que la nombra', () => {
  const r = parsearInscriptos(planilla([], COLUMNAS.filter((c) => c !== 'Rama')));
  assert.equal(r.exito, false);
  assert.match(r.errores[0], /ENCABEZADOS_INVALIDOS.*Rama/);
});

test('encabezados sin tildes ni mayúsculas igual valen', () => {
  const enc = ['apellido', 'NOMBRE', 'fecha de nacimiento', 'categoria', 'mail del responsable', 'rama'];
  const r = parsearInscriptos(planilla([['Gómez', 'Ana', '01/01/2012', U15, 'a@b.com', '']], enc));
  assert.equal(r.filas.length, 1);
});

test('fechas: serial de Excel, texto dd/mm/aaaa, y lo ilegible es null', () => {
  assert.equal(leerFecha(41002), '2012-04-03');
  assert.equal(leerFecha('3/4/2012'), '2012-04-03');
  assert.equal(leerFecha('31/02/2012'), null);
  assert.equal(leerFecha('2012-04-03'), null);
  assert.equal(leerFecha(''), null);
  assert.equal(leerFecha(5), null);
});

test('una fila sin fecha legible se saltea con aviso, las demás siguen', () => {
  const r = parsearInscriptos(planilla([
    ['Pérez', 'Juan', 'cualquiera', U15, 'a@b.com', ''],
    ['Gómez', 'Ana', '01/01/2012', U15, 'c@d.com', ''],
  ]));
  assert.equal(r.filas.length, 1);
  assert.match(r.advertencias[0], /FECHA_ILEGIBLE.*fila 2/);
});

test('las filas en blanco se ignoran sin aviso', () => {
  const r = parsearInscriptos(planilla([[null, null, null, null, null, null]]));
  assert.equal(r.filas.length, 0);
  assert.equal(r.advertencias.length, 0);
});

test('mapearCategoria cubre las 11 opciones del formulario', () => {
  const casos = [
    ['ESCUELITA - MIXTO', 'Masculino', null],
    ['U9 - MIXTO (2017 y 2018)', 'Masculino', null],
    ['U11 - MIXTO (2015 y 2016)', 'Femenino', null],
    ['U13 - MIXTO (2014 y 2013)', 'Masculino', 'U13M'],
    ['U13 - MIXTO (2014 y 2013)', 'Femenino', null],
    ['U15 - MASCULINO (2012 y 2011)', '', 'U15M'],
    ['U15 - FEMENINO (2012 y 2011)', '', null],
    ['U17 - MASCULINO (2010 y 2009)', '', 'U17M'],
    ['U17 - FEMENINO (2010 y 2009)', '', null],
    ['U21 - MASCULINO (2008, 2007, 2006 y 2005)', '', 'U21M'],
    ['U21 - FEMENINO (2008, 2007, 2006 y 2005)', '', null],
    ['MAYORES FEMENINO', '', 'MAY_F'],
  ];
  for (const [texto, rama, esperado] of casos) {
    assert.equal(mapearCategoria(texto, rama).codigo, esperado, `${texto} / ${rama}`);
  }
});

test('mapearCategoria: en MASCULINO/FEMENINO manda la categoría, no la rama', () => {
  assert.equal(mapearCategoria('U15 - MASCULINO (2012 y 2011)', 'Femenino').codigo, 'U15M');
  assert.equal(mapearCategoria('U15 - FEMENINO (2012 y 2011)', 'Masculino').codigo, null);
});

test('mapearCategoria: U13 mixto sin rama y texto desconocido se saltean con motivo', () => {
  assert.match(mapearCategoria('U13 - MIXTO (2014 y 2013)', '').motivo, /sin rama/);
  assert.match(mapearCategoria('U99', '').motivo, /desconocida/);
});

test('normalizarMail: minúsculas, recorte, e inválido es null', () => {
  assert.equal(normalizarMail('  Padre@Ejemplo.COM '), 'padre@ejemplo.com');
  assert.equal(normalizarMail('sin-arroba'), null);
  assert.equal(normalizarMail(''), null);
});

const fila = (extra) => ({
  fila: 2, apellido: 'Pérez', nombre: 'Juan', fechaNacimiento: '2012-04-03',
  categoriaTexto: U15, mail: 'a@b.com', rama: '', ...extra,
});

test('inscriptosDelPlantel: filtra por plantel y cuenta lo salteado con motivo', () => {
  const r = inscriptosDelPlantel([
    fila({}),
    fila({ fila: 3, apellido: 'Gómez', categoriaTexto: 'U17 - MASCULINO (2010 y 2009)' }),
    fila({ fila: 4, apellido: 'Ruiz', categoriaTexto: 'U9 - MIXTO (2017 y 2018)' }),
  ], 'U15M');
  assert.equal(r.inscriptos.length, 1);
  assert.equal(r.salteadas.length, 2);
  assert.match(r.salteadas[1].motivo, /no tiene esa categoría/);
});

test('inscriptosDelPlantel: dos filas del mismo chico juntan los dos mails', () => {
  const r = inscriptosDelPlantel([fila({}), fila({ fila: 3, mail: 'MADRE@b.com' }), fila({ fila: 4, mail: 'a@b.com' })], 'U15M');
  assert.equal(r.inscriptos.length, 1);
  assert.deepEqual(r.inscriptos[0].mails, ['a@b.com', 'madre@b.com']);
});

test('inscriptosDelPlantel: homónimos con otra fecha son dos chicos', () => {
  const r = inscriptosDelPlantel([fila({}), fila({ fila: 3, fechaNacimiento: '2011-09-09' })], 'U15M');
  assert.equal(r.inscriptos.length, 2);
});

test('inscriptosDelPlantel: un mail inválido avisa pero el chico entra sin mail', () => {
  const r = inscriptosDelPlantel([fila({ mail: 'roto' })], 'U15M');
  assert.equal(r.inscriptos.length, 1);
  assert.deepEqual(r.inscriptos[0].mails, []);
  assert.match(r.advertencias[0], /no es válido/);
});
