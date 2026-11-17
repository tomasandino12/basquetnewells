import { destinoDeAuth } from '@datos/entradaAuth.js';
import { CLAVE_NUEVA, RUTA_CLASICA } from '@datos/interruptorNueva.js';

/**
 * Desde el 09/11/2026 esta app es /app (vercel.json) y la de siempre vive en
 * /app/clasica. Entrar, crear cuenta y la vuelta de los mails y de Google ya viven acá (cuenta/);
 * lo que todavía no se mudó sigue allá (H-175).
 *
 * `?desde=nueva` le dice a la de siempre que no la mande de vuelta acá.
 */
export const APP_DE_SIEMPRE = `${RUTA_CLASICA}?desde=nueva`;

/**
 * La de siempre abierta directo en una prueba de Medir (`tiro`, `salto`, `sprint`, `yoyo`) o en la
 * lista de pruebas (`medir`). La lista cerrada vive en `interruptorNueva.js`.
 */
export const medirEnLaDeSiempre = (destino: 'medir' | 'tiro' | 'salto' | 'sprint' | 'yoyo') =>
  `${APP_DE_SIEMPRE}&ir=${destino}`;

/** En el armado de producción; en la compu (/nueva/ del servidor de Vite) no existe la de siempre. */
const PUBLICADA = import.meta.env.PROD && typeof window !== 'undefined' && window.location.pathname.startsWith('/app');

/**
 * Pasa a la de siempre sin dejar esta en el historial. Devuelve false si no hay
 * de siempre (en la compu): ahí quien llama sigue con lo suyo.
 */
export function irALaDeSiempre({ volver = false }: { volver?: boolean } = {}): boolean {
  if (!PUBLICADA) return false;
  // Sin `desde`: la de siempre, después de entrar, vuelve a mandar Plantel y Hoy acá.
  window.location.replace(volver ? RUTA_CLASICA : APP_DE_SIEMPRE);
  return true;
}

/**
 * Antes de dibujar nada: con el interruptor apagado en Mi perfil, se abre la de siempre.
 * La vuelta de un mail o del login con Google (a /app, la dirección permitida en Supabase)
 * NO se reenvía: la resuelve esta app, apagada o no. Si se mandara a otro lado con el
 * interruptor apagado, el link de confirmar la cuenta se perdería.
 */
export function reenviarSiCorresponde(): boolean {
  if (!PUBLICADA) return false;
  const { search, hash } = window.location;
  if (destinoDeAuth(search, hash)) return false;
  let apagada = false;
  try {
    apagada = localStorage.getItem(CLAVE_NUEVA) === 'no';
  } catch {
    apagada = false;
  }
  if (apagada) {
    window.location.replace(APP_DE_SIEMPRE);
    return true;
  }
  return false;
}
