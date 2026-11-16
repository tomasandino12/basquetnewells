import { WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { esSinConexion, mensajeDeError } from '../../datos/errores';
import { Aviso } from './aviso';
import { Boton } from './button';
import { Cargando } from './estados';

interface Props<T> {
  consulta: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown };
  /** Lo que se cuenta si falla por algo que no es la conexión ni el permiso: «No pudimos cargar los planteles». */
  errorGenerico: string;
  filas?: number;
  /** Dibuja también el lugar del título: para pantallas que cargan antes de mostrar su título. */
  conTitulo?: boolean;
  children: (datos: T) => ReactNode;
}

/**
 * Carga, error y sin conexión iguales en todas las pantallas que piden datos.
 * El error siempre trae una salida (reintentar); nunca queda una pantalla en blanco.
 */
export function Consulta<T>({ consulta, errorGenerico, filas, conTitulo, children }: Props<T>) {
  if (consulta.isPending) return <Cargando filas={filas} titulo={conTitulo} />;
  if (consulta.isError || consulta.data === undefined) {
    const sinRed = esSinConexion(consulta.error);
    return (
      <div className="flex flex-col items-start gap-3">
        <Aviso tono="error" titulo={sinRed ? 'Sin conexión' : errorGenerico}>
          {mensajeDeError(consulta.error, 'Probá de nuevo en un momento.')}
        </Aviso>
        <Boton variante="contorno" tamano="chico" onClick={() => void consulta.refetch()}>
          {sinRed && <WifiOff aria-hidden className="size-4" />}
          Reintentar
        </Boton>
      </div>
    );
  }
  return <>{children(consulta.data)}</>;
}
