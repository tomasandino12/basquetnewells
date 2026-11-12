import { ChevronLeft, ChevronRight, Play, Square } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { estadoAlInicioDelPaso } from '@datos/jugadas.js';
import { DURACION_PASO_MS, AROS, direccionFinal, estadoEn, trazoSvg } from '@datos/animacionJugada.js';
import { MARGEN, W, altoDe, formasDeUnExtremo } from '@datos/geometriaCancha.js';
import type { AccionDePizarra, DatosDePizarra, FichaDePizarra } from '../../datos/repositorio';
import { cn } from '../../lib/cn';

type Punto = { x: number; y: number };
interface Estado {
  posiciones: Map<string, Punto>;
  /** Cada pelota ya resuelta a un punto (suelta en el aro, o donde está su dueño). */
  pelotas: Punto[];
}

const R_FICHA = 12;
const LARGO_T = 9;
const ACCIONES_DE_PUNTA = ['corte', 'rotacion'];

/** Los colores salen de los tokens de la app: así la pizarra cambia de tono con el tema (nunca negra sobre claro). */
const TRAZO: Record<string, { color: string; punteado?: string; ancho?: number }> = {
  corte: { color: 'var(--tinta)' },
  dribbling: { color: 'var(--tinta)' },
  pase: { color: 'var(--club-texto)', punteado: '5 4' },
  cortina: { color: 'var(--tinta)', ancho: 3 },
  tiro: { color: 'var(--baja)', punteado: '2 3' },
  handoff: { color: 'var(--club-texto)', punteado: '5 4' },
  rebote: { color: 'var(--baja)', punteado: '1 4' },
  rotacion: { color: 'var(--gris)', punteado: '6 4' },
};

/** Un `d` de trazoSvg (coordenadas 0–1) llevado a píxeles de la cancha. */
function escalar(d: string, alto: number): string {
  let esX = true;
  return d
    .split(/\s+/)
    .map((tok) => {
      if (/^[A-Za-z]$/.test(tok)) return tok;
      const n = Number(tok) * (esX ? W : alto);
      esX = !esX;
      return n.toFixed(2);
    })
    .join(' ');
}

