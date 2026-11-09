import { useMemo } from 'react';
import { Proveedores, crearConsultas } from '../datos/contexto';
import { repositorioDeHoyDemo } from '../mocks/hoyDemo';
import { ContenidoDeHoy, MarcoDeHoy } from './Hoy';

const cargar = async () => repositorioDeHoyDemo;

/**
 * Hoy con datos inventados: la misma pantalla de verdad, con un repositorio de mentira adentro.
 * Sirve para ver el diseño sin entrar con una cuenta y sin datos de chicos reales.
 */
export function HoyEjemplo() {
  const consultas = useMemo(() => crearConsultas(), []);
  return (
    <Proveedores cargar={cargar} consultas={consultas}>
      <MarcoDeHoy>
        <ContenidoDeHoy clubId="demo" plantelId="demo" categoria="U13 · Microestadio" />
      </MarcoDeHoy>
    </Proveedores>
  );
}
