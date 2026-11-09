/**
 * Desde el 09/11/2026 la app nueva (React) es /app y esta, la de siempre, vive en
 * /app/clasica para lo que todavía no se mudó (login, Medir, Recursos, Datos,
 * coordinación, jugador y familia). Este interruptor decide si Hoy, Plantel y la
 * ficha se abren en la nueva.
 * Prendido por defecto desde el 08/11/2026 (Tomás quiere ver el rediseño en /app y nadie
 * usa la app todavía): sólo el valor 'no' lo apaga. Es del teléfono (localStorage), no de
 * la cuenta: quien prefiera la de siempre lo apaga en Mi perfil.
 *
 * No hay autorización acá: /nueva pide los datos con la misma sesión y la misma
 * RLS que /app. El interruptor sólo decide qué pantalla se muestra.
 */
export const CLAVE_NUEVA = 'semillero.nueva';

/** Cuánto se espera a que /nueva conteste antes de quedarse con la pantalla vieja. */
export const ESPERA_NUEVA_MS = 3000;

/**
 * Dónde vive la versión nueva (vercel.json la sirve ahí). Sin barra final: es la
 * dirección que vercel.json reescribe y sirve sin guardar en el navegador.
 */
export const RUTA_NUEVA = '/app';

/** Dónde vive esta app, la de siempre (vercel.json). */
export const RUTA_CLASICA = '/app/clasica';

/**
 * La app nueva enlaza acá con `?desde=nueva` cuando la persona quiere algo que
 * todavía no se mudó: entonces la de siempre no la manda de vuelta a la nueva.
 */
export function vieneDeLaNueva(search) {
  return new URLSearchParams(String(search ?? '').replace(/^\?/, '')).get('desde') === 'nueva';
}

export function normalizarNueva(valor) {
  return valor === 'no' ? 'no' : 'si';
}

const ID_SEGURO = /^[\w-]{1,64}$/;

/**
 * La categoría con la que se trabaja (los chips de arriba). La nueva la lee del
 * teléfono y no de la dirección: Tomás no quiere ver ids en /app. Esta app la
 * escribe justo antes de pasar a la nueva (ver pantallaNueva.js).
 */
export const CLAVE_PLANTEL = 'semillero.plantel';

/** Sólo un id con forma de id: lo que se guarda termina eligiendo qué datos se piden. */
export function plantelSeguro(plantelId) {
  return typeof plantelId === 'string' && ID_SEGURO.test(plantelId) ? plantelId : null;
}

/**
 * La dirección de la pantalla nueva, limpia: /app/hoy, /app/plantel. La ficha de
 * un jugador va con ?jugador=<id> y la nueva la cambia por su nombre apenas abre.
 * El id se valida y no se concatena crudo: la dirección termina en un cambio de
 * location y no tiene que poder llevar a otro lado.
 */
export function direccionNueva({ jugadorId, pantalla = 'plantel' } = {}) {
  if (pantalla === 'hoy') return `${RUTA_NUEVA}/hoy`;
  const base = `${RUTA_NUEVA}/plantel`;
  if (typeof jugadorId !== 'string' || !ID_SEGURO.test(jugadorId)) return base;
  return `${base}?jugador=${jugadorId}`;
}
