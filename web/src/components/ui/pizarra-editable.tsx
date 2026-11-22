import { useId, useRef, useState, type PointerEvent as EventoPuntero } from 'react';
import { MARGEN, W, altoDe } from '@datos/geometriaCancha.js';
import type { AccionDePizarra, DatosDePizarra } from '../../datos/repositorio';
import { fichaEnPunto, puntoDesdeToque, R_FICHA } from '../../recursos/geometriaEditor';
import { ops } from '../../recursos/operaciones';
import { puntoDeControl } from '../../recursos/puntoDeControl';
import { Cancha, estadoQuieto, Ficha, PuntasDeFlecha, Trazo } from './pizarra';

export type Herramienta = 'seleccionar' | 'pelota' | 'corte' | 'dribbling' | 'pase' | 'cortina' | 'tiro' | 'handoff';
export type Seleccion = { tipo: 'ficha'; id: string } | { tipo: 'accion'; indice: number } | null;

interface Props {
  datos: DatosDePizarra;
  paso: number;
  nosotrosDefiende: boolean;
  herramienta: Herramienta;
  seleccion: Seleccion;
  /** La ficha ya tocada, a la espera del segundo toque de una herramienta de acción. */
  origen: string | null;
  etiqueta: string;
  alSeleccionar: (s: Seleccion) => void;
  alElegirOrigen: (id: string | null) => void;
  /** Aplica una función pura al historial; devuelve false (y avisa) si la regla no se cumple. */
  alAplicar: (fn: (d: DatosDePizarra) => DatosDePizarra) => boolean;
  /** Un arrastre terminado: una sola foto en el historial por gesto. */
  alReemplazar: (nuevos: DatosDePizarra) => void;
  alAvisar: (texto: string) => void;
}

type Arrastre = { tipo: 'ficha' | 'control' | 'destino'; id?: string; base: DatosDePizarra; ultima?: DatosDePizarra; avisado?: boolean };

const ANCHO = W as number;
const BANDA = MARGEN as number;

/**
 * La cancha interactiva del editor: Pointer Events (mouse, dedo y lápiz) sobre un SVG. Toda la regla vive en
 * las funciones puras de `operaciones`; acá sólo se traduce un toque a una llamada.
 */
