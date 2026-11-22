import type { ReactNode } from 'react';
import { Navigate, Outlet, createBrowserRouter, useLocation, type RouteObject } from 'react-router';
import { Consulta } from './components/ui/consulta';
import { Pagina } from './components/ui/pagina';
import { Marco } from './laboratorio';
import { useSesion } from './datos/contexto';
import { BarraDeCategorias, ReservaDeCategorias } from './pantallas/BarraDeCategorias';
import { Asistencia } from './pantallas/Asistencia';
import { AsistenciaHistorial } from './pantallas/AsistenciaHistorial';
import { Datos } from './pantallas/Datos';
import { Entrar } from './pantallas/Entrar';
import { NuevaClave } from './pantallas/NuevaClave';
import { PasosDeCuenta } from './pantallas/cuenta/PasosDeCuenta';
import { useRecuperacionPendiente } from './cuenta/recuperacion';
import { CargarPartido } from './pantallas/importar/CargarPartido';
import { CargarPlanFisico } from './pantallas/importar/CargarPlanFisico';
import { FichaEjemplo, PantallaDeFicha } from './pantallas/PantallaDeFicha';
import { Fisico } from './pantallas/Fisico';
import { FisicoEscalones } from './pantallas/FisicoEscalones';
import { FisicoSesion } from './pantallas/FisicoSesion';
import { Hoy } from './pantallas/Hoy';
import { CoordInventario, InventarioLectura } from './pantallas/Inventario';
import { Medir } from './pantallas/Medir';
import { Metas } from './pantallas/Metas';
import { MedirBateria } from './pantallas/MedirBateria';
import { MedirSalto } from './pantallas/MedirSalto';
import { MedirSprint } from './pantallas/MedirSprint';
import { MedirYoyo } from './pantallas/MedirYoyo';
import { Piezas } from './pantallas/Piezas';
import { LaboratorioInteracciones } from './pantallas/LaboratorioInteracciones';
import { Recursos } from './pantallas/Recursos';
import { DatosEjemplo, HoyEjemplo, RecursosEjemplo } from './pantallas/HoyEjemplo';
import { PlantelEjemplo } from './pantallas/PlantelEjemplo';
import { PlantelDelClub } from './pantallas/PlantelDelClub';
import { ProveedorPlantelActivo } from './plantel/activo';
import { Cargando } from './components/ui/estados';
import { useMiFicha } from './datos/consultasJugador';
import { JugadorFisico } from './pantallas/jugador/JugadorFisico';
import { EditorDeJugada } from './pantallas/EditorDeJugada';
import { JugadorJugadas } from './pantallas/jugador/JugadorJugadas';
import { JugadorProgreso } from './pantallas/jugador/JugadorProgreso';
import { JugadorRecursos } from './pantallas/jugador/JugadorRecursos';
import { JugadorSesion } from './pantallas/jugador/JugadorSesion';
import { MarcoJugador } from './pantallas/jugador/MarcoJugador';
import { ArmarMisiones } from './pantallas/ArmarMisiones';
import { MisionesPartido } from './pantallas/MisionesPartido';
import { Perfil } from './pantallas/Perfil';
import { FamiliaChicos, MarcoFamilia } from './pantallas/familia/Familia';
import { GuiaDePrimerUso } from './guia/GuiaDePrimerUso';
import { useDatosDelPerfil } from './datos/consultasPerfil';
import { useMisClubes, useMisRoles } from './datos/consultas';
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
  const perfil = useDatosDelPerfil();
  if (!perfil.rolesListos) return <Pagina><Cargando titulo filas={3} /></Pagina>;
  if (perfil.esJugador) return <Navigate to="/jugador/fisico" replace />;
  // Una familia (sin club propio) tiene su portal: ve a sus hijos y nada más.
  if (perfil.esFamilia && !perfil.esEntrenador && !perfil.esCoordinador) return <Navigate to="/familia" replace />;
  // Quien sólo coordina no tiene categorías propias: arranca en el panorama del club.
  if (perfil.esCoordinador && !perfil.esEntrenador) return <Navigate to="/coordinacion" replace />;
  return <Navigate to="/hoy" replace />;
}

/** La intro de primer uso de quien entrena o coordina (entrenar gana si es las dos cosas, como siempre). */
function GuiaDelCuerpoTecnico() {
  const club = useMisClubes().data?.[0];
  const roles = useMisRoles(club?.id).data;
  if (!roles || (!roles.esEntrenador && !roles.esCoordinador)) return null;
  return <GuiaDePrimerUso modo={roles.esEntrenador ? 'entrenar' : 'coordinar'} esCoordinador={roles.esCoordinador} />;
}

/**
 * Todo lo que lleva datos reales pasa por acá. Sin sesión, a /entrar (ahí están el alta, Google y la
 * clave olvidada) y de ahí vuelve. Con sesión, primero el nombre, los Términos y el acceso
 * (PasosDeCuenta); después, la categoría elegida (los chips de arriba) vale para todas las pantallas.
 */
