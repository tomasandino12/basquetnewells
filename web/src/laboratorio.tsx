import { Activity, CalendarCheck, ClipboardCheck, Moon, Sun, Users, LayoutGrid, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, matchPath, useLocation } from 'react-router';
import escudo from '../../public/escudo.png';
import { cn } from './lib/cn';
import { aplicarTema, guardarTema, leerTema, type Tema } from './tema';

interface Enlace {
  a: string;
  nombre: string;
  icono: LucideIcon;
}

/**
 * Las pantallas reales del menú. Sin plantel elegido sólo hay Planteles; con uno (sale de la
 * dirección), las de esa categoría. Cada pantalla nueva que se muda se suma acá (una prueba
 * controla que toda ruta directa esté en el menú o en EJEMPLOS).
 */
export function enlacesDelMenu(plantelId: string | undefined): Enlace[] {
  const base: Enlace[] = [{ a: '/', nombre: 'Planteles', icono: LayoutGrid }];
  if (!plantelId) return base;
  return [
    ...base,
    { a: `/hoy/${plantelId}`, nombre: 'Hoy', icono: Activity },
    { a: `/plantel/${plantelId}`, nombre: 'Plantel', icono: Users },
    { a: `/asistencia/${plantelId}`, nombre: 'Asistencia', icono: ClipboardCheck },
    { a: `/fisico/${plantelId}`, nombre: 'Físico', icono: CalendarCheck },
  ];
}

/** Pantallas con datos inventados: fuera del menú, en una línea aparte que lo dice. */
export const EJEMPLOS = [
  { a: '/piezas', nombre: 'Piezas' },
  { a: '/maqueta/plantel', nombre: 'Maqueta del plantel' },
];

const CON_PLANTEL = ['/hoy/:plantelId/*', '/plantel/:plantelId/*', '/asistencia/:plantelId/*', '/fisico/:plantelId/*'];

function plantelDe(ruta: string): string | undefined {
  for (const patron of CON_PLANTEL) {
    const m = matchPath(patron, ruta);
    if (m?.params.plantelId) return m.params.plantelId;
  }
  return undefined;
}

function BotonTema({ tema, alCambiar, className }: { tema: Tema; alCambiar: () => void; className?: string }) {
  const Icono = tema === 'oscuro' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={alCambiar}
      aria-label={tema === 'oscuro' ? 'Pasar al tema claro' : 'Pasar al tema oscuro'}
      className={cn(
        'grid size-11 place-items-center rounded-full text-sobre-bordo outline-offset-2 transition-transform duration-[var(--dur-1)] active:scale-90 focus-visible:outline-2 focus-visible:outline-lima',
        className,
      )}
    >
      <Icono aria-hidden className="size-5" />
    </button>
  );
}

/** Un enlace del menú. El activo se lee por peso y por el punto lima, no sólo por color. */
function ItemMenu({ enlace, compacto }: { enlace: Enlace; compacto?: boolean }) {
  const Icono = enlace.icono;
  return (
    <NavLink
      to={enlace.a}
      end
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-[0.5rem] text-sobre-bordo outline-offset-2 focus-visible:outline-2 focus-visible:outline-lima',
          compacto ? 'min-h-14 flex-1 flex-col justify-center gap-1 text-[0.6875rem]' : 'min-h-11 px-3 text-[0.9375rem]',
          isActive ? 'font-semibold' : 'opacity-70 [@media(hover:hover)]:hover:opacity-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icono aria-hidden className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
          <span>{enlace.nombre}</span>
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full bg-lima transition-transform duration-[var(--dur-2)] ease-[var(--ease-salida)]',
              compacto ? 'absolute top-1.5' : 'ml-auto',
              isActive ? 'scale-100' : 'scale-0',
            )}
          />
        </>
      )}
    </NavLink>
  );
}

function Ejemplos() {
  return (
    <nav aria-label="Pantallas de ejemplo" className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 px-4 py-6 text-xs text-gris sm:px-6">
      <span>Con datos de ejemplo:</span>
      {EJEMPLOS.map((e) => (
        <NavLink key={e.a} to={e.a} end className="underline decoration-linea underline-offset-4 aria-[current=page]:text-tinta [@media(hover:hover)]:hover:text-tinta">
          {e.nombre}
        </NavLink>
      ))}
    </nav>
  );
}

/** El marco de todas las pantallas: menú bordó al costado en compu y abajo en el celular. */
export function Marco() {
  const { pathname } = useLocation();
  const enlaces = enlacesDelMenu(plantelDe(pathname));
  const [tema, setTema] = useState<Tema>(leerTema);

  useEffect(() => aplicarTema(tema), [tema]);
  const cambiarTema = () =>
    setTema((t) => {
      const otro: Tema = t === 'oscuro' ? 'claro' : 'oscuro';
      guardarTema(otro);
      return otro;
    });

  return (
    <div className="min-h-svh lg:pl-60">
      {/* Compu */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-bordo px-3 py-5 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-3">
          <img src={escudo} alt="" width={36} height={36} className="size-9" />
          <p className="font-titulo text-xl leading-none font-bold tracking-wide text-sobre-bordo uppercase">Semillero</p>
        </div>
        <nav aria-label="Menú de la app">
          <ul className="flex flex-col gap-1">
            {enlaces.map((e) => (
              <li key={e.a}>
                <ItemMenu enlace={e} />
              </li>
            ))}
          </ul>
        </nav>
        <BotonTema tema={tema} alCambiar={cambiarTema} className="mt-auto" />
      </aside>

      {/* Celular: arriba el escudo y el tema; abajo el menú al alcance del pulgar. */}
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between bg-bordo pr-1 pl-4 lg:hidden">
        <div className="flex items-center gap-2">
          <img src={escudo} alt="" width={24} height={24} className="size-6" />
          <p className="font-titulo text-lg leading-none font-bold tracking-wide text-sobre-bordo uppercase">Semillero</p>
        </div>
        <BotonTema tema={tema} alCambiar={cambiarTema} />
      </header>
      <nav aria-label="Menú de la app" className="fixed inset-x-0 bottom-0 z-20 bg-bordo pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="flex">
          {enlaces.map((e) => (
            <li key={e.a} className="flex flex-1">
              <ItemMenu enlace={e} compacto />
            </li>
          ))}
        </ul>
      </nav>

      <div key={pathname} className="entra pb-20 lg:pb-0">
        <Outlet />
        <Ejemplos />
      </div>
    </div>
  );
}
