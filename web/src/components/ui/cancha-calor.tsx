import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import type { Zona } from '../../hoy/resumen';

const SALIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Media cancha a 30 unidades por metro, con la línea de fondo abajo. Las medidas son las FIBA salvo
// la recta del triple, que se dibuja más adentro (1,8 m y no 0,9 m) para que la esquina tenga lugar
// para su número: el dibujo es para leer, no un plano.
const M = 30;
const ANCHO = 14 * M; // 420
const ALTO = 340;
const ARO = { x: ANCHO / 2, y: ALTO - 1.575 * M };
const RADIO_TRIPLE = 6.75 * M;
const X_ESQUINA = 1.8 * M;
const Y_QUIEBRE = ARO.y - Math.sqrt(RADIO_TRIPLE ** 2 - (ARO.x - X_ESQUINA) ** 2);
const MEDIA_PINTURA = (4.9 * M) / 2;
const Y_TIRO_LIBRE = ALTO - 5.8 * M;
const R_TIRO_LIBRE = 1.8 * M;

/** Dónde corta a la altura `y` la recta que sale del aro con ese ángulo (90° es derecho para arriba). */
const rayo = (grados: number, y: number) => ARO.x + (ARO.y - y) / Math.tan((grados * Math.PI) / 180);
const pts = (lista: [number, number][]) => lista.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// Cada zona es un polígono que después se recorta a lo que queda afuera del triple: el color nunca
// pisa la cancha de adentro. Las esquinas son la franja entre la lateral y la recta del triple.
const ZONAS: Record<string, { forma: string; marca: { x: number; y: number }; corto: string }> = {
  esq_izq: { forma: pts([[0, Y_QUIEBRE], [X_ESQUINA, Y_QUIEBRE], [X_ESQUINA, ALTO], [0, ALTO]]), marca: { x: X_ESQUINA / 2, y: ALTO - 70 }, corto: 'Esq. izq.' },
  c45_izq: { forma: pts([[0, 0], [rayo(115, 0), 0], [rayo(115, Y_QUIEBRE), Y_QUIEBRE], [0, Y_QUIEBRE]]), marca: { x: 60, y: 92 }, corto: '45° izq.' },
  frontal: { forma: pts([[rayo(115, 0), 0], [rayo(65, 0), 0], [ARO.x, ARO.y]]), marca: { x: ARO.x, y: 40 }, corto: 'Frontal' },
  c45_der: { forma: pts([[rayo(65, 0), 0], [ANCHO, 0], [ANCHO, Y_QUIEBRE], [rayo(65, Y_QUIEBRE), Y_QUIEBRE]]), marca: { x: ANCHO - 60, y: 92 }, corto: '45° der.' },
  esq_der: { forma: pts([[ANCHO - X_ESQUINA, Y_QUIEBRE], [ANCHO, Y_QUIEBRE], [ANCHO, ALTO], [ANCHO - X_ESQUINA, ALTO]]), marca: { x: ANCHO - X_ESQUINA / 2, y: ALTO - 70 }, corto: 'Esq. der.' },
};

const ADENTRO_DEL_TRIPLE = `M${X_ESQUINA} ${ALTO} V${Y_QUIEBRE} A${RADIO_TRIPLE} ${RADIO_TRIPLE} 0 0 1 ${ANCHO - X_ESQUINA} ${Y_QUIEBRE} V${ALTO} Z`;
const SEMICIRCULO_LIBRES = `M${ARO.x - R_TIRO_LIBRE} ${Y_TIRO_LIBRE} A${R_TIRO_LIBRE} ${R_TIRO_LIBRE} 0 0 1 ${ARO.x + R_TIRO_LIBRE} ${Y_TIRO_LIBRE} Z`;

const LINEA = { stroke: 'var(--tinta)', strokeOpacity: 0.45, strokeWidth: 1.5, fill: 'none' } as const;

/** El número de una zona escrito directo sobre su color: nombre, porcentaje y tiros. */
function Marca({ x, y, corto, zona, fondo, texto, angosta }: { x: number; y: number; corto: string; zona: Zona; fondo: boolean; texto: string; angosta?: boolean }) {
  return (
    <g aria-hidden fill={fondo ? texto : 'var(--gris)'} textAnchor="middle">
      <text x={x} y={y - 16} fontSize={angosta ? 7.5 : 9} letterSpacing={0.6} className="font-mono uppercase" opacity={0.85}>
        {corto}
      </text>
      <text x={x} y={y + 6} fontSize={zona.valor ? (angosta ? 17 : 24) : 10} fontWeight={700} className="font-titulo">
        {zona.valor ? `${zona.valor.pct}%` : 'sin medir'}
      </text>
      {zona.valor && (
        <text x={x} y={y + 19} fontSize={angosta ? 8 : 9.5} className="font-mono">
          {zona.valor.anotados}/{zona.valor.intentos}
        </text>
      )}
    </g>
  );
}

