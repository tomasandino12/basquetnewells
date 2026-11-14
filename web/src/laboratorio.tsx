import { Activity, ArrowUpRight, Building2, LogOut, CalendarCheck,LineChart, Moon, MoreHorizontal, PlaySquare, Ruler, Sun, User, Users, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { inicialesDeNombre, nombreDeUsuario } from '@datos/cuenta.js';
import escudo from '../../public/escudo.png';
import { ANCHO_DE_PAGINA } from './components/ui/pagina';
import { cn } from './lib/cn';
import { useSesion } from './datos/contexto';
import { useSalir } from './datos/consultas';
import { useEsCoordinador } from './coord/consultas';
import { aplicarTema, guardarTema, useTema, type Tema } from './tema';
import { APP_DE_SIEMPRE } from './clasica';

interface Enlace {
  a: string;
  nombre: string;
  icono: LucideIcon;
  /** Sólo lo ve quien coordina el club (la base es la que decide qué se puede leer: esto sólo evita un enlace que a un profe le daría error). */
  soloCoordinacion?: boolean;
  /** Para la barra de abajo del celular, donde el nombre entero no entra. */
  corto?: string;
}

/**
 * Las pantallas reales del menú. La categoría no va en la dirección (se elige arriba, con los
 * chips, como en la app de siempre). Cada pantalla nueva que se muda se suma acá (una prueba
 * controla que toda ruta directa esté en el menú o en EJEMPLOS).
 */
export const ENLACES_DEL_MENU: Enlace[] = [
  { a: '/hoy', nombre: 'Hoy', icono: Activity },
  { a: '/plantel', nombre: 'Plantel', icono: Users },
  { a: '/fisico', nombre: 'Físico', icono: CalendarCheck },
  { a: '/medir', nombre: 'Medir', icono: Ruler },
  { a: '/datos', nombre: 'Datos', icono: LineChart },
  { a: '/recursos', nombre: 'Recursos', icono: PlaySquare },
  // Panorama, profes, finanzas y familias: el resto de coordinación cuelga de /coordinacion/….
  { a: '/coordinacion', nombre: 'Coordinación', icono: Building2, soloCoordinacion: true, corto: 'Coord.' },
];

/**
 * Lo que todavía no se mudó: se abre en la app de siempre (/app/clasica), así no se pierde
 * ninguna función (H-175). Va con `?desde=nueva`: la de siempre no la manda de vuelta acá.
 */
export const EN_LA_DE_SIEMPRE: { nombre: string; icono: LucideIcon }[] = [];

function DeSiempre({ compacto }: { compacto?: boolean }) {
  // Datos ya se mudó: sin nada pendiente, el menú no manda a ningún lado.
  if (EN_LA_DE_SIEMPRE.length === 0) return null;
  if (compacto) {
    return (
      <a
        href={APP_DE_SIEMPRE}
        className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] text-sobre-negro opacity-70 outline-offset-2 focus-visible:outline-2 focus-visible:outline-lima"
      >
        <MoreHorizontal aria-hidden className="size-5" strokeWidth={1.8} />
        <span>Más</span>
      </a>
    );
  }
  return (
    <div className="mt-6 border-t border-white/10 pt-4">
      <p className="px-3 pb-2 font-mono text-[0.6875rem] tracking-wide text-sobre-negro uppercase opacity-60">En la app de siempre</p>
      <ul className="flex flex-col gap-1">
        {EN_LA_DE_SIEMPRE.map(({ nombre, icono: Icono }) => (
          <li key={nombre}>
            <a
              href={APP_DE_SIEMPRE}
              className="flex min-h-11 items-center gap-3 rounded-[0.5rem] px-3 text-[0.9375rem] text-sobre-negro opacity-70 outline-offset-2 focus-visible:outline-2 focus-visible:outline-lima [@media(hover:hover)]:hover:opacity-100"
            >
              <Icono aria-hidden className="size-5" strokeWidth={1.8} />
              <span>{nombre}</span>
              <ArrowUpRight aria-hidden className="ml-auto size-4" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pantallas con datos inventados: fuera del menú, en una línea aparte que lo dice. */
export const EJEMPLOS = [
  { a: '/piezas', nombre: 'Piezas' },
  { a: '/maqueta/plantel', nombre: 'Maqueta del plantel' },
  { a: '/maqueta/hoy', nombre: 'Maqueta de Hoy' },
  { a: '/maqueta/recursos', nombre: 'Maqueta de Recursos' },
];

/** Salir de la cuenta: estaba en la lista de planteles, que ya no existe. Sólo con sesión. */
export function BotonSalir({ compacto }: { compacto?: boolean }) {
  const { estado } = useSesion();
  const salir = useSalir();
  if (estado !== 'con-sesion') return null;
  return (
    <button
      type="button"
      disabled={salir.isPending}
      onClick={() => salir.mutate()}
      aria-label={compacto ? 'Salir' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-[0.5rem] text-sobre-negro opacity-70 outline-offset-2 focus-visible:outline-2 focus-visible:outline-lima [@media(hover:hover)]:hover:opacity-100',
        compacto ? 'size-11 justify-center' : 'min-h-11 px-3 text-[0.9375rem]',
      )}
    >
      <LogOut aria-hidden className="size-5" strokeWidth={1.8} />
      {!compacto && <span>Salir</span>}
    </button>
  );
}

/**
 * Mi perfil: no es un ítem del menú (la barra de abajo ya está llena) sino un acceso en la cabecera,
 * con las iniciales del nombre. Sin nombre cargado, un muñequito. Sólo con sesión.
 */
export function BotonPerfil({ compacto }: { compacto?: boolean }) {
  const { estado, sesion } = useSesion();
  if (estado !== 'con-sesion') return null;
  const iniciales = inicialesDeNombre((nombreDeUsuario(sesion?.user) as string | null) ?? '') as string;
  const marca = (
    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-club font-titulo text-sm leading-none font-bold text-sobre-club">
      {iniciales || <User className="size-4" />}
    </span>
  );
  return (
    <NavLink
      to="/perfil"
      aria-label={compacto ? 'Mi perfil' : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-[0.5rem] text-sobre-negro outline-offset-2 focus-visible:outline-2 focus-visible:outline-lima',
          compacto ? 'size-11 justify-center' : 'min-h-11 px-3 text-[0.9375rem]',
          isActive ? 'font-semibold' : 'opacity-70 [@media(hover:hover)]:hover:opacity-100',
        )
      }
    >
      {marca}
      {!compacto && <span>Mi perfil</span>}
    </NavLink>
  );
}

export function BotonTema({ tema, alCambiar, className }: { tema: Tema; alCambiar: () => void; className?: string }) {
  const Icono = tema === 'oscuro' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={alCambiar}
      aria-label={tema === 'oscuro' ? 'Pasar al tema claro' : 'Pasar al tema oscuro'}
      className={cn(
        'grid size-11 place-items-center rounded-full text-sobre-negro outline-offset-2 transition-transform duration-[var(--dur-1)] active:scale-90 focus-visible:outline-2 focus-visible:outline-lima',
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
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-[0.5rem] text-sobre-negro outline-offset-2 focus-visible:outline-2 focus-visible:outline-lima',
          compacto ? 'min-h-14 flex-1 flex-col justify-center gap-1 text-[0.6875rem]' : 'min-h-11 px-3 text-[0.9375rem]',
          isActive ? 'font-semibold' : 'opacity-70 [@media(hover:hover)]:hover:opacity-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icono aria-hidden className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
          {compacto && enlace.corto ? (
            <>
              <span aria-hidden>{enlace.corto}</span>
              <span className="sr-only">{enlace.nombre}</span>
            </>
          ) : (
            <span>{enlace.nombre}</span>
          )}
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
    <nav aria-label="Pantallas de ejemplo" className={cn(ANCHO_DE_PAGINA, 'flex flex-wrap items-center gap-x-3 py-6 text-xs text-gris')}>
      <span>Con datos de ejemplo:</span>
      {EJEMPLOS.map((e) => (
        <NavLink key={e.a} to={e.a} end className="underline decoration-linea underline-offset-4 aria-[current=page]:text-tinta [@media(hover:hover)]:hover:text-tinta">
          {e.nombre}
        </NavLink>
      ))}
    </nav>
  );
}

/** El marco de todas las pantallas: menú negro al costado en compu y abajo en el celular. */
export function Marco() {
  const { pathname } = useLocation();
  const esCoordinador = useEsCoordinador();
  const enlaces = ENLACES_DEL_MENU.filter((e) => !e.soloCoordinacion || esCoordinador);
  // El mismo tema que el interruptor de Mi perfil: cambiar uno cambia el otro.
  const tema: Tema = useTema();

  useEffect(() => aplicarTema(tema), [tema]);
  const cambiarTema = () => guardarTema(tema === 'oscuro' ? 'claro' : 'oscuro');

  return (
    <div className="min-h-svh lg:pl-60 print:pl-0">
      {/* Compu */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col print:hidden border-r-2 border-club bg-negro px-3 py-5 lg:flex">
        <div className="mb-8 flex items-center gap-3 px-3">
          <img src={escudo} alt="" width={36} height={36} className="size-9" />
          <p className="font-titulo text-xl leading-none font-bold tracking-wide text-sobre-negro uppercase">Semillero</p>
        </div>
        <nav aria-label="Menú de la app">
          <ul className="flex flex-col gap-1">
            {enlaces.map((e) => (
              <li key={e.a}>
                <ItemMenu enlace={e} />
              </li>
            ))}
          </ul>
          <DeSiempre />
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <BotonPerfil />
          <div className="flex items-center justify-between">
            <BotonSalir />
            <BotonTema tema={tema} alCambiar={cambiarTema} />
          </div>
        </div>
      </aside>

      {/* Celular: arriba el escudo y el tema; abajo el menú al alcance del pulgar. */}
      <header className="sticky top-0 z-20 flex h-12 items-center print:hidden justify-between border-b-2 border-club bg-negro pr-1 pl-4 lg:hidden">
        <div className="flex items-center gap-2">
          <img src={escudo} alt="" width={24} height={24} className="size-6" />
          <p className="font-titulo text-lg leading-none font-bold tracking-wide text-sobre-negro uppercase">Semillero</p>
        </div>
        <div className="flex items-center">
          <BotonPerfil compacto />
          <BotonSalir compacto />
          <BotonTema tema={tema} alCambiar={cambiarTema} />
        </div>
      </header>
      <nav aria-label="Menú de la app" className="fixed inset-x-0 bottom-0 z-20 print:hidden border-t-2 border-club bg-negro pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="flex">
          {enlaces.map((e) => (
            <li key={e.a} className="flex flex-1">
              <ItemMenu enlace={e} compacto />
            </li>
          ))}
          {EN_LA_DE_SIEMPRE.length > 0 && (
            <li className="flex flex-1">
              <DeSiempre compacto />
            </li>
          )}
        </ul>
      </nav>

      <div key={pathname} className="entra pb-20 lg:pb-0">
        <Outlet />
        <Ejemplos />
      </div>
    </div>
  );
}