export function PizarraEditable(p: Props) {
  const { paso, herramienta, seleccion, origen } = p;
  const idFlecha = `pz-${useId().replace(/:/g, '')}`;
  const svg = useRef<SVGSVGElement>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const [vista, setVista] = useState<DatosDePizarra | null>(null);

  const datos = vista ?? p.datos;
  const alto = altoDe(datos.cancha) as number;
  const inicio = estadoQuieto(datos, paso);
  const acciones = datos.pasos[paso]?.acciones ?? [];
  const accionElegida = seleccion?.tipo === 'accion' ? acciones[seleccion.indice] : undefined;

  const punto = (e: EventoPuntero) => puntoDesdeToque(svg.current!.getBoundingClientRect(), datos.cancha, e.clientX, e.clientY);

  const completar = (accion: AccionDePizarra) => {
    const ok = p.alAplicar((d) => ops.aplicarAccion(d, paso, accion));
    // La acción nueva queda elegida, con el asa lista para curvarla en el mismo gesto.
    p.alSeleccionar(ok ? { tipo: 'accion', indice: acciones.length } : null);
    p.alElegirOrigen(null);
  };

  const alBajar = (e: EventoPuntero<SVGSVGElement>) => {
    const objetivo = e.target as Element;
    const pt = punto(e);
    const fichaId = objetivo.closest('[data-ficha]')?.getAttribute('data-ficha') ?? fichaEnPunto(p.datos, inicio.posiciones, pt.xSvg, pt.ySvg);

    // Las asas mandan sobre cualquier herramienta: se curva o se estira la acción recién creada sin pasar por «Elegir».
    const asa = objetivo.closest('[data-asa]')?.getAttribute('data-asa');
    if (asa && seleccion?.tipo === 'accion') {
      svg.current!.setPointerCapture(e.pointerId);
      arrastre.current = { tipo: asa === 'destino' ? 'destino' : 'control', base: p.datos };
      return;
    }

    if (herramienta === 'seleccionar') {
      const fantasma = objetivo.closest('[data-fantasma]')?.getAttribute('data-accion-indice');
      if (fantasma != null && fichaId) {
        // El fantasma se elige como la acción (el ajuste), no como la ficha: Supr borra sólo el ajuste.
        p.alSeleccionar({ tipo: 'accion', indice: Number(fantasma) });
        svg.current!.setPointerCapture(e.pointerId);
        arrastre.current = { tipo: 'ficha', id: fichaId, base: p.datos };
        return;
      }
      if (fichaId) {
        p.alSeleccionar({ tipo: 'ficha', id: fichaId });
        svg.current!.setPointerCapture(e.pointerId);
        arrastre.current = { tipo: 'ficha', id: fichaId, base: p.datos };
        return;
      }
      const indice = objetivo.closest('[data-accion-indice]')?.getAttribute('data-accion-indice');
      p.alSeleccionar(indice != null ? { tipo: 'accion', indice: Number(indice) } : null);
      return;
    }

    if (herramienta === 'pelota') {
      if (paso !== 0) return p.alAvisar('Quién arranca con la pelota se elige en la formación inicial (paso 1).');
      if (!fichaId) return p.alAvisar('Tocá al atacante que arranca con la pelota.');
      // Tocar al que ya la tiene se la saca: así también se puede arrancar sin pelota.
      const nuevo = p.datos.pelota === fichaId ? null : fichaId;
      p.alAplicar((d) => ops.darPelotaInicial(d, nuevo));
      return;
    }

    // Las acciones: primer toque el origen, segundo el destino (o quien recibe, en pase y handoff). El tiro no pide segundo toque.
    if (!origen) {
      p.alSeleccionar(null);
      if (!fichaId) return p.alAvisar('Tocá primero la ficha que hace la acción.');
      if (herramienta === 'tiro') completar({ tipo: 'tiro', ficha: fichaId });
      else p.alElegirOrigen(fichaId);
      return;
    }
    if (herramienta === 'pase' || herramienta === 'handoff') {
      if (!fichaId || fichaId === origen) return p.alAvisar('Tocá a quién le pasa o entrega.');
      completar({ tipo: herramienta, ficha: origen, a: fichaId });
      return;
    }
    completar({ tipo: herramienta, ficha: origen, hasta: { x: pt.x, y: pt.y } });
  };

  const alMover = (e: EventoPuntero<SVGSVGElement>) => {
    const a = arrastre.current;
    if (!a) return;
    const pt = punto(e);
    const hasta = { x: pt.x, y: pt.y };
    const indice = seleccion?.tipo === 'accion' ? seleccion.indice : -1;
    try {
      const nueva =
        a.tipo === 'ficha' ? ops.ajustarFicha(a.base, paso, a.id!, pt.x, pt.y)
        : a.tipo === 'destino' ? ops.fijarDestinoDeAccion(a.base, paso, indice, hasta)
        : ops.fijarControlDeAccion(a.base, paso, indice, hasta);
      a.ultima = nueva;
      setVista(nueva);
    } catch (err) {
      // Una regla rechazada, no un punto momentáneamente afuera (el toque ya se recorta): se avisa una sola vez por arrastre.
      if (!a.avisado) {
        a.avisado = true;
        p.alAvisar(err instanceof Error ? err.message : 'No se pudo mover.');
      }
    }
  };

  const alSoltar = (e: EventoPuntero<SVGSVGElement>) => {
    const a = arrastre.current;
    if (!a) return;
    try {
      svg.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ya liberado */
    }
    arrastre.current = null;
    setVista(null);
    if (a.ultima) p.alReemplazar(a.ultima);
  };

  const proporcion = (ANCHO + BANDA * 2) / (alto + BANDA * 2);
  const control = accionElegida && accionElegida.tipo !== 'ajuste' && seleccion?.tipo === 'accion' ? puntoDeControl(datos, paso, seleccion.indice) : null;
  const destino = accionElegida && ops.tieneDestinoLibre(accionElegida) ? accionElegida.hasta : null;
  const resaltada = origen ?? (seleccion?.tipo === 'ficha' ? seleccion.id : null);
  const posResaltada = resaltada ? inicio.posiciones.get(resaltada) : null;

  return (
    <svg
      ref={svg}
      role="img"
      aria-label={p.etiqueta}
      viewBox={`${-BANDA} ${-BANDA} ${ANCHO + BANDA * 2} ${alto + BANDA * 2}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ aspectRatio: `${ANCHO + BANDA * 2} / ${alto + BANDA * 2}`, width: `min(100%, calc(75svh * ${proporcion}))`, touchAction: 'none' }}
      className="mx-auto block h-auto cursor-crosshair border border-linea bg-sup select-none"
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
    >
      <PuntasDeFlecha id={idFlecha} />
      <Cancha cancha={datos.cancha} />
      {acciones.map((a, i) => (
        <g key={i} opacity={seleccion?.tipo === 'accion' && seleccion.indice !== i ? 0.55 : 1}>
          <Trazo a={a} inicio={inicio} cancha={datos.cancha} alto={alto} idFlecha={idFlecha} indice={i} />
        </g>
      ))}
      {datos.fichas.map((f) => (
        <Ficha key={f.id} ficha={f} p={inicio.posiciones.get(f.id) ?? f} alto={alto} nosotrosDefiende={p.nosotrosDefiende} />
      ))}
      {/* Un fantasma por cada ajuste del paso: la ficha dibujada donde termina, sin flecha. */}
      {acciones.map((a, i) => {
        if (a.tipo !== 'ajuste' || !a.hasta) return null;
        const ficha = datos.fichas.find((f) => f.id === a.ficha);
        if (!ficha) return null;
        return (
          <g key={`f${i}`} data-fantasma data-accion-indice={i} opacity={0.45}>
            <Ficha ficha={ficha} p={a.hasta} alto={alto} nosotrosDefiende={p.nosotrosDefiende} />
            {seleccion?.tipo === 'accion' && seleccion.indice === i && (
              <circle cx={a.hasta.x * ANCHO} cy={a.hasta.y * alto} r={R_FICHA + 5} fill="none" stroke="var(--club)" strokeWidth={2} strokeDasharray="4 3" />
            )}
          </g>
        );
      })}
      {inicio.pelotas.map((q, i) => (
        <circle key={i} data-pelota cx={(q.x + 0.026) * ANCHO} cy={(q.y + 0.026) * alto} r={5} fill="var(--ambar)" stroke="var(--tinta)" strokeWidth={1.5} />
      ))}
      {posResaltada && (
        <circle data-resalto cx={posResaltada.x * ANCHO} cy={posResaltada.y * alto} r={R_FICHA + 5} fill="none" stroke="var(--club)" strokeWidth={2} strokeDasharray="4 3" />
      )}
      {control && <circle data-asa="control" cx={control.x * ANCHO} cy={control.y * alto} r={7} fill="var(--club)" stroke="var(--sup)" strokeWidth={2} className="cursor-grab" />}
      {destino && (
        <rect data-asa="destino" x={destino.x * ANCHO - 6} y={destino.y * alto - 6} width={12} height={12} rx={2} fill="var(--club)" stroke="var(--sup)" strokeWidth={2} className="cursor-grab" />
      )}
    </svg>
  );
}
