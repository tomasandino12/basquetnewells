import { html } from './html.js';
import { $ } from './dom.js';
import { PORTAL, urlEmbedCalendario, enlaceInscripcion } from '../data/portal.js';

/*
 * Bloque "El básquet del club" de la landing. Todo sale de src/data/portal.js:
 * esta parte es pública y no lee nada de la base, a propósito (hay datos de
 * menores del otro lado del login).
 */

const PRONTO = html`<div class="bq-pronto">Próximamente</div>`;

export function htmlInscripcion(url) {
  const u = enlaceInscripcion(url);
  return u ? html`<a class="btn" href="${u}" target="_blank" rel="noopener">Inscribirme</a>` : PRONTO;
}

// sandbox sin allow-top-navigation: el calendario no puede llevarse la página.
// allow-popups para que "abrir en Google Calendar" siga andando.
export function htmlCalendarios(calendarios) {
  return html`${calendarios.map(({ titulo, id }) => {
    const src = urlEmbedCalendario(id);
    return html`<div class="bq-cal">
      <div class="bq-cal-t">${titulo}</div>
      ${src ? html`<iframe src="${src}" title="Calendario: ${titulo}" loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>` : PRONTO}
    </div>`;
  })}`;
}

export function iniciarPortalLanding() {
  $('bq-inscripcion-accion').innerHTML = htmlInscripcion(PORTAL.inscripcion);
  $('bq-calendarios').innerHTML = htmlCalendarios(PORTAL.calendarios);
}
