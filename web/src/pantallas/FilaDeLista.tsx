import { Check, HeartPulse } from 'lucide-react';
import { cn } from '../lib/cn';
import type { FilaPlantel } from '../plantel/filas';

interface Props {
  fila: FilaPlantel;
  /** La fila elegida va en rojo: es lo primero que se mira. */
  elegida: boolean;
  guardando: boolean;
  alElegir: (id: string) => void;
  alPresente: (fila: FilaPlantel) => void;
}

const dato = (valor: number | null, unidad: string) => (valor === null ? '—' : `${String(valor).replace('.', ',')} ${unidad}`);

/**
 * Dos botones por fila: el tilde marca presente (sin abrir la ficha) y el resto abre la ficha.
 * El presente se ve con tilde y un fondo apenas más claro; el rojo lleno queda para la fila elegida.
 */
export function FilaDeLista({ fila: f, elegida, guardando, alElegir, alPresente }: Props) {
  const presente = f.hoy === 'presente';
  const nombre = `${f.apellido}${f.nombre ? `, ${f.nombre}` : ''}`;
  return (
    <li
      data-elegida={elegida}
      data-presente={presente}
      className={cn(
        'flex items-stretch overflow-hidden rounded-tarjeta border',
        elegida ? 'border-club bg-club text-sobre-club' : presente ? 'border-linea bg-sup-2' : 'border-linea bg-sup shadow-tarjeta',
      )}
    >
      <button
        type="button"
        aria-pressed={presente}
        aria-label={`Marcar presente a ${nombre}`}
        disabled={guardando}
        onClick={() => alPresente(f)}
        className="grid min-h-14 w-14 shrink-0 place-items-center outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta"
      >
        <span
          aria-hidden
          className={cn(
            'grid size-7 place-items-center rounded-full border-2',
            elegida
              ? presente ? 'border-sobre-club bg-sobre-club text-club' : 'border-sobre-club/70'
              : presente ? 'border-tinta bg-tinta text-fondo' : 'border-borde-control',
          )}
        >
          {presente && <Check className="size-4" strokeWidth={3} />}
        </span>
      </button>
      <button
        type="button"
        aria-pressed={elegida}
        aria-label={`Ficha de ${nombre}`}
        onClick={() => alElegir(f.id)}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-3 text-left outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-titulo text-xl leading-tight font-semibold">{nombre}</span>
          <span className={cn('block truncate font-mono text-xs', elegida ? 'text-sobre-club/85' : 'text-gris')}>
            {dato(f.alturaCm, 'cm')} · {dato(f.pesoKg, 'kg')}
          </span>
        </span>
        {f.lesion && <HeartPulse aria-label="Lesionado" className="size-5 shrink-0" />}
        <span className="flex shrink-0 flex-col items-end font-mono text-xs leading-tight tabular-nums">
          <span>
            <span className={elegida ? 'text-sobre-club/85' : 'text-gris'}>Tiro </span>
            <b className="text-sm">{f.tiroPct === null ? '—' : `${f.tiroPct}%`}</b>
          </span>
          <span>
            <span className={elegida ? 'text-sobre-club/85' : 'text-gris'}>Asist. </span>
            <b className="text-sm">{f.asistenciaPct === null ? '—' : `${f.asistenciaPct}%`}</b>
          </span>
        </span>
      </button>
    </li>
  );
}
