import { CLAVE_TEMA, COLOR_BARRA_OSCURO, normalizarTema } from '../data/tema.js';

/**
 * El tema de este teléfono. Al abrir la app ya lo puso public/tema.js (antes de
 * pintar); esto es lo que lo cambia desde Mi perfil, sin recargar.
 *
 * Todo va en try/catch: en modo privado localStorage tira al escribir, y no
 * poder guardar el tema nunca puede romper la pantalla (se aplica igual, hasta
 * que se cierre la app).
 */

/** El tema que se está viendo ahora. */
export function temaActual() {
  return normalizarTema(document.documentElement.dataset.tema);
}

/** Lo que se ve: el atributo de <html> que usan los tokens y el color de la barra del navegador. */
export function aplicarTema(tema) {
  const t = normalizarTema(tema);
  if (t === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');
  else document.documentElement.removeAttribute('data-tema');
  const barra = document.querySelector('meta[name="theme-color"]');
  if (!barra) return;
  // El color claro es el que trae el HTML: se recuerda la primera vez (public/tema.js ya lo hizo si arrancó oscuro).
  barra.dataset.claro ??= barra.getAttribute('content');
  barra.setAttribute('content', t === 'oscuro' ? COLOR_BARRA_OSCURO : barra.dataset.claro);
}

/** Lo que se recuerda para la próxima vez. Devuelve false si el teléfono no dejó guardar. */
export function guardarTema(tema) {
  try {
    const t = normalizarTema(tema);
    if (t === 'oscuro') localStorage.setItem(CLAVE_TEMA, 'oscuro');
    else localStorage.removeItem(CLAVE_TEMA);
    return true;
  } catch {
    return false;
  }
}
