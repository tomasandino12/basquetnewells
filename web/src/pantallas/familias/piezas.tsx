import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Las piezas que comparten las hojas y pantallas de familias y altas. Las filas se separan con espacio y
 * con un fondo distinto, no con bordes ni sombras; el estado se dice con texto, no con pastillas.
 */

/** El título de una hoja: el mismo en todas. */
export function TituloDeHoja({ children }: { children: ReactNode }) {
  return <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{children}</h2>;
}

/** El rótulo chico en mayúsculas que abre un bloque dentro de una hoja o de una ficha. */
export function RotuloDeBloque({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('font-mono text-xs tracking-wide text-gris uppercase', className)}>{children}</h3>;
}

/** La base de una fila: fondo propio y aire alrededor, sin borde. */
export const FILA_PLANA = 'rounded-tarjeta bg-sup-2 px-4 py-3';

/** Una fila que se toca (lleva a otra cosa): ocupa todo el ancho y da 44 px de alto como mínimo. */
export const FILA_TOCABLE = cn(
  FILA_PLANA,
  'flex min-h-14 w-full items-center gap-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta disabled:opacity-60 [@media(hover:hover)]:hover:bg-linea',
);

/** «2026-11-04» → «04/11». Vacío si no hay fecha. */
export const fechaCorta = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
