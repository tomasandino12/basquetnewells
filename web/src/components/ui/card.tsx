import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Superficie base: hueso en el tema claro, tarjeta bordó oscura en el otro. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-[0.6875rem] border border-linea bg-sup shadow-tarjeta', className)} {...props} />;
}

/**
 * Bloque de datos (de la rama del rediseño viejo): todo lo que se lee —cifras, barras, renglones— va
 * adentro de un panel, nunca suelto sobre el fondo con textura. El título va en Barlow, chico y con aire.
 */
export function Panel({ titulo, accion, className, children, ...props }: Omit<ComponentProps<'section'>, 'title'> & { titulo: string; accion?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('rounded-[0.6875rem] border border-linea bg-sup p-4 shadow-tarjeta', className)} {...props}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-linea pb-2">
        <h2 id={id} className="font-titulo text-lg leading-none font-semibold tracking-[.12em] text-gris uppercase">
          {titulo}
        </h2>
        {accion}
      </div>
      {children}
    </section>
  );
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
