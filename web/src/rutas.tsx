import { Navigate, Outlet, createBrowserRouter, useLocation, type RouteObject } from 'react-router';
import { Consulta } from './components/ui/consulta';
import { Pagina } from './components/ui/pagina';
import { Marco } from './laboratorio';
import { useSesion } from './datos/contexto';
import { irALaDeSiempre } from './clasica';
import { BarraDeCategorias } from './pantallas/BarraDeCategorias';
import { Asistencia } from './pantallas/Asistencia';
import { AsistenciaHistorial } from './pantallas/AsistenciaHistorial';
import { Datos } from './pantallas/Datos';
import { Entrar } from './pantallas/Entrar';
import { CargarPartido } from './pantallas/importar/CargarPartido';
import { FichaEjemplo, PantallaDeFicha } from './pantallas/PantallaDeFicha';
import { Fisico } from './pantallas/Fisico';
import { FisicoEscalones } from './pantallas/FisicoEscalones';
import { FisicoSesion } from './pantallas/FisicoSesion';
import { Hoy } from './pantallas/Hoy';
import { Medir } from './pantallas/Medir';
import { Piezas } from './pantallas/Piezas';
import { Recursos } from './pantallas/Recursos';
import { DatosEjemplo, HoyEjemplo, RecursosEjemplo } from './pantallas/HoyEjemplo';
import { PlantelEjemplo } from './pantallas/PlantelEjemplo';
import { PlantelDelClub } from './pantallas/PlantelDelClub';
import { ProveedorPlantelActivo } from './plantel/activo';
import { Cargando } from './components/ui/estados';
import { useMiFicha } from './datos/consultasJugador';
import { JugadorFisico } from './pantallas/jugador/JugadorFisico';
import { JugadorJugadas } from './pantallas/jugador/JugadorJugadas';
import { JugadorProgreso } from './pantallas/jugador/JugadorProgreso';
import { JugadorRecursos } from './pantallas/jugador/JugadorRecursos';
import { JugadorSesion } from './pantallas/jugador/JugadorSesion';
import { MarcoJugador } from './pantallas/jugador/MarcoJugador';
import { MisionesPartido } from './pantallas/MisionesPartido';
import { CoordFamilias } from './pantallas/coord/CoordFamilias';
import { CoordFinanzas } from './pantallas/coord/CoordFinanzas';
import { CoordFormularios } from './pantallas/coord/CoordFormularios';
import { CoordPanorama } from './pantallas/coord/CoordPanorama';
import { CoordProfes } from './pantallas/coord/CoordProfes';
import { CoordRubros } from './pantallas/coord/CoordRubros';
import { CoordTemporada } from './pantallas/coord/CoordTemporada';
import { RequiereCoordinacion } from './pantallas/coord/MarcoCoord';

/** La puerta de entrada: quien tiene cuenta de jugador va a lo suyo; el resto, a Hoy. */
function Entrada() {
  const ficha = useMiFicha();
  if (ficha.isPending) return <Pagina><Cargando filas={2} /></Pagina>;
  return <Navigate to={ficha.data ? '/jugador/fisico' : '/hoy'} replace />;
}

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
    { path: '/maqueta/recursos', element: <RecursosEjemplo /> },
    { path: '/maqueta/datos', element: <DatosEjemplo /> },
    { element: <RequiereSesion />, children: [
        { path: '/', element: <Entrada /> },
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
        { path: '/datos', element: <Datos /> },
        // Cargar un partido cuelga de Datos (y del plantel vacío): no tiene ítem propio en el menú.
        { path: '/datos/cargar-partido', element: <CargarPartido /> },
        { path: '/recursos', element: <Recursos /> },
        { path: '/misiones/:previaId', element: <MisionesPartido /> },
        { path: '/fisico', element: <Fisico /> },
        { path: '/fisico/plan/:planId/sesion/:sesionId', element: <FisicoSesion /> },
        { path: '/fisico/plan/:planId/sesion/:sesionId/ejercicio/:lineaId', element: <FisicoEscalones /> },
      ],
    },
    // Coordinación no pasa por RequiereSesion: ése manda a la app de siempre a quien sólo coordina.
    // La puerta propia pide la sesión y el rol de coordinación.
    { element: <RequiereCoordinacion />, children: [
        { path: '/coordinacion', element: <CoordPanorama /> },
        { path: '/coordinacion/profes', element: <CoordProfes /> },
        { path: '/coordinacion/temporada', element: <CoordTemporada /> },
        { path: '/coordinacion/finanzas', element: <CoordFinanzas /> },
        { path: '/coordinacion/rubros', element: <CoordRubros /> },
        { path: '/coordinacion/familias', element: <CoordFamilias /> },
        { path: '/coordinacion/formularios', element: <CoordFormularios /> },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ] },
  // La vista del jugador tiene su propio marco (barra de abajo con sus cinco destinos) y no pasa por RequiereSesion:
  // quien entra es un jugador, sin club ni categoría activa. El marco mismo pide la ficha y la sesión.
  { element: <MarcoJugador />, children: [
    { path: '/jugador', element: <Navigate to="/jugador/fisico" replace /> },
    { path: '/jugador/fisico', element: <JugadorFisico /> },
    { path: '/jugador/progreso', element: <JugadorProgreso /> },
    { path: '/jugador/jugadas', element: <JugadorJugadas /> },
    { path: '/jugador/recursos', element: <JugadorRecursos /> },
    { path: '/jugador/sesion', element: <JugadorSesion /> },
    { path: '/jugador/sesion/:sesionId', element: <JugadorSesion /> },
  ] },
];

/**
 * Direcciones limpias (/app/hoy, /app/plantel/tobias-funes): vercel.json sirve esta app en todo
 * /app salvo /app/clasica. En la compu, el servidor de Vite la sirve en /nueva.
 */
export const BASE = typeof window !== 'undefined' && window.location.pathname.startsWith('/app') ? '/app' : '/nueva';

export const crearRouter = () => createBrowserRouter(rutas, { basename: BASE });
