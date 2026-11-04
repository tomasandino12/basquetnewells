import { NavLink, Outlet } from 'react-router';

/**
 * El menú de /nueva: mientras dura la mudanza, Tomás tiene que poder llegar a cada pantalla
 * sin saberse las direcciones. Cada etapa que suma una pantalla la agrega a esta lista
 * (una prueba lo controla); las de datos de ejemplo lo dicen en `nota`.
 */
export const PANTALLAS: { a: string; nombre: string; nota?: string }[] = [
  { a: '/', nombre: 'Planteles' },
  { a: '/piezas', nombre: 'Piezas', nota: 'ejemplo' },
  { a: '/maqueta/plantel', nombre: 'Maqueta del plantel', nota: 'ejemplo' },
];

export function Menu() {
  return (
    <nav aria-label="Pantallas de la app nueva" className="border-b border-linea bg-sup">
      <div className="mx-auto flex w-full max-w-[52rem] items-center gap-4 px-4 sm:px-6">
        <span className="hidden shrink-0 font-mono sm:inline text-xs tracking-wide text-gris uppercase">App nueva · en obra</span>
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {PANTALLAS.map((p) => (
            <li key={p.a} className="shrink-0">
              <NavLink
                to={p.a}
                end
                className={({ isActive }) =>
                  [
                    'flex min-h-11 items-center gap-1.5 border-b-2 px-2 text-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-tinta',
                    isActive ? 'border-club font-semibold text-tinta' : 'border-transparent text-gris [@media(hover:hover)]:hover:text-tinta',
                  ].join(' ')
                }
              >
                {p.nombre}
                {p.nota && <span className="hidden font-mono text-[0.6875rem] text-gris sm:inline">{p.nota}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** Todas las pantallas de /nueva llevan el menú arriba. */
export function Marco() {
  return (
    <>
      <Menu />
      <Outlet />
    </>
  );
}
