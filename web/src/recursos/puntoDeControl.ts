import { AROS } from '@datos/animacionJugada.js';
import { estadoAlInicioDelPaso } from '@datos/jugadas.js';
import type { DatosDePizarra } from '../datos/repositorio';

type Punto = { x: number; y: number };

/** El punto de control de una acción (el real, o el punto medio del trazo si todavía no tiene uno), para el asa de la curva. */
export function puntoDeControl(datos: DatosDePizarra, k: number, indice: number): Punto | null {
  const inicio = estadoAlInicioDelPaso(datos, k) as { posiciones: Map<string, Punto> };
  const a = datos.pasos[k]?.acciones?.[indice];
  if (!a) return null;
  if (a.control) return a.control;
  const aro = (AROS as Record<string, Punto>)[datos.cancha] ?? AROS.media;
  const desde = a.tipo === 'rebote' ? aro : inicio.posiciones.get(a.ficha);
  const hasta =
    a.tipo === 'tiro' ? aro
    : a.tipo === 'rebote' ? inicio.posiciones.get(a.ficha)
    : a.tipo === 'pase' || a.tipo === 'handoff' ? inicio.posiciones.get(a.a ?? '')
    : a.hasta;
  if (!desde || !hasta) return null;
  return { x: (desde.x + hasta.x) / 2, y: (desde.y + hasta.y) / 2 };
}
