import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seccionMisiones } from '../src/ui/componentes/seccionMisiones.js';
import { bloqueLogros } from '../src/ui/componentes/logrosDelEquipo.js';

const mision = (extra) => ({ fecha: '2026-10-18', rival: null, comentario: null, estado: null, metrica: null, valor: null, texto: 'hablar', ...extra });

test('la ficha lista las misiones sin totales ni porcentajes', () => {
  const t = seccionMisiones([
    mision({ fecha: '2026-10-18', estado: 'logrado' }),
    mision({ fecha: '2026-10-11', estado: 'no_logrado', texto: 'cortar' }),
    mision({ fecha: '2026-10-04', estado: null, metrica: 'reb_tot', valor: 5, texto: null }),
  ]).toString();
  assert.doesNotMatch(t, /%|ranking|total|de 3|\b3 misiones\b/i);
  assert.ok(t.indexOf('18/10/26') < t.indexOf('11/10/26') && t.indexOf('11/10/26') < t.indexOf('04/10/26'), 'cronológico, la más reciente arriba');
  assert.match(t, /Logrado/);
  assert.match(t, /No logrado/);
  assert.match(t, /Sin evaluar/);
  assert.match(t, /Al menos 5 rebotes/);
});

test('la ficha sin misiones lo dice y no inventa un cero', () => {
  const t = seccionMisiones([]).toString();
  assert.match(t, /Todavía no tuvo misiones/);
  assert.doesNotMatch(t, /\b0\b/);
});

test('el texto del usuario se escapa', () => {
  const t = seccionMisiones([mision({ texto: '<img src=x onerror=alert(1)>', comentario: '<b>x</b>' })]).toString();
  assert.doesNotMatch(t, /<img|<b>/);
});

test('logros del equipo: contador y lista', () => {
  const l = [{ fecha: '2026-10-18', rival: 'Central', metrica: 'puntos_rival', valor: 59, texto: null }];
  const t = bloqueLogros(l).toString();
  assert.match(t, /<div class="cifra">1<\/div>/);
  assert.match(t, /logro en la temporada/);
  assert.match(t, /El rival hace como máximo 59 puntos/);
  assert.match(bloqueLogros([]).toString(), /<div class="cifra">0<\/div>[\s\S]*Plantel → Misiones del partido/);
});

test('logros dentro de otra tarjeta no abren una tarjeta anidada', () => {
  const t = bloqueLogros([], { conTarjeta: false }).toString();
  assert.doesNotMatch(t, /class="tarj"/);
  assert.match(bloqueLogros([]).toString(), /class="tarj"/);
});
