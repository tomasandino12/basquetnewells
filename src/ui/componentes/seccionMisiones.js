import { html } from '../html.js';
import { ESTADOS, textoDeMision } from '../../data/misiones.js';

const GLIFO = { logrado: '✓', en_proceso: '◐', no_logrado: '✕' };
const formatearFecha = (iso) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
};

/**
 * Las misiones de un chico, en orden cronológico y nada más: sin totales, sin
 * porcentajes y sin compararlo con nadie (un conteo volvería a meter la
 * competencia individual que las misiones vienen a sacar). `misiones` sale de
 * `misionesConPrevia`, la más reciente primero.
 */
export function seccionMisiones(misiones) {
  if (!misiones.length) {
    return html`<div class="eyebrow">Misiones</div><div class="p">Todavía no tuvo misiones.</div>`;
  }
  return html`
    <div class="eyebrow">Misiones</div>
    <div class="tarj">
      <div class="tabla-ev">${misiones.map((m) => {
        const estado = ESTADOS.find((e) => e.id === m.estado);
        return html`
        <div class="fila-ev dos">
          <div class="f">${formatearFecha(m.fecha)}</div>
          <div>
            <div>${textoDeMision(m)}${m.rival ? html` <span class="sin">· ${m.rival}</span>` : ''}</div>
            ${estado
              ? html`<span class="chip${m.estado === 'logrado' ? ' sube' : ''}"><span aria-hidden="true">${GLIFO[m.estado]}</span> ${estado.nombre}</span>`
              : html`<span class="chip sin">Sin evaluar</span>`}
            ${m.comentario ? html`<div class="det">${m.comentario}</div>` : ''}
          </div>
        </div>`;
      })}</div>
    </div>
  `;
}
