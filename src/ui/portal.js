import { html } from './html.js';
import { $ } from './dom.js';
import { PORTAL, urlEmbedCalendario, enlaceFormulario, enlaceContacto } from '../data/portal.js';

/*
 * Portal "Básquet Newell's": la página pública que se reparte a las familias
 * (public/portal.html). Todo sale de src/data/portal.js. Esta parte no lee la
 * base de jugadores ni nada de ellos: hay datos de menores del otro lado del
 * login, en /app.
 */

const PRONTO = html`<div class="portal-pronto">Próximamente</div>`;

/**
 * Una tarjeta por formulario, con su línea de para qué es y qué tener a mano.
 * Si el enlace no es de Google Forms (lo pegó alguien a mano) la tarjeta
 * queda sin botón: mejor "Próximamente" que un link a cualquier lado.
 */
export function htmlFormularios(formularios) {
  if (!formularios?.length) return PRONTO;
  return html`${formularios.map(({ titulo, texto, enlace }) => {
    const url = enlaceFormulario(enlace);
    return html`<div class="portal-tarjeta">
      <div class="t">${titulo}</div>
      <div class="d">${texto}</div>
      ${url ? html`<a class="btn" href="${url}" target="_blank" rel="noopener">Abrir el formulario</a>` : PRONTO}
    </div>`;
  })}`;
}

// sandbox sin allow-top-navigation: el calendario no puede llevarse la página.
// allow-popups para que "abrir en Google Calendar" siga andando.
export function htmlCalendarios(calendarios) {
  return html`${calendarios.map(({ titulo, id }) => {
    const src = urlEmbedCalendario(id);
    return html`<div class="portal-cal">
      <div class="portal-cal-t">${titulo}</div>
      ${src ? html`<iframe src="${src}" title="Calendario: ${titulo}" loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>` : PRONTO}
    </div>`;
  })}`;
}

export function htmlContacto(contacto) {
  const url = enlaceContacto(contacto);
  if (!url) return PRONTO;
  const etiqueta = url.startsWith('mailto:') ? 'Escribirle por mail' : 'Escribirle por WhatsApp';
  return html`<a class="btn" href="${url}" target="_blank" rel="noopener">${etiqueta}</a>`;
}

export function iniciarPortal() {
  $('portal-formularios').innerHTML = htmlFormularios(PORTAL.formularios);
  $('portal-calendarios').innerHTML = htmlCalendarios(PORTAL.calendarios);
  $('portal-contacto').innerHTML = htmlContacto(PORTAL.contacto);
}
