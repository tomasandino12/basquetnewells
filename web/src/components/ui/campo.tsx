import { useId, type ComponentProps } from 'react';
import { cn } from '../../lib/cn';

interface Props extends Omit<ComponentProps<'input'>, 'id'> {
  etiqueta: string;
  ayuda?: string;
  /** Con error el campo se marca con borde del club y el texto lo cuenta (no sólo el color). */
  error?: string;
}

/** Campo de texto con su etiqueta visible, su ayuda y su error enlazados para lectores de pantalla. */
export function Campo({ etiqueta, ayuda, error, className, ...props }: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const describe = [error && idError, ayuda && idAyuda].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {etiqueta}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe}
        className={cn(
          'h-11 w-full rounded-campo border bg-sup px-3 text-base outline-offset-2 placeholder:text-gris focus-visible:outline-2 focus-visible:outline-tinta',
          error ? 'border-club' : 'border-borde-control',
        )}
        {...props}
      />
      {error && (
        <p id={idError} className="text-sm font-medium text-club-texto">
          {error}
        </p>
      )}
      {ayuda && (
        <p id={idAyuda} className="text-sm text-gris">
          {ayuda}
        </p>
      )}
    </div>
  );
}
