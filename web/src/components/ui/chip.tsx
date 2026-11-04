import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

const chip = cva(
  'inline-flex min-h-6 items-center rounded-[0.3125rem] px-2 text-xs font-medium transition-transform duration-[120ms] select-none',
  {
    variants: {
      tono: {
        suave: 'bg-sup-2 text-tinta',
        // Filtro elegido: se lee por contraste, sin gastar el color del club.
        activo: 'bg-tinta text-sup',
      },
    },
    defaultVariants: { tono: 'suave' },
  },
);

export function Chip({ className, tono, ...props }: ComponentProps<'span'> & VariantProps<typeof chip>) {
  return <span className={cn(chip({ tono }), className)} {...props} />;
}

/** Chip que se toca (filtros). Alto táctil de 44 px, aunque el chip se vea más bajo. */
export function ChipBoton({ className, activo, children, ...props }: ComponentProps<'button'> & { activo?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      className={cn(
        'relative inline-flex min-h-11 items-center px-1 text-sm font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
        className,
      )}
      {...props}
    >
      <Chip tono={activo ? 'activo' : 'suave'} className="min-h-8 px-3 text-sm">
        {children}
      </Chip>
    </button>
  );
}
