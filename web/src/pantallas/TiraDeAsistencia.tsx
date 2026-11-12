import { ETIQUETAS, diaMes } from '@datos/asistencia.js';
import { cn } from '../lib/cn';
import type { DiaDeLaTira } from '../plantel/filas';

/** Color de cada día en la tira: el mismo en la tira, en su leyenda y en la lista del plantel. */
export const COLOR_DIA: Record<string, string> = {
  presente: 'bg-sube',
  justificada: 'bg-ambar',
  ausente: 'bg-baja',
  sin_entreno: 'bg-linea',
};

const etiqueta = (clave: string) => (ETIQUETAS as Record<string, string>)[clave] ?? clave;

export function textoDelDia(d: DiaDeLaTira) {
  const cuando = diaMes(d.fecha) as string;
  if (d.estado === 'sin_entreno') return `${cuando}: no hubo entrenamiento`;
  if (d.estado === null) return `${cuando}: no se tomó`;
  if (d.estado === 'justificada') return `${cuando}: avisó${d.motivo ? ` (${etiqueta(d.motivo).toLowerCase()})` : ''}`;
  const base = `${cuando}: ${d.estado === 'presente' ? 'vino' : 'faltó sin avisar'}`;
  return d.lesionado ? `${base}, lesionado` : base;
}

/** Qué significa cada color; una sola vez por pantalla. */
export function LeyendaDeAsistencia({ className }: { className?: string }) {
  return (
    <ul aria-hidden className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs text-gris', className)}>
      {[['presente', 'Vino'], ['justificada', 'Avisó'], ['ausente', 'Faltó'], ['sin_entreno', 'Sin entreno']].map(([k, t]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-[2px]', COLOR_DIA[k])} />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Los últimos entrenamientos de un vistazo: un rectángulo por día, del más viejo al más nuevo. */
export function TiraDeAsistencia({ dias }: { dias: DiaDeLaTira[] }) {
  if (dias.length === 0) return null;
  return (
    <div>
      <ol aria-label="Últimos entrenamientos" className="flex gap-1">
        {dias.map((d) => (
          <li
            key={d.fecha}
            title={textoDelDia(d)}
            aria-label={textoDelDia(d)}
            className={cn(
              'h-3 flex-1 rounded-[2px]',
              d.estado === null ? 'border border-dashed border-borde-control' : COLOR_DIA[d.estado],
              d.lesionado && 'ring-2 ring-caramelo ring-offset-1 ring-offset-sup',
            )}
          />
        ))}
      </ol>
      <div className="mt-1.5 flex justify-between font-mono text-[0.6875rem] text-gris">
        <span>{diaMes(dias[0].fecha) as string}</span>
        <span>{diaMes(dias[dias.length - 1].fecha) as string}</span>
      </div>
      <LeyendaDeAsistencia className="mt-2" />
    </div>
  );
}

/** Cuántos entrenamientos muestra cada fila de la lista del plantel. */
export const ULTIMAS_EN_LISTA = 5;

/**
 * La tira chica de la lista del plantel: las últimas prácticas de ese chico, sin fechas ni leyenda.
 * Siempre ocupa 5 casilleros, con la misma medida en todas las filas: los que faltan (un chico nuevo o un
 * plantel con pocas prácticas) van vacíos a la izquierda, así la columna queda recta.
 */
export function UltimasAsistencias({ dias, nombre, className }: { dias: DiaDeLaTira[]; nombre: string; className?: string }) {
  const ultimas = dias.slice(-ULTIMAS_EN_LISTA);
  const vacios = Array.from({ length: ULTIMAS_EN_LISTA - ultimas.length }, (_, i) => (
    <span key={`vacio-${i}`} aria-hidden className="h-4 w-2 rounded-[2px] border border-linea sm:w-2.5" />
  ));
  const contenedor = cn('flex shrink-0 gap-[3px] sm:gap-1', className);
  if (ultimas.length === 0) return <span aria-label={`Sin entrenamientos de ${nombre}`} className={contenedor}>{vacios}</span>;
  return (
    <span role="img" aria-label={`Últimas asistencias de ${nombre}: ${ultimas.map(textoDelDia).join('; ')}`} className={contenedor}>
      {vacios}
      {ultimas.map((d) => (
        <span
          key={d.fecha}
          title={textoDelDia(d)}
          className={cn(
            'h-4 w-2 rounded-[2px] sm:w-2.5',
            d.estado === null ? 'border border-dashed border-borde-control' : COLOR_DIA[d.estado],
            d.lesionado && 'ring-2 ring-caramelo ring-offset-1 ring-offset-sup',
          )}
        />
      ))}
    </span>
  );
}
