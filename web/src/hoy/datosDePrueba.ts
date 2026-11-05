import type { MedicionTiro } from '../datos/repositorio';

const ZONAS = ['esq_izq', 'c45_izq', 'frontal', 'c45_der', 'esq_der', 'libres'];

/** Tres jugadores inventados que tiran 10 por zona: `anotados` es lo que mete cada uno en esa zona (por defecto 6). */
export function bateria(sesionId: string, anotados: Record<string, number> = {}): MedicionTiro[] {
  return ZONAS.flatMap((posicion) =>
    ['j-1', 'j-2', 'j-3'].map((jugadorId) => ({ sesionId, jugadorId, posicion, anotados: anotados[posicion] ?? 6, intentos: 10 })),
  );
}
