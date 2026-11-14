import type { ReactNode } from 'react';
import { Proveedores, crearConsultas } from '../datos/contexto';
import { repositorioDemo } from '../mocks/hoyDemo';
import { ContenidoDelPlantel, MarcoDelPlantel } from './PlantelDelClub';

const cargar = async () => repositorioDemo;
// Una sola caché para la maqueta: ir del plantel a una ficha y volver no vuelve a cargar todo.
const consultas = crearConsultas();

/** Los datos inventados de las maquetas del plantel y de la ficha. */
export function ConDatosDeEjemplo({ children }: { children: ReactNode }) {
  return (
    <Proveedores cargar={cargar} consultas={consultas}>
      {children}
    </Proveedores>
  );
}

/**
 * El plantel con chicos inventados: la misma pantalla de verdad, con un repositorio de mentira
 * que guarda lo que se toca sólo en memoria. Para ver el diseño sin cuenta y sin datos reales.
 */
export function PlantelEjemplo() {
  return (
    <ConDatosDeEjemplo>
      <MarcoDelPlantel>
        <ContenidoDelPlantel clubId="demo" plantelId="demo" categoria="U13" base="/maqueta/plantel" tomar="/maqueta/plantel" conMisiones={false} />
      </MarcoDelPlantel>
    </ConDatosDeEjemplo>
  );
}
