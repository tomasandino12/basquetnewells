/**
 * Tema de la app: claro por defecto, oscuro si la persona lo prende en Mi perfil.
 * La preferencia es del teléfono (localStorage), no de la cuenta.
 *
 * public/tema.js repite esta regla mínima (la clave, el valor 'oscuro' y el color
 * de la barra) porque corre antes del importmap y no puede importar nada:
 * tests/contratoTokens.test.js compara los dos.
 */
export const CLAVE_TEMA = 'semillero.tema';

/**
 * Color de la barra del navegador (meta theme-color) en oscuro: el del fondo, --pub-fondo.
 * En claro queda el del HTML (el de la cabecera), que se recuerda al cambiar de tema.
 */
export const COLOR_BARRA_OSCURO = '#0D0D10';

/** Sólo 'oscuro' prende el tema oscuro: cualquier otra cosa (ausente, vacía, rota) es claro. */
export function normalizarTema(valor) {
  return valor === 'oscuro' ? 'oscuro' : 'claro';
}
