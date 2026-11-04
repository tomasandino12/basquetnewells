import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface VacioProps {
  icono: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  titulo: string;
  /** Qué falta y qué hacer: un vacío sin salida no ayuda. */
  children: ReactNode;
  accion?: ReactNode;
}

export function Vacio({ icono: Icono, titulo, children, accion }: VacioProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-full bg-sup-2 text-gris">
        <Icono aria-hidden className="size-6" />
      </span>
      <h3 className="font-titulo text-2xl leading-none font-semibold uppercase tracking-wide">{titulo}</h3>
      <p className="max-w-xs text-sm text-gris">{children}</p>
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

/**
 * Esqueleto de carga: formas quietas, sin animación (DESIGN.md: nada en loop).
 * El «Cargando…» es sólo para lectores de pantalla.
 */
export function Cargando({ filas = 3, className }: { filas?: number; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col gap-2', className)}>
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} aria-hidden className="h-14 rounded-tarjeta bg-sup-2" />
      ))}
    </div>
  );
}
