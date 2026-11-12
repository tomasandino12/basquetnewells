import { Navigate, Outlet, createBrowserRouter, useLocation, type RouteObject } from 'react-router';
import { Consulta } from './components/ui/consulta';
import { Pagina } from './components/ui/pagina';
import { Marco } from './laboratorio';
import { useSesion } from './datos/contexto';
import { irALaDeSiempre } from './clasica';
import { BarraDeCategorias } from './pantallas/BarraDeCategorias';
import { Asistencia } from './pantallas/Asistencia';
import { AsistenciaHistorial } from './pantallas/AsistenciaHistorial';
import { Entrar } from './pantallas/Entrar';
import { FichaEjemplo, PantallaDeFicha } from './pantallas/PantallaDeFicha';
import { Fisico } from './pantallas/Fisico';
import { FisicoEscalones } from './pantallas/FisicoEscalones';
import { FisicoSesion } from './pantallas/FisicoSesion';
import { Hoy } from './pantallas/Hoy';
import { Medir } from './pantallas/Medir';
import { Piezas } from './pantallas/Piezas';
import { Recursos } from './pantallas/Recursos';
import { HoyEjemplo } from './pantallas/HoyEjemplo';
import { PlantelEjemplo } from './pantallas/PlantelEjemplo';
import { PlantelDelClub } from './pantallas/PlantelDelClub';
import { ProveedorPlantelActivo } from './plantel/activo';

/**
 * Todo lo que lleva datos reales pasa por acá. Sin sesión, publicada, se entra en la app de
 * siempre (tiene el alta, Google y la clave olvidada) y de ahí vuelve; en la compu, a /entrar.
 * Con sesión, la categoría elegida (los chips de arriba) vale para todas las pantallas.
 */
export function RequiereSesion() {
  const { estado, error, reintentar } = useSesion();
  const lugar = useLocation();
  if (estado === 'con-sesion') {
    return (
      <ProveedorPlantelActivo>
        <BarraDeCategorias />
        <Outlet />
      </ProveedorPlantelActivo>
    );
  }
  if (estado === 'sin-sesion' && irALaDeSiempre({ volver: true })) return null;
  if (estado === 'sin-sesion') return <Navigate to="/entrar" replace state={{ desde: lugar.pathname }} />;
  return (
    <Pagina>
      <Consulta
        consulta={{ isPending: estado === 'cargando', isError: estado === 'error', error, data: undefined, refetch: reintentar }}
        errorGenerico="No pudimos revisar tu sesión"
      >
        {() => null}
      </Consulta>
    </Pagina>
  );
}

/** Mantiene ?fecha=… al mudar una dirección vieja. */
function RedirigirConBusqueda({ a }: { a: string }) {
  return <Navigate to={{ pathname: a, search: useLocation().search }} replace />;
}

export const rutas: RouteObject[] = [
  // El menú (laboratorio.tsx) va en todas: así se llega a cada pantalla sin saberse la dirección.
  { element: <Marco />, children: [
    { path: '/entrar', element: <Entrar /> },
    // Pantallas con datos de ejemplo: las enlaza el menú, nunca la app de siempre.
    { path: '/piezas', element: <Piezas /> },
    { path: '/maqueta/plantel', element: <PlantelEjemplo /> },
    { path: '/maqueta/plantel/:jugador', element: <FichaEjemplo /> },
    { path: '/maqueta/hoy', element: <HoyEjemplo /> },
    { element: <RequiereSesion />, children: [
        { path: '/', element: <Navigate to="/hoy" replace /> },
        { path: '/hoy', element: <Hoy /> },
        { path: '/plantel', element: <PlantelDelClub /> },
        { path: '/plantel/:jugador', element: <PantallaDeFicha /> },
        // La asistencia se toma desde el plantel: la toma (de hoy o de otro día) y el historial
        // cuelgan de /plantel. Las direcciones de antes (favoritos, enlaces) redirigen acá.
        { path: '/plantel/asistencia', element: <Asistencia /> },
        { path: '/plantel/asistencia/historial', element: <AsistenciaHistorial /> },
        { path: '/asistencia', element: <RedirigirConBusqueda a="/plantel/asistencia" /> },
        { path: '/asistencia/historial', element: <RedirigirConBusqueda a="/plantel/asistencia/historial" /> },
        { path: '/medir', element: <Medir /> },
        { path: '/recursos', element: <Recursos /> },
        { path: '/fisico', element: <Fisico /> },
        { path: '/fisico/plan/:planId/sesion/:sesionId', element: <FisicoSesion /> },
        { path: '/fisico/plan/:planId/sesion/:sesionId/ejercicio/:lineaId', element: <FisicoEscalones /> },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ] },
];

/**
 * Direcciones limpias (/app/hoy, /app/plantel/tobias-funes): vercel.json sirve esta app en todo
 * /app salvo /app/clasica. En la compu, el servidor de Vite la sirve en /nueva.
 */
export const BASE = typeof window !== 'undefined' && window.location.pathname.startsWith('/app') ? '/app' : '/nueva';

export const crearRouter = () => createBrowserRouter(rutas, { basename: BASE });
