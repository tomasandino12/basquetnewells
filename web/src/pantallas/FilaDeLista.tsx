import { HeartPulse } from 'lucide-react';
import { cn } from '../lib/cn';
import type { FilaPlantel } from '../plantel/filas';
import { UltimasAsistencias } from './TiraDeAsistencia';

interface Props {
  fila: FilaPlantel;
  /** La fila elegida va en rojo: es lo primero que se mira. */
  elegida: boolean;
  alElegir: (id: string) => void;
}

const dato = (valor: number | null, unidad: string) => (valor === null ? '—' : `${String(valor).replace('.', ',')} ${unidad}`);

/**
 * Una sola zona tocable por fila: abre la ficha. La asistencia no se marca acá (para eso está
 * «Tomar asistencia»): la fila muestra cómo vino en sus últimas prácticas.
 */
export function FilaDeLista({ fila: f, elegida, alElegir }: Props) {
  const nombre = `${f.apellido}${f.nombre ? `, ${f.nombre}` : ''}`;
  return (
    <li
      data-elegida={elegida}
      className={cn(
        'flex items-stretch overflow-hidden rounded-tarjeta border',
        elegida ? 'border-club bg-club text-sobre-club' : 'border-linea bg-sup shadow-tarjeta',
      )}
    >
      <button
        type="button"
        aria-pressed={elegida}
        aria-label={`Ficha de ${nombre}`}
        onClick={() => alElegir(f.id)}
        // Celular: avatar, nombre y números arriba; la tira de 5 prácticas debajo del nombre.
        // Compu: una sola línea con columnas de ancho fijo (nombre, tira, números), iguales en todas las filas.
        className="grid min-h-16 min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_5.25rem] items-center gap-x-3 gap-y-1 px-3 py-2 text-left outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta sm:grid-cols-[auto_minmax(0,1fr)_auto_5.25rem]"
      >
        <span
          aria-hidden
          className={cn(
            'row-span-2 grid size-10 shrink-0 place-items-center self-start rounded-full font-titulo text-base font-bold tracking-wide sm:row-span-1 sm:self-center',
            elegida ? 'bg-sobre-club/15' : 'bg-negro text-sobre-negro ring-1 ring-linea',
          )}
        >
          {f.iniciales}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-titulo text-xl leading-tight font-semibold">{nombre}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate font-mono text-xs', elegida ? 'text-sobre-club/85' : 'text-gris')}>
              {dato(f.alturaCm, 'cm')} · {dato(f.pesoKg, 'kg')}
            </span>
            {f.lesion && (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-[0.3125rem] px-1.5 text-xs font-semibold',
                  elegida ? 'bg-sobre-club/15' : 'bg-baja-fondo text-baja',
                )}
              >
                <HeartPulse aria-hidden className="size-3.5" />
                Lesionado
              </span>
            )}
          </span>
        </span>
        <UltimasAsistencias dias={f.ultimos} nombre={nombre} className="col-start-2 row-start-2 justify-self-start sm:col-start-3 sm:row-start-1" />
        <span className="col-start-3 row-start-1 flex flex-col font-mono text-xs leading-tight tabular-nums sm:col-start-4">
          <span className="flex justify-between gap-2">
            <span className={elegida ? 'text-sobre-club/85' : 'text-gris'}>Tiro </span>
            <b className="text-sm">{f.tiroPct === null ? '—' : `${f.tiroPct}%`}</b>
          </span>
          <span className="flex justify-between gap-2">
            <span className={elegida ? 'text-sobre-club/85' : 'text-gris'}>Asist. </span>
            <b className="text-sm">{f.asistenciaPct === null ? '—' : `${f.asistenciaPct}%`}</b>
          </span>
        </span>
      </button>
    </li>
  );
}
