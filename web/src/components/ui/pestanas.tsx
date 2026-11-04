import { Tabs } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/cn';

// Radix ya trae flechas, Inicio/Fin y el foco correcto; acá sólo se le pone la cara.
export const Pestanas = Tabs.Root;

export function ListaPestanas({ className, ...props }: ComponentProps<typeof Tabs.List>) {
  return <Tabs.List className={cn('flex border-b border-linea', className)} {...props} />;
}

/** La elegida lleva el filete del club abajo; el cambio es inmediato, sin animar color. */
export function Pestana({ className, ...props }: ComponentProps<typeof Tabs.Trigger>) {
  return (
    <Tabs.Trigger
      className={cn(
        '-mb-px min-h-11 flex-1 border-b-[3px] border-transparent px-3 font-titulo text-lg font-semibold tracking-wide text-gris uppercase',
        'outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta',
        'data-[state=active]:border-club data-[state=active]:text-tinta',
        className,
      )}
      {...props}
    />
  );
}

export function PanelPestana({ className, ...props }: ComponentProps<typeof Tabs.Content>) {
  return <Tabs.Content className={cn('pt-4 outline-none', className)} {...props} />;
}