function triangulo(cx: number, cy: number, r: number): string {
  const bajada = r * 0.3;
  return [[cx, cy - r - bajada], [cx - r, cy + r - bajada], [cx + r, cy + r - bajada]].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function MitadDeCancha() {
  const { zona, circuloLibres, triple, aro, tablero } = formasDeUnExtremo();
  const { rectaIzq, rectaDer, arco } = triple;
  const linea = { stroke: 'var(--borde-control)', strokeWidth: 1.5, fill: 'none' } as const;
  return (
    <g>
      <rect x={zona.x} y={zona.y} width={zona.ancho} height={zona.alto} {...linea} />
      <circle cx={circuloLibres.cx} cy={circuloLibres.cy} r={circuloLibres.r} {...linea} />
      <line x1={rectaIzq.x} y1={rectaIzq.y1} x2={rectaIzq.x} y2={rectaIzq.y2} {...linea} />
      <line x1={rectaDer.x} y1={rectaDer.y1} x2={rectaDer.x} y2={rectaDer.y2} {...linea} />
      <path d={`M ${rectaIzq.x} ${rectaIzq.y2} A ${arco.r} ${arco.r} 0 0 0 ${rectaDer.x} ${rectaDer.y2}`} {...linea} />
      <circle cx={aro.cx} cy={aro.cy} r={aro.r} stroke="var(--quemado)" strokeWidth={2} fill="none" />
      <line x1={tablero.x1} y1={tablero.y} x2={tablero.x2} y2={tablero.y} stroke="var(--tinta)" strokeWidth={2.5} />
    </g>
  );
}

function Cancha({ cancha }: { cancha: 'media' | 'entera' }) {
  const alto = altoDe(cancha);
  const { circuloCentral } = formasDeUnExtremo();
  const linea = { stroke: 'var(--borde-control)', strokeWidth: 1.5, fill: 'none' } as const;
  return (
    <>
      <rect x={-MARGEN} y={-MARGEN} width={W + MARGEN * 2} height={alto + MARGEN * 2} fill="var(--sup-2)" />
      <rect x={0} y={0} width={W} height={alto} fill="var(--sup)" />
      <rect x={1} y={1} width={W - 2} height={alto - 2} {...linea} />
      <MitadDeCancha />
      {cancha === 'entera' ? (
        <>
          <g transform={`translate(0,${alto}) scale(1,-1)`}>
            <MitadDeCancha />
          </g>
          <line x1={0} y1={alto / 2} x2={W} y2={alto / 2} {...linea} />
          <circle cx={W / 2} cy={alto / 2} r={circuloCentral.r} {...linea} />
        </>
      ) : (
        <path d={`M ${W / 2 - circuloCentral.r} ${alto} A ${circuloCentral.r} ${circuloCentral.r} 0 0 1 ${W / 2 + circuloCentral.r} ${alto}`} {...linea} />
      )}
    </>
  );
}

function Ficha({ ficha, p, alto, nosotrosDefiende }: { ficha: FichaDePizarra; p: Punto; alto: number; nosotrosDefiende: boolean }) {
  const x = p.x * W;
  const y = p.y * alto;
  const base = { x: ficha.x * W, y: ficha.y * alto };
  if (ficha.tipo === 'fila') {
    const salio = Math.hypot(x - base.x, y - base.y) > 2;
    const enFila = (ficha.cantidad ?? 0) - (salio ? 1 : 0);
    return (
      <g data-ficha={ficha.id}>
        {Array.from({ length: Math.min(enFila, 4) }, (_, i) => 3 - i)
          .filter((i) => i < enFila)
          .map((i) => (
            <circle key={i} cx={base.x} cy={base.y + i * 8} r={R_FICHA} fill="var(--club)" stroke="var(--sup)" strokeWidth={1.5} />
          ))}
        <text x={base.x + R_FICHA + 4} y={base.y + 4} fontSize={11} fontWeight={700} fill="var(--tinta)">
          ×{enFila}
        </text>
        {salio && <circle cx={x} cy={y} r={R_FICHA} fill="var(--club)" stroke="var(--sup)" strokeWidth={1.5} />}
      </g>
    );
  }
  if (ficha.tipo === 'entrenador') {
    const lado = R_FICHA * 1.8;
    return (
      <g data-ficha={ficha.id}>
        <rect x={x - lado / 2} y={y - lado / 2} width={lado} height={lado} rx={4} fill="var(--gris)" />
        <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--sup)">E</text>
      </g>
    );
  }
  if (ficha.tipo === 'cono') {
    return <polygon data-ficha={ficha.id} points={triangulo(x, y, R_FICHA * 0.6)} fill="var(--ambar)" stroke="var(--tinta)" strokeWidth={1} />;
  }
  const esNuestra = nosotrosDefiende ? ficha.tipo === 'defensa' : ficha.tipo === 'ataque';
  // Nosotros en el rojo del club; el rival en tinta: se leen por forma (círculo o triángulo) y por tono.
  const relleno = esNuestra ? 'var(--club)' : 'var(--tinta)';
  const textoSobre = esNuestra ? 'var(--sobre-club)' : 'var(--fondo)';
  if (ficha.tipo === 'defensa') {
    return (
      <g data-ficha={ficha.id}>
        <polygon points={triangulo(x, y, R_FICHA + 2)} fill={relleno} stroke="var(--sup)" strokeWidth={1.5} />
        {ficha.numero != null && <text x={x} y={y + 5} textAnchor="middle" fontSize={12} fontWeight={700} fill={textoSobre}>{ficha.numero}</text>}
      </g>
    );
  }
  return (
    <g data-ficha={ficha.id}>
      <circle cx={x} cy={y} r={R_FICHA} fill={relleno} stroke="var(--sup)" strokeWidth={1.5} />
      {ficha.numero != null && <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={textoSobre}>{ficha.numero}</text>}
    </g>
  );
}

/** El trazo de una acción del paso, con su flecha (corte) o su T (cortina). */
function Trazo({ a, inicio, cancha, alto, idFlecha }: { a: AccionDePizarra; inicio: Estado; cancha: 'media' | 'entera'; alto: number; idFlecha: string }) {
  if (a.tipo === 'ajuste') return null;
  const aro = (AROS as Record<string, Punto>)[cancha] ?? AROS.media;
  const desde = a.tipo === 'rebote' ? aro : inicio.posiciones.get(a.ficha);
  const hasta =
    a.tipo === 'tiro' ? aro
    : a.tipo === 'rebote' ? inicio.posiciones.get(a.ficha)
    : a.tipo === 'pase' || a.tipo === 'handoff' ? inicio.posiciones.get(a.a ?? '')
    : a.hasta;
  if (!desde || !hasta) return null;
  const estilo = TRAZO[a.tipo] ?? TRAZO.corte;
  const d = escalar(trazoSvg(desde, hasta, a.control ?? null, a.tipo), alto);
  let cortina = null;
  if (a.tipo === 'cortina') {
    const { dx, dy } = direccionFinal(desde, hasta, a.control ?? null);
    const x = hasta.x * W;
    const y = hasta.y * alto;
    const px = -dy * LARGO_T;
    const py = dx * LARGO_T;
    cortina = <line x1={x + px} y1={y + py} x2={x - px} y2={y - py} stroke={estilo.color} strokeWidth={3} />;
  }
  return (
    <g data-trazo={a.tipo}>
      <path
        d={d}
        fill="none"
        stroke={estilo.color}
        strokeWidth={estilo.ancho ?? 2}
        strokeDasharray={estilo.punteado}
        strokeLinecap={a.tipo === 'rebote' ? 'round' : undefined}
        markerEnd={ACCIONES_DE_PUNTA.includes(a.tipo) ? `url(#${idFlecha})` : undefined}
      />
      {cortina}
    </g>
  );
}

