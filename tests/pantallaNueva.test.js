import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { abrirAlEntrar, abrirEnNueva, guardarNueva, nuevaPrendida } from '../src/ui/pantallaNueva.js';

/**
 * El respaldo de la mudanza: con el interruptor apagado, o con /nueva caída,
 * la pantalla vieja se abre como siempre. Se simulan localStorage, fetch y
 * window.location, que no existen en Node.
 */

let guardado;
let destinos;
let pedidos;
let avisos;
const originales = {};
const CLAVES = ['localStorage', 'sessionStorage', 'window', 'fetch', 'document'];
let reemplazos;
let sesion;

function simular({ fetchFalla = false, status = 200 } = {}) {
  guardado = new Map();
  destinos = [];
  pedidos = [];
  globalThis.localStorage = {
    getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
    setItem: (k, v) => guardado.set(k, String(v)),
    removeItem: (k) => guardado.delete(k),
  };
  reemplazos = [];
  sesion = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (sesion.has(k) ? sesion.get(k) : null),
    setItem: (k, v) => sesion.set(k, String(v)),
  };
  globalThis.window = { location: { assign: (d) => destinos.push(d), replace: (d) => reemplazos.push(d) } };
  // toast() escribe en el DOM: alcanza con algo que guarde el texto.
  avisos = [];
  const nodo = { textContent: '', classList: { add() {}, remove() {} } };
  globalThis.document = {
    getElementById: (id) => ({
      ...nodo,
      set textContent(t) { if (id === 'toast-tx') avisos.push(t); },
    }),
  };
  globalThis.fetch = async (url, opciones) => {
    pedidos.push({ url, opciones });
    if (fetchFalla) throw new TypeError('sin conexión');
    return { ok: status >= 200 && status < 300 };
  };
}

beforeEach(() => {
  for (const k of CLAVES) originales[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  simular();
});

afterEach(() => {
  for (const k of CLAVES) {
    if (originales[k]) Object.defineProperty(globalThis, k, originales[k]);
    else delete globalThis[k];
  }
});

test('prendido por defecto: sin tocar nada, el plantel abre en la nueva', async () => {
  assert.equal(nuevaPrendida(), true);
  assert.equal(await abrirEnNueva({ plantelId: 'p1' }), true);
  assert.deepEqual(destinos, ['/nueva#/plantel/p1']);
});

test('Hoy abre el resumen nuevo', async () => {
  assert.equal(await abrirEnNueva({ plantelId: 'p1', pantalla: 'hoy' }), true);
  assert.deepEqual(destinos, ['/nueva#/hoy/p1']);
});

test('apagado: no pide nada y no se va de la pantalla vieja', async () => {
  guardarNueva(false);
  assert.equal(nuevaPrendida(), false);
  assert.equal(await abrirEnNueva({ plantelId: 'p1' }), false);
  assert.deepEqual(pedidos, []);
  assert.deepEqual(destinos, []);
});

test('prendido y con /nueva respondiendo: va al plantel nuevo', async () => {
  assert.equal(guardarNueva(true), true);
  assert.equal(nuevaPrendida(), true);
  assert.equal(await abrirEnNueva({ plantelId: 'p1' }), true);
  assert.deepEqual(destinos, ['/nueva#/plantel/p1']);
  assert.equal(pedidos[0].url, '/nueva');
  assert.equal(pedidos[0].opciones.method, 'HEAD');
});

test('prendido, la ficha se abre en la nueva con el jugador', async () => {
  guardarNueva(true);
  assert.equal(await abrirEnNueva({ plantelId: 'p1', jugadorId: 'j1' }), true);
  assert.deepEqual(destinos, ['/nueva#/plantel/p1?jugador=j1']);
});

test('respaldo: sin conexión se queda en la pantalla vieja', async () => {
  simular({ fetchFalla: true });
  guardarNueva(true);
  assert.equal(await abrirEnNueva({ plantelId: 'p1' }), false);
  assert.deepEqual(destinos, []);
  assert.equal(avisos.length, 1, 'avisa por qué se quedó en la vieja');
});

test('respaldo: si /nueva da error (deploy roto) se queda en la pantalla vieja', async () => {
  simular({ status: 404 });
  guardarNueva(true);
  assert.equal(await abrirEnNueva({ plantelId: 'p1' }), false);
  assert.deepEqual(destinos, []);
});

test('apagarlo vuelve al comportamiento de siempre', async () => {
  guardarNueva(true);
  guardarNueva(false);
  assert.equal(nuevaPrendida(), false);
  assert.equal(await abrirEnNueva({ plantelId: 'p1' }), false);
});

test('si el teléfono no deja usar localStorage queda apagado y no rompe', async () => {
  globalThis.localStorage = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('bloqueado'); },
    removeItem: () => { throw new Error('bloqueado'); },
  };
  assert.equal(nuevaPrendida(), false);
  assert.equal(guardarNueva(true), false);
  assert.equal(await abrirEnNueva({ plantelId: 'p1' }), false);
});

test('al entrar a /app salta a la nueva con replace, una sola vez por pestaña', async () => {
  assert.equal(await abrirAlEntrar({ plantelId: 'p1', pantalla: 'plantel' }), true);
  assert.deepEqual(reemplazos, ['/nueva#/plantel/p1']);
  assert.deepEqual(destinos, [], 'replace: /app no queda en el historial');
  // Volver desde /nueva («En la app de siempre») no rebota.
  assert.equal(await abrirAlEntrar({ plantelId: 'p1', pantalla: 'plantel' }), false);
  assert.equal(reemplazos.length, 1);
});

test('al entrar con el interruptor apagado se queda en /app', async () => {
  guardarNueva(false);
  assert.equal(await abrirAlEntrar({ plantelId: 'p1' }), false);
  assert.deepEqual(reemplazos, []);
});

test('al entrar sin sessionStorage no salta (no habría cómo no rebotar)', async () => {
  globalThis.sessionStorage = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => {} };
  assert.equal(await abrirAlEntrar({ plantelId: 'p1' }), false);
  assert.deepEqual(reemplazos, []);
});
