import { useId } from 'react';
import { cn } from '../../lib/cn';

interface Props {
  etiqueta: string;
  /** Qué cambia al prenderlo, en una línea. */
  descripcion?: string;
  activo: boolean;
  alCambiar: (activo: boolean) => void;
}

/**
 * Interruptor con su etiqueta: toda la fila se toca (44 px de alto como mínimo). El estado se dice
 * con la posición de la perilla y con el texto «Prendido»/«Apagado», no sólo con el color.
 */
export function Interruptor({ etiqueta, descripcion, activo, alCambiar }: Props) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-labelledby={`${id}-t`}
      aria-describedby={descripcion ? `${id}-d` : undefined}
      onClick={() => alCambiar(!activo)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-campo text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta"
    >
      <span className="min-w-0">
        <span id={`${id}-t`} className="block font-semibold">{etiqueta}</span>
        {descripcion && <span id={`${id}-d`} className="block text-sm text-gris">{descripcion}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span aria-hidden className="font-mono text-xs tracking-wide text-gris uppercase">{activo ? 'Prendido' : 'Apagado'}</span>
        <span
          aria-hidden
          className={cn(
            'relative h-7 w-12 rounded-full border transition-colors duration-[var(--dur-2)]',
            activo ? 'border-club bg-club' : 'border-borde-control bg-sup-2',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-5.5 rounded-full bg-sup shadow-tarjeta transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)]',
              activo ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </span>
      </span>
    </button>
  );
}
