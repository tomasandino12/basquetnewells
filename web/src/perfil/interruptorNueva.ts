import { CLAVE_NUEVA, normalizarNueva } from '@datos/interruptorNueva.js';

/**
 * El interruptor de la versión nueva es del teléfono (localStorage), como el tema. Prendido por
 * defecto: sólo el valor 'no' lo apaga. No hay autorización acá: decide qué pantalla se muestra.
 */
export function nuevaPrendida(): boolean {
  try {
    return normalizarNueva(localStorage.getItem(CLAVE_NUEVA)) === 'si';
  } catch {
    return true;
  }
}

/** Devuelve si se pudo guardar; si no, el interruptor queda como estaba (no se promete lo que no se cumple). */
export function guardarNueva(prendida: boolean): boolean {
  try {
    if (prendida) localStorage.removeItem(CLAVE_NUEVA);
    else localStorage.setItem(CLAVE_NUEVA, 'no');
    return true;
  } catch {
    return false;
  }
}
