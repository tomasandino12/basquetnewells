import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Boton } from '../components/ui/button';
import { Panel } from '../components/ui/card';
import { cn } from '../lib/cn';
import { FRASES_DE_CARGA, siguienteFrase } from './logica';
import { ESTILOS_DE_PELOTA, Opciones, Pelota, caminoDeRed, useDuracion, type EstiloDePelota } from './piezas';

const PERIODO = { pique: 640, tiro: 700 } as const;
type Mecanica = keyof typeof PERIODO;
/** La carga larga dura ~6 s y se corta sola: DESIGN.md no deja nada en loop. Una carga más larga ya es un error a la vista. */
const CARGA_LARGA_MS = 6000;

const conVueltas = (n: number) => ({ '--vueltas': n }) as CSSProperties;

/** Los colores del aro y la red siguen al estilo de la pelota. */
const ARO: Record<EstiloDePelota, { aro: string; red: string }> = {
  clasica: { aro: 'var(--quemado)', red: 'var(--gris)' },
  gajos: { aro: 'var(--club)', red: 'var(--tinta)' },
  trazo: { aro: 'var(--club)', red: 'var(--tinta)' },
};

export function Pique({ estilo, vueltas, corre }: { estilo: EstiloDePelota; vueltas: number; corre: boolean }) {
  return (
    <div aria-hidden className={cn('ix-pique', corre && 'corre')} style={conVueltas(vueltas)}>
      <span className="sombra" />
      <span className="bote">
        <Pelota estilo={estilo} />
      </span>
    </div>
  );
}

export function TiroLimpio({ estilo, vueltas, corre }: { estilo: EstiloDePelota; vueltas: number; corre: boolean }) {
  const { aro, red } = ARO[estilo];
  return (
    <svg aria-hidden viewBox="0 0 160 112" width="160" height="112" className={cn('ix-tiro overflow-visible', corre && 'corre')} style={conVueltas(vueltas)}>
      <line x1="8" x2="152" y1="107" y2="107" stroke="var(--linea)" strokeWidth="1.5" />
      <rect x="142" y="12" width="3" height="40" rx="1" fill="var(--tinta)" opacity=".75" />
      <path d="M136 46L142 41" stroke="var(--tinta)" strokeWidth="2" opacity=".75" />
      {/* Atrás del aro va la mitad de arriba; la pelota pasa entre las dos mitades y por dentro de la red. */}
      <path d="M100 46A18 4 0 0 1 136 46" fill="none" stroke={aro} strokeWidth="2.5" />
      <g className="tiro-x">
        <g className="tiro-y">
          <g className="tiro-giro">
            <Pelota estilo={estilo} x={15} y={87} tamano={18} />
          </g>
        </g>
      </g>
      <path className="red" d={caminoDeRed(118, 46, 36, 20, 26)} fill="none" stroke={red} strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
      <path d="M100 46A18 4 0 0 0 136 46" fill="none" stroke={aro} strokeWidth="2.5" />
    </svg>
  );
}

/** Frases que rotan mientras dura una carga larga. No se anuncian una por una: el lector oye «Cargando». */
export function RotadorDeFrases({ activo }: { activo: boolean }) {
  const [i, setI] = useState(0);
  const dur = useDuracion();
  const cada = dur(1800);
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => setI((n) => siguienteFrase(n, FRASES_DE_CARGA.length)), cada);
    return () => clearInterval(t);
  }, [activo, cada]);
  return (
    <p className="min-h-6 text-sm text-gris" aria-live="off">
      {activo ? (
        <span key={i} className="ix-aparece inline-block">
          {FRASES_DE_CARGA[i]}
        </span>
      ) : (
        <span className="italic">Las frases aparecen sólo en una carga larga.</span>
      )}
    </p>
  );
}

type Corrida = { id: number; larga: boolean } | null;

export function SeccionCargadores() {
  const [corrida, setCorrida] = useState<Corrida>(null);
  const [fondo, setFondo] = useState<'crema' | 'negro'>('crema');
  const dur = useDuracion();
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);

  const disparar = (larga: boolean) => {
    clearTimeout(reloj.current);
    const id = Date.now();
    setCorrida({ id, larga });
    // Se apaga por reloj y no por animationend: con movimiento reducido no hay animación que termine.
    reloj.current = setTimeout(() => setCorrida(null), dur(larga ? CARGA_LARGA_MS : PERIODO.tiro * 2));
  };
  useEffect(() => () => clearTimeout(reloj.current), []);

  const vueltas = (m: Mecanica) => (corrida?.larga ? Math.ceil(CARGA_LARGA_MS / PERIODO[m]) : m === 'pique' ? 2 : 1);

  return (
    <Panel titulo="1 · Cargador deportivo">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Boton tamano="chico" variante="secundario" onClick={() => disparar(false)}>Disparar</Boton>
        <Boton tamano="chico" variante="contorno" onClick={() => disparar(true)}>Carga larga (6 s)</Boton>
        <Opciones etiqueta="Fondo de prueba" valor={fondo} alCambiar={setFondo} opciones={[{ id: 'crema', nombre: 'Sobre tarjeta' }, { id: 'negro', nombre: 'Sobre negro' }]} />
      </div>
      <p className="sr-only" aria-live="polite">{corrida ? 'Cargando' : ''}</p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ESTILOS_DE_PELOTA.map((e) => (
          <figure key={e.id} className="flex flex-col gap-2">
            <div
              // En negro la tinta y la línea se aclaran: se prueba la misma pieza sobre el negro del portal.
              data-tema={fondo === 'negro' ? 'oscuro' : undefined}
              className={cn('flex flex-wrap items-end justify-around gap-4 rounded-tarjeta border border-linea px-4 pt-3 pb-2', fondo === 'negro' ? 'bg-negro' : 'bg-sup-2')}
            >
              <div className="flex flex-col items-center gap-1">
                <Pique key={`p-${corrida?.id}`} estilo={e.id} vueltas={vueltas('pique')} corre={!!corrida} />
                <span className="font-mono text-[0.625rem] tracking-wide whitespace-nowrap text-gris uppercase">A · pique</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <TiroLimpio key={`t-${corrida?.id}`} estilo={e.id} vueltas={vueltas('tiro')} corre={!!corrida} />
                <span className="font-mono text-[0.625rem] tracking-wide whitespace-nowrap text-gris uppercase">B · swish</span>
              </div>
            </div>
            <figcaption>
              <span className="block text-sm font-semibold">{e.nombre}</span>
              <span className="block text-xs text-gris">{e.detalle}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-4 border-t border-linea pt-3">
        <p className="mb-1 text-xs font-semibold tracking-wide text-gris uppercase">Micro-textos (carga larga)</p>
        <RotadorDeFrases activo={!!corrida?.larga} />
      </div>
    </Panel>
  );
}
