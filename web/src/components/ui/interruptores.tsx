import { cn } from '../../lib/cn';

export interface Interruptor {
  id: string;
  nombre: string;
  /** Un color de la paleta (`var(--club-texto)`): el mismo de su línea o su capa. */
  color: string;
  punteada?: boolean;
}

/**
 * Botones para prender y apagar las líneas de un gráfico. Cada uno lleva la muestra de su color (y si
 * va punteada) para que se lea sin leyenda aparte. Nunca deja apagar la última: un gráfico vacío no sirve.
 */
export function Interruptores({
  opciones, prendidas, alCambiar, etiqueta,
}: { opciones: Interruptor[]; prendidas: string[]; alCambiar: (ids: string[]) => void; etiqueta: string }) {
  if (opciones.length < 2) return null;
  return (
    <div role="group" aria-label={etiqueta} className="mb-3 flex flex-wrap gap-2">
      {opciones.map((o) => {
        const on = prendidas.includes(o.id);
        const ultima = on && prendidas.length === 1;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            aria-disabled={ultima || undefined}
            title={ultima ? 'Tiene que quedar al menos una' : undefined}
            onClick={() => {
              if (ultima) return;
              alCambiar(on ? prendidas.filter((p) => p !== o.id) : opciones.filter((x) => x.id === o.id || prendidas.includes(x.id)).map((x) => x.id));
            }}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold outline-offset-2 transition-[background-color,border-color,opacity] duration-[var(--dur-1)] focus-visible:outline-2 focus-visible:outline-tinta',
              on ? 'border-tinta bg-sup-2' : 'border-linea bg-transparent text-gris opacity-70 [@media(hover:hover)]:hover:opacity-100',
            )}
          >
            <svg aria-hidden width="18" height="8" viewBox="0 0 18 8" className="shrink-0">
              <line x1="1" x2="17" y1="4" y2="4" stroke={o.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={o.punteada ? '4 3' : undefined} opacity={on ? 1 : 0.4} />
            </svg>
            {o.nombre}
          </button>
        );
      })}
    </div>
  );
}