/** Dónde está cada pelota: la del dueño va con él; la suelta (ya tirada) cae en el aro. */
function pelotasDe(datos: DatosDePizarra, duenos: (string | null)[], posiciones: Map<string, Punto>, tiro: boolean): Punto[] {
  const aro = (AROS as Record<string, Punto>)[datos.cancha] ?? AROS.media;
  return duenos
    .map((d) => (d === null ? (tiro || datos.modo === 'ejercicio' ? aro : null) : (posiciones.get(d) ?? null)))
    .filter((p): p is Punto => p !== null);
}

function estadoQuieto(datos: DatosDePizarra, k: number): Estado {
  const inicio = estadoAlInicioDelPaso(datos, k) as { posiciones: Map<string, Punto>; pelota?: string | null; pelotas?: (string | null)[] };
  const duenos = inicio.pelotas ?? [inicio.pelota ?? null];
  const seTiro = datos.pasos.slice(0, k).some((p) => p.acciones.some((a) => a.tipo === 'tiro'));
  return { posiciones: inicio.posiciones, pelotas: pelotasDe(datos, duenos, inicio.posiciones, seTiro) };
}

function estadoAnimado(datos: DatosDePizarra, k: number, t: number): Estado {
  const e = estadoEn(datos, k, t) as { posiciones: Map<string, Punto>; pelotaEn?: Punto | null };
  if (datos.modo === 'ejercicio') {
    // Un ejercicio tiene varias pelotas: cada una sigue a su dueño mientras se mueve.
    const duenos = (estadoAlInicioDelPaso(datos, k) as { pelotas: (string | null)[] }).pelotas;
    return { posiciones: e.posiciones, pelotas: pelotasDe(datos, duenos, e.posiciones, false) };
  }
  return { posiciones: e.posiciones, pelotas: e.pelotaEn ? [e.pelotaEn] : [] };
}

