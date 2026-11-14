import type { ChangeEvent, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '../../lib/cn';

/** «Cómo se hace»: los pasos para bajar la planilla de Google y subirla acá. */
export function PasosDeImportacion({ children }: { children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">Cómo se hace:</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-gris">{children}</ol>
    </div>
  );
}

/** El selector de archivo con su etiqueta visible; sólo .xlsx. */
export function CampoDeArchivo({ etiqueta, alElegir, disabled }: { etiqueta: string; alElegir: (archivo: File | undefined) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">{etiqueta}</label>
      <input
        id={id}
        type="file"
        accept=".xlsx"
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => alElegir(e.target.files?.[0])}
        className="w-full rounded-campo border border-borde-control bg-sup p-2 text-sm file:mr-3 file:min-h-9 file:rounded-btn file:border-0 file:bg-negro file:px-3 file:font-semibold file:text-sobre-negro"
      />
    </div>
  );
}

/** Una fila con casilla: el chico, lo que se va a hacer con él y sus notas. La casilla mide 24 px y toda la fila se toca. */
export function FilaTildable({
  tildada, alCambiar, nombre, detalle, children,
}: { tildada: boolean; alCambiar: (tildada: boolean) => void; nombre: string; detalle: string; children?: ReactNode }) {
  return (
    <li>
      <label className={cn('flex min-h-14 cursor-pointer items-start gap-3 rounded-tarjeta bg-sup-2 px-4 py-3', !tildada && 'opacity-70')}>
        <input
          type="checkbox"
          checked={tildada}
          onChange={(e) => alCambiar(e.target.checked)}
          aria-label={nombre}
          className="mt-0.5 size-6 shrink-0 accent-[var(--club)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{nombre}</span>
          <span className="block text-sm text-gris">{detalle}</span>
          {children}
        </span>
      </label>
    </li>
  );
}
