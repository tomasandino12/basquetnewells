import { useId } from 'react';

interface Props {
  /** Fechas ISO (YYYY-MM-DD), de la más vieja a la más nueva. */
  fechas: string[];
  valores: number[];
  /** Cómo se escribe un valor en el eje y en el último punto: «12,5 s», «+8%». */
  formato: (valor: number) => string;
  /** Lo que lee el lector de pantalla en lugar del dibujo. */
  descripcion: string;
}

const ANCHO = 360;
const ALTO = 150;
const M = { arriba: 14, abajo: 22, izquierda: 52, derecha: 16 };

/**
 * Una línea que une los puntos observados y nada más: sin tendencia ni «mejora» (lo lee el profe).
 * El eje se ajusta a lo medido, con aire arriba y abajo, y escribe el mínimo y el máximo. Con un solo
 * punto no hay línea: se dibuja el punto.
 */
export function GraficoDeSerie({ fechas, valores, formato, descripcion }: Props) {
  const id = useId();
  const n = valores.length;
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  // Todos iguales: se abre el eje para que la línea quede en el medio y no pegada al borde.
  const aire = maximo === minimo ? Math.max(Math.abs(maximo) * 0.05, 1) : (maximo - minimo) * 0.15;
  const bajo = minimo - aire;
  const alto = maximo + aire;
  const utilW = ANCHO - M.izquierda - M.derecha;
  const utilH = ALTO - M.arriba - M.abajo;
  const x = (i: number) => M.izquierda + (n <= 1 ? utilW / 2 : (i / (n - 1)) * utilW);
  const y = (v: number) => M.arriba + utilH - ((v - bajo) / (alto - bajo)) * utilH;
  const corta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const linea = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  return (
    <svg role="img" aria-labelledby={id} viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-auto w-full text-club-texto">
      <title id={id}>{descripcion}</title>
      {[maximo, minimo].filter((v, i, todos) => todos.indexOf(v) === i).map((v) => (
        <g key={v} aria-hidden>
          <line x1={M.izquierda} x2={ANCHO - M.derecha} y1={y(v)} y2={y(v)} className="stroke-linea" strokeDasharray="3 4" />
          <text x={M.izquierda - 6} y={y(v) + 4} textAnchor="end" className="fill-gris font-mono" fontSize={10}>{formato(v)}</text>
        </g>
      ))}
      <text x={x(0)} y={ALTO - 6} textAnchor={n <= 1 ? 'middle' : 'start'} className="fill-gris font-mono" fontSize={10}>{corta(fechas[0])}</text>
      {n > 1 && <text x={x(n - 1)} y={ALTO - 6} textAnchor="end" className="fill-gris font-mono" fontSize={10}>{corta(fechas[n - 1])}</text>}
      {n > 1 && <path d={linea} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {valores.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 5 : 3.5} fill="currentColor" />
      ))}
    </svg>
  );
}
