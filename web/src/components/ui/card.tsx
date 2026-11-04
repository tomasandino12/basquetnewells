import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

/** Superficie base: papel claro en el tema claro, tarjeta oscura en el otro. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-[0.6875rem] border border-linea bg-sup shadow-tarjeta', className)} {...props} />;
}

/**
 * Tarjeta que se toca. El borde de selección es un anillo que cambia de color
 * (no de tamaño), así elegir una no mueve a las vecinas.
 */
export function CardBoton({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-[0.6875rem] border border-linea bg-sup text-left shadow-tarjeta outline-offset-2',
        'transition-transform duration-[120ms] active:scale-[.98]',
        'focus-visible:outline-2 focus-visible:outline-tinta',
        '[@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-borde-control',
        'aria-pressed:border-club aria-pressed:ring-1 aria-pressed:ring-club',
        className,
      )}
      {...props}
    />
  );
}
