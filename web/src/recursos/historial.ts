/*
 * Deshacer y rehacer del editor de jugadas: una pila de fotos completas de los
 * datos (el JSON es chico, ≤64 KB), sin diffs ni comandos inversos. Puro y sin
 * React, para probarlo solo.
 */
export interface Historial<T> {
  pila: T[];
  indice: number;
  /** Posición de la pila que está guardada en la base; -1 si ya no está en la pila (se descartó por el tope). */
  guardado: number;
}

const TOPE = 50;

export const crearHistorial = <T>(inicial: T): Historial<T> => ({ pila: [inicial], indice: 0, guardado: 0 });

export const actual = <T>(h: Historial<T>): T => h.pila[h.indice];

export function empujar<T>(h: Historial<T>, nuevo: T): Historial<T> {
  const pila = [...h.pila.slice(0, h.indice + 1), nuevo];
  let guardado = h.guardado > h.indice ? -1 : h.guardado; // lo guardado en una rama que se pisó ya no se puede recuperar
  if (pila.length > TOPE) {
    pila.shift();
    guardado = guardado === -1 ? -1 : guardado - 1;
    if (guardado < 0) guardado = -1;
  }
  return { pila, indice: pila.length - 1, guardado };
}

export const puedeDeshacer = <T>(h: Historial<T>) => h.indice > 0;
export const puedeRehacer = <T>(h: Historial<T>) => h.indice < h.pila.length - 1;
export const deshacer = <T>(h: Historial<T>): Historial<T> => (puedeDeshacer(h) ? { ...h, indice: h.indice - 1 } : h);
export const rehacer = <T>(h: Historial<T>): Historial<T> => (puedeRehacer(h) ? { ...h, indice: h.indice + 1 } : h);

export const marcarGuardado = <T>(h: Historial<T>): Historial<T> => ({ ...h, guardado: h.indice });
export const haySinGuardar = <T>(h: Historial<T>) => h.indice !== h.guardado;
