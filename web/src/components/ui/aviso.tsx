import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

// Tarjeta con filete a la izquierda. El ícono acompaña al color: nada se dice sólo con el color.
const aviso = cva('flex gap-3 rounded-tarjeta border border-linea border-l-[3px] bg-sup p-4 shadow-tarjeta', {
  variants: {
    tono: {
      info: 'border-l-club',
      ok: 'border-l-sube',
      error: 'border-l-[5px] border-l-club bg-club-cl',
    },
  },
  defaultVariants: { tono: 'info' },
});

const ICONOS = { info: Info, ok: CircleCheck, error: CircleAlert } as const;

interface Props extends VariantProps<typeof aviso> {
  titulo: string;
  children?: ReactNode;
  className?: string;
}

/** Un error se anuncia (role="alert"); lo demás se lee en su momento (role="status"). */
export function Aviso({ tono = 'info', titulo, children, className }: Props) {
  const clave = tono ?? 'info';
  const Icono = ICONOS[clave];
  return (
    <div role={clave === 'error' ? 'alert' : 'status'} className={cn(aviso({ tono }), className)}>
      <Icono aria-hidden className={cn('mt-0.5 size-5 shrink-0', clave === 'ok' ? 'text-sube' : 'text-club-texto')} />
      <div className="min-w-0">
        <p className="font-semibold">{titulo}</p>
        {children && <div className="mt-0.5 text-sm text-gris">{children}</div>}
      </div>
    </div>
  );
}
