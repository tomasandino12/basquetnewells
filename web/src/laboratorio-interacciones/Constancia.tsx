import { CalendarCheck, Check, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Panel } from '../components/ui/card';
import { cn } from '../lib/cn';
import { ALZA_MINIMA, DIAS_DE_LA_SEMANA, asistenciaSeguida, sesionesEnAlza } from './logica';
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
      aria-labelledby="lab-rutina-t"
      aria-describedby="lab-rutina-d"
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
      <span data-pulso={pulso ? 'si' : undefined} data-hecho={hecho ? 'si' : undefined} className="lab-check relative grid size-14 shrink-0 place-items-center rounded-full border-2 border-sobre-negro/40">
        <span className="relleno-check absolute inset-0 rounded-full bg-lima" />
        <Check aria-hidden className="tilde-check relative size-7 text-sobre-lima" strokeWidth={3} />
        <span aria-hidden className="lab-rayas">
          {[-50, 0, 50].map((g) => <i key={g} style={{ '--giro': `${g}deg` } as CSSProperties} />)}
        </span>
      </span>
      <span className="min-w-0">
        <span id="lab-rutina-t" className="block text-lg font-semibold">Hice mi rutina de hoy</span>
        <span id="lab-rutina-d" className="block text-sm text-sobre-negro/70">Registro personal para tu progreso · sólo lo ves vos</span>
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
                  'lab-bloque relative h-11 w-full overflow-hidden rounded-[3px]',
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
        <clipPath id="lab-destapa">
          <rect className="lab-destapa" x="0" y="0" width="120" height="36" />
        </clipPath>
      </defs>
      <g clipPath="url(#lab-destapa)">
        <path d={d} fill="none" stroke="var(--sobre-negro)" strokeOpacity=".55" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {valores.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === valores.length - 1 ? 3.5 : 2} fill={i === valores.length - 1 ? 'var(--lima)' : 'var(--sobre-negro)'} />
        ))}
      </g>
    </svg>
  );
}

/**
 * La «mano caliente»: un fueguito que se prende al aparecer la racha y flamea tres veces (no en loop).
 * Crece con la racha: 3 mejoras es el chico; desde 5, el grande.
 */
function Fueguito({ racha }: { racha: number }) {
  const grande = racha >= 5;
  return (
    <svg aria-hidden viewBox="0 0 32 40" className={cn('lab-fuego shrink-0 overflow-visible', grande ? 'h-14 w-11' : 'h-11 w-9')}>
      <path className="llama" d="M16 1C18 9 27 13 27 25A11 11 0 0 1 5 25C5 18 9 14.5 10.5 8.5C12.5 12.5 13.5 14.5 15 15.5C15 10.5 14.5 5.5 16 1Z" fill="var(--fuego-afuera)" />
      <path className="nucleo" d="M16 17C18.5 21 21.5 23.5 21.5 28.5A5.5 5.5 0 0 1 10.5 28.5C10.5 25.5 12.5 23.5 13.8 20.8C14.8 22.6 15.6 22.8 16 17Z" fill="var(--fuego-centro)" />
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
        <div key="si" className="lab-reconoce flex flex-col gap-3">
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
        <div key="no" className="lab-aparece flex flex-col gap-2">
          <p className="font-titulo text-sm font-semibold tracking-[.16em] text-sobre-negro/60 uppercase">Tu tiro</p>
          <p className="text-sm text-sobre-negro/70">
            <span className="cifra font-mono text-2xl font-semibold text-sobre-negro">{ultimo} %</span> en la última sesión. Con {ALZA_MINIMA} mejoras seguidas aparece la racha.
          </p>
        </div>
      )}
    </div>
  );
}

function AsistenciaContinuada({ presencias }: { presencias: (boolean | null)[] }) {
  const racha = asistenciaSeguida(presencias);
  // Para pintar la tira: los últimos `racha` presentes (saltando los días sin tomar) son la racha.
  let quedan = racha;
  const enRacha = [...presencias].reverse().map((p) => (p === true && quedan-- > 0)).reverse();
  return (
    <div className="flex min-h-40 flex-col justify-between gap-3 rounded-tarjeta border border-sobre-negro/15 bg-negro p-4 text-sobre-negro">
      {racha >= ASISTENCIA_MINIMA ? (
        <div key="si" className="lab-reconoce flex flex-col gap-3">
          <p className="flex items-center gap-2 font-titulo text-sm font-semibold tracking-[.16em] text-lima uppercase">
            <CalendarCheck aria-hidden className="size-4" strokeWidth={2.4} /> Asistencia continuada
          </p>
          <p className="font-titulo text-3xl leading-none font-bold uppercase">{racha} entrenamientos seguidos</p>
        </div>
      ) : (
        <div key="no" className="lab-aparece flex flex-col gap-2">
          <p className="font-titulo text-sm font-semibold tracking-[.16em] text-sobre-negro/60 uppercase">Asistencia</p>
          <p className="text-sm text-sobre-negro/70">
            <span className="cifra font-mono text-2xl font-semibold text-sobre-negro">{racha}</span> {racha === 1 ? 'entrenamiento seguido' : 'entrenamientos seguidos'}. Desde {ASISTENCIA_MINIMA} se reconoce.
          </p>
        </div>
      )}
      <ol aria-label="Últimos entrenamientos" className="flex gap-1">
        {presencias.map((p, i) => (
          <li
            key={i}
            className={cn(
              'h-3 flex-1 rounded-[2px]',
              p == null ? 'border border-dashed border-sobre-negro/30' : p ? (enRacha[i] ? 'bg-lima' : 'bg-sobre-negro/45') : 'border border-sobre-negro/45',
            )}
          >
            <span className="sr-only">{p == null ? 'sin tomar' : p ? 'presente' : 'ausente'}</span>
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
