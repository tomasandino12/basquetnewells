import { motion, useReducedMotion } from 'motion/react';
import type { Zona } from '../../hoy/resumen';

const SALIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Media cancha FIBA a 30 unidades por metro (14 m de ancho). La línea de fondo está abajo.
const M = 30;
const ANCHO = 14 * M; // 420
const ALTO = 300;
const ARO = { x: ANCHO / 2, y: ALTO - 1.575 * M }; // el centro del aro está a 1,575 m de la línea de fondo
const RADIO_TRIPLE = 6.75 * M;
const X_ESQUINA = 0.9 * M; // la recta del triple está a 0,90 m de la línea de lateral
const Y_QUIEBRE = ARO.y - Math.sqrt(RADIO_TRIPLE ** 2 - (ARO.x - X_ESQUINA) ** 2);
const MEDIA_PINTURA = (4.9 * M) / 2;
const Y_TIRO_LIBRE = ALTO - 5.8 * M;
const R_TIRO_LIBRE = 1.8 * M;

// Cada zona es el sector de cancha que ve el aro entre dos ángulos (0° a la derecha, 90° arriba).
// Cada marca va sobre el triple, en el ángulo de su zona; los sectores se recortan a la cancha.
const SECTORES: Record<string, { desde: number; hasta: number; marca: number }> = {
  esq_der: { desde: -90, hasta: 30, marca: 6.5 },
  c45_der: { desde: 30, hasta: 65, marca: 45 },
  frontal: { desde: 65, hasta: 115, marca: 90 },
  c45_izq: { desde: 115, hasta: 150, marca: 135 },
  esq_izq: { desde: 150, hasta: 270, marca: 173.5 },
};

const punto = (grados: number, radio: number) => {
  const a = (grados * Math.PI) / 180;
  return { x: ARO.x + radio * Math.cos(a), y: ARO.y - radio * Math.sin(a) };
};

