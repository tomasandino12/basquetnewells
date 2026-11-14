import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface HojaProps {
  abierta: boolean;
  alCambiar: (abierta: boolean) => void;
  titulo: string;
  descripcion: string;
  children: ReactNode;
  /** Sobre el rojo oscuro del club (la ficha del jugador): el fondo y la cruz cambian de color. */
  rojo?: boolean;
  /** Lo que lee el lector de pantalla en la cruz; por defecto es el de la ficha. */
  etiquetaCerrar?: string;
  /** Un video necesita lugar: en pantalla grande la hoja se ensancha, en el celular sigue igual. */
  ancha?: boolean;
}

/** Hoja inferior para celular: se cierra con la cruz, el velo o Escape. */
export function Hoja({ abierta, alCambiar, titulo, descripcion, children, rojo = false, etiquetaCerrar = 'Cerrar la ficha', ancha = false }: HojaProps) {
  return (
    <Dialog.Root open={abierta} onOpenChange={alCambiar}>
      <Dialog.Portal>
        <Dialog.Overlay className="hoja-velo fixed inset-0 z-40 bg-[var(--velo)]" />
        <Dialog.Content
          className={cn(
            'hoja-contenido fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88svh] w-full max-w-[24.375rem] flex-col overflow-y-auto rounded-t-[1.125rem] border border-b-0 border-linea bg-sup text-tinta outline-none',
            ancha && 'md:max-w-4xl',
            rojo && 'border-club-osc bg-club-osc text-sobre-club',
          )}
        >
          <Dialog.Title className="sr-only">{titulo}</Dialog.Title>
          <Dialog.Description className="sr-only">{descripcion}</Dialog.Description>
          <Dialog.Close
            aria-label={etiquetaCerrar}
            className={cn(
              'absolute top-1 right-1 z-10 grid size-11 place-items-center rounded-full text-gris outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta',
              rojo && 'text-sobre-club focus-visible:outline-sobre-club',
            )}
          >
            <X aria-hidden className="size-5" />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
