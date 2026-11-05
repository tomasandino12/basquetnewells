import { fechaCorta, type PuntoDeCurva } from '../../hoy/resumen';

const ANCHO = 300;
const ALTO = 84;
const LADO = 8;
const ARRIBA = 8;
const ABAJO = 8;

const x = (i: number, n: number) => LADO + (n === 1 ? (ANCHO - 2 * LADO) / 2 : (i * (ANCHO - 2 * LADO)) / (n - 1));
const y = (pct: number) => ARRIBA + ((100 - pct) / 100) * (ALTO - ARRIBA - ABAJO);

/**
 * Un punto por batería del arco completo, en escala fija de 0 a 100 %. Une los puntos observados
 * y nada más: sin línea de tendencia ni proyección. Con una sola batería es un punto sin línea
 * (una tendencia de un punto no existe). Un punto con pocos tiros va hueco.
 */
export function CurvaArco({ serie }: { serie: PuntoDeCurva[] }) {
  const n = serie.length;
  const resumen = serie.map((p) => `${fechaCorta(p.fecha)}: ${p.valor.pct}%`).join(', ');
  return (
    <svg role="img" aria-label={`Evolución del tiro de campo por batería. ${resumen}`} viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-20 w-full text-club-texto">
      <line x1={LADO} x2={ANCHO - LADO} y1={y(50)} y2={y(50)} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 4" />
      {n > 1 && (
        <polyline fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={serie.map((p, i) => `${x(i, n)},${y(p.valor.pct)}`).join(' ')} />
      )}
      {serie.map((p, i) => (
        <circle
          key={p.fecha + i}
          cx={x(i, n)}
          cy={y(p.valor.pct)}
          r={4}
          fill={p.valor.muestraChica ? 'var(--sup)' : 'currentColor'}
          stroke="currentColor"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
