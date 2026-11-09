import { useMemo } from 'react';
import { Proveedores, crearConsultas } from '../datos/contexto';
import { repositorioDemo } from '../mocks/hoyDemo';
import { ContenidoDelPlantel, MarcoDelPlantel } from './PlantelDelClub';

const cargar = async () => repositorioDemo;

/**
 * El plantel con chicos inventados: la misma pantalla de verdad, con un repositorio de mentira
 * que guarda lo que se toca sólo en memoria. Para ver el diseño sin cuenta y sin datos reales.
 */
export function PlantelEjemplo() {
  const consultas = useMemo(() => crearConsultas(), []);
  return (
    <Proveedores cargar={cargar} consultas={consultas}>
      <MarcoDelPlantel>
        <ContenidoDelPlantel clubId="demo" plantelId="demo" categoria="U13" />
      </MarcoDelPlantel>
    </Proveedores>
  );
}
