import type { ReactNode } from 'react';
import { ZonaDeArchivo } from '../../interacciones/ZonaDeArchivo';
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

/** El selector de archivo: una zona para soltar o elegir el .xlsx, con la planilla que encesta mientras se lee. */
export function CampoDeArchivo({ etiqueta, alElegir, disabled }: { etiqueta: string; alElegir: (archivo: File | undefined) => void; disabled?: boolean }) {
  return <ZonaDeArchivo etiqueta={etiqueta} alElegir={alElegir} disabled={disabled} />;
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
