import { Check, HeartPulse } from 'lucide-react';
import { Toggle, ToggleGroup } from 'radix-ui';
import { cn } from '../../lib/cn';

export type Aviso = 'avisó' | 'no-avisó';

interface Props {
  nombre: string;
  posicion: string;
  /** Chico y de ancho fijo: la camiseta cambia, el nombre es lo que identifica. */
  numero?: number | null;
  presente: boolean;
  aviso: Aviso | null;
  lesion: boolean;
  alPresente: (presente: boolean) => void;
  alAviso: (aviso: Aviso | null) => void;
  alLesion: (lesion: boolean) => void;
}

const OPCION =
  'min-h-11 flex-1 rounded-btn border border-borde-control px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta data-[state=on]:border-tinta data-[state=on]:bg-tinta data-[state=on]:text-fondo';

/**
 * Una fila por jugador. Se toca la fila entera: presente = pintada de rojo.
 * Al ausente se le pregunta si avisó y se le puede marcar una lesión.
 * Nada de coordinación acá (cuota, apto médico): eso no es del profe.
 */
export function FilaJugador({ nombre, posicion, numero, presente, aviso, lesion, alPresente, alAviso, alLesion }: Props) {
  return (
    <li
      data-presente={presente}
      className="relative overflow-hidden rounded-tarjeta border border-linea bg-sup shadow-tarjeta data-[presente=true]:border-club data-[presente=true]:text-sobre-club"
    >
      {/* El rojo es una capa: aparece con opacity (la GPU lo resuelve) y no repinta la fila. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 bg-club transition-opacity duration-[var(--dur-1)]',
          presente ? 'opacity-100' : 'opacity-0',
        )}
      />
      <button
        type="button"
        aria-pressed={presente}
        onClick={() => alPresente(!presente)}
        className="relative flex min-h-14 w-full items-center gap-3 px-4 text-left outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta data-[p=true]:focus-visible:outline-sobre-club"
        data-p={presente}
      >
        <span
          aria-hidden
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full border',
            presente ? 'border-sobre-club bg-sobre-club text-club' : 'border-borde-control',
          )}
        >
          {presente && <Check className="size-4" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-tight font-semibold">{nombre}</span>
          <span className={cn('block text-sm', presente ? 'text-sobre-club' : 'text-gris')}>{posicion}</span>
        </span>
        {lesion && presente && <HeartPulse aria-label="Con lesión" className="size-5 shrink-0" />}
        {numero != null && (
          <span className="w-8 shrink-0 text-right font-mono text-sm font-medium tabular-nums opacity-80">{numero}</span>
        )}
      </button>

      {!presente && (
        <div className="relative flex flex-wrap items-center gap-2 px-4 pb-3">
          <ToggleGroup.Root
            type="single"
            value={aviso ?? ''}
            onValueChange={(v) => alAviso(v === '' ? null : (v as Aviso))}
            aria-label={`¿${nombre} avisó que faltaba?`}
            className="flex min-w-[12rem] flex-1 gap-2"
          >
            <ToggleGroup.Item value="avisó" className={OPCION}>Avisó</ToggleGroup.Item>
            <ToggleGroup.Item value="no-avisó" className={OPCION}>No avisó</ToggleGroup.Item>
          </ToggleGroup.Root>
          <Toggle.Root
            pressed={lesion}
            onPressedChange={alLesion}
            className={cn(
              OPCION,
              'inline-flex flex-none items-center justify-center gap-1.5',
              'data-[state=on]:border-baja data-[state=on]:bg-baja-fondo data-[state=on]:text-baja',
            )}
          >
            <HeartPulse aria-hidden className="size-4" />
            Lesión
          </Toggle.Root>
        </div>
      )}
    </li>
  );
}
