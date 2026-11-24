import { html } from './html.js';
import { piezasDeConfeti } from '../data/confeti.js';

/*
 * El "gracias" de los botones que abren un formulario de Google en otra
 * pestaña (Recaudación y Colaborar). La página no se entera de si la persona
 * lo completó, así que no agradece al tocar: eso pasa cuando vuelve a esta
 * pestaña. Ahí se estampa el escudo del club con el gracias y sale el confeti.
 * (Al tocar, la pestaña nueva le tapa la pantalla: el confeti no se vería.)
 */

const ESCUDO = '/public/escudo.png';

export const AGRADECIMIENTOS = Object.freeze({
  sumarte: '¡Gracias por sumarte!',
  colaborar: '¡Gracias por colaborar!',
});

/** El escudo con el gracias. Una clave que no existe no pinta nada. */
export function htmlSello(clave) {
  if (!Object.hasOwn(AGRADECIMIENTOS, clave)) return html``;
  const texto = AGRADECIMIENTOS[clave];
  return html`<img src="${ESCUDO}" alt="" width="72" height="72"><b>${texto}</b>`;
}

const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Un estallido que sale del centro de `origen`. Con movimiento reducido, nada. */
export function lanzarConfeti(origen) {
  if (!origen || sinMovimiento()) return;
  const caja = origen.getBoundingClientRect();
  const capa = document.createElement('div');
  capa.className = 'confeti';
  capa.setAttribute('aria-hidden', 'true');
  capa.style.setProperty('left', `${caja.left + caja.width / 2}px`);
  capa.style.setProperty('top', `${caja.top + caja.height / 2}px`);
  for (const p of piezasDeConfeti()) {
    // Dos capas (ver publico.css): <i> la lleva de costado, <b> hace el arco.
    const pieza = document.createElement('i');
    pieza.className = `c${p.variante}`;
    pieza.style.setProperty('--cf-dx', `${p.dx}px`);
    pieza.style.setProperty('--cf-caida', `${p.caida}px`);
    pieza.style.setProperty('--cf-giro', `${p.giro}deg`);
    pieza.style.setProperty('--cf-tam', `${p.tam}px`);
    pieza.style.setProperty('--cf-demora', `${p.demora}ms`);
    pieza.append(document.createElement('b'));
    capa.append(pieza);
  }
  document.body.append(capa);
  setTimeout(() => capa.remove(), 2200);
}

/**
 * Engancha los botones con `data-gracias="<clave>"`: al tocarlos anota cuál
 * fue, y cuando la pestaña vuelve a verse estampa el sello en el lugar
 * `data-sello="<clave>"` y lanza el confeti desde el escudo. Devuelve
 * `restaurar`, que se llama después de volver a pintar las secciones: sin eso
 * el sello ya estampado se perdería con el nuevo HTML.
 */
export function iniciarGracias() {
  const dadas = new Set();
  let pendiente = null;

  const estampar = (clave, conConfeti) => {
    const sitio = document.querySelector(`[data-sello="${clave}"]`);
    if (!sitio) return;
    sitio.innerHTML = htmlSello(clave).toString();
    // El confeti sale cuando el escudo ya cayó sobre la página.
    if (conConfeti) setTimeout(() => lanzarConfeti(sitio.querySelector('img')), 280);
  };

  document.addEventListener('click', (ev) => {
    const boton = ev.target.closest('[data-gracias]');
    if (boton) pendiente = boton.dataset.gracias;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !pendiente) return;
    const clave = pendiente;
    pendiente = null;
    dadas.add(clave);
    estampar(clave, true);
  });

  return { restaurar: () => dadas.forEach((clave) => estampar(clave, false)) };
}
