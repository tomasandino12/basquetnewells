import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCargarRepositorio } from './contexto';
import type { DatosDePizarra } from './repositorio';

// Recursos: la biblioteca de ejercicios y de jugadas del club. Las claves empiezan con «recursos».

export function useEjercicios(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['recursos', 'ejercicios', clubId],
    enabled: clubId !== undefined,
    queryFn: async () => (await cargar()).obtenerEjercicios(clubId!),
  });
}

export function useJugadasDelClub(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['recursos', 'jugadas', clubId],
    enabled: clubId !== undefined,
    queryFn: async () => (await cargar()).listarJugadas(clubId!),
  });
}

/** El detalle de un ejercicio: la pizarra es lo que importa; las notas y variaciones degradan solas. */
export function useDetalleDeEjercicio(clubId: string | undefined, ejercicioId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['recursos', 'ejercicio', clubId, ejercicioId],
    enabled: clubId !== undefined && ejercicioId !== undefined,
    queryFn: async () => {
      const repo = await cargar();
      const [ejercicio, notas, variaciones] = await Promise.all([
        repo.obtenerEjercicio(clubId!, ejercicioId!),
        repo.obtenerNotas(clubId!, ejercicioId!).catch(() => []),
        repo.obtenerVariaciones(clubId!, ejercicioId!).catch(() => []),
      ]);
      return { ejercicio, notas, variaciones };
    },
  });
}

export function usePlantelesDeJugada(clubId: string | undefined, jugadaId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['recursos', 'jugada-planteles', clubId, jugadaId],
    enabled: clubId !== undefined && jugadaId !== undefined,
    queryFn: async () => (await cargar()).plantelesDeJugada(clubId!, jugadaId!),
  });
}

export function useAsignarJugada(clubId: string, jugadaId: string) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (plantelIds: string[]) => (await cargar()).asignarJugada(clubId, jugadaId, plantelIds),
    onSettled: () => consultas.invalidateQueries({ queryKey: ['recursos', 'jugada-planteles'] }),
  });
}

export function useDuplicarJugada(clubId: string) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (datos: { nombre: string; tipo: string; datos: DatosDePizarra }) =>
      (await cargar()).crearJugada({ clubId, ...datos }),
    onSettled: () => consultas.invalidateQueries({ queryKey: ['recursos', 'jugadas'] }),
  });
}
