import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { Proveedores, crearConsultas } from './contexto';
import type { Repositorio, Sesion } from './repositorio';

export const sesionInventada: Sesion = { user: { id: 'u-1', email: 'profe@ejemplo.test' } };

/** Un repositorio de mentira: sesión abierta, un club y un par de planteles inventados. Cada prueba pisa lo que necesita. */
export function repositorioInventado(piso: Partial<Repositorio> = {}): Repositorio {
  return {
    obtenerSesionActual: async () => sesionInventada,
    iniciarSesion: async () => sesionInventada,
    cerrarSesion: async () => {},
    alCambiarAuth: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    fueSalidaVoluntaria: () => true,
    obtenerClubesDelEntrenador: async () => [{ id: 'c-1', nombre: 'Club de Ejemplo', apodos: [] }],
    obtenerPlantelesDelClub: async () => [
      { id: 'p-1', categoria: 'Sub 13', categoriaCodigo: 'U13', codigoCabb: null, temporadaId: 't-1' },
      { id: 'p-2', categoria: 'Sub 15', categoriaCodigo: 'U15', codigoCabb: null, temporadaId: 't-1' },
    ],
    obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }),
    obtenerMisPlantelesAsignados: async () => new Set<string>(),
    obtenerJugadoresDelPlantel: async () => [],
    obtenerMedicionesCorporalesDelClub: async () => [],
    obtenerSolicitudesDelPlantel: async () => [],
    obtenerEntrenamientos: async () => [],
    obtenerLesionesDelPlantel: async () => [],
    obtenerSesionesDeMedicion: async () => [],
    obtenerMedicionesTiroDelPlantel: async () => [],
    obtenerMetasDelPlantel: async () => ({}),
    obtenerPreviasDelPlantel: async () => [],
    obtenerPartidosDelPlantel: async () => [],
    guardarAsistencia: async () => 'e-1',
    abrirLesion: async () => {},
    darAlta: async () => {},
    sacarDelPlantel: async () => {},
    obtenerMiFicha: async () => null,
    obtenerMiPlan: async () => ({ planes: [], pesos: [] }),
    obtenerMiProgreso: async () => ({ partidos: [], tiro: [], saltos: [], sprints: [], yoyos: [], escalones: [] }),
    misJugadas: async () => [],
    obtenerMisRecursos: async () => [],
    registrarAperturaDeRecurso: async () => {},
    obtenerPrevia: async () => null,
    obtenerEstadisticasParaMisiones: async () => [],
    evaluarMisiones: async () => ({}),
    obtenerPlanesFisicos: async () => [],
    obtenerPlanFisico: async () => [],
    obtenerPasos: async () => [],
    crearPaso: async ({ clave, nombre, paso }) => ({ id: 'pa-nuevo', clave, nombre, paso }),
    editarPaso: async (id, paso) => ({ id, clave: 'x', nombre: 'x', paso }),
    obtenerEscalonesActuales: async () => [],
    moverEscalon: async ({ jugadorId, kg }) => ({ jugadorId, kg, desde: new Date().toISOString() }),
    obtenerEjercicios: async () => [],
    obtenerEjercicio: async () => null,
    obtenerNotas: async () => [],
    obtenerVariaciones: async () => [],
    listarJugadas: async () => [],
    plantelesDeJugada: async () => [],
    asignarJugada: async () => {},
    crearJugada: async () => ({}),
    ...piso,
  };
}

export function renderConDatos(rutas: RouteObject[], { repo = repositorioInventado(), ruta = '/' } = {}) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  const resultado = render(
    <Proveedores cargar={async () => repo} consultas={crearConsultas({ retardoMs: 0 })}>
      <RouterProvider router={router} />
    </Proveedores>,
  );
  return { ...resultado, router };
}
