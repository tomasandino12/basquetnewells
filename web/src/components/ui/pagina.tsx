import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * El ancho de TODAS las pantallas: un solo contenedor, para que ninguna se encoja sola.
 * - Celular: usa todo el ancho, con 1rem de margen a cada lado.
 * - Tablet y compu: usa todo el ancho que dejan el menú y los márgenes (1.5rem, y 2rem desde compu).
 * - Un solo tope, `TOPE_DE_PAGINA`, sólo para pantallas muy anchas: ahí el contenido se centra.
 * Cargando, vacío, con pocos datos, con muchos o con error: el contenedor mide siempre lo mismo.
 */
export const TOPE_DE_PAGINA = 'max-w-[96rem]';
export const ANCHO_DE_PAGINA = `mx-auto w-full ${TOPE_DE_PAGINA} px-4 sm:px-6 lg:px-8`;

interface Props {
  children: ReactNode;
  /** Sólo para cosas que no son de ancho (por ejemplo, alto mínimo). Nunca un `max-w-*`. */
  className?: string;
}

export function Pagina({ children, className }: Props) {
  return <main className={cn(ANCHO_DE_PAGINA, 'py-5 lg:py-8', className)}>{children}</main>;
}
