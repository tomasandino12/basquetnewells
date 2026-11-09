import { CLAVE_PLANTEL } from '@datos/interruptorNueva.js';

const VIEJA = /^\/(hoy|plantel|asistencia|fisico)\/([\w-]{1,64})(\/[^?#]*)?(\?[^#]*)?$/;

/**
 * Las direcciones de antes eran con # y con el id de la categoría (/app#/hoy/2000…). Si llega una
 * (un favorito, un enlace viejo), la categoría se guarda en el teléfono y la dirección queda limpia
 * (/app/hoy). Devuelve la dirección nueva, o null si no había nada que cambiar.
 */
export function direccionLimpia(hash: string, base: string, guardar: (plantelId: string) => void): string | null {
  if (!hash.startsWith('#/')) return null;
  const ruta = hash.slice(1);
  const m = VIEJA.exec(ruta);
  if (!m) return `${base}${ruta}`;
  guardar(m[2]);
  return `${base}/${m[1]}${m[3] ?? ''}${m[4] ?? ''}`;
}

export function limpiarDireccionVieja(base: string) {
  const nueva = direccionLimpia(window.location.hash, base, (id) => {
    try {
      localStorage.setItem(CLAVE_PLANTEL, id);
    } catch {
      // Sin localStorage se abre la primera categoría.
    }
  });
  if (nueva) window.history.replaceState(null, '', nueva);
}
