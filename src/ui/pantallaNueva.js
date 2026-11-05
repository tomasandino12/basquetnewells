import { CLAVE_NUEVA, ESPERA_NUEVA_MS, RUTA_NUEVA, direccionNueva, normalizarNueva } from '../data/interruptorNueva.js';
import { toast } from './nav.js';

/**
 * Salida de /app hacia las pantallas nuevas (Plantel y ficha). Todo es del
 * teléfono y todo va en try/catch: en modo privado localStorage tira, y no
 * poder leer el interruptor nunca puede romper la pantalla vieja (queda apagado).
 */

export function nuevaPrendida() {
  try {
    return normalizarNueva(localStorage.getItem(CLAVE_NUEVA)) === 'si';
  } catch {
    return false;
  }
}

/** Devuelve false si el teléfono no dejó guardar. */
export function guardarNueva(prendida) {
  try {
    if (prendida) localStorage.setItem(CLAVE_NUEVA, 'si');
    else localStorage.removeItem(CLAVE_NUEVA);
    return true;
  } catch {
    return false;
  }
}

/**
 * Respaldo: antes de irse de /app se comprueba que /nueva responda. Sin conexión,
 * con el deploy caído o tardando de más, la persona se queda en la pantalla vieja
 * (que es la que anda) en vez de caer en una página en blanco.
 */
async function nuevaResponde() {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_NUEVA_MS);
  try {
    const r = await fetch(RUTA_NUEVA, { method: 'HEAD', cache: 'no-store', signal: corte.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Si el interruptor está prendido, lleva a la pantalla nueva y devuelve true: quien
 * llama no sigue con la vieja. Apagado, o si /nueva no responde, devuelve false y
 * la pantalla vieja se abre como siempre.
 */
export async function abrirEnNueva({ plantelId, jugadorId } = {}) {
  if (!nuevaPrendida()) return false;
  if (!(await nuevaResponde())) {
    toast('La versión nueva no está disponible ahora. Te dejamos la de siempre.');
    return false;
  }
  // assign y no replace: el atrás del sistema vuelve a /app.
  window.location.assign(direccionNueva({ plantelId, jugadorId }));
  return true;
}
