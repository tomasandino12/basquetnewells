import { Navigate, Outlet, createHashRouter, useLocation, type RouteObject } from 'react-router';
import { Consulta } from './components/ui/consulta';
import { Marco } from './laboratorio';
import { useSesion } from './datos/contexto';
import { Entrar } from './pantallas/Entrar';
import { Hoy } from './pantallas/Hoy';
import { Piezas } from './pantallas/Piezas';
import { Plantel } from './pantallas/Plantel';
import { PlantelDelClub } from './pantallas/PlantelDelClub';
import { Planteles } from './pantallas/Planteles';

/** Todo lo que lleva datos reales pasa por acá: sin sesión se va a /entrar y vuelve a donde quería ir. */
export function RequiereSesion() {
  const { estado, error, reintentar } = useSesion();
  const lugar = useLocation();
  if (estado === 'con-sesion') return <Outlet />;
  if (estado === 'sin-sesion') return <Navigate to="/entrar" replace state={{ desde: lugar.pathname }} />;
  return (
    <main className="mx-auto w-full max-w-[52rem] px-4 py-5">
      <Consulta
        consulta={{ isPending: estado === 'cargando', isError: estado === 'error', error, data: undefined, refetch: reintentar }}
        errorGenerico="No pudimos revisar tu sesión"
      >
        {() => null}
      </Consulta>
    </main>
  );
}

export const rutas: RouteObject[] = [
  // El menú de arriba (laboratorio.tsx) va en todas: así se llega a cada pantalla sin saberse la dirección.
  { element: <Marco />, children: [
    { path: '/entrar', element: <Entrar /> },
    // Pantallas con datos de ejemplo: las enlaza el menú de /nueva, nunca la app vieja.
    { path: '/piezas', element: <Piezas /> },
    { path: '/maqueta/plantel', element: <Plantel /> },
    { element: <RequiereSesion />, children: [
        { path: '/', element: <Planteles /> },
        { path: '/plantel/:plantelId', element: <PlantelDelClub /> },
        { path: '/hoy/:plantelId', element: <Hoy /> },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ] },
];

// Hash y no ruta limpia: se publica estático en /nueva y así no hace falta reenviar cada ruta.
export const crearRouter = () => createHashRouter(rutas);
