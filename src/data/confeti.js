/*
 * Las piezas de un estallido de confeti: sólo números, sin DOM, para poder
 * probarlas. La interfaz (ui/celebracion.js) las convierte en elementos y el
 * CSS pone los colores: acá `variante` es un índice, no un color, así los
 * colores siguen viviendo en los tokens.
 */

export const VARIANTES_CONFETI = 4;

const entre = (azar, min, max) => Math.round(min + azar() * (max - min));

/**
 * `cantidad` piezas que salen de un punto: se abren `dx` px a los costados y
 * terminan `caida` px por debajo del origen, girando `giro` grados. El arco
 * (primero sube y después cae) lo hace la curva del CSS, no un número acá.
 * `demora` (ms) las desparrama para que no salgan todas juntas. `azar` es
 * inyectable: los tests pasan uno fijo.
 */
export function piezasDeConfeti(cantidad = 40, azar = Math.random) {
  return Array.from({ length: cantidad }, () => ({
    dx: entre(azar, -220, 220),
    caida: entre(azar, 160, 300),
    giro: entre(azar, 240, 720) * (azar() < 0.5 ? -1 : 1),
    tam: entre(azar, 8, 14),
    demora: entre(azar, 0, 140),
    variante: Math.min(VARIANTES_CONFETI - 1, Math.floor(azar() * VARIANTES_CONFETI)),
  }));
}