export function RequiereSesion() {
  return (
    <PuertaDeSesion conBarra>
      <ProveedorPlantelActivo>
        <BarraDeCategorias />
        <Outlet />
        <GuiaDelCuerpoTecnico />
      </ProveedorPlantelActivo>
    </PuertaDeSesion>
  );
}

/**
 * Mi perfil lo abre cualquiera con cuenta (profe, coordinación, jugador, familia): pide sólo la
 * sesión, sin categoría elegida (ésa es del cuerpo técnico).
 */
export function RequiereSoloSesion() {
  return (
    <PuertaDeSesion sinAcceso>
      <Outlet />
    </PuertaDeSesion>
  );
}

/**
 * `conBarra`: la pantalla lleva arriba los chips de categoría (BarraDeCategorias). Mientras se revisa la
 * sesión se reserva su lugar, así la carga de la sesión y la de la categoría se ven como una sola y no
 * hay un salto entre las dos.
 */
function PuertaDeSesion({ children, sinAcceso = false, conBarra = false }: { children: ReactNode; sinAcceso?: boolean; conBarra?: boolean }) {
  const { estado, error, reintentar } = useSesion();
  const lugar = useLocation();
  const faltaClaveNueva = useRecuperacionPendiente();
  // Volvió del mail de nueva clave: no pasa a ninguna pantalla hasta elegirla.
  if (estado === 'con-sesion' && faltaClaveNueva) return <Navigate to="/nueva-clave" replace />;
  if (estado === 'con-sesion') return <PasosDeCuenta sinAcceso={sinAcceso}>{children}</PasosDeCuenta>;
  if (estado === 'sin-sesion') return <Navigate to="/entrar" replace state={{ desde: lugar.pathname }} />;
  return (
    <>
      {conBarra && estado === 'cargando' && <ReservaDeCategorias />}
      <Pagina>
        <Consulta
          consulta={{ isPending: estado === 'cargando', isError: estado === 'error', error, data: undefined, refetch: reintentar }}
          errorGenerico="No pudimos revisar tu sesión"
        >
          {() => null}
        </Consulta>
      </Pagina>
    </>
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
    // La vuelta del mail de «olvidé la clave»: ya hay sesión, falta elegir la nueva.
    { path: '/nueva-clave', element: <NuevaClave /> },
    // Pantallas con datos de ejemplo: las enlaza el menú, nunca la app de siempre.
    { path: '/piezas', element: <Piezas /> },
    { path: '/laboratorio/interacciones', element: <LaboratorioInteracciones /> },
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
        // Los cuatro tests, con su cronómetro, video y pitidos (antes se hacían en la app de siempre).
        { path: '/medir/tiro', element: <MedirBateria /> },
        { path: '/medir/salto', element: <MedirSalto /> },
        { path: '/medir/sprint', element: <MedirSprint /> },
        { path: '/medir/yoyo', element: <MedirYoyo /> },
        { path: '/datos', element: <Datos /> },
        // Cargar un partido cuelga de Datos (y del plantel vacío): no tiene ítem propio en el menú.
        { path: '/datos/cargar-partido', element: <CargarPartido /> },
        { path: '/recursos', element: <Recursos /> },
        { path: '/recursos/jugadas/:jugadaId/editar', element: <EditorDeJugada /> },
        // Armar las misiones cuelga de Plantel y de Hoy; sin id es una previa nueva, con id se edita la que está.
        { path: '/misiones/armar', element: <ArmarMisiones /> },
        { path: '/misiones/:previaId/armar', element: <ArmarMisiones /> },
        { path: '/misiones/:previaId', element: <MisionesPartido /> },
        // Metas del cuerpo técnico (cuelgan de Hoy) e inventario en lectura (cuelga de Físico).
        { path: '/metas', element: <Metas /> },
        { path: '/fisico/cargar-plan', element: <CargarPlanFisico /> },
        { path: '/fisico/inventario', element: <InventarioLectura /> },
        { path: '/fisico', element: <Fisico /> },
        { path: '/fisico/plan/:planId/sesion/:sesionId', element: <FisicoSesion /> },
        { path: '/fisico/plan/:planId/sesion/:sesionId/ejercicio/:lineaId', element: <FisicoEscalones /> },
      ],
    },
    // Mi perfil: con cuenta de cualquier rol; se abre desde la cabecera, no desde el menú.
    { element: <RequiereSoloSesion />, children: [{ path: '/perfil', element: <Perfil /> }] },
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
        { path: '/coordinacion/inventario', element: <CoordInventario /> },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ] },
  // La vista del jugador tiene su propio marco (barra de abajo con sus cinco destinos) y no pasa por RequiereSesion:
  // quien entra es un jugador, sin club ni categoría activa. El marco mismo pide la ficha y la sesión.
  // El portal de familias, igual: su propio marco, sin menú. Una familia sólo ve a sus hijos.
  { element: <MarcoFamilia />, children: [{ path: '/familia', element: <FamiliaChicos /> }] },
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
