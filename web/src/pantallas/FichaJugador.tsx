import { motion } from 'motion/react';
import { cifra, nombreCompleto, porcentaje } from '../plantel/vista';
import type { Jugador } from '../plantel/tipos';

const SALIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 first:pl-0">
      <dt className="text-xs text-gris">{etiqueta}</dt>
      <dd className="font-mono text-xl font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

// El relleno crece con scaleX desde el ancho final: no se anima el ancho.
function Barra({ etiqueta, valor }: { etiqueta: string; valor: number | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-gris">{etiqueta}</span>
        <span className="font-mono font-semibold tabular-nums">{porcentaje(valor)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sup-2">
        {valor !== null && (
          <motion.div
            className="h-full origin-left rounded-full bg-tinta"
            style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.28, ease: SALIDA, delay: 0.1 }}
          />
        )}
      </div>
    </div>
  );
}

function UltimosPartidos({ puntos }: { puntos: (number | null)[] }) {
  if (puntos.length === 0) return <p className="text-sm text-gris">Todavía no hay partidos cargados.</p>;
  const tope = Math.max(1, ...puntos.map((p) => p ?? 0));
  return (
    <ol className="flex h-16 items-end gap-2" aria-label="Puntos en los últimos partidos">
      {puntos.map((p, i) => (
        <li key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="font-mono text-xs tabular-nums text-gris">{p ?? '—'}</span>
          {p !== null && (
            <motion.span
              className="w-full origin-bottom rounded-t-[0.1875rem] bg-tinta/80"
              style={{ height: `${Math.max(8, (p / tope) * 100)}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.28, ease: SALIDA, delay: 0.05 * i }}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

export function FichaJugador({ jugador: j }: { jugador: Jugador }) {
  const altura = j.alturaCm === null ? null : `${(j.alturaCm / 100).toFixed(2).replace('.', ',')} m`;
  const meta = [j.posicion, String(j.nacimiento), altura].filter(Boolean).join(' · ');
  return (
    <motion.article
      aria-label={`Ficha de ${nombreCompleto(j)}`}
      className="flex flex-col gap-5 p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: SALIDA }}
    >
      <header className="flex items-end gap-4 pr-10">
        <span aria-hidden className="font-titulo text-[5.5rem] leading-[.8] font-bold tabular-nums text-club-texto">
          {j.numero ?? '—'}
        </span>
        <div className="min-w-0 pb-1">
          <h2 className="font-titulo text-3xl leading-none font-semibold break-words">{nombreCompleto(j)}</h2>
          <p className="mt-1.5 text-sm text-gris">{meta}</p>
        </div>
      </header>

      <section aria-label="Promedios por partido">
        <dl className="grid grid-cols-4 divide-x divide-linea">
          <Dato etiqueta="Puntos" valor={cifra(j.puntos)} />
          <Dato etiqueta="Rebotes" valor={cifra(j.rebotes)} />
          <Dato etiqueta="Asist." valor={cifra(j.asistencias)} />
          <Dato etiqueta="Minutos" valor={cifra(j.minutos, 0)} />
        </dl>
      </section>

      <section aria-label="Tiro" className="flex flex-col gap-3">
        <Barra etiqueta="Triples" valor={j.triples} />
        <Barra etiqueta="Libres" valor={j.libres} />
      </section>

      <section aria-label="Últimos partidos">
        <h3 className="mb-2 text-sm font-semibold">Últimos partidos</h3>
        <UltimosPartidos puntos={j.ultimos} />
      </section>

      <section aria-label="Físico" className="flex gap-8 border-t border-linea pt-4">
        <div>
          <p className="text-xs text-gris">Salto</p>
          <p className="font-mono text-lg font-semibold tabular-nums">{j.saltoCm === null ? '—' : `${j.saltoCm} cm`}</p>
        </div>
        <div>
          <p className="text-xs text-gris">Sprint</p>
          <p className="font-mono text-lg font-semibold tabular-nums">{j.sprintSeg === null ? '—' : `${cifra(j.sprintSeg, 2)} s`}</p>
        </div>
      </section>

      <section aria-label="Para el entrenamiento" className="flex flex-col gap-3 text-sm">
        <p><span className="block text-xs text-gris">Su fuerte</span>{j.fuerte ?? 'Sin anotar todavía.'}</p>
        <p><span className="block text-xs text-gris">A trabajar</span>{j.aTrabajar ?? 'Sin anotar todavía.'}</p>
      </section>
    </motion.article>
  );
}
