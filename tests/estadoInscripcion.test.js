import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chicoDesdeFila, conexionDesdeFila, conceptosDe, debeAlgo, faltaDocumentacion, porVerificar,
  categoriaDeChico, filtrar, contadores, resumenPanorama, linkFila, estadoDePago,
} from '../src/data/estadoInscripcion.js';

const chico = (extra) => chicoDesdeFila({
  id: 'x', nombre: 'Pérez, Juan', emparejamiento: 'ok', fila: 2, documentos: {}, completo: true, pagos: {}, ...extra,
});
const CONC = ['Arancel', 'Rifa'];

test('chicoDesdeFila pasa a camelCase y deja null lo que falta', () => {
  const c = chicoDesdeFila({ id: 'a', nombre: 'N', nombre_google: null, categoria_codigo: 'U13M', emparejamiento: 'sin_ficha', fila: 5, cambio_en: '2026-10-17T10:00:00Z' });
  assert.equal(c.categoriaCodigo, 'U13M');
  assert.equal(c.categoriaTexto, null);
  assert.equal(c.completo, null);
  assert.deepEqual(c.pagos, {});
  assert.equal(c.cambioEn, '2026-10-17T10:00:00Z');
});

test('conexionDesdeFila: sin fila no está conectado', () => {
  assert.equal(conexionDesdeFila(undefined).conectado, false);
  assert.deepEqual(conexionDesdeFila({ conectado: true, conceptos_orden: ['A'] }).conceptosOrden, ['A']);
});

test('un concepto nuevo aparece en los contadores, al final', () => {
  const chicos = [chico({ pagos: { Arancel: 'verificado', 'Pantalón 2026': 'subido' } })];
  const conceptos = conceptosDe(chicos, CONC);
  assert.deepEqual(conceptos, ['Arancel', 'Rifa', 'Pantalón 2026']);
  const { porConcepto } = contadores(chicos, conceptos);
  assert.deepEqual(porConcepto[2], { concepto: 'Pantalón 2026', verificado: 0, subido: 1, falta: 0 });
  assert.deepEqual(porConcepto[1], { concepto: 'Rifa', verificado: 0, subido: 0, falta: 1 });
});

test('sin_tablero debe todo y le falta todo', () => {
  const c = chico({ emparejamiento: 'sin_tablero', fila: null, completo: null, pagos: {} });
  assert.equal(debeAlgo(c, CONC), true);
  assert.equal(faltaDocumentacion(c), true);
  assert.equal(estadoDePago(c, 'Arancel'), 'falta');
  assert.equal(porVerificar(c, CONC), false);
});

test('completo null cuenta como "falta documentación" y no como ✅', () => {
  assert.equal(faltaDocumentacion(chico({ completo: null })), true);
  assert.equal(faltaDocumentacion(chico({ completo: true })), false);
});

test('al día en todo: no debe nada', () => {
  const c = chico({ pagos: { Arancel: 'verificado', Rifa: 'verificado' } });
  assert.equal(debeAlgo(c, CONC), false);
});

test('los filtros se combinan', () => {
  const a = chico({ id: 'a', categoria_codigo: 'U13M', pagos: { Arancel: 'falta', Rifa: 'verificado' }, completo: true });
  const b = chico({ id: 'b', categoria_codigo: 'U13M', pagos: { Arancel: 'verificado', Rifa: 'subido' }, completo: false });
  const c = chico({ id: 'c', categoria_codigo: 'U15M', pagos: { Arancel: 'falta' }, completo: false });
  const ids = (f) => filtrar([a, b, c], { conceptos: CONC, ...f }).map((x) => x.id);
  assert.deepEqual(ids({}), ['a', 'b', 'c']);
  assert.deepEqual(ids({ categoria: 'U13M' }), ['a', 'b']);
  assert.deepEqual(ids({ debe: true }), ['a', 'c']);
  assert.deepEqual(ids({ categoria: 'U13M', faltaDoc: true }), ['b']);
  assert.deepEqual(ids({ verificar: true }), ['b']);
  assert.deepEqual(ids({ debe: true, faltaDoc: true }), ['c']);
});

test('la categoría de un sin_ficha sale del texto del tablero', () => {
  const c = chico({ emparejamiento: 'sin_ficha', categoria_texto: 'U13 - MIXTO (2014 y 2013)', rama: 'Masculino' });
  assert.equal(categoriaDeChico(c), 'U13M');
  assert.equal(categoriaDeChico(chico({ categoria_texto: 'Escuelita - MIXTO' })), null);
  assert.equal(categoriaDeChico(chico({ categoria_codigo: 'U17M', categoria_texto: 'U13 - MIXTO (2014 y 2013)' })), 'U17M');
});

test('los contadores de documentación cuentan los completos', () => {
  const { documentacion } = contadores([chico({ completo: true }), chico({ completo: false }), chico({ completo: null })], CONC);
  assert.deepEqual(documentacion, { completos: 1, total: 3 });
});

test('resumenPanorama cuenta los que deben y los que no tienen los papeles', () => {
  const r = resumenPanorama([chico({ pagos: { Arancel: 'falta' } }), chico({ completo: false, pagos: { Arancel: 'verificado', Rifa: 'verificado' } })], CONC);
  assert.deepEqual(r, { debenAlgo: 1, sinPapeles: 1 });
});

test('linkFila arma #gid y range de la fila', () => {
  const con = { tableroUrl: 'https://docs.google.com/spreadsheets/d/abc', gidTablero: 0, gidPagos: 77 };
  assert.equal(linkFila(con, 'tablero', 4), 'https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=A4:Z4');
  assert.equal(linkFila(con, 'pagos', 4), 'https://docs.google.com/spreadsheets/d/abc/edit#gid=77&range=A4:Z4');
});

test('linkFila es null sin conexión o sin fila', () => {
  assert.equal(linkFila({ tableroUrl: null, gidTablero: 0 }, 'tablero', 4), null);
  assert.equal(linkFila({ tableroUrl: 'https://docs.google.com/spreadsheets/d/abc', gidTablero: 0 }, 'tablero', null), null);
  assert.equal(linkFila(undefined, 'tablero', 4), null);
});
