import { useMemo } from 'react';
import { Pagina } from '../components/ui/pagina';
import { Proveedores, crearConsultas } from '../datos/contexto';
import { repositorioDeDatosDemo } from '../mocks/datosDemo';
import { repositorioDeHoyDemo } from '../mocks/hoyDemo';
import { ContenidoDeDatos } from './Datos';
import { ContenidoDeHoy, MarcoDeHoy } from './Hoy';
import { Biblioteca } from './Recursos';

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

/** Recursos con ejercicios y jugadas inventados: la misma pantalla de verdad, sin cuenta y sin datos del club. */
export function RecursosEjemplo() {
  const consultas = useMemo(() => crearConsultas(), []);
  return (
    <Proveedores cargar={cargar} consultas={consultas}>
      <Biblioteca clubId="demo" planteles={[{ id: 'demo', categoria: 'U13', categoriaCodigo: 'U13', codigoCabb: null, temporadaId: 't-1' }]} />
    </Proveedores>
  );
}

const cargarDatos = async () => repositorioDeDatosDemo;

/** Datos con partidos, baterías, asistencia y sprints inventados: la misma pantalla de verdad, sin cuenta. */
export function DatosEjemplo() {
  const consultas = useMemo(() => crearConsultas(), []);
  return (
    <Proveedores cargar={cargarDatos} consultas={consultas}>
      <Pagina>
        <ContenidoDeDatos clubId="demo" plantelId="demo" categoria="U13 · Microestadio" />
      </Pagina>
    </Proveedores>
  );
}
