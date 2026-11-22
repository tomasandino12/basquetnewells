import { CalendarCheck, Check, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Panel } from '../components/ui/card';
import { cn } from '../lib/cn';
import { ALZA_MINIMA, DIAS_DE_LA_SEMANA, asistenciaSeguida, mejorRacha, sesionesEnAlza } from './logica';
import { Fueguito } from './ManoCaliente';
import { Opciones, useDuracion } from './piezas';

// Datos INVENTADOS: el laboratorio nunca lee datos de un jugador real.
const HOY = 4; // viernes: deja ver días pasados, hoy y días que todavía no llegaron
const SEMANA_INICIAL = [true, true, false, true, false, false, false];
const TIROS = { alza: [33, 30, 34, 37, 41], cortada: [30, 34, 37, 35, 39] };
const PRESENCIAS: Record<'seguida' | 'cortada', (boolean | null)[]> = {
  seguida: [true, false, true, true, true, true, null, true, true, true],
  cortada: [true, true, true, true, true, true, null, true, false, true],
};
/** Desde cuántos entrenamientos seguidos se reconoce la asistencia. */
const ASISTENCIA_MINIMA = 6;

function CheckDeRutina({ hecho, alCambiar }: { hecho: boolean; alCambiar: (v: boolean) => void }) {
  const [pulso, setPulso] = useState(0);
  const dur = useDuracion();
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(reloj.current), []);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={hecho}
      aria-labelledby="ix-rutina-t"
      aria-describedby="ix-rutina-d"
      onClick={() => {
        alCambiar(!hecho);
        // La recompensa es sólo al marcar: desmarcar (se equivocó) no castiga ni festeja.
        if (!hecho) {
          setPulso((n) => n + 1);
          clearTimeout(reloj.current);
          reloj.current = setTimeout(() => setPulso(0), dur(480));
        }
      }}
      className="flex min-h-14 w-full items-center gap-4 rounded-campo text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-lima"
    >
      <span data-pulso={pulso ? 'si' : undefined} data-hecho={hecho ? 'si' : undefined} className="ix-check relative grid size-14 shrink-0 place-items-center rounded-full border-2 border-sobre-negro/40">
        <span className="relleno-check absolute inset-0 rounded-full bg-lima" />
        <Check aria-hidden className="tilde-check relative size-7 text-sobre-lima" strokeWidth={3} />
        <span aria-hidden className="ix-rayas">
          {[-50, 0, 50].map((g) => <i key={g} style={{ '--giro': `${g}deg` } as CSSProperties} />)}
        </span>
      </span>
      <span className="min-w-0">
        <span id="ix-rutina-t" className="block text-lg font-semibold">Hice mi rutina de hoy</span>
        <span id="ix-rutina-d" className="block text-sm text-sobre-negro/70">Registro personal para tu progreso · sólo lo ves vos</span>
      </span>
    </button>
  );
}

