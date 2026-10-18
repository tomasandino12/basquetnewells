import { html } from '../html.js';
import { textoDeMision } from '../../data/misiones.js';

const formatearFecha = (iso) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
};

/**
 * Lo que el equipo logró junto: las misiones de equipo marcadas Logrado, con
 * un contador de la temporada y la lista (la más reciente primero). Es del
 * plantel, nunca de un jugador: la sensación que busca es la de unión por
 * algo logrado en conjunto. `logros` sale de `logrosDelEquipo`.
 */
export function bloqueLogros(logros, { titulo = 'Logros del equipo', conTarjeta = true } = {}) {
  return html`
    <div class="eyebrow">${titulo}</div>
    <div class="${conTarjeta ? 'tarj' : ''}">
      <div class="cifra">${logros.length}</div>
      <div class="det">${logros.length === 1 ? 'logro en la temporada' : 'logros en la temporada'}</div>
      ${logros.length
        ? html`<div class="tabla-ev">${logros.map((l) => html`
          <div class="fila-ev dos">
            <div class="f">${formatearFecha(l.fecha)}</div>
            <div>${textoDeMision(l)}${l.rival ? html` <span class="sin">· ${l.rival}</span>` : ''}</div>
          </div>`)}</div>`
        : html`<div class="p">Las misiones del equipo se arman antes del partido, desde Plantel → Misiones del partido. Cuando evalúes una como Logrado, aparece acá.</div>`}
    </div>
  `;
}
