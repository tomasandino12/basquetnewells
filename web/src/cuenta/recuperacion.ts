import { useSyncExternalStore } from 'react';

/**
 * Supabase avisa con PASSWORD_RECOVERY cuando alguien vuelve desde el mail de «olvidé la clave»:
 * es la única señal de que hay que pedirle una clave nueva. Quien llega por ese link ya tiene una
 * sesión abierta, así que sin este aviso entraría derecho a la app sin cambiar nada.
 *
 * Vive fuera de React porque el aviso llega antes (o después) de que se dibuje cualquier pantalla.
 */
let pendiente = false;
const oyentes = new Set<() => void>();

const avisar = () => oyentes.forEach((f) => f());

export function marcarRecuperacion() {
  if (pendiente) return;
  pendiente = true;
  avisar();
}

export function soltarRecuperacion() {
  if (!pendiente) return;
  pendiente = false;
  avisar();
}

export function useRecuperacionPendiente(): boolean {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => pendiente,
    () => false,
  );
}

/**
 * Si la dirección es la vuelta de un mail de nueva clave (`type=recovery` en el hash o en la búsqueda).
 * Lo usa el arranque para no mandar esa vuelta a la app de siempre: la resuelve ésta.
 */
export function esVueltaDeRecuperacion(search: string, hash: string): boolean {
  const de = (t: string) => new URLSearchParams(t.replace(/^[?#]/, '')).get('type') === 'recovery';
  return de(search) || de(hash);
}
