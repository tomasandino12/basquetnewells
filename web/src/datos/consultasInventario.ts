import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCargarRepositorio } from './contexto';
import type { Repositorio } from './repositorio';

// Metas del cuerpo técnico e inventario de material. La UI sólo pide por el repositorio.

/** Las metas de la categoría y de dónde parte cada zona (la última batería de tiro). Si algo falla, no hay pantalla. */
export function useMetasDeLaCategoria(clubId: string, plantelId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['metas', clubId, plantelId],
    queryFn: async () => {
      const repo = await cargar();
      const [metas, sesiones, mediciones] = await Promise.all([
        repo.obtenerMetasDelPlantel(clubId, plantelId),
        repo.obtenerSesionesDeMedicion(clubId, plantelId),
        repo.obtenerMedicionesTiroDelPlantel(clubId, plantelId),
      ]);
      return { metas, sesiones, mediciones };
    },
  });
}

/** Al guardar, Hoy y Metas vuelven a pedir lo que quedó (Hoy marca las zonas que llegaron a la meta). */
export function useGuardarMetas(clubId: string, plantelId: string) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (metas: { zona: string; objetivoPct: number | null }[]) =>
      (await cargar()).guardarMetasPlantel({ clubId, plantelId, metas }),
    onSuccess: () =>
      Promise.all([
        consultas.invalidateQueries({ queryKey: ['metas', clubId, plantelId] }),
        consultas.invalidateQueries({ queryKey: ['hoy', clubId, plantelId] }),
      ]),
  });
}

/** El inventario y quién hizo cada cambio. Los nombres degradan solos: sin ellos se muestra sólo la fecha. */
export function useInventario(clubId: string | undefined) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['inventario', clubId],
    enabled: clubId !== undefined,
    queryFn: async () => {
      const repo = await cargar();
      const [filas, nombres] = await Promise.all([
        repo.obtenerMaterial(clubId!),
        repo.obtenerPerfilesDelClub(clubId!).catch(() => ({}) as Record<string, string>),
      ]);
      return { filas, nombres };
    },
  });
}

export function useEscrituraDeInventario<V, R = unknown>(clubId: string, escribir: (repo: Repositorio, v: V) => Promise<R>) {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => escribir(await cargar(), v),
    onSuccess: () => consultas.invalidateQueries({ queryKey: ['inventario', clubId] }),
  });
}
