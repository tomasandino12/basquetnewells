/**
 * Interruptor por celular para abrir Plantel y la ficha en la versión nueva (/nueva).
 * Apagado por defecto: sólo el valor 'si' lo prende, cualquier otra cosa (ausente,
 * vacía, rota) es apagado. Es del teléfono (localStorage), no de la cuenta, para
 * poder probar en un solo aparato sin tocar a los demás profes.
 *
 * No hay autorización acá: /nueva pide los datos con la misma sesión y la misma
 * RLS que /app. El interruptor sólo decide qué pantalla se muestra.
 */
export const CLAVE_NUEVA = 'semillero.nueva';

/** Cuánto se espera a que /nueva conteste antes de quedarse con la pantalla vieja. */
export const ESPERA_NUEVA_MS = 3000;

/**
 * Dónde vive la versión nueva (vercel.json la publica ahí). Sin barra final: es la
 * dirección que vercel.json reescribe y sirve sin guardar en el navegador.
 */
export const RUTA_NUEVA = '/nueva';

export function normalizarNueva(valor) {
  return valor === 'si' ? 'si' : 'no';
}

const ID_SEGURO = /^[\w-]{1,64}$/;

/**
 * La dirección de la pantalla nueva. /nueva usa rutas con # (se publica estático).
 * Sin plantel o con un id raro va a la lista de planteles; un jugador sin plantel
 * no tiene dónde abrirse. El id se valida y no se concatena crudo: la dirección
 * termina en un cambio de location y no tiene que poder llevar a otro lado.
 */
export function direccionNueva({ plantelId, jugadorId } = {}) {
  if (typeof plantelId !== 'string' || !ID_SEGURO.test(plantelId)) return `${RUTA_NUEVA}#/`;
  const base = `${RUTA_NUEVA}#/plantel/${plantelId}`;
  if (typeof jugadorId !== 'string' || !ID_SEGURO.test(jugadorId)) return base;
  return `${base}?jugador=${jugadorId}`;
}
