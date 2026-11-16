import { useQuery } from '@tanstack/react-query';
import { historialDePartidosDelJugador } from '@datos/estadisticas.js';
import { misionesConPrevia } from '@datos/misiones.js';
import { useCargarRepositorio } from './contexto';
import type { MisionDelJugador } from './repositorio';

// Cada pestaña de la ficha pide lo suyo, y recién cuando se abre: si una falla, las otras se ven igual.
// Las claves empiezan con «plantel» para que se vuelvan a pedir junto con el resto de la ficha.

export interface Porcentaje { pct: number; anotados: number; intentos: number; muestraChica: boolean }
export interface PartidoDelJugador {
  partidoId: string;
  fecha: string;
  rivalNombre: string | null;
  minSegundos: number | null;
  pts: number | null;
  dos: Porcentaje | null;
  tres: Porcentaje | null;
  libres: Porcentaje | null;
}

/** Partido a partido del chico (del más reciente al más viejo) y sus misiones. */
export function useHistorialDePartidos(clubId: string, plantelId: string, jugadorId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['plantel', 'ficha', 'partidos', clubId, plantelId, jugadorId],
    queryFn: async () => {
      const repo = await cargar();
      const [partidos, estadisticas, misiones] = await Promise.all([
        repo.obtenerPartidosDelPlantel(clubId, plantelId),
        repo.obtenerEstadisticasDelPlantel(clubId, plantelId),
        // Las misiones son un extra: si no se pueden leer, el partido a partido se ve igual.
        repo.obtenerMisionesDelJugador(jugadorId).catch(() => null),
      ]);
      return {
        partidos: historialDePartidosDelJugador(partidos, estadisticas, jugadorId) as PartidoDelJugador[],
        misiones: misiones ? (misionesConPrevia(misiones.misiones, misiones.previas) as MisionDelJugador[]) : null,
      };
    },
  });
}

/** Los recursos que se le mandaron al chico. */
export function useEnviosDelJugador(clubId: string, jugadorId: string) {
  const cargar = useCargarRepositorio();
  return useQuery({
    queryKey: ['plantel', 'ficha', 'envios', clubId, jugadorId],
    queryFn: async () => (await cargar()).obtenerEnviosDeJugador(clubId, jugadorId),
  });
}
