import { useState, type ReactNode } from 'react';
import { Aviso } from '../components/ui/aviso';
import { Boton } from '../components/ui/button';
import { Hoja } from '../components/ui/sheet';
import { cn } from '../lib/cn';

/** El rótulo chico en mayúsculas que abre cada bloque de coordinación. */
export function Rotulo({ children, cuenta, className }: { children: ReactNode; cuenta?: number | string; className?: string }) {
  return (
    <h2 className={cn('mt-6 mb-2 flex items-baseline justify-between font-mono text-xs tracking-wide text-gris uppercase first:mt-0', className)}>
      <span>{children}</span>
      {cuenta !== undefined && <span className="text-tinta">{cuenta}</span>}
    </h2>
  );
}

export const TITULO_DE_PANTALLA = 'font-titulo text-4xl leading-none font-bold tracking-tight lg:text-5xl';

/** La fila de una lista: lo de la izquierda crece y lo de la derecha (botones, chips) no se achica. */
export function Fila({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tarjeta border border-linea bg-sup px-4 py-3', className)}>{children}</div>;
}

/** El aviso de «Listo» que queda arriba de la pantalla después de guardar. */
export function Hecho({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return <Aviso tono="ok" titulo={texto} className="mb-4" />;
}

interface ConfirmarProps {
  abierta: boolean;
  alCerrar: () => void;
  titulo: string;
  /** Qué pasa si confirma: siempre dicho en una frase, sin tecnicismos. */
  texto: ReactNode;
  verbo: string;
  alConfirmar: () => Promise<void>;
  /** Texto del error si el guardado falla; se muestra adentro, con la hoja abierta. */
  mensajeDeError: (e: unknown) => string;
}

/** Confirmación en hoja: lo que no tiene vuelta atrás (rechazar, quitar, dar de baja, borrar, confirmar pases). */
export function Confirmar({ abierta, alCerrar, titulo, texto, verbo, alConfirmar, mensajeDeError }: ConfirmarProps) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cerrar = () => {
    setError(null);
    alCerrar();
  };
  return (
    <Hoja abierta={abierta} alCambiar={(a) => !a && cerrar()} titulo={titulo} descripcion={typeof texto === 'string' ? texto : titulo} etiquetaCerrar="Cerrar">
      <div className="flex flex-col gap-4 p-5 pt-12">
        <h2 className="font-titulo text-3xl leading-none font-semibold uppercase">{titulo}</h2>
        <div className="text-sm text-gris">{texto}</div>
        {error && <Aviso tono="error" titulo={error} />}
        <div className="flex flex-col gap-2">
          <Boton
            variante="club"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              setError(null);
              try {
                await alConfirmar();
                cerrar();
              } catch (e) {
                setError(mensajeDeError(e));
              } finally {
                setOcupado(false);
              }
            }}
          >
            {ocupado ? 'Guardando…' : verbo}
          </Boton>
          <Boton variante="contorno" onClick={cerrar}>Cancelar</Boton>
        </div>
      </div>
    </Hoja>
  );
}

/** Un campo de selección con la misma cara que `Campo`. */
export function Seleccion({ etiqueta, className, children, ...props }: { etiqueta: string } & React.ComponentProps<'select'>) {
  return (
    <label className={cn('flex flex-col gap-1 text-sm font-semibold', className)}>
      {etiqueta}
      <select className="h-11 w-full rounded-campo border border-borde-control bg-sup px-3 text-base font-normal outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta" {...props}>
        {children}
      </select>
    </label>
  );
}
