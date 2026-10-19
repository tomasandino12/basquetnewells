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

const FORMS = ['Inscripción', 'Reinscripción', 'Comprobante de aranceles', 'Plantilla'];

test('todos los formularios arrancan con las 3 preguntas estándar de config.gs', () => {
  const estandar = [tituloDe('TITULO_DNI'), tituloDe('TITULO_APELLIDO'), tituloDe('TITULO_NOMBRE')];
  for (const f of FORMS) {
    assert.deepEqual(formulario(f).slice(0, 3).map((x) => x[1]), estandar, f);
  }
});

test('la letra de cada pregunta es su posición real en la pestaña de respuestas', () => {
  for (const f of FORMS) {
    formulario(f).forEach((fila, i) => assert.equal(fila[0], letraDe(i + 3), `${f}: "${fila[1]}"`));
  }
});

test('el mapa de columnas del tablero coincide con los formularios', () => {
  const pestana = { 'Inscripción': 'Inscripción', 'Reinscripción': 'Reinscripción', 'Aranceles': 'Comprobante de aranceles' };
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
  assert.ok(formulario('Comprobante de aranceles').some((f) => f[1] === tituloDe('TITULO_CONCEPTO')));
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
