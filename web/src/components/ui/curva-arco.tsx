import { useId, useLayoutEffect, useRef, useState } from 'react';
import { fechaCorta, type PuntoDeCurva } from '../../hoy/resumen';

// El dibujo se arma al ancho real de su tarjeta: así las letras y la línea miden siempre lo mismo
// (un lienzo fijo estirado a 1000 px agrandaba todo ×3 y la curva se veía «zoomeada»).
const ANCHO_INICIAL = 320; // hasta que se mide (y donde no hay medidas, como en las pruebas)
const ALTO = 210;
const IZQ = 40; // lugar para los porcentajes del eje
const DER = 18;
const ARRIBA = 38; // lugar para la etiqueta del punto elegido
const ABAJO = 26; // lugar para las fechas
const LETRA = 11;

/**
 * El eje no arranca en 0: se ajusta a lo medido, con aire arriba y abajo, y cada línea lleva su
 * porcentaje escrito. Así una mejora de 10 puntos se ve, y nadie la confunde con otra cosa.
 */
function escala(valores: number[]) {
  const bajo = Math.max(0, Math.floor((Math.min(...valores) - 6) / 10) * 10);
  let alto = Math.min(100, Math.ceil((Math.max(...valores) + 6) / 10) * 10);
  if (alto - bajo < 20) alto = Math.min(100, bajo + 20);
  const paso = alto - bajo > 40 ? 20 : 10;
  const marcas: number[] = [];
  for (let v = bajo; v <= alto; v += paso) marcas.push(v);
  return { bajo, alto, marcas };
}

/** Curva suave que pasa por cada punto sin pasarse nunca de largo (no inventa picos entre baterías). */
export function suave(p: { x: number; y: number }[]): string {
  if (p.length === 1) return `M${p[0].x},${p[0].y}`;
  const n = p.length;
  const d = p.slice(0, -1).map((a, i) => (p[i + 1].y - a.y) / (p[i + 1].x - a.x));
  const m = p.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  d.forEach((di, i) => {
    if (di === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      return;
    }
    const a = m[i] / di;
    const b = m[i + 1] / di;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * di;
      m[i + 1] = t * b * di;
    }
  });
  let camino = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (p[i + 1].x - p[i].x) / 3;
    camino += ` C${p[i].x + h},${p[i].y + m[i] * h} ${p[i + 1].x - h},${p[i + 1].y - m[i + 1] * h} ${p[i + 1].x},${p[i + 1].y}`;
  }
  return camino;
}

/**
 * Un punto por batería del arco completo, con el área debajo de la línea. Al pasar el mouse o tocar
 * una batería, su punto se agranda y muestra el porcentaje; al abrir muestra el de la última. Un
 * punto con pocos tiros va hueco. El resumen en texto va en la etiqueta, para quien no ve el dibujo.
 */
export function CurvaArco({ serie }: { serie: PuntoDeCurva[] }) {
  const id = useId();
  const dibujo = useRef<SVGSVGElement>(null);
  const [ancho, setAncho] = useState(ANCHO_INICIAL);
  useLayoutEffect(() => {
    const el = dibujo.current;
    if (!el) return;
    const medir = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setAncho(w);
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  const n = serie.length;
  const [elegido, setElegido] = useState(n - 1);
  const resumen = serie.map((p) => `${fechaCorta(p.fecha)}: ${p.valor.pct}%`).join(', ');
  const { bajo, alto, marcas } = escala(serie.map((p) => p.valor.pct));

  const x = (i: number) => (n === 1 ? (IZQ + ancho - DER) / 2 : IZQ + (i * (ancho - IZQ - DER)) / (n - 1));
  const y = (pct: number) => ARRIBA + ((alto - pct) / (alto - bajo)) * (ALTO - ARRIBA - ABAJO);
  const puntos = serie.map((p, i) => ({ x: x(i), y: y(p.valor.pct) }));
  const linea = n > 1 ? suave(puntos) : '';
  const piso = ALTO - ABAJO;
  const banda = n > 1 ? (ancho - IZQ - DER) / (n - 1) : ancho;
  const sel = serie[Math.min(elegido, n - 1)];
  const ps = puntos[Math.min(elegido, n - 1)];
  const conFecha = (i: number) => n <= 7 || i === 0 || i === n - 1;

  return (
    <svg
      ref={dibujo}
      role="img"
      aria-label={`Evolución del tiro de campo por batería. ${resumen}`}
      viewBox={`0 0 ${ancho} ${ALTO}`}
      height={ALTO}
      style={{ height: ALTO }}
      className="block w-full text-club-texto"
    >
      <defs>
        <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity={0.24} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>

      {marcas.map((v) => (
        <g key={v} aria-hidden>
          <line x1={IZQ} x2={ancho - DER} y1={y(v)} y2={y(v)} stroke="var(--tinta)" strokeOpacity={0.12} strokeDasharray="3 4" />
          <text x={IZQ - 6} y={y(v) + 4} textAnchor="end" fontSize={LETRA} fill="var(--gris)" className="font-mono">
            {v}%
          </text>
        </g>
      ))}

      {n > 1 && <path d={`${linea} L${puntos[n - 1].x},${piso} L${puntos[0].x},${piso} Z`} fill={`url(#${id}-area)`} />}
      {n > 1 && <path d={linea} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />}

      {serie.map((p, i) => (
        <g key={p.fecha + i} aria-hidden>
          {conFecha(i) && (
            <text x={puntos[i].x} y={ALTO - 6} textAnchor="middle" fontSize={LETRA} fill="var(--gris)" className="font-mono">
              {fechaCorta(p.fecha)}
            </text>
          )}
          <circle
            cx={puntos[i].x}
            cy={puntos[i].y}
            r={i === elegido ? 6 : 4}
            fill={p.valor.muestraChica ? 'var(--sup)' : 'currentColor'}
            stroke={i === elegido ? 'var(--sup)' : 'currentColor'}
            strokeWidth={i === elegido ? 2.5 : 1.5}
          />
        </g>
      ))}

      {/* La etiqueta del punto elegido: oscura, arriba del punto, sin taparlo. */}
      <g aria-hidden pointerEvents="none">
        <rect x={Math.min(Math.max(ps.x - 26, 0), ancho - 52)} y={ps.y - 34} width={52} height={24} rx={5} fill="var(--tinta)" />
        <text x={Math.min(Math.max(ps.x, 26), ancho - 26)} y={ps.y - 17} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--sup)" className="font-titulo">
          {sel.valor.pct}%
        </text>
      </g>

      {/* Zonas para elegir una batería con el mouse o el dedo: una franja por punto. */}
      {n > 1 &&
        puntos.map((p, i) => (
          <rect
            key={i}
            aria-hidden
            x={p.x - banda / 2}
            y={0}
            width={banda}
            height={ALTO}
            fill="transparent"
            onPointerEnter={() => setElegido(i)}
            onClick={() => setElegido(i)}
          />
        ))}
    </svg>
  );
}
