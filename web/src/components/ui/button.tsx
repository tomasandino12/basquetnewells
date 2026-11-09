import { cva, type VariantProps } from 'class-variance-authority';
import { ArrowRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

// Casi recto, mayúsculas con aire: el botón del sitio del club (DESIGN.md).
// La principal es lima y hay una sola por pantalla: es lo que más llama la atención (criterio de Tomás).
const boton = cva(
  [
    'group inline-flex min-h-11 items-center justify-center gap-2 rounded-btn px-5 font-titulo text-lg font-semibold tracking-[.14em] uppercase select-none',
    // Se hunde apenas al tocarlo: responde antes de que termine el gesto.
    'transition-transform duration-[var(--dur-1)] active:scale-[.97]',
    'outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
    // Apagado se lee por forma y contraste, no sólo por color.
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-sup-2 disabled:text-gris disabled:active:scale-100',
  ],
  {
    variants: {
      variante: {
        principal: 'bg-lima text-sobre-lima',
        // Rojo vivo: para lo del club o lo que no tiene vuelta atrás, nunca al lado de la lima.
        club: 'bg-club text-sobre-club [@media(hover:hover)]:hover:bg-club-osc',
        // La secundaria al lado de una principal: sin relleno, en el rojo profundo.
        linea: 'border border-club-texto bg-transparent text-club-texto [@media(hover:hover)]:hover:bg-club-cl',
        // Bordó macizo; en oscuro el borde lo separa del fondo.
        secundario: 'border border-borde-control bg-bordo text-sobre-bordo [@media(hover:hover)]:hover:bg-cereza',
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

type Props = ComponentProps<'button'> & VariantProps<typeof boton> & {
  /** Flecha que avanza al pasar el mouse: el detalle de la acción principal que lleva a otro lado. */
  flecha?: boolean;
};

/** La misma forma para un enlace (`<Link>` o `<a>`): ir a otra pantalla se ve igual que un botón. */
export const claseBoton = (opciones: VariantProps<typeof boton> = {}) => boton(opciones);

/** La flecha que avanza: va adentro de algo con la clase `group` (un Boton o un enlace con claseBoton). */
export function Flecha() {
  return (
    <ArrowRight
      aria-hidden
      strokeWidth={2.5}
      className="size-5 transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)] group-active:translate-x-0.5 [@media(hover:hover)]:group-hover:translate-x-1"
    />
  );
}

export function Boton({ className, variante, tamano, flecha, type = 'button', children, ...props }: Props) {
  return (
    <button type={type} className={cn(boton({ variante, tamano }), className)} {...props}>
      {children}
      {flecha && <Flecha />}
    </button>
  );
}
