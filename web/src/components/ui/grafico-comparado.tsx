import { useId, useLayoutEffect, useRef, useState } from 'react';
import { suave } from './curva-arco';
import { Interruptores, type Interruptor } from './interruptores';

export interface SerieComparada extends Interruptor {
  /** Un valor por fecha; null = esa fecha no tiene dato de esta línea (la línea se corta ahí). */
  valores: (number | null)[];
  /** Los puntos con pocos datos se dibujan huecos. */
  huecos?: boolean[];
}

interface Props {
  /** Fechas ISO (YYYY-MM-DD), de la más vieja a la más nueva. */
  fechas: string[];
  series: SerieComparada[];
  /** Lo que lee el lector de pantalla en lugar del dibujo. */
  descripcion: string;
  formato?: (v: number) => string;
  /** Porcentajes: el eje nunca sale de 0–100 y se escribe con «%». */
  porcentaje?: boolean;
  /** Las que arrancan prendidas (por defecto, todas). */
  inicial?: string[];
  etiquetaDeBotones?: string;
}

const ALTO = 220;
const IZQ = 44;
const DER = 16;
const ARRIBA = 14;
const ABAJO = 26;
const LETRA = 11;

const corta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function useAncho<T extends Element>(inicial: number) {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(inicial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setAncho(w);
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return [ref, ancho] as const;
}

function escala(valores: number[], porcentaje: boolean) {
  if (valores.length === 0) return { bajo: 0, alto: 100, marcas: [0, 50, 100] };
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  if (porcentaje) {
    const bajo = Math.max(0, Math.floor((min - 6) / 10) * 10);
    let alto = Math.min(100, Math.ceil((max + 6) / 10) * 10);
    if (alto - bajo < 20) alto = Math.min(100, bajo + 20);
    const paso = alto - bajo > 40 ? 20 : 10;
    const marcas: number[] = [];
    for (let v = bajo; v <= alto; v += paso) marcas.push(v);
    return { bajo, alto, marcas };
  }
  const aire = max === min ? Math.max(Math.abs(max) * 0.05, 1) : (max - min) * 0.18;
  return { bajo: min - aire, alto: max + aire, marcas: max === min ? [max] : [min, max] };
}

/**
 * Varias líneas sobre las mismas fechas, cada una con su botón para prenderla o apagarla. Curvas suaves
 * que pasan por cada punto sin inventar picos; con una o dos líneas prendidas llevan el área debajo
 * (como la curva de Hoy). Al pasar el mouse o tocar una fecha se ven los valores de todas las prendidas.
 * Une los puntos observados y nada más: la tendencia la lee el profe.
 */
export function GraficoComparado({
  fechas, series, descripcion, formato, porcentaje = false, inicial, etiquetaDeBotones = 'Líneas del gráfico',
}: Props) {
  const id = useId();
  const [caja, ancho] = useAncho<HTMLDivElement>(320);
  const [prendidas, setPrendidas] = useState<string[]>(inicial ?? series.map((s) => s.id));
  const n = fechas.length;
  const [elegido, setElegido] = useState(n - 1);
  const fmt = formato ?? ((v: number) => (porcentaje ? `${v}%` : String(v)));

  const visibles = series.filter((s) => prendidas.includes(s.id));
  const todos = visibles.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  const { bajo, alto, marcas } = escala(todos, porcentaje);
  const x = (i: number) => (n <= 1 ? (IZQ + ancho - DER) / 2 : IZQ + (i * (ancho - IZQ - DER)) / (n - 1));
  const y = (v: number) => ARRIBA + ((alto - v) / (alto - bajo || 1)) * (ALTO - ARRIBA - ABAJO);
  const piso = ALTO - ABAJO;
  const banda = n > 1 ? (ancho - IZQ - DER) / (n - 1) : ancho;
  const conArea = visibles.length <= 2;
  const conFecha = (i: number) => {
    // Una fecha cada ~64 px; la del medio nunca pegada a la última (se pisaban en el celular).
    const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((ancho - IZQ - DER) / 64))));
    return i === 0 || i === n - 1 || (i % cada === 0 && n - 1 - i >= cada);
  };
  const sel = Math.min(Math.max(elegido, 0), n - 1);
  const enSel = visibles.map((s) => ({ s, v: s.valores[sel] })).filter((e) => e.v !== null) as { s: SerieComparada; v: number }[];

  return (
    <div>
      <Interruptores opciones={series} prendidas={prendidas} alCambiar={setPrendidas} etiqueta={etiquetaDeBotones} />
      {/* La lectura de la fecha elegida (al abrir, la última): arriba, para no tapar ninguna línea. */}
      {n > 0 && (
        <p aria-hidden className="mb-1 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="rounded bg-negro px-1.5 py-0.5 font-mono text-xs text-sobre-negro">{corta(fechas[sel])}</span>
          {enSel.map(({ s, v }) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-gris">{s.nombre}</span>
              <span className="cifra font-titulo text-lg leading-none font-bold">{fmt(v)}</span>
            </span>
          ))}
          {enSel.length === 0 && <span className="text-gris">sin datos ese día</span>}
        </p>
      )}
      <div ref={caja} className="relative">
        <svg role="img" aria-labelledby={id} viewBox={`0 0 ${ancho} ${ALTO}`} height={ALTO} style={{ height: ALTO }} className="block w-full">
          <title id={id}>{descripcion}</title>
          <defs>
            {visibles.map((s) => (
              <linearGradient key={s.id} id={`${id}-${s.id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity={visibles.length === 1 ? 0.26 : 0.15} />
                <stop offset="1" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {marcas.map((v) => (
            <g key={v} aria-hidden>
              <line x1={IZQ} x2={ancho - DER} y1={y(v)} y2={y(v)} stroke="var(--tinta)" strokeOpacity={0.12} strokeDasharray="3 4" />
              <text x={IZQ - 6} y={y(v) + 4} textAnchor="end" fontSize={LETRA} fill="var(--gris)" className="font-mono">{fmt(v)}</text>
            </g>
          ))}
          {fechas.map((f, i) =>
            conFecha(i) ? (
              <text key={f + i} aria-hidden x={x(i)} y={ALTO - 6} textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={LETRA} fill="var(--gris)" className="font-mono">
                {corta(f)}
              </text>
            ) : null,
          )}

          {n > 1 && <line aria-hidden x1={x(sel)} x2={x(sel)} y1={ARRIBA} y2={piso} stroke="var(--tinta)" strokeOpacity={0.25} />}

          {visibles.map((s) => {
            // Tramos sin huecos: unir dos puntos separados por una fecha sin dato inventaría una tendencia.
            const tramos: { x: number; y: number }[][] = [];
            let actual: { x: number; y: number }[] = [];
            s.valores.forEach((v, i) => {
              if (v === null) {
                if (actual.length) tramos.push(actual);
                actual = [];
              } else actual.push({ x: x(i), y: y(v) });
            });
            if (actual.length) tramos.push(actual);
            return (
              <g key={s.id} aria-hidden className="grafico-entra">
                {tramos.map((t, k) => (
                  <g key={k}>
                    {conArea && t.length > 1 && (
                      <path d={`${suave(t)} L${t[t.length - 1].x},${piso} L${t[0].x},${piso} Z`} fill={`url(#${id}-${s.id})`} />
                    )}
                    {t.length > 1 && (
                      <path d={suave(t)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={s.punteada ? '6 5' : undefined} />
                    )}
                  </g>
                ))}
                {s.valores.map((v, i) =>
                  v === null ? null : (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={i === sel ? 5.5 : 3.5}
                      fill={s.huecos?.[i] ? 'var(--sup)' : s.color}
                      stroke={i === sel ? 'var(--sup)' : s.color}
                      strokeWidth={i === sel ? 2.5 : 1.5}
                    />
                  ),
                )}
              </g>
            );
          })}

          {n > 1 &&
            fechas.map((f, i) => (
              <rect key={f + i} aria-hidden x={x(i) - banda / 2} y={0} width={banda} height={ALTO} fill="transparent" onPointerEnter={() => setElegido(i)} onClick={() => setElegido(i)} />
            ))}
        </svg>

      </div>
    </div>
  );
}
