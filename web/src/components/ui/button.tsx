import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

// Casi recto, mayúsculas con aire: el botón del sitio del club (DESIGN.md).
const boton = cva(
  [
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-btn px-5 font-titulo text-lg font-semibold tracking-[.14em] uppercase select-none',
    'transition-transform duration-[var(--dur-1)] active:scale-[.97]',
    'outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
    // Apagado se lee por forma y contraste, no sólo por color.
    'disabled:cursor-not-allowed disabled:bg-sup-2 disabled:text-gris disabled:active:scale-100',
  ],
  {
    variants: {
      variante: {
        principal: 'bg-club text-sobre-club [@media(hover:hover)]:hover:bg-club-osc',
        // Negro macizo en claro; en oscuro sube un escalón y lleva borde, si no se pierde.
        secundario: 'border border-tinta bg-tinta text-fondo [@media(hover:hover)]:hover:bg-club [@media(hover:hover)]:hover:border-club [@media(hover:hover)]:hover:text-sobre-club',
        contorno: 'border border-borde-control bg-transparent text-tinta [@media(hover:hover)]:hover:border-tinta',
      },
      tamano: {
        normal: '',
        chico: 'px-3 text-base',
      },
    },
    defaultVariants: { variante: 'principal', tamano: 'normal' },
  },
);

type Props = ComponentProps<'button'> & VariantProps<typeof boton>;

export function Boton({ className, variante, tamano, type = 'button', ...props }: Props) {
  return <button type={type} className={cn(boton({ variante, tamano }), className)} {...props} />;
}
