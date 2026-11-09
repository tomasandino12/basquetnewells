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
 * La dirección de la pantalla nueva. /nueva usa rutas con # (se publica estático).
 * Sin plantel o con un id raro va a la lista de planteles; un jugador sin plantel
 * no tiene dónde abrirse. El id se valida y no se concatena crudo: la dirección
 * termina en un cambio de location y no tiene que poder llevar a otro lado.
 */
export function direccionNueva({ plantelId, jugadorId, pantalla = 'plantel' } = {}) {
  if (typeof plantelId !== 'string' || !ID_SEGURO.test(plantelId)) return `${RUTA_NUEVA}#/`;
  if (pantalla === 'hoy') return `${RUTA_NUEVA}#/hoy/${plantelId}`;
  const base = `${RUTA_NUEVA}#/plantel/${plantelId}`;
  if (typeof jugadorId !== 'string' || !ID_SEGURO.test(jugadorId)) return base;
  return `${base}?jugador=${jugadorId}`;
}
