import { Navigate, Outlet, createHashRouter, useLocation, type RouteObject } from 'react-router';
import { Consulta } from './components/ui/consulta';
import { useSesion } from './datos/contexto';
import { Entrar } from './pantallas/Entrar';
import { Piezas } from './pantallas/Piezas';
import { Plantel } from './pantallas/Plantel';
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
  { path: '/entrar', element: <Entrar /> },
  // Pantallas escondidas, con datos de ejemplo: nadie las enlaza desde la app vieja.
  { path: '/piezas', element: <Piezas /> },
  { path: '/maqueta/plantel', element: <Plantel /> },
  { element: <RequiereSesion />, children: [{ path: '/', element: <Planteles /> }] },
  { path: '*', element: <Navigate to="/" replace /> },
];

// Hash y no ruta limpia: se publica estático en /nueva y así no hace falta reenviar cada ruta.
export const crearRouter = () => createHashRouter(rutas);
