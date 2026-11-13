import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCargarRepositorio } from '../datos/contexto';
import type { Repositorio, SolicitudDelPlantel } from '../datos/repositorio';

// Familias y altas. Las claves de lo que depende de un plantel empiezan con «plantel» (así el plantel se
// vuelve a pedir solo después de aprobar o agregar a alguien); lo de la familia, con «familia».

/**
 * Los pedidos de entrada de una categoría. Son nombres de chicos: no se guardan (gcTime 0) y se
 * vuelven a pedir cada vez que se abre la hoja.
 */
export function useSolicitudesDelPlantel(plantelId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['plantel', 'solicitudes', plantelId],
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => (await (await cargar()).obtenerSolicitudesDelPlantel(plantelId)) as SolicitudDelPlantel[],
  });
}

/** Si el chico tiene cuenta propia. Es un agregado de la ficha: si falla, la ficha no dibuja nada de esto (retry false). */
export function useTieneCuenta(jugadorId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['familia', 'cuenta', jugadorId],
    retry: false,
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => (await cargar()).jugadorTieneCuenta(jugadorId),
  });
}

export function useResponsables(jugadorId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['familia', 'responsables', jugadorId],
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => (await cargar()).obtenerResponsablesDeJugador(jugadorId),
  });
}

/** Los hijos vinculados a quien mira. Si el club cargó a otro desde la última vez, el vínculo se crea acá (sin romper si no es familia). */
export function useMisChicos() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['familia', 'chicos'],
    staleTime: 0,
    queryFn: async () => {
      const repo = await cargar();
      await repo.vincularPorMail().catch(() => {});
      return repo.obtenerMisChicos();
    },
  });
}

/** El catálogo de clubes y categorías para pedir acceso, o el pedido que ya está esperando. */
export function useDatosDelPedido() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['familia', 'pedido'],
    staleTime: 0,
    queryFn: async () => {
      const repo = await cargar();
      // Un error al mirar el pedido propio no frena a nadie: se trata como «no hay».
      const miSolicitud = await repo.obtenerMiSolicitud().catch(() => null);
      const pendiente = miSolicitud?.estado === 'pendiente' ? miSolicitud : null;
      const catalogo = pendiente ? [] : await repo.obtenerClubesParaSolicitar();
      return { pendiente, catalogo };
    },
  });
}

/**
 * Una escritura de plantel o de familia. Al terminar bien vuelve a pedir lo que depende de ella: la
 * pantalla muestra lo que quedó guardado, no lo que se tocó.
 */
export function useAccion<V, R = unknown>(escribir: (repo: Repositorio, v: V) => Promise<R>) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => escribir(await cargar(), v),
    onSuccess: () => Promise.all([
      consultas.invalidateQueries({ queryKey: ['plantel'] }),
      consultas.invalidateQueries({ queryKey: ['familia'] }),
    ]),
  });
}

/** Para preguntar algo puntual a la base en medio de un flujo (¿ya existe esa ficha?) sin armar una consulta. */
export function useRepositorio() {
  return useCargarRepositorio();
}
