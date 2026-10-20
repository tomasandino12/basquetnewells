import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventosDelMes } from '../src/data/repos/portal.js';

const CLAVE = `AIza${'x'.repeat(35)}`;
const BIEN = 'partidos@group.calendar.google.com';
const MAL = 'roto@group.calendar.google.com';

function conFetch(respuestas, fn) {
  const original = globalThis.fetch;
  const pedidos = [];
  globalThis.fetch = async (url) => {
    pedidos.push(url);
    const r = respuestas(url);
    if (r instanceof Error) throw r;
    return { ok: r.ok ?? true, json: async () => r.cuerpo };
  };
  return fn(pedidos).finally(() => { globalThis.fetch = original; });
}

test('junta los calendarios y un calendario que falla no tira los demás', () => conFetch(
  (url) => (url.includes(encodeURIComponent(MAL)) ? new Error('sin red') : { cuerpo: { items: [{ id: '1', summary: 'U15', start: { date: '2026-10-24' } }] } }),
  async () => {
    const r = await eventosDelMes([{ tipo: 'partido', id: BIEN }, { tipo: 'evento', id: MAL }], CLAVE, 2026, 10);
    assert.deepEqual(r.eventos.map((e) => [e.tipo, e.titulo, e.dia]), [['partido', 'U15', '2026-10-24']]);
    assert.equal(r.fallidos, 1);
  },
));

test('una respuesta de error de Google cuenta como fallido', () => conFetch(
  () => ({ ok: false, cuerpo: { error: {} } }),
  async () => {
    const r = await eventosDelMes([{ tipo: 'partido', id: BIEN }], CLAVE, 2026, 10);
    assert.deepEqual(r, { eventos: [], fallidos: 1 });
  },
));

test('sin ID o sin clave válida no se pide nada', () => conFetch(
  () => ({ cuerpo: { items: [] } }),
  async (pedidos) => {
    assert.deepEqual(await eventosDelMes([{ tipo: 'partido', id: null }], CLAVE, 2026, 10), { eventos: [], fallidos: 0 });
    await eventosDelMes([{ tipo: 'partido', id: BIEN }], null, 2026, 10);
    assert.equal(pedidos.length, 0);
  },
));
