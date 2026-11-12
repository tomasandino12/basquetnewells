import { CalendarCheck, Library, LineChart, PlaySquare, Users, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import escudo from '../../../../public/escudo.png';
import { irALaDeSiempre } from '../../clasica';
import { Consulta } from '../../components/ui/consulta';
import { Pagina, TOPE_DE_PAGINA } from '../../components/ui/pagina';
import { useSesion } from '../../datos/contexto';
import { useMiFicha } from '../../datos/consultasJugador';
import { BotonSalir, BotonTema } from '../../laboratorio';
import { cn } from '../../lib/cn';
import { aplicarTema, guardarTema, leerTema, type Tema } from '../../tema';
import { Vacio } from '../../components/ui/estados';

interface Destino {
  a: string;
  nombre: string;
  icono: LucideIcon;
}

/**
 * La barra de abajo del jugador: ícono y texto, la pestaña activa en lima. «Sesión» (la de hoy, o la
 * próxima) va al final de la lista, como un destino más: no es un botón flotante que tape contenido.
 */
export const DESTINOS_DEL_JUGADOR: Destino[] = [
  { a: '/jugador/fisico', nombre: 'Físico', icono: CalendarCheck },
  { a: '/jugador/progreso', nombre: 'Progreso', icono: LineChart },
  { a: '/jugador/jugadas', nombre: 'Jugadas', icono: PlaySquare },
  { a: '/jugador/recursos', nombre: 'Recursos', icono: Library },
  { a: '/jugador/sesion', nombre: 'Sesión', icono: Zap },
];

function Pestana({ destino }: { destino: Destino }) {
  const Icono = destino.icono;
  return (
    <NavLink
      to={destino.a}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] outline-offset-[-3px] transition-colors duration-[var(--dur-1)] focus-visible:outline-2 focus-visible:outline-lima',
          isActive ? 'font-semibold text-lima' : 'text-sobre-negro opacity-80 [@media(hover:hover)]:hover:opacity-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              'absolute top-0 h-0.5 w-8 rounded-full bg-lima transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)]',
              isActive ? 'scale-x-100' : 'scale-x-0',
            )}
          />
          <Icono aria-hidden className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
          <span>{destino.nombre}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * El marco de la vista del jugador. Todas sus pantallas comparten el mismo ancho (este contenedor): ninguna
 * fija el suyo. Lo que ve sólo lo decide la base (mi_ficha, mi_plan…); acá se decide qué mostrar.
 */
export function MarcoJugador() {
  const { pathname } = useLocation();
  const [tema, setTema] = useState<Tema>(leerTema);
  useEffect(() => aplicarTema(tema), [tema]);
  const cambiarTema = () =>
    setTema((t) => {
      const otro: Tema = t === 'oscuro' ? 'claro' : 'oscuro';
      guardarTema(otro);
      return otro;
    });

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b-2 border-club bg-negro pr-1 pl-4 print:hidden">
        <div className="flex items-center gap-2">
          <img src={escudo} alt="" width={24} height={24} className="size-6" />
          <p className="font-titulo text-lg leading-none font-bold tracking-wide text-sobre-negro uppercase">Semillero</p>
        </div>
        <div className="flex items-center">
          <BotonSalir compacto />
          <BotonTema tema={tema} alCambiar={cambiarTema} />
        </div>
      </header>

      <div key={pathname} className="entra pb-24">
        <RequiereJugador>
          <Pagina>
            <Outlet />
          </Pagina>
        </RequiereJugador>
      </div>

      <nav aria-label="Menú del jugador" className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-club bg-cereza pb-[env(safe-area-inset-bottom)] print:hidden">
        <ul className={`mx-auto flex w-full ${TOPE_DE_PAGINA}`}>
          {DESTINOS_DEL_JUGADOR.map((d) => (
            <li key={d.a} className="flex flex-1">
              <Pestana destino={d} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Sólo entra quien tiene ficha de jugador. Sin sesión: a entrar (en la app de siempre, publicada). */
function RequiereJugador({ children }: { children: ReactNode }) {
  const { estado, error, reintentar } = useSesion();
  const lugar = useLocation();
  const ficha = useMiFicha(estado === 'con-sesion');

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
  return (
    <Consulta consulta={ficha} errorGenerico="No pudimos revisar tu cuenta">
      {(f) =>
        f ? (
          children
        ) : (
          <Pagina>
            <Vacio icono={Users} titulo="Esta cuenta no es de jugador" accion={<Link to="/hoy" className="text-sm font-semibold underline">Ir a Hoy</Link>}>
              Tu profe te habilita desde el plantel. Si sos del cuerpo técnico, tu pantalla es Hoy.
            </Vacio>
          </Pagina>
        )
      }
    </Consulta>
  );
}
