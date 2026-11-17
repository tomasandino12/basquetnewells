/**
 * Google no lleva nuestros metadatos: «Soy jugador» se anota en la pestaña antes de salir
 * (sessionStorage sobrevive a la redirección en la misma pestaña) y se lee al volver, cuando la
 * cuenta todavía no tiene club. Como `quiere_ser_jugador`, sólo decide a qué formulario llevarla:
 * no autoriza nada. Lo que un jugador ve lo decide la base.
 */
export const CLAVE_JUGADOR_POR_GOOGLE = 'alta.jugador-por-google';

export function anotarJugadorPorGoogle(esJugador: boolean): void {
  try {
    if (esJugador) sessionStorage.setItem(CLAVE_JUGADOR_POR_GOOGLE, '1');
    else sessionStorage.removeItem(CLAVE_JUGADOR_POR_GOOGLE);
  } catch {
    // Sin almacenamiento, el jugador cae en «falta el acceso», que tiene su botón.
  }
}

export function eligioJugadorPorGoogle(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_JUGADOR_POR_GOOGLE) === '1';
  } catch {
    return false;
  }
}

export function soltarJugadorPorGoogle(): void {
  try {
    sessionStorage.removeItem(CLAVE_JUGADOR_POR_GOOGLE);
  } catch {
    // Nada que soltar.
  }
}