/**
 * Media cancha con las cinco zonas del triple pintadas sólo afuera de la línea, de crema a naranja
 * intenso según su porcentaje relativo (la más floja es la más fuerte), y los tiros libres en su
 * semicírculo, en la misma escala. Las zonas sin medir quedan sin color. El detalle está en la
 * lista de al lado, para quien no ve el dibujo.
 */
export function CanchaCalor({ zonas, libres }: { zonas: Zona[]; libres?: Zona }) {
  const reducido = useReducedMotion();
  const id = useId();
  const resumen = zonas.map((z) => `${z.nombre}: ${z.valor ? `${z.valor.pct}%` : 'sin medir'}`).join(', ');
  const deLibres = libres ? `. Tiros libres, aparte: ${libres.valor ? `${libres.valor.pct}%` : 'sin medir'}` : '';
  const orden = [...zonas].sort((a, b) => (b.calor ?? -1) - (a.calor ?? -1));

  return (
    <svg
      role="img"
      aria-label={`Cancha con el tiro por zona, de la más floja a la mejor. ${resumen}${deLibres}`}
      viewBox={`-2 -2 ${ANCHO + 4} ${ALTO + 4}`}
      className="w-full"
    >
      <defs>
        {/* Toda la cancha menos lo de adentro del triple. */}
        <clipPath id={`${id}-afuera`}>
          <path clipRule="evenodd" d={`M0 0 H${ANCHO} V${ALTO} H0 Z ${ADENTRO_DEL_TRIPLE}`} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={ANCHO} height={ALTO} fill="var(--sup)" />
      <g clipPath={`url(#${id}-afuera)`}>
        {zonas.map((z) => {
          const forma = ZONAS[z.id];
          if (!forma) return null;
          return (
            <motion.polygon
              key={z.id}
              points={forma.forma}
              fill={z.calor === null ? 'none' : `var(--calor-${z.calor})`}
              stroke="var(--sup)"
              strokeWidth={3}
              initial={reducido ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.28, ease: SALIDA, delay: 0.04 * orden.indexOf(z) }}
            />
          );
        })}
      </g>
      {libres?.valor && (
        <motion.path
          d={SEMICIRCULO_LIBRES}
          fill={libres.calor === null ? 'none' : `var(--calor-${libres.calor})`}
          stroke="var(--sup)"
          strokeWidth={3}
          initial={reducido ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: SALIDA, delay: 0.24 }}
        />
      )}

      {/* Líneas de la cancha, por encima del color. */}
      <rect x={0} y={0} width={ANCHO} height={ALTO} {...LINEA} />
      <rect x={ARO.x - MEDIA_PINTURA} y={Y_TIRO_LIBRE} width={MEDIA_PINTURA * 2} height={ALTO - Y_TIRO_LIBRE} {...LINEA} />
      <path d={`M${ARO.x - R_TIRO_LIBRE} ${Y_TIRO_LIBRE} A${R_TIRO_LIBRE} ${R_TIRO_LIBRE} 0 0 1 ${ARO.x + R_TIRO_LIBRE} ${Y_TIRO_LIBRE}`} {...LINEA} />
      <path
        d={`M${ARO.x - R_TIRO_LIBRE} ${Y_TIRO_LIBRE} A${R_TIRO_LIBRE} ${R_TIRO_LIBRE} 0 0 0 ${ARO.x + R_TIRO_LIBRE} ${Y_TIRO_LIBRE}`}
        {...LINEA}
        strokeDasharray="4 4"
      />
      <path d={`M${X_ESQUINA} ${ALTO} V${Y_QUIEBRE} A${RADIO_TRIPLE} ${RADIO_TRIPLE} 0 0 1 ${ANCHO - X_ESQUINA} ${Y_QUIEBRE} V${ALTO}`} {...LINEA} strokeOpacity={0.7} strokeWidth={2} />
      <path d={`M${ARO.x - 1.25 * M} ${ALTO - 1.2 * M} V${ARO.y} A${1.25 * M} ${1.25 * M} 0 0 1 ${ARO.x + 1.25 * M} ${ARO.y} V${ALTO - 1.2 * M}`} {...LINEA} />
      <line x1={ARO.x - 0.9 * M} x2={ARO.x + 0.9 * M} y1={ALTO - 1.2 * M} y2={ALTO - 1.2 * M} {...LINEA} strokeWidth={2.5} />
      <circle cx={ARO.x} cy={ARO.y} r={0.225 * M} {...LINEA} strokeWidth={2} />

      {zonas.map((z) => {
        const forma = ZONAS[z.id];
        if (!forma) return null;
        return (
          <Marca
            key={z.id}
            {...forma.marca}
            corto={forma.corto}
            zona={z}
            fondo={z.calor !== null}
            texto={`var(--calor-t-${z.calor ?? 0})`}
            angosta={z.id.startsWith('esq')}
          />
        );
      })}
      {libres && <Marca x={ARO.x} y={Y_TIRO_LIBRE - 24} corto="Libres" zona={libres} fondo={libres.calor !== null} texto={`var(--calor-t-${libres.calor ?? 0})`} />}
    </svg>
  );
}
