import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCargarRepositorio } from './contexto';
import type { EvaluacionAGuardar, PayloadDePrevia } from './repositorio';

// Vista del jugador: una consulta por dato. La base entrega sólo lo suyo (mi_ficha, mi_plan, mi_progreso…),
// así que las claves empiezan con «jugador» y se sueltan junto con el resto al salir de la cuenta.

/**
 * La ficha de quien tiene cuenta de jugador, o null. Un error no se cuenta: quien no es jugador (o todavía
 * no tiene la base al día) simplemente no entra a esta vista, como en la app de siempre.
 */
export function useMiFicha(habilitada = true) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['jugador', 'ficha'],
    enabled: habilitada,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const repo = await cargar();
      try {
        return (await repo.obtenerMiFicha?.()) ?? null;
      } catch {
        return null;
      }
    },
  });
}

export function useMiPlan() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['jugador', 'plan'],
    queryFn: async () => (await cargar()).obtenerMiPlan(),
  });
}

/**
 * Mi progreso. El plan sólo aporta el bloque de cada ejercicio: si falla, los pesos se muestran igual,
 * todos en «Sin bloque», en vez de tirar abajo la pantalla.
 */
export function useMiProgreso() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['jugador', 'progreso'],
    queryFn: async () => {
      const repo = await cargar();
      const [progreso, plan] = await Promise.all([repo.obtenerMiProgreso(), repo.obtenerMiPlan().catch(() => null)]);
      return { progreso, plan };
    },
  });
}

export function useMisJugadas() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['jugador', 'jugadas'],
    queryFn: async () => (await cargar()).misJugadas(),
  });
}

export function useMisRecursos() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['jugador', 'recursos'],
    queryFn: async () => (await cargar()).obtenerMisRecursos(),
  });
}

/** Anota la apertura; nunca molesta: sin conexión o con cualquier falla, el recurso se abre igual. */
export function useAnotarApertura() {
  const cargar = useCargarRepositorio();
  return (recursoId: string) => {
    void cargar().then((repo) => repo.registrarAperturaDeRecurso(recursoId)).catch(() => {});
  };
}

/** Sus marcas de práctica. Con staleTime 0 para que «hoy» no quede viejo si deja la pestaña abierta. */
export function useMisPracticas() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['jugador', 'practicas'],
    staleTime: 0,
    queryFn: async () => (await cargar()).misPracticas(),
  });
}

/**
 * Marca o desmarca la práctica de hoy. La base devuelve las marcas ya al día: se guardan directo (sin
 * esperar otra consulta) y además se invalida, por si la hora cambió de día en el medio.
 */
export function useMarcarPractica() {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async ({ recursoId, hecho }: { recursoId: string; hecho: boolean }) => (await cargar()).marcarPractica(recursoId, hecho),
    onSuccess: (marcas) => {
      if (marcas) consultas.setQueryData(['jugador', 'practicas'], marcas);
    },
    onSettled: () => consultas.invalidateQueries({ queryKey: ['jugador', 'practicas'] }),
  });
}

/** Su asistencia, un día por fecha. */
export function useMiAsistencia() {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['jugador', 'asistencia'],
    queryFn: async () => (await cargar()).miAsistencia(),
  });
}

// Misiones del partido (las evalúa el profe).

export function useDatosDeMisiones(clubId: string | undefined, plantelId: string | undefined, previaId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['misiones', 'evaluar', clubId, plantelId, previaId],
    enabled: clubId !== undefined && plantelId !== undefined,
    staleTime: 0,
    queryFn: async () => {
      const repo = await cargar();
      const [previa, previas, partidos, jugadores] = await Promise.all([
        repo.obtenerPrevia(previaId),
        repo.obtenerPreviasDelPlantel(clubId!, plantelId!),
        repo.obtenerPartidosDelPlantel(clubId!, plantelId!),
        repo.obtenerJugadoresDelPlantel(clubId!, plantelId!),
      ]);
      return { previa, previas, partidos, jugadores };
    },
  });
}

/**
 * Lo que necesita armar o editar las misiones: los chicos (nombres de menores, así no se guardan
 * en memoria) y, si se edita una previa que ya existe, esa previa.
 */
export function useDatosDeArmado(clubId: string | undefined, plantelId: string | undefined, previaId: string | null) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['misiones', 'armar', clubId, plantelId, previaId],
    enabled: clubId !== undefined && plantelId !== undefined,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const repo = await cargar();
      const [jugadores, previa] = await Promise.all([
        repo.obtenerJugadoresDelPlantel(clubId!, plantelId!),
        previaId ? repo.obtenerPrevia(previaId) : Promise.resolve(null),
      ]);
      return { jugadores, previa };
    },
  });
}

export function useGuardarPrevia() {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PayloadDePrevia) => (await cargar()).guardarPrevia(payload),
    onSuccess: () => consultas.invalidateQueries({ queryKey: ['misiones'] }),
  });
}

export function useEstadisticasDeMisiones(partidoId: string | null) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['misiones', 'estadisticas', partidoId],
    enabled: partidoId !== null,
    queryFn: async () => (await cargar()).obtenerEstadisticasParaMisiones(partidoId!),
  });
}

export function useEvaluarMisiones() {
  const cargar = useCargarRepositorio();
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: async (datos: EvaluacionAGuardar) => (await cargar()).evaluarMisiones(datos),
    onSettled: () => consultas.invalidateQueries({ queryKey: ['misiones'] }),
  });
}
