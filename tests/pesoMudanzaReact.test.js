import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Presupuesto de peso de /nueva (lo que baja el celular, comprimido, sin fuentes).
 * Medido el 04/11 con Plantel y la ficha: 268 kB de JS + 6 kB de CSS, contra ~560 kB
 * de la app vieja entera (ver docs/decisiones/mudanza-peso.md). Si crece más de
 * ~20% sin que se haya mudado nada nuevo, algo pesado entró de más.
 * 12/11: coordinación entera (7 pantallas: panorama con gráficos, profes, temporada, rubros,
 * finanzas, papeles y formularios) subió el total a 341 kB; el tope pasó de 330 a 360.
 *
 * 13/11: importar planillas y Datos (partidos, tiro, cargas y pruebas con sus gráficos) sumaron ~24 kB;
 * el tope pasó de 360 a 385. El lector de xlsx (~120 kB) no cuenta: es un trozo aparte que el celular
 * sólo baja cuando alguien sube una planilla (import dinámico), no al abrir la app. Otra prueba, abajo,
 * vigila que siga siendo así.
 *
 * 14/11: los cuatro tests de Medir (batería, salto con el marcador de cuadros, sprint con el
 * cronómetro de salida y Yo-Yo con los pitidos) dejaron de abrirse en la app de siempre: el total
 * llegó a ~400 kB y el tope pasó de 385 a 410.
 *
 * 16/11: cargar el plan de fuerza (resumen y videos) y armar la planilla de asistencia pasaron a React
 * (~5 kB); el tope pasó de 410 a 420. El lector de xlsx sigue siendo un trozo aparte.
 *
 * Mide web/dist, que sólo existe después de `npm --prefix web run build`: sin
 * armar, se saltea (Vercel la arma en el deploy, no en las pruebas).
 */

const PRESUPUESTO_KB = 420;
const DIST = 'web/dist/assets';
const LECTOR_XLSX = /^xlsx-/;

test('lo que baja el celular de /nueva entra en el presupuesto', { skip: !existsSync(DIST) && 'web/dist no está armado' }, () => {
  const peso = readdirSync(DIST).filter((a) => /\.(js|css)$/.test(a) && !LECTOR_XLSX.test(a))
    .reduce((suma, a) => suma + gzipSync(readFileSync(join(DIST, a)), { level: 9 }).length, 0);
  assert.ok(peso <= PRESUPUESTO_KB * 1024, `/nueva pesa ${(peso / 1024).toFixed(0)} kB comprimida (tope ${PRESUPUESTO_KB})`);
});

test('el lector de xlsx no se baja al abrir la app: sólo al subir una planilla', { skip: !existsSync(DIST) && 'web/dist no está armado' }, () => {
  const html = readFileSync('web/dist/index.html', 'utf8');
  assert.ok(!/xlsx/i.test(html), 'index.html no carga el lector de xlsx');
  const trozos = readdirSync(DIST).filter((a) => LECTOR_XLSX.test(a));
  assert.equal(trozos.length, 1, 'el lector de xlsx es un trozo aparte');
  const entrada = readdirSync(DIST).filter((a) => /^index-.*\.js$/.test(a)).map((a) => readFileSync(join(DIST, a), 'utf8')).join('\n');
  // Un import estático empezaría con «from"./xlsx-»; el dinámico sólo lo nombra dentro de la lista de precarga.
  assert.ok(!/from\s*["']\.\/xlsx-/.test(entrada), 'la entrada no importa el lector de xlsx de entrada');
});
