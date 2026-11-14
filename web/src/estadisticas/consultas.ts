import { useQuery } from '@tanstack/react-query';
import { useCargarRepositorio } from '../datos/contexto';
import { bloquesDePruebas } from './formatos';

// Cada bloque de Datos pide lo suyo: si uno falla, los otros se dibujan igual. Todas las claves
// empiezan con «datos»: al guardar un partido nuevo se vuelven a pedir juntas.

const clave = (que: string, clubId: string, plantelId: string) => ['datos', que, clubId, plantelId];

/** Los partidos cargados, del más nuevo al más viejo. */
export function usePartidosDelPlantel(clubId: string, plantelId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: clave('partidos', clubId, plantelId),
    queryFn: async () => (await cargar()).obtenerPartidosDelPlantel(clubId, plantelId),
  });
}

/** Lo que juega y anota cada chico, y el tiro del equipo partido a partido. */
export function useEquipoEnPartidos(clubId: string, plantelId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: clave('equipo', clubId, plantelId),
    queryFn: async () => {
      const repo = await cargar();
      const [estadisticas, jugadores, partidos] = await Promise.all([
        repo.obtenerEstadisticasDelPlantel(clubId, plantelId),
        repo.obtenerJugadoresDelPlantel(clubId, plantelId),
        repo.obtenerPartidosDelPlantel(clubId, plantelId),
      ]);
      return { estadisticas, jugadores, partidos };
    },
  });
}

/** Las baterías de tiro no dependen de que haya partidos cargados. */
export function useBateriasDeTiro(clubId: string, plantelId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: clave('tiro', clubId, plantelId),
    queryFn: async () => {
      const repo = await cargar();
      const [sesiones, mediciones] = await Promise.all([
        repo.obtenerSesionesDeMedicion(clubId, plantelId),
        repo.obtenerMedicionesTiroDelPlantel(clubId, plantelId),
      ]);
      return { sesiones, mediciones };
    },
  });
}

/** Los pesos anotados por ejercicio; hace falta la lista de chicos para pedirlos. */
export function useCargasDelPlantel(clubId: string, plantelId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: clave('cargas', clubId, plantelId),
    queryFn: async () => {
      const repo = await cargar();
      const jugadores = await repo.obtenerJugadoresDelPlantel(clubId, plantelId);
      return repo.obtenerCargasDelPlantel(clubId, plantelId, jugadores.map((j) => j.id));
    },
  });
}

/** Velocidad, resistencia y salto: ya armado en bloques, con sólo las pruebas que el club cargó. */
export function usePruebasDelPlantel(clubId: string, plantelId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: clave('pruebas', clubId, plantelId),
    queryFn: async () => {
      const repo = await cargar();
      const [sprint, yoyo, salto] = await Promise.all([
        repo.obtenerMedicionesSprintDelPlantel(clubId, plantelId),
        repo.obtenerMedicionesYoyoDelPlantel(clubId, plantelId),
        repo.obtenerMedicionesSaltoDelPlantel(clubId, plantelId),
      ]);
      return bloquesDePruebas(sprint, yoyo, salto);
    },
  });
}
