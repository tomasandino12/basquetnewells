import { useSyncExternalStore } from 'react';

/**
 * La vuelta de un mail (confirmar la cuenta, nueva clave) o del login con Google llega a /app con
 * parámetros en la dirección. Si salió bien, Supabase los lee solo y abre la sesión.
 * Si salió mal (link vencido o ya usado, Google que no dejó pasar) llega `error`/`error_code` y no
 * hay sesión: sin este aviso la persona caería en «Entrar» sin saber qué pasó.
 *
 * Vive fuera de React: se lee antes de dibujar nada y la dirección se limpia enseguida.
 */
const MENSAJE_VENCIDO = 'El link venció o ya se usó. Entrá con tu clave o pedí otro desde «Olvidé la clave».';
const MENSAJE_GENERICO = 'No pudimos completar el ingreso desde ese link. Entrá con tu mail y tu clave.';

const parametros = (t: string) => new URLSearchParams(t.replace(/^[?#]/, ''));

/** El texto para quien vuelve con un error en la dirección, o null si no hay ninguno. */
export function fallaDeLaVuelta(search: string, hash: string): string | null {
  const p = [parametros(search), parametros(hash)];
  const dice = (c: string) => p.map((x) => x.get(c)).find(Boolean) ?? null;
  const codigo = dice('error_code');
  if (!codigo && !dice('error')) return null;
  // «access_denied» sola puede ser que la persona canceló en Google: no es un link vencido.
  if (codigo === 'otp_expired' || /expired|invalid/i.test(dice('error_description') ?? '')) return MENSAJE_VENCIDO;
  return MENSAJE_GENERICO;
}

/** La dirección sin los parámetros del error (los que traen una sesión no se tocan: los lee Supabase). */
export function direccionSinError(search: string, hash: string): { search: string; hash: string } {
  const quitar = (t: string, prefijo: '?' | '#') => {
    const p = parametros(t);
    for (const c of ['error', 'error_code', 'error_description']) p.delete(c);
    const resto = p.toString();
    return resto ? `${prefijo}${resto}` : '';
  };
  return { search: quitar(search, '?'), hash: quitar(hash, '#') };
}

let pendiente: string | null = null;
const oyentes = new Set<() => void>();

/** Antes de dibujar: guarda el error de la vuelta (si lo hay) y deja la dirección limpia. */
export function registrarFallaDeLaVuelta(): void {
  if (typeof window === 'undefined') return;
  const { search, hash, pathname } = window.location;
  const falla = fallaDeLaVuelta(search, hash);
  if (!falla) return;
  pendiente = falla;
  const limpia = direccionSinError(search, hash);
  window.history.replaceState(null, '', `${pathname}${limpia.search}${limpia.hash}`);
  oyentes.forEach((f) => f());
}

export function soltarFallaDeLaVuelta(): void {
  if (pendiente === null) return;
  pendiente = null;
  oyentes.forEach((f) => f());
}

export function useFallaDeLaVuelta(): string | null {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => pendiente,
    () => null,
  );
}

/** Sólo para pruebas: deja el módulo como recién cargado. */
export function reiniciarFallaDeLaVuelta(): void {
  pendiente = null;
}
