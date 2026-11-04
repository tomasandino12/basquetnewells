import { CardBoton } from '../components/ui/card';
import { Chip } from '../components/ui/chip';
import { cifra, nombreCompleto } from '../plantel/vista';
import type { Jugador } from '../plantel/tipos';

interface Props {
  jugador: Jugador;
  activa: boolean;
  /** En compu la tarjeta «queda apretada» (panel lateral); en celular abre una hoja. */
  escritorio: boolean;
  alElegir: (id: string) => void;
}

// Todas miden lo mismo: alto fijo, ancho de la columna, y el texto largo se corta
// con puntos suspensivos en vez de estirar la tarjeta.
export function TarjetaJugador({ jugador: j, activa, escritorio, alElegir }: Props) {
  const resumen = j.partidos === 0
    ? 'Sin partidos'
    : `${cifra(j.puntos)} pts · ${cifra(j.asistencias)} ast`;
  return (
    <CardBoton
      aria-pressed={escritorio ? activa : undefined}
      aria-haspopup={escritorio ? undefined : 'dialog'}
      aria-label={`${nombreCompleto(j)}, ${j.posicion}`}
      onClick={() => alElegir(j.id)}
      className="flex h-[10.5rem] min-w-0 flex-col justify-between p-3"
    >
      <span className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className={`font-titulo text-[3.5rem] leading-[.85] font-bold tabular-nums ${activa ? 'text-club-texto' : 'text-tinta'}`}
        >
          {j.numero ?? '—'}
        </span>
        <Chip className="mt-0.5 shrink-0">{j.posicion}</Chip>
      </span>
      <span className="block min-w-0">
        <span className="block truncate font-titulo text-xl leading-tight font-semibold">{j.apellido}</span>
        <span className="block truncate text-sm text-gris">{j.nombre}</span>
        <span className="mt-1.5 block truncate font-mono text-xs font-medium text-gris">{resumen}</span>
      </span>
    </CardBoton>
  );
}
