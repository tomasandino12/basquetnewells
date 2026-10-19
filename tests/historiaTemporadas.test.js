import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seccionTemporadas } from '../src/ui/componentes/historiaTemporadas.js';

// Un chico que viene de U15 2025 y hoy está en U17 2026; 2025 sólo tiene
// un salto y una batería, 2026 no tiene ninguna medición.
const datos = () => ({
  temporadas: [{ id: 't25', nombre: '2025' }, { id: 't26', nombre: '2026' }],
  planteles: [
    { id: 'a', temporadaId: 't25', categoria: 'U15M', profes: ['Ana <b>'] },
    { id: 'b', temporadaId: 't26', categoria: 'U17M', profes: ['Beto'] },
  ],
  pertenencias: [
    { plantelId: 'a', temporadaId: 't25', desde: '2025-03-01', hasta: '2025-12-15' },
    { plantelId: 'b', temporadaId: 't26', desde: '2026-03-01', hasta: null },
  ],
  planFisico: [], cargas: [], recursos: [], sprints: [], yoyos: [], corporales: [], partidos: [],
  saltos: [{ sesionId: 's', plantelId: 'a', fecha: '2025-11-01', testSalto: 'cmj', intento: 1, tiempoVueloMs: 500 }],
  tiro: [{ sesionId: 'b1', plantelId: 'a', fecha: '2025-08-01', posicion: 'frontal', anotados: 6, intentos: 10 }],
});

test('muestra la temporada más reciente arriba, con sus categorías y profes, sin inyectar HTML', () => {
  const t = seccionTemporadas(datos()).toString();
  assert.ok(t.indexOf('2026 · U17M') < t.indexOf('2025 · U15M'));
  assert.match(t, /Temporada actual/);
  assert.match(t, /Profes: Beto/);
  assert.match(t, /Ana &lt;b&gt;/);
  assert.doesNotMatch(t, /Ana <b>/);
});

test('cómo llega muestra el último dato anterior a esta temporada', () => {
  const t = seccionTemporadas(datos()).toString();
  assert.match(t, /Cómo llega a U17M/);
  assert.match(t, /30,7 cm/);
  assert.match(t, /6 de 10/);
});

test('lo que falta dice sin datos y nunca 0', () => {
  const t = seccionTemporadas(datos()).toString();
  assert.match(t, /sin datos/);
  assert.doesNotMatch(t, /\b0 (cm|kg|m)\b|\b0 de 0\b|\b0 partidos\b|0 sesiones/);
  // 2026 no tiene nada: el resumen lo dice sin contar ceros.
  assert.match(t, /Sin plan físico · Sin mediciones físicas/);
});

test('no afirma mejoras ni compara', () => {
  const t = seccionTemporadas(datos()).toString();
  assert.doesNotMatch(t, /mejor[óo]|progres|promedio|ranking|norma|tendencia|vs /i);
});

test('sin ninguna temporada lo dice', () => {
  const t = seccionTemporadas({ ...datos(), temporadas: [], planteles: [], pertenencias: [], saltos: [], tiro: [] }).toString();
  assert.match(t, /Todavía no hay temporadas/);
});
