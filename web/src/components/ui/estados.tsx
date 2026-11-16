import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface VacioProps {
  icono: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  titulo: string;
  /** Qué falta y qué hacer: un vacío sin salida no ayuda. */
  children: ReactNode;
  accion?: ReactNode;
  /** Ocupa todo el ancho y buena parte del alto, como la pantalla con datos: el vacío no se ve más chico que lo lleno. */
  llena?: boolean;
}

export function Vacio({ icono: Icono, titulo, children, accion, llena = false }: VacioProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', llena && 'min-h-[60svh] w-full justify-center rounded-tarjeta border border-linea')}>
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
export function Cargando({ filas = 3, className, titulo = false }: { filas?: number; className?: string; titulo?: boolean }) {
  return (
    <div role="status" className={cn('flex flex-col gap-2', className)}>
      <span className="sr-only">Cargando…</span>
      {/* El lugar del título de la pantalla (text-4xl, leading-none): lo de abajo no se corre cuando llega. */}
      {titulo && <div aria-hidden className="mb-2 h-9 w-44 rounded-campo bg-sup-2" />}
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} aria-hidden className="h-14 rounded-tarjeta bg-sup-2" />
      ))}
    </div>
  );
}

/** Una línea de texto que todavía no llegó, en el lugar y con el alto del texto: no mueve lo que tiene al lado. */
export function LineaCargando({ className }: { className?: string }) {
  return (
    <span role="status" className={cn('inline-block h-5 w-32 rounded-campo bg-sup-2 align-middle', className)}>
      <span className="sr-only">Cargando…</span>
    </span>
  );
}