function Semana({ hechos, nuevo }: { hechos: boolean[]; nuevo: number | null }) {
  const total = hechos.filter(Boolean).length;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-titulo text-base font-semibold tracking-[.14em] text-sobre-negro/70 uppercase">Constancia semanal</p>
        <p className="text-sm text-sobre-negro/70">
          <span className="cifra font-mono text-lg font-semibold text-sobre-negro">{total}</span> de 7 días
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Días de esta semana con rutina">
        {DIAS_DE_LA_SEMANA.map((d, i) => {
          const futuro = i > HOY;
          return (
            <li key={i} className="flex flex-col items-center gap-1">
              <span
                data-hecho={hechos[i] ? 'si' : undefined}
                data-nuevo={nuevo === i ? 'si' : undefined}
                className={cn(
                  'ix-bloque relative h-11 w-full overflow-hidden rounded-[3px]',
                  futuro ? 'border border-dashed border-sobre-negro/25' : 'bg-sobre-negro/10',
                  i === HOY && 'outline-2 outline-offset-2 outline-sobre-negro/50',
                )}
              >
                <span className="relleno absolute inset-0 bg-lima" />
              </span>
              <span className={cn('font-mono text-xs', i === HOY ? 'font-semibold text-sobre-negro' : 'text-sobre-negro/60')}>{d}</span>
              <span className="sr-only">{futuro ? 'todavía no llegó' : hechos[i] ? 'con rutina' : 'sin rutina'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Sparkline({ valores }: { valores: number[] }) {
  const min = Math.min(...valores) - 3;
  const max = Math.max(...valores) + 3;
  const x = (i: number) => 4 + (i * 112) / (valores.length - 1);
  const y = (v: number) => 32 - ((v - min) / (max - min)) * 28;
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join('');
  return (
    <svg aria-hidden viewBox="0 0 120 36" className="h-9 w-30">
      <defs>
        <clipPath id="ix-destapa">
          <rect className="ix-destapa" x="0" y="0" width="120" height="36" />
        </clipPath>
      </defs>
      <g clipPath="url(#ix-destapa)">
        <path d={d} fill="none" stroke="var(--sobre-negro)" strokeOpacity=".55" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {valores.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === valores.length - 1 ? 3.5 : 2} fill={i === valores.length - 1 ? 'var(--lima)' : 'var(--sobre-negro)'} />
        ))}
      </g>
    </svg>
  );
}

function RachaDeTiro({ valores }: { valores: number[] }) {
  const racha = sesionesEnAlza(valores);
  const ultimo = valores[valores.length - 1];
  const base = valores[valores.length - 1 - racha];
  return (
    <div className="flex min-h-40 flex-col justify-between gap-3 rounded-tarjeta border border-sobre-negro/15 bg-negro p-4 text-sobre-negro">
      {racha >= ALZA_MINIMA ? (
        <div key="si" className="ix-reconoce flex flex-col gap-3">
          <p className="flex items-center gap-2 font-titulo text-sm font-semibold tracking-[.16em] text-lima uppercase">
            <TrendingUp aria-hidden className="size-4" strokeWidth={2.4} /> Mano caliente
          </p>
          <div className="flex items-end justify-between gap-3">
            <p className="font-titulo text-3xl leading-none font-bold uppercase">{racha} sesiones en alza</p>
            <Fueguito racha={racha} />
          </div>
          <div className="flex items-end justify-between gap-3">
            <Sparkline valores={valores} />
            <p className="text-right text-sm text-sobre-negro/70">
              <span className="cifra block font-mono text-2xl font-semibold text-sobre-negro">{ultimo} %</span>
              <span className="text-lima">+{ultimo - base} pts</span> desde {base} %
            </p>
          </div>
        </div>
      ) : (
        <div key="no" className="ix-aparece flex flex-col gap-2">
          <p className="font-titulo text-sm font-semibold tracking-[.16em] text-sobre-negro/60 uppercase">Tu tiro</p>
          <p className="text-sm text-sobre-negro/70">
            <span className="cifra font-mono text-2xl font-semibold text-sobre-negro">{ultimo} %</span> en la última sesión. Con {ALZA_MINIMA} mejoras seguidas aparece la racha.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Asistencia en positivo: cada entrenamiento al que vino suma en lima (no sólo los de la racha) y una falta es un
 * hueco, no una marca gris. Con la racha cortada se le dice cuánto le falta para su mejor racha, no lo que perdió.
 */
function AsistenciaContinuada({ presencias }: { presencias: (boolean | null)[] }) {
  const racha = asistenciaSeguida(presencias);
  const mejor = mejorRacha(presencias);
  const vino = presencias.filter((p) => p === true).length;
  const tomadas = presencias.filter((p) => p != null).length;
  // Para pintar la tira: los últimos `racha` presentes (saltando los días sin tomar) son la racha.
  let quedan = racha;
  const enRacha = [...presencias].reverse().map((p) => (p === true && quedan-- > 0)).reverse();
  const faltan = mejor - racha;
  return (
    <div className="flex min-h-40 flex-col justify-between gap-3 rounded-tarjeta border border-sobre-negro/15 bg-negro p-4 text-sobre-negro">
      {racha >= ASISTENCIA_MINIMA ? (
        <div key="si" className="ix-reconoce flex flex-col gap-3">
          <p className="flex items-center gap-2 font-titulo text-sm font-semibold tracking-[.16em] text-lima uppercase">
            <CalendarCheck aria-hidden className="size-4" strokeWidth={2.4} /> Asistencia continuada
          </p>
          <p className="font-titulo text-3xl leading-none font-bold uppercase">{racha} entrenamientos seguidos</p>
          <p className="text-sm text-sobre-negro/70">{racha >= mejor ? 'Es tu mejor racha. Seguí así.' : `Tu mejor fue de ${mejor}: vas por buen camino.`}</p>
        </div>
      ) : (
        <div key="no" className="ix-aparece flex flex-col gap-2">
          <p className="flex items-center gap-2 font-titulo text-sm font-semibold tracking-[.16em] text-lima uppercase">
            <CalendarCheck aria-hidden className="size-4" strokeWidth={2.4} /> Tu asistencia
          </p>
          <p className="font-titulo text-3xl leading-none font-bold uppercase">
            Viniste a {vino} de {tomadas}
          </p>
          <p className="text-sm text-sobre-negro/70">
            {racha === 0
              ? 'El próximo entrenamiento arranca una racha nueva.'
              : faltan > 0
                ? `Llevás ${racha} ${racha === 1 ? "seguido" : "seguidos"}: ${faltan === 1 ? 'uno más' : `${faltan} más`} y igualás tu mejor racha (${mejor}).`
                : `Llevás ${racha} seguidos: es tu mejor racha.`}
          </p>
        </div>
      )}
      <ol aria-label="Últimos entrenamientos" className="flex items-center gap-1">
        {presencias.map((p, i) => (
          <li
            key={i}
            className={cn(
              'h-3 flex-1 rounded-[2px]',
              p == null ? 'border border-dashed border-sobre-negro/25' : p ? (enRacha[i] ? 'bg-lima' : 'bg-lima/55') : 'border border-lima/35',
            )}
          >
            <span className="sr-only">{p == null ? 'sin tomar' : p ? 'vino' : 'faltó'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SeccionConstancia() {
  const [hechos, setHechos] = useState(SEMANA_INICIAL);
  const [nuevo, setNuevo] = useState<number | null>(null);
  const [tiro, setTiro] = useState<'alza' | 'cortada'>('alza');
  const [asistencia, setAsistencia] = useState<'seguida' | 'cortada'>('seguida');

  return (
    <Panel titulo="4 · Vista del jugador: constancia y rachas">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5 self-start rounded-tarjeta border border-sobre-negro/15 bg-negro p-4 text-sobre-negro">
          <div className="flex items-baseline justify-between">
            <p className="font-titulo text-2xl leading-none font-bold tracking-wide uppercase">Tu semana</p>
            <p className="font-mono text-xs tracking-wide text-sobre-negro/60 uppercase">hoy · viernes</p>
          </div>
          <CheckDeRutina
            hecho={hechos[HOY]}
            alCambiar={(v) => {
              setNuevo(v ? HOY : null);
              setHechos((h) => h.map((x, i) => (i === HOY ? v : x)));
            }}
          />
          <Semana hechos={hechos} nuevo={nuevo} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Opciones etiqueta="Datos del tiro" valor={tiro} alCambiar={setTiro} opciones={[{ id: 'alza', nombre: 'Tiro: en alza' }, { id: 'cortada', nombre: 'Tiro: se cortó' }]} />
            <RachaDeTiro valores={TIROS[tiro]} />
          </div>
          <div className="flex flex-col gap-1">
            <Opciones etiqueta="Datos de asistencia" valor={asistencia} alCambiar={setAsistencia} opciones={[{ id: 'seguida', nombre: 'Asistencia: seguida' }, { id: 'cortada', nombre: 'Asistencia: se cortó' }]} />
            <AsistenciaContinuada presencias={PRESENCIAS[asistencia]} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-gris">Datos inventados. Un porcentaje sin medir corta la racha (no se inventa una mejora); un día sin asistencia tomada no la corta.</p>
    </Panel>
  );
}
