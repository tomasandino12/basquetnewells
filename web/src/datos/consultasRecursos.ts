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

/** Los videos y links que el profe ofrece a sus jugadores. */
export function useRecursosDelClub(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['recursos', 'videos', clubId],
    enabled: clubId !== undefined,
    queryFn: async () => (await cargar()).obtenerRecursos(clubId!),
  });
}

/** El conteo es un agregado: si falla, las tarjetas salen igual y dicen que no se pudo leer. */
export function useResumenDeRecursos(plantelId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['recursos', 'resumen', plantelId],
    enabled: plantelId !== undefined,
    queryFn: async () => (await cargar()).obtenerResumenRecursos(plantelId!).catch(() => null),
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

/** Una jugada sola, para el editor (la lista del club trae todas; el editor pide la suya fresca). */
export function useJugada(clubId: string | undefined, jugadaId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['recursos', 'jugada', clubId, jugadaId],
    enabled: clubId !== undefined && jugadaId !== undefined,
    // Se edita en pantalla: no se refresca sola mientras el profe dibuja.
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => (await cargar()).obtenerJugada(clubId!, jugadaId!),
  });
}

/** Guarda los datos y el nombre de una jugada propia. */
export function useGuardarJugada(clubId: string, jugadaId: string) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (datos: { nombre: string; tipo: string; datos: DatosDePizarra }) =>
      (await cargar()).guardarJugada(clubId, jugadaId, datos),
    onSettled: () => consultas.invalidateQueries({ queryKey: ['recursos', 'jugadas'] }),
  });
}

export function useBorrarJugada(clubId: string) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (jugadaId: string) => (await cargar()).borrarJugada(clubId, jugadaId),
    onSettled: () => consultas.invalidateQueries({ queryKey: ['recursos', 'jugadas'] }),
  });
}