/** La jugada en miniatura: la cancha y las fichas al empezar, sin trazos ni controles. Decorativa (el nombre va al lado). */
export function PizarraMini({ datos, nosotrosDefiende = false, className }: { datos: DatosDePizarra; nosotrosDefiende?: boolean; className?: string }) {
  const alto = altoDe(datos.cancha);
  const estado = estadoQuieto(datos, 0);
  return (
    <svg
      aria-hidden
      viewBox={`${-MARGEN} ${-MARGEN} ${W + MARGEN * 2} ${alto + MARGEN * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('block w-full', className)}
    >
      <Cancha cancha={datos.cancha} />
      {datos.fichas.map((f) => (
        <Ficha key={f.id} ficha={f} p={estado.posiciones.get(f.id) ?? f} alto={alto} nosotrosDefiende={nosotrosDefiende} />
      ))}
      {estado.pelotas.map((p, i) => (
        <circle key={i} cx={(p.x + 0.026) * W} cy={(p.y + 0.026) * alto} r={5} fill="var(--ambar)" stroke="var(--tinta)" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

const reducirMovimiento = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  datos: DatosDePizarra;
  /** En Presión y Defensa «nosotros» somos el triángulo. */
  nosotrosDefiende?: boolean;
  /** Lo que lee un lector de pantalla: «Jugada: Salida de lateral». */
  etiqueta: string;
  className?: string;
}

/**
 * La pizarra táctica, sólo para ver: la cancha, las fichas, los trazos del paso y la animación.
 * Editarla queda en la app de siempre (necesita compu o tablet). Todo el color sale de los tokens.
 */
export function Pizarra({ datos, nosotrosDefiende = false, etiqueta, className }: Props) {
  const idFlecha = `pz-${useId().replace(/:/g, '')}`;
  const pasos = datos.pasos.length;
  const [paso, setPaso] = useState(0);
  const [anim, setAnim] = useState<{ k: number; t: number } | null>(null);
  const cuadro = useRef(0);

  // Otra jugada, otro estado: no se arrastra el paso de la anterior.
  useEffect(() => {
    setPaso(0);
    setAnim(null);
  }, [datos]);

  useEffect(() => () => cancelAnimationFrame(cuadro.current), []);

  const detener = () => {
    cancelAnimationFrame(cuadro.current);
    setAnim(null);
  };

  const animar = () => {
    if (pasos === 0) return;
    if (reducirMovimiento()) {
      // Sin movimiento: «Animar» pasa de paso en paso, sin interpolar.
      setPaso((p) => (p + 1) % pasos);
      return;
    }
    let k = 0;
    let inicio = performance.now();
    const marcar = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_PASO_MS);
      setAnim({ k, t });
      if (t < 1) {
        cuadro.current = requestAnimationFrame(marcar);
      } else if (k + 1 < pasos) {
        k += 1;
        inicio = ahora;
        cuadro.current = requestAnimationFrame(marcar);
      } else {
        setAnim(null);
        setPaso(0);
      }
    };
    cuadro.current = requestAnimationFrame(marcar);
  };

  const alto = altoDe(datos.cancha);
  const k = anim ? anim.k : Math.min(paso, Math.max(0, pasos - 1));
  const estado = anim ? estadoAnimado(datos, anim.k, anim.t) : estadoQuieto(datos, k);
  const inicioDelPaso = estadoQuieto(datos, k);
  const acciones = datos.pasos[k]?.acciones ?? [];
  const nota = datos.pasos[k]?.nota;
  const animando = anim !== null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <svg
        role="img"
        aria-label={etiqueta}
        viewBox={`${-MARGEN} ${-MARGEN} ${W + MARGEN * 2} ${alto + MARGEN * 2}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ aspectRatio: `${W + MARGEN * 2} / ${alto + MARGEN * 2}` }}
        className="mx-auto max-h-[70svh] w-full rounded-tarjeta border border-linea"
      >
        <defs>
          <marker id={idFlecha} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--tinta)" />
          </marker>
        </defs>
        <Cancha cancha={datos.cancha} />
        {acciones.map((a, i) => (
          <Trazo key={i} a={a} inicio={inicioDelPaso} cancha={datos.cancha} alto={alto} idFlecha={idFlecha} />
        ))}
        {datos.fichas.map((f) => (
          <Ficha key={f.id} ficha={f} p={estado.posiciones.get(f.id) ?? f} alto={alto} nosotrosDefiende={nosotrosDefiende} />
        ))}
        {estado.pelotas.map((p, i) => (
          <circle key={i} data-pelota cx={(p.x + 0.026) * W} cy={(p.y + 0.026) * alto} r={5} fill="var(--ambar)" stroke="var(--tinta)" strokeWidth={1.5} />
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={animando ? detener : animar}
          disabled={pasos === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-btn bg-lima px-5 font-titulo text-lg font-semibold tracking-[.14em] text-sobre-lima uppercase outline-offset-2 transition-transform duration-[var(--dur-1)] focus-visible:outline-2 focus-visible:outline-tinta active:scale-[.97] disabled:cursor-not-allowed disabled:bg-sup-2 disabled:text-gris disabled:active:scale-100"
        >
          {animando ? <Square aria-hidden className="size-4" fill="currentColor" /> : <Play aria-hidden className="size-4" fill="currentColor" />}
          {animando ? 'Detener' : 'Animar'}
        </button>
        {pasos > 1 && (
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="Pasos">
            <button
              type="button"
              aria-label="Paso anterior"
              disabled={animando || k === 0}
              onClick={() => setPaso(k - 1)}
              className="grid size-11 place-items-center rounded-full border border-borde-control text-tinta outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta disabled:opacity-40"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <span className="min-w-20 text-center font-mono text-xs text-gris" aria-live="polite">
              Paso {k + 1} de {pasos}
            </span>
            <button
              type="button"
              aria-label="Paso siguiente"
              disabled={animando || k >= pasos - 1}
              onClick={() => setPaso(k + 1)}
              className="grid size-11 place-items-center rounded-full border border-borde-control text-tinta outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta disabled:opacity-40"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          </div>
        )}
      </div>
      {nota && <p className="text-sm text-gris">{nota}</p>}
    </div>
  );
}
