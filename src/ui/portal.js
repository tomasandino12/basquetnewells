import { html } from './html.js';
import { $ } from './dom.js';
import { formulariosPublicos } from '../data/repositorio.js';
import { PORTAL, urlEmbedCalendario, enlaceFormulario, enlaceContacto } from '../data/portal.js';
import { resolverFormularios } from '../data/formulariosPortal.js';
import { destinoDeAuth } from '../data/entradaAuth.js';

/*
 * Portal "Básquet Newell's": la página pública que se reparte a las familias
 * (public/portal.html). Calendarios y contacto salen de src/data/portal.js. Lo
 * único que lee de la base es la lista de formularios activos, por la función
 * anónima formularios_publicos (0058): nada de jugadores ni de familias, que
 * están del otro lado del login, en /app.
 */

const PRONTO = html`<div class="portal-pronto">Próximamente</div>`;

/** Con la lista vacía: la coordinación los ocultó a todos, o todavía no cargó ninguno. */
export function htmlSinFormularios() {
  return html`<div class="portal-tarjeta"><div class="d">Por ahora no hay formularios abiertos. Si necesitás algo, escribile al coordinador (más abajo en esta página).</div></div>`;
}

/** Si la base no respondió se muestra una copia: mejor eso que nada, pero que se note. */
export function htmlAvisoRespaldo() {
  return html`<p class="portal-pronto">No pudimos actualizar la lista de formularios; te mostramos la última que conocemos.</p>`;
}

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

export async function iniciarPortal() {
  $('portal-calendarios').innerHTML = htmlCalendarios(PORTAL.calendarios);
  $('portal-contacto').innerHTML = htmlContacto(PORTAL.contacto);

  // Si la URL es la vuelta de un login, portalEntrada.js ya está mandando a la
  // persona a /app. Acá no se consulta nada: el cliente de Supabase canjearía
  // el ?code= o el #access_token en esta página, y la sesión es de /app.
  if (destinoDeAuth(window.location.search, window.location.hash)) return;

  const { estado, formularios } = await resolverFormularios(() => formulariosPublicos(PORTAL.clubId), PORTAL.formularios);
  $('portal-formularios').innerHTML = estado === 'vacio'
    ? htmlSinFormularios()
    : html`${estado === 'respaldo' && htmlAvisoRespaldo()}${htmlFormularios(formularios)}`;
}
