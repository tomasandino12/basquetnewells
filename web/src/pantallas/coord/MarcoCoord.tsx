import { ShieldAlert } from 'lucide-react';
import { createContext, useContext } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { irALaDeSiempre } from '../../clasica';
import { Consulta } from '../../components/ui/consulta';
import { Vacio } from '../../components/ui/estados';
import { Pagina } from '../../components/ui/pagina';
import { claseBoton } from '../../components/ui/button';
import { useMisClubes, useMisRoles } from '../../datos/consultas';
import { useSesion } from '../../datos/contexto';
import { cn } from '../../lib/cn';

const ClubCoord = createContext<string | null>(null);

/** El club con el que coordina quien está mirando. Sólo existe adentro de <RequiereCoordinacion>. */
export function useClubCoord(): string {
  const id = useContext(ClubCoord);
  if (!id) throw new Error('useClubCoord va adentro de <RequiereCoordinacion>');
  return id;
}

export const SECCIONES = [
  { a: '/coordinacion', nombre: 'Panorama', fin: true },
  { a: '/coordinacion/profes', nombre: 'Profes', fin: false },
  { a: '/coordinacion/finanzas', nombre: 'Finanzas', fin: false },
  { a: '/coordinacion/familias', nombre: 'Familias', fin: false },
] as const;

function BarraDeSecciones() {
  const { pathname } = useLocation();
  // Temporada, rubros y formularios cuelgan de una de las cuatro: la barra marca la de la que vienen.
  const madre: Record<string, string> = {
    '/coordinacion/temporada': '/coordinacion/profes',
    '/coordinacion/rubros': '/coordinacion/finanzas',
    '/coordinacion/formularios': '/coordinacion/familias',
  };
  const activa = madre[pathname];
  return (
    <nav aria-label="Secciones de coordinación" className="mb-5 flex gap-1 overflow-x-auto border-b border-linea">
      {SECCIONES.map((s) => (
        <NavLink
          key={s.a}
          to={s.a}
          end={s.fin}
          className={({ isActive }) =>
            cn(
              '-mb-px inline-flex min-h-11 items-center border-b-[3px] px-4 font-titulo text-lg font-semibold tracking-wide whitespace-nowrap uppercase outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-tinta',
              isActive || activa === s.a ? 'border-club text-tinta' : 'border-transparent text-gris',
            )
          }
        >
          {s.nombre}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * La puerta de coordinación. No pasa por RequiereSesion a propósito: ése manda a la app de siempre a
 * quien sólo coordina, y acá es justo quien entra. La base es la que decide qué se puede leer; esta
 * puerta sólo evita mostrar pantallas que a un profe le darían error.
 */
export function RequiereCoordinacion() {
  const { estado, error, reintentar } = useSesion();
  const lugar = useLocation();
  if (estado === 'sin-sesion' && irALaDeSiempre({ volver: true })) return null;
  if (estado === 'sin-sesion') return <Navigate to="/entrar" replace state={{ desde: lugar.pathname }} />;
  if (estado !== 'con-sesion') {
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
  return <ConSesion />;
}

function ConSesion() {
  const clubes = useMisClubes();
  const club = clubes.data?.[0];
  const roles = useMisRoles(club?.id);
  const consulta = {
    isPending: clubes.isPending || (!!club && roles.isPending),
    isError: clubes.isError || roles.isError,
    error: clubes.error ?? roles.error,
    data: clubes.data && (club ? roles.data : true) ? { club, roles: roles.data } : undefined,
    refetch: () => Promise.all([clubes.refetch(), roles.refetch()]),
  };
  return (
    <Pagina>
      <Consulta consulta={consulta} errorGenerico="No pudimos cargar tu club">
        {({ club: c, roles: r }) => {
          if (!c || !r?.esCoordinador) {
            return (
              <Vacio
                icono={ShieldAlert}
                titulo="Esto es de la coordinación"
                accion={<Link to="/" className={claseBoton({ variante: 'contorno', tamano: 'chico' })}>Volver al inicio</Link>}
              >
                Esta sección la ve sólo quien coordina el club. Si te corresponde, pedile a la coordinación que te sume.
              </Vacio>
            );
          }
          return (
            <ClubCoord.Provider value={c.id}>
              <BarraDeSecciones />
              <Outlet />
            </ClubCoord.Provider>
          );
        }}
      </Consulta>
    </Pagina>
  );
}
