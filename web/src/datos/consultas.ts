import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAVE_SESION, useCargarRepositorio } from './contexto';

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
