import { CLAVE_NUEVA, ESPERA_NUEVA_MS, RUTA_NUEVA, direccionNueva, normalizarNueva } from '../data/interruptorNueva.js';
import { toast } from './nav.js';

/**
 * Salida de /app hacia las pantallas nuevas (Plantel y ficha). Todo es del
 * teléfono y todo va en try/catch: en modo privado localStorage tira, y no
 * poder leer el interruptor nunca puede romper la pantalla vieja (queda apagado).
 */

// Sin localStorage se queda en la de siempre: si no se puede guardar, tampoco se podría apagar.
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
    if (prendida) localStorage.removeItem(CLAVE_NUEVA);
    else localStorage.setItem(CLAVE_NUEVA, 'no');
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
export async function abrirEnNueva({ plantelId, jugadorId, pantalla, reemplazar = false } = {}) {
  if (!nuevaPrendida()) return false;
  if (!(await nuevaResponde())) {
    toast('La versión nueva no está disponible ahora. Te dejamos la de siempre.');
    return false;
  }
  const destino = direccionNueva({ plantelId, jugadorId, pantalla });
  // Al tocar una pestaña, assign: el atrás del sistema vuelve a /app. Al entrar,
  // replace: /app no queda en el historial y el atrás no rebota.
  if (reemplazar) window.location.replace(destino);
  else window.location.assign(destino);
  return true;
}

export const CLAVE_YA_SALTO = 'semillero.nueva.yaSalto';

/**
 * Al entrar a /app (no al tocar una pestaña): salta a la nueva una sola vez por
 * pestaña del navegador. Así abrir /app muestra lo nuevo, pero volver desde
 * /nueva con «En la app de siempre» se queda en la vieja. Sin sessionStorage no
 * salta: sin la marca no habría forma de no rebotar.
 */
export async function abrirAlEntrar({ plantelId, pantalla } = {}) {
  if (!nuevaPrendida()) return false;
  try {
    if (sessionStorage.getItem(CLAVE_YA_SALTO)) return false;
    sessionStorage.setItem(CLAVE_YA_SALTO, '1');
  } catch {
    return false;
  }
  return abrirEnNueva({ plantelId, pantalla, reemplazar: true });
}
