import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAVE_SESION, useCargarRepositorio } from './contexto';
import type { EstadoAsistencia, Repositorio } from './repositorio';

// Una consulta por dato, con la clave armada con lo que la hace distinta (el club, el plantel).
// Los datos de un club nunca comparten clave con los de otro.

export function useMisClubes() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['clubes'],
    queryFn: async () => (await cargar()).obtenerClubesDelEntrenador(),
  });
}

export function usePlanteles(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['planteles', clubId],
    queryFn: async () => (await cargar()).obtenerPlantelesDelClub(clubId!),
    enabled: clubId !== undefined,
  });
}

export function useMisRoles(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['roles', clubId],
    queryFn: async () => (await cargar()).obtenerMisRoles(clubId!),
    enabled: clubId !== undefined,
  });
}

export function useMisPlantelesAsignados(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['asignados', clubId],
    queryFn: async () => (await cargar()).obtenerMisPlantelesAsignados(clubId!),
    enabled: clubId !== undefined,
  });
}

// Un plantel es de una temporada: todo lo que tiene entrenamientos es de ésta.
const DESDE_SIEMPRE = '2000-01-01';

const claveDelPlantel = (clubId: string | undefined, plantelId: string | undefined) => ['plantel', clubId, plantelId];

/**
 * Todo lo que el plantel necesita junto. Los agregados (mediciones, asistencia, lesiones, tiro,
 * solicitudes) degradan solos: si fallan, la lista se dibuja igual sin ese dato, que es preferible
 * a ningún plantel. Sólo la lista de chicos puede dar error.
 */
export function useDatosDelPlantel(clubId: string | undefined, plantelId: string | undefined, hoy: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: claveDelPlantel(clubId, plantelId),
    enabled: clubId !== undefined && plantelId !== undefined,
    queryFn: async () => {
      const repo = await cargar();
      const [jugadores, mediciones, entrenamientos, lesiones, sesiones, tiro, solicitudes] = await Promise.all([
        repo.obtenerJugadoresDelPlantel(clubId!, plantelId!),
        repo.obtenerMedicionesCorporalesDelClub(clubId!).catch(() => []),
        repo.obtenerEntrenamientos(plantelId!, DESDE_SIEMPRE, hoy).catch(() => []),
        repo.obtenerLesionesDelPlantel(plantelId!).catch(() => []),
        repo.obtenerSesionesDeMedicion(clubId!, plantelId!).catch(() => []),
        repo.obtenerMedicionesTiroDelPlantel(clubId!, plantelId!).catch(() => []),
        repo.obtenerSolicitudesDelPlantel(plantelId!).catch(() => []),
      ]);
      return { jugadores, mediciones, entrenamientos, lesiones, sesiones, tiro, solicitudes: solicitudes.length };
    },
  });
}

/** Cada cambio vuelve a pedir el plantel: la pantalla muestra lo que quedó guardado, no lo que se tocó. */
function useEscritura<V>(escribir: (repo: Repositorio, v: V) => Promise<unknown>) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => escribir(await cargar(), v),
    onSettled: () => consultas.invalidateQueries({ queryKey: ['plantel'] }),
  });
}

export function useMarcarAsistencia(plantelId: string, fecha: string) {
  return useEscritura<{ jugadorId: string; estado: EstadoAsistencia | null }>((repo, f) =>
    repo.guardarAsistencia({ plantelId, fecha, hubo: true, filas: [f] }),
  );
}

export function useAbrirLesion(clubId: string, desde: string) {
  return useEscritura<string>((repo, jugadorId) => repo.abrirLesion({ clubId, jugadorId, desde }));
}

export function useDarAlta(hasta: string) {
  return useEscritura<string>((repo, lesionId) => repo.darAlta(lesionId, hasta));
}

export function useSacarDelPlantel(clubId: string, plantelId: string) {
  return useEscritura<string>((repo, jugadorId) => repo.sacarDelPlantel(clubId, jugadorId, plantelId));
}

export function useEntrar() {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, clave }: { email: string; clave: string }) =>
      (await cargar()).iniciarSesion(email, clave),
    onSuccess: (sesion) => consultas.setQueryData(CLAVE_SESION, sesion),
  });
}

export function useSalir() {
  const cargar = useCargarRepositorio();
  return useMutation({
    // El resto (vaciar datos, marcar sin sesión) lo hace el aviso de cambio de sesión.
    mutationFn: async () => (await cargar()).cerrarSesion(),
  });
}
