import { useId, useState } from 'react';
import { Interruptores, type Interruptor } from './interruptores';

export interface CapaDeRadar extends Interruptor {
  /** Un valor 0–100 por eje; null = ese eje no se midió en esta capa. */
  valores: (number | null)[];
}

interface Props {
  ejes: { id: string; corto: string }[];
  capas: CapaDeRadar[];
  descripcion: string;
  etiquetaDeBotones?: string;
}

const LADO = 300;
const C = LADO / 2;
const R = 104;

/**
 * Un polígono por capa sobre los mismos ejes (por ejemplo, la primera batería contra la última): se ve
 * de un vistazo en qué zonas se agrandó la figura. El eje va siempre de 0 a 100. Un eje sin dato se
 * dibuja en el centro y no se inventa.
 */
export function Radar({ ejes, capas, descripcion, etiquetaDeBotones = 'Capas del polígono' }: Props) {
  const id = useId();
  const [prendidas, setPrendidas] = useState(capas.map((c) => c.id));
  const n = ejes.length;
  const angulo = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const punto = (i: number, v: number) => [C + Math.cos(angulo(i)) * (R * v) / 100, C + Math.sin(angulo(i)) * (R * v) / 100] as const;
  const anillo = (v: number) => ejes.map((_, i) => punto(i, v).join(',')).join(' ');
  const visibles = capas.filter((c) => prendidas.includes(c.id));

  return (
    <div>
      <Interruptores opciones={capas} prendidas={prendidas} alCambiar={setPrendidas} etiqueta={etiquetaDeBotones} />
      {/* Con margen a los costados: las etiquetas de las puntas no se cortan en el celular. */}
      <svg role="img" aria-labelledby={id} viewBox={`-52 0 ${LADO + 104} ${LADO}`} className="mx-auto block h-auto w-full max-w-[26rem]">
        <title id={id}>{descripcion}</title>
        {[25, 50, 75, 100].map((v) => (
          <polygon key={v} aria-hidden points={anillo(v)} fill={v === 100 ? 'var(--sup-2)' : 'none'} stroke="var(--tinta)" strokeOpacity={v === 100 ? 0.2 : 0.1} strokeDasharray={v === 100 ? undefined : '3 4'} />
        ))}
        {ejes.map((e, i) => {
          const [x, y] = punto(i, 100);
          const [lx, ly] = punto(i, 124);
          return (
            <g key={e.id} aria-hidden>
              <line x1={C} y1={C} x2={x} y2={y} stroke="var(--tinta)" strokeOpacity={0.1} />
              <text x={lx} y={ly + 4} textAnchor={Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end'} fontSize={11} fontWeight={600} fill="var(--gris)" className="font-mono">
                {e.corto}
              </text>
            </g>
          );
        })}
        <text aria-hidden x={C + 4} y={C - R / 2 + 3} fontSize={9} fill="var(--gris)" className="font-mono">50</text>
        {visibles.map((c, k) => (
          <g key={c.id} aria-hidden className="grafico-entra">
            <polygon
              points={c.valores.map((v, i) => punto(i, v ?? 0).join(',')).join(' ')}
              fill={c.color}
              fillOpacity={k === visibles.length - 1 ? 0.22 : 0.08}
              stroke={c.color}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeDasharray={c.punteada ? '6 5' : undefined}
            />
            {c.valores.map((v, i) => {
              if (v === null) return null;
              const [x, y] = punto(i, v);
              return <circle key={i} cx={x} cy={y} r={3.5} fill={c.color} />;
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
