/*
 * La geometría del editor de jugadas: de un toque en la pantalla al punto de la
 * cancha (0 a 1), y qué ficha hay ahí. Puro: recibe el rectángulo del SVG, no el SVG.
 */
import { MARGEN, W, altoDe, limitesDe } from '@datos/geometriaCancha.js';
import type { DatosDePizarra } from '../datos/repositorio';

export const R_FICHA = 12;

interface Caja { left: number; top: number; width: number; height: number }

/**
 * El punto de un toque en unidades del viewBox (`xSvg`, `ySvg`) y normalizado 0–1 (`x`, `y`, recortado a la
 * cancha más la banda de afuera). El SVG usa «meet»: sobran franjas en un eje, por eso la escala es la menor.
 */
export function puntoDesdeToque(caja: Caja, cancha: DatosDePizarra['cancha'], clientX: number, clientY: number) {
  const alto = altoDe(cancha) as number;
  const anchoVb = (W as number) + (MARGEN as number) * 2;
  const altoVb = alto + (MARGEN as number) * 2;
  const escala = Math.min(caja.width / anchoVb, caja.height / altoVb) || 1;
  const margenX = (caja.width - anchoVb * escala) / 2;
  const margenY = (caja.height - altoVb * escala) / 2;
  const xSvg = (clientX - caja.left - margenX) / escala - (MARGEN as number);
  const ySvg = (clientY - caja.top - margenY) / escala - (MARGEN as number);
  const l = limitesDe(cancha) as { minX: number; maxX: number; minY: number; maxY: number };
  return {
    xSvg,
    ySvg,
    x: Math.min(l.maxX, Math.max(l.minX, xSvg / (W as number))),
    y: Math.min(l.maxY, Math.max(l.minY, ySvg / alto)),
  };
}

/** La ficha más cercana al toque, dentro de un radio; null si ninguna entra. */
export function fichaEnPunto(
  datos: DatosDePizarra,
  posiciones: Map<string, { x: number; y: number }>,
  xSvg: number,
  ySvg: number,
  radio = R_FICHA * 1.6,
): string | null {
  const alto = altoDe(datos.cancha) as number;
  let mejor: string | null = null;
  let mejorDistancia = radio;
  for (const f of datos.fichas) {
    const p = posiciones.get(f.id) ?? f;
    const d = Math.hypot(p.x * (W as number) - xSvg, p.y * alto - ySvg);
    if (d <= mejorDistancia) {
      mejorDistancia = d;
      mejor = f.id;
    }
  }
  return mejor;
}
