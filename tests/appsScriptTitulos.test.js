import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const config = leer('../google/apps-script/config.gs');
const formularios = leer('../google/formularios/FORMULARIOS.md');
const tablero = leer('../google/sheets/TABLERO.md');

const tituloDe = (nombre) => config.match(new RegExp(`var ${nombre} = '([^']+)'`))[1];

// Filas de las tablas: | Col | Título | ... |   (las secciones llevan "—" en Col)
function filasDe(texto) {
  return texto.split('\n').filter((l) => l.startsWith('|')).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

function formulario(nombre) {
  const desde = formularios.indexOf(`## ${nombre}`);
  assert.ok(desde >= 0, `falta el formulario ${nombre}`);
  const resto = formularios.slice(desde + 3);
  const hasta = resto.search(/\n## /);
  return filasDe(hasta < 0 ? resto : resto.slice(0, hasta)).filter((f) => /^[A-Z]{1,2}$/.test(f[0]));
}

function letraDe(n) { // 1 -> A
  let s = '';
  for (; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Con login: A = marca temporal, B = mail verificado, la primera pregunta es la C. Sin login: la primera es la B.
const CON_LOGIN = ['Inscripción', 'Comprobante de pago', 'Plantilla'];
const SIN_LOGIN = ["Quiero jugar en Newell's", 'Quiero colaborar'];
const FORMS = [...CON_LOGIN, ...SIN_LOGIN];
const primeraLetra = (f) => (CON_LOGIN.includes(f) ? 3 : 2);

test('los formularios con login traen las 3 preguntas estándar de config.gs (en la Inscripción, justo después de "¿Ya completó…?")', () => {
  const estandar = [tituloDe('TITULO_DNI'), tituloDe('TITULO_APELLIDO'), tituloDe('TITULO_NOMBRE')];
  for (const f of CON_LOGIN) {
    const desde = f === 'Inscripción' ? 1 : 0;
    assert.deepEqual(formulario(f).slice(desde, desde + 3).map((x) => x[1]), estandar, f);
  }
  assert.match(formulario('Inscripción')[0][1], /^¿Ya completó la ficha del básquet la temporada pasada \(2026\)\?$/);
});

test('la letra de cada pregunta es su posición real en la pestaña de respuestas', () => {
  for (const f of FORMS) {
    formulario(f).forEach((fila, i) => assert.equal(fila[0], letraDe(i + primeraLetra(f)), `${f}: "${fila[1]}"`));
  }
});

test('el mapa de columnas del tablero coincide con los formularios', () => {
  const pestana = { 'Inscripción': 'Inscripción', 'Comprobantes': 'Comprobante de pago' };
  const desde = tablero.indexOf('### Mapa de columnas');
  const mapa = filasDe(tablero.slice(desde, tablero.indexOf('## 1.'))).filter((f) => /^[A-Z]{1,2}$/.test(f[1]));
  assert.ok(mapa.length >= 20);
  for (const [tab, col, titulo] of mapa) {
    const fila = formulario(pestana[tab]).find((x) => x[0] === col);
    assert.ok(fila, `${tab} columna ${col} no existe en el formulario`);
    assert.equal(fila[1], titulo, `${tab} columna ${col}`);
  }
});

test('el formulario de aranceles tiene la pregunta Concepto de config.gs', () => {
  assert.ok(formulario('Comprobante de pago').some((f) => f[1] === tituloDe('TITULO_CONCEPTO')));
});

test('cada pregunta de subir archivo tiene una ayuda', () => {
  for (const f of FORMS) {
    for (const fila of formulario(f).filter((x) => x[2].startsWith('Subir archivo'))) {
      assert.ok(fila[4].length > 20, `${f}: "${fila[1]}" sin ayuda`);
    }
  }
});

test('la casilla de recaudación no viene premarcada y el texto de privacidad está por validar', () => {
  assert.match(formularios, /\*\*No premarcada\.\*\*/);
  assert.match(formularios, /\[VALIDAR CON COORDINACIÓN\]/);
});

test('cada título aparece una sola vez en Inscripción', () => {
  const titulos = formulario('Inscripción').map((f) => f[1].toLowerCase());
  assert.equal(new Set(titulos).size, titulos.length);
});

test('consentimiento y alertas médicas son obligatorias, y las alertas traen "Ninguna"', () => {
  const insc = formulario('Inscripción');
  const consentimiento = insc.find((f) => f[1] === 'Consentimiento de Datos');
  const alertas = insc.find((f) => f[1] === 'Alertas médicas');
  assert.equal(consentimiento[3], 'sí');
  assert.equal(alertas[3], 'sí');
  assert.match(alertas[4], /\*\*Ninguna\*\*/);
});

test('la casilla de Emergencias en Semillero es opcional y no viene premarcada', () => {
  const fila = formulario('Inscripción').find((f) => f[1] === 'Emergencias en Semillero');
  assert.equal(fila[3], 'no');
  assert.match(fila[4], /No premarcada/);
});

test('las fotos de la reinscripción llevan otro título que las de la primera vez', () => {
  const insc = formulario('Inscripción').map((f) => f[1]);
  for (const base of ['DNI jugador - frente', 'DNI jugador - dorso', 'DNI adulto - frente', 'DNI adulto - dorso', 'Foto del jugador', 'Foto del adulto']) {
    assert.ok(insc.includes(base), base);
    assert.ok(insc.includes(base + ' (reinscripción)'), base + ' (reinscripción)');
  }
});

test('Quiero jugar y Quiero colaborar no tienen subidas ni DNI', () => {
  for (const f of SIN_LOGIN) {
    for (const fila of formulario(f)) {
      assert.ok(!fila[2].startsWith('Subir archivo'), `${f}: "${fila[1]}" sube archivos`);
      assert.ok(!/dni|domicilio|salud/i.test(fila[1]), `${f}: "${fila[1]}" pide un dato que no corresponde`);
    }
  }
});