function sector(desde: number, hasta: number) {
  const pts = [{ x: ARO.x, y: ARO.y }];
  for (let g = desde; g < hasta; g += 10) pts.push(punto(g, 900));
  pts.push(punto(hasta, 900));
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** Dónde va la marca de una zona: sobre el triple; las esquinas, sobre la recta. */
function marcaDe(id: string) {
  const s = SECTORES[id];
  if (id === 'esq_der') return { x: ANCHO - X_ESQUINA, y: ALTO - 68 };
  if (id === 'esq_izq') return { x: X_ESQUINA, y: ALTO - 68 };
  return punto(s.marca, RADIO_TRIPLE);
}

const LINEA = { stroke: 'var(--tinta)', strokeOpacity: 0.55, strokeWidth: 1.5, fill: 'none' } as const;

/**
 * Media cancha con las cinco zonas de tiro, con medidas reales. Cada zona se pinta de crema a
 * naranja intenso según su porcentaje relativo (la más floja es la más fuerte) y lleva su número
 * adentro, sobre una marca que tapa las líneas: ninguna línea cruza un número. Las zonas sin
 * medir quedan sin color. El detalle por zona está en la lista de al lado, para quien no ve el dibujo.
 */
export function CanchaCalor({ zonas }: { zonas: Zona[] }) {
  const reducido = useReducedMotion();
  const resumen = zonas.map((z) => `${z.nombre}: ${z.valor ? `${z.valor.pct}%` : 'sin medir'}`).join(', ');
  const orden = [...zonas].sort((a, b) => (b.calor ?? -1) - (a.calor ?? -1));

  return (
    <svg
      role="img"
      aria-label={`Cancha con el tiro por zona, de la más floja a la mejor. ${resumen}`}
      viewBox={`-20 0 ${ANCHO + 40} ${ALTO}`}
      className="w-full"
    >
      <defs>
        <clipPath id="cancha-recorte">
          <rect x={0} y={0} width={ANCHO} height={ALTO} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={ANCHO} height={ALTO} fill="var(--sup)" />
      <g clipPath="url(#cancha-recorte)">
        {zonas.map((z) => {
          const s = SECTORES[z.id];
          if (!s) return null;
          const i = orden.indexOf(z);
          return (
            <motion.polygon
              key={z.id}
              points={sector(s.desde, s.hasta)}
              fill={z.calor === null ? 'none' : `var(--calor-${z.calor})`}
              stroke="var(--sup)"
              strokeWidth={2}
              initial={reducido ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.28, ease: SALIDA, delay: 0.04 * i }}
            />
          );
        })}
      </g>
      {/* Líneas de la cancha, por encima del color. */}
      <rect x={0} y={0} width={ANCHO} height={ALTO} {...LINEA} />
      <rect x={ARO.x - MEDIA_PINTURA} y={Y_TIRO_LIBRE} width={MEDIA_PINTURA * 2} height={ALTO - Y_TIRO_LIBRE} {...LINEA} />
      <path d={`M${ARO.x - R_TIRO_LIBRE} ${Y_TIRO_LIBRE} A${R_TIRO_LIBRE} ${R_TIRO_LIBRE} 0 0 1 ${ARO.x + R_TIRO_LIBRE} ${Y_TIRO_LIBRE}`} {...LINEA} />
      <path
        d={`M${ARO.x - R_TIRO_LIBRE} ${Y_TIRO_LIBRE} A${R_TIRO_LIBRE} ${R_TIRO_LIBRE} 0 0 0 ${ARO.x + R_TIRO_LIBRE} ${Y_TIRO_LIBRE}`}
        {...LINEA}
        strokeDasharray="4 4"
      />
      <path d={`M${X_ESQUINA} ${ALTO} V${Y_QUIEBRE} A${RADIO_TRIPLE} ${RADIO_TRIPLE} 0 0 1 ${ANCHO - X_ESQUINA} ${Y_QUIEBRE} V${ALTO}`} {...LINEA} />
      <path d={`M${ARO.x - 1.25 * M} ${ALTO - 1.2 * M} V${ARO.y} A${1.25 * M} ${1.25 * M} 0 0 1 ${ARO.x + 1.25 * M} ${ARO.y} V${ALTO - 1.2 * M}`} {...LINEA} />
      <line x1={ARO.x - 0.9 * M} x2={ARO.x + 0.9 * M} y1={ALTO - 1.2 * M} y2={ALTO - 1.2 * M} {...LINEA} strokeWidth={2.5} />
      <circle cx={ARO.x} cy={ARO.y} r={0.225 * M} {...LINEA} strokeWidth={2} />

      {/* Los números, encima de todo y sobre una marca que tapa lo que haya debajo. */}
      {zonas.map((z) => {
        if (!SECTORES[z.id]) return null;
        const { x, y } = marcaDe(z.id);
        const n = z.calor ?? 0;
        return (
          <g key={z.id} aria-hidden>
            <rect
              x={x - 31}
              y={y - 19}
              width={62}
              height={38}
              rx={9}
              fill={z.calor === null ? 'var(--sup)' : `var(--calor-${n})`}
              stroke="var(--sup)"
              strokeWidth={3}
              paintOrder="stroke"
            />
            <rect x={x - 31} y={y - 19} width={62} height={38} rx={9} fill="none" stroke="var(--tinta)" strokeOpacity={0.35} strokeWidth={1} />
            <text x={x} y={z.valor ? y + 1 : y + 5} textAnchor="middle" fontSize={z.valor ? 19 : 11} fontWeight={700} className="font-titulo" fill={z.calor === null ? 'var(--gris)' : `var(--calor-t-${n})`}>
              {z.valor ? `${z.valor.pct}%` : 'sin medir'}
            </text>
            {z.valor && (
              <text x={x} y={y + 14} textAnchor="middle" fontSize={9.5} className="font-mono" fill={`var(--calor-t-${n})`}>
                {z.valor.anotados}/{z.valor.intentos}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
