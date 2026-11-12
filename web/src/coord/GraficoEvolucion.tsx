import { useId } from 'react';

export interface PuntoDeSerie {
  /** Porcentaje 0–100 o null si esa fecha no tiene dato de esta fuente (la línea se corta). */
  pct: number | null;
  muestraChica: boolean;
}

export interface SerieDelGrafico {
  nombre: string;
  puntos: PuntoDeSerie[];
  /** Los partidos van punteados: se distinguen de la batería sin depender del color. */
  punteada?: boolean;
  clase: string;
}

interface Props {
  fechas: string[];
  series: SerieDelGrafico[];
  /** Lo que lee el lector de pantalla en lugar del dibujo. */
  descripcion: string;
}

const ANCHO = 360;
const ALTO = 176;
const MARGEN = { arriba: 12, abajo: 22, izquierda: 30, derecha: 74 };

/**
 * Evolución de una categoría contra sí misma. El eje va SIEMPRE de 0 a 100: con una escala automática una
 * categoría que se movió 3 puntos se vería igual de dramática que una que se movió 20. Cada línea lleva su
 * nombre al final (no hay una leyenda aparte que obligue a mirar de un lado a otro). Un punto hueco es una
 * muestra chica («pocos datos»).
 */
export function GraficoEvolucion({ fechas, series, descripcion }: Props) {
  const id = useId();
  const utilW = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const utilH = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (i: number) => MARGEN.izquierda + (fechas.length <= 1 ? utilW / 2 : (i / (fechas.length - 1)) * utilW);
  const y = (pct: number) => MARGEN.arriba + utilH - (pct / 100) * utilH;
  const corta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  return (
    <svg role="img" aria-labelledby={id} viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-auto w-full">
      <title id={id}>{descripcion}</title>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(v)} y2={y(v)} className="stroke-linea" strokeWidth={1} />
          <text x={MARGEN.izquierda - 6} y={y(v) + 4} textAnchor="end" className="fill-gris font-mono" fontSize={10}>{v}</text>
        </g>
      ))}
      <text x={x(0)} y={ALTO - 6} textAnchor={fechas.length <= 1 ? 'middle' : 'start'} className="fill-gris font-mono" fontSize={10}>{corta(fechas[0])}</text>
      {fechas.length > 1 && (
        <text x={x(fechas.length - 1)} y={ALTO - 6} textAnchor="end" className="fill-gris font-mono" fontSize={10}>{corta(fechas[fechas.length - 1])}</text>
      )}
      {series.map((s) => {
        // La línea se corta donde falta el dato: unir dos puntos separados por un hueco inventaría una tendencia.
        const tramos: string[] = [];
        let actual = '';
        s.puntos.forEach((p, i) => {
          if (p.pct === null) {
            if (actual) tramos.push(actual);
            actual = '';
            return;
          }
          actual += `${actual ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.pct).toFixed(1)} `;
        });
        if (actual) tramos.push(actual);
        let ultimo = -1;
        s.puntos.forEach((p, i) => {
          if (p.pct !== null) ultimo = i;
        });
        return (
          <g key={s.nombre} className={s.clase}>
            {tramos.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.punteada ? '6 5' : undefined} />
            ))}
            {s.puntos.map((p, i) =>
              p.pct === null ? null : (
                <circle key={i} cx={x(i)} cy={y(p.pct)} r={4} stroke="currentColor" strokeWidth={2} className={p.muestraChica ? 'fill-sup' : 'fill-current'} />
              ),
            )}
            {ultimo >= 0 && (
              <text x={x(ultimo) + 9} y={y(s.puntos[ultimo].pct!) + 4} fontSize={12} fontWeight={700} fill="currentColor">{s.nombre}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
