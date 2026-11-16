import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { marcarRecuperacion, soltarRecuperacion } from '../cuenta/recuperacion';
import { desmarcarSesionCerrada, marcarSesionCerrada, reintentar } from './errores';
import { cargarRepositorioReal, type CargarRepositorio, type Repositorio, type Sesion } from './repositorio';

const CargaContext = createContext<CargarRepositorio>(cargarRepositorioReal);

/** La función que pide el repositorio; las consultas la llaman adentro, nunca al renderizar. */
export function useCargarRepositorio(): CargarRepositorio {
  return useContext(CargaContext);
}

/**
 * Consultas iguales en todas las pantallas. `networkMode: 'always'` y no el de por defecto:
 * sin conexión, el de por defecto deja la consulta «cargando» para siempre; acá falla y la
 * pantalla dice «sin conexión» con un botón para reintentar.
 */
export function crearConsultas({ retardoMs = 1000 } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        retry: reintentar,
        retryDelay: retardoMs,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: { networkMode: 'always' },
    },
  });
}

export const CLAVE_SESION = ['sesion'] as const;

export interface EstadoSesion {
  estado: 'cargando' | 'con-sesion' | 'sin-sesion' | 'error';
  sesion: Sesion | null;
  error: unknown;
  reintentar: () => void;
}

const SesionContext = createContext<EstadoSesion | null>(null);

export function useSesion(): EstadoSesion {
  const v = useContext(SesionContext);
  if (!v) throw new Error('useSesion va adentro de <Proveedores>');
  return v;
}

function ProveedorSesion({ children }: { children: ReactNode }) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  const q = useQuery({
    queryKey: CLAVE_SESION,
    queryFn: async () => (await (await cargar()).obtenerSesionActual()) ?? null,
    staleTime: Infinity,
  });

  // Los datos son de menores: al salir (o al entrar otra persona) no queda nada en memoria de quien estaba antes.
  const soltarDatos = useCallback(
    () => consultas.removeQueries({ predicate: (c) => c.queryKey[0] !== CLAVE_SESION[0] }),
    [consultas],
  );

  useEffect(() => {
    let baja: (() => void) | undefined;
    let vigente = true;
    void cargar().then((repo: Repositorio) => {
      if (!vigente) return;
      const { data } = repo.alCambiarAuth((evento, sesion) => {
        const anterior = consultas.getQueryData<Sesion | null>(CLAVE_SESION);
        if (evento === 'SIGNED_OUT') {
          // Si la sesión se cayó sola (token vencido) y no por «Salir», el aviso de permiso tiene que decir «volvé a entrar».
          if (!repo.fueSalidaVoluntaria()) marcarSesionCerrada();
          soltarDatos();
          soltarRecuperacion();
          consultas.setQueryData(CLAVE_SESION, null);
          return;
        }
        desmarcarSesionCerrada();
        // Antes de guardar la sesión: así, cuando las pantallas se enteran de que hay sesión, ya saben que falta la clave nueva.
        if (evento === 'PASSWORD_RECOVERY') marcarRecuperacion();
        if (anterior && sesion && anterior.user.id !== sesion.user.id) soltarDatos();
        if (sesion) consultas.setQueryData(CLAVE_SESION, sesion);
      });
      baja = () => data.subscription.unsubscribe();
    }).catch(() => {
      // Si el repositorio no cargó, la consulta de sesión ya muestra el error: acá no hay nada que escuchar.
    });
    return () => {
      vigente = false;
      baja?.();
    };
  }, [cargar, consultas, soltarDatos]);

  const valor = useMemo<EstadoSesion>(() => {
    const estado = q.isError ? 'error' : q.isPending ? 'cargando' : q.data ? 'con-sesion' : 'sin-sesion';
    return { estado, sesion: q.data ?? null, error: q.error, reintentar: () => void q.refetch() };
  }, [q]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

interface Props {
  children: ReactNode;
  /** Las pruebas pasan un repositorio inventado. */
  cargar?: CargarRepositorio;
  consultas?: QueryClient;
}

export function Proveedores({ children, cargar = cargarRepositorioReal, consultas }: Props) {
  const qc = useMemo(() => consultas ?? crearConsultas(), [consultas]);
  return (
    <CargaContext.Provider value={cargar}>
      <QueryClientProvider client={qc}>
        <ProveedorSesion>{children}</ProveedorSesion>
      </QueryClientProvider>
    </CargaContext.Provider>
  );
}
