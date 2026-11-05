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
 *
 * Mide web/dist, que sólo existe después de `npm --prefix web run build`: sin
 * armar, se saltea (Vercel la arma en el deploy, no en las pruebas).
 */

const PRESUPUESTO_KB = 330;
const DIST = 'web/dist/assets';

test('lo que baja el celular de /nueva entra en el presupuesto', { skip: !existsSync(DIST) && 'web/dist no está armado' }, () => {
  const peso = readdirSync(DIST).filter((a) => /\.(js|css)$/.test(a))
    .reduce((suma, a) => suma + gzipSync(readFileSync(join(DIST, a)), { level: 9 }).length, 0);
  assert.ok(peso <= PRESUPUESTO_KB * 1024, `/nueva pesa ${(peso / 1024).toFixed(0)} kB comprimida (tope ${PRESUPUESTO_KB})`);
});
