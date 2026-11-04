import { motion } from 'motion/react';
import type { ZonaDeTiro } from '../../plantel/filas';

const SALIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];
const ANCHO = 300;
const ALTO = 130;
const IZQ = 30;
const DER = 12;
const ARRIBA = 10;
const ABAJO = 24;

const x = (i: number, n: number) => IZQ + (n === 1 ? 0 : (i * (ANCHO - IZQ - DER)) / (n - 1));
const y = (pct: number) => ARRIBA + ((100 - pct) / 100) * (ALTO - ARRIBA - ABAJO);

/**
 * Porcentaje de tiro por zona de la cancha, con escala de 0 a 100 %. Una zona sin dato corta la
 * línea: no se dibuja como un cero. Pensada para ir sobre el rojo oscuro del club.
 */
export function TiroCurva({ zonas }: { zonas: ZonaDeTiro[] }) {
  const tramos: { x: number; y: number }[][] = [[]];
  zonas.forEach((z, i) => {
    if (z.pct === null) tramos.push([]);
    else tramos[tramos.length - 1].push({ x: x(i, zonas.length), y: y(z.pct) });
  });
  const resumen = zonas.map((z) => `${z.corto}: ${z.pct === null ? 'sin dato' : `${z.pct}%`}`).join(', ');

  return (
    <svg role="img" aria-label={`Curva de tiro por zona. ${resumen}`} viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={IZQ} x2={ANCHO - DER} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.6 : 0.25} strokeDasharray={v === 0 ? undefined : '3 4'} />
          <text x={IZQ - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity={0.8} className="font-mono">
            {v}%
          </text>
        </g>
      ))}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: SALIDA, delay: 0.1 }}>
        {tramos
          .filter((t) => t.length > 1)
          .map((t, i) => (
            <polyline key={i} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={t.map((p) => `${p.x},${p.y}`).join(' ')} />
          ))}
        {zonas.map((z, i) =>
          z.pct === null ? null : <circle key={z.id} cx={x(i, zonas.length)} cy={y(z.pct)} r={3.5} fill="currentColor" />,
        )}
      </motion.g>
      {zonas.map((z, i) => (
        <text key={z.id} x={x(i, zonas.length)} y={ALTO - 8} textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity={0.85} className="font-mono">
          {z.corto}
        </text>
      ))}
    </svg>
  );
}
