// Forma del jugador para el profe. Un número que no se sabe es null, nunca 0.
export type Posicion = 'Base' | 'Escolta' | 'Alero' | 'Ala-pívot' | 'Pívot';

export interface Jugador {
  id: string;
  nombre: string;
  apellido: string;
  numero: number | null;
  posicion: Posicion;
  nacimiento: number;
  alturaCm: number | null;
  partidos: number;
  /** Promedios por partido; null si todavía no hay partidos cargados. */
  puntos: number | null;
  rebotes: number | null;
  asistencias: number | null;
  minutos: number | null;
  /** Porcentajes de 0 a 100. */
  triples: number | null;
  libres: number | null;
  /** Puntos de los últimos partidos, del más viejo al más nuevo. */
  ultimos: (number | null)[];
  saltoCm: number | null;
  sprintSeg: number | null;
  fuerte: string | null;
  aTrabajar: string | null;
}
