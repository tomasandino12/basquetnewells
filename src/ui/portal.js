import { html } from './html.js';
import { $ } from './dom.js';
import { formulariosPublicos } from '../data/repositorio.js';
import { PORTAL, urlEmbedCalendario, enlaceFormulario, enlaceContacto, sponsorsValidos } from '../data/portal.js';
import { resolverFormularios, separarFormularios } from '../data/formulariosPortal.js';
import { destinoDeAuth } from '../data/entradaAuth.js';

/*
 * Portal "Básquet Newell's": la página pública que se reparte a las familias
 * (public/portal.html). Calendarios y contacto salen de src/data/portal.js. Lo
 * único que lee de la base es la lista de formularios activos, por la función
 * anónima formularios_publicos (0058): nada de jugadores ni de familias, que
 * están del otro lado del login, en /app.
 */

const PRONTO = html`<div class="portal-pronto">Próximamente</div>`;

/**
 * Con la lista vacía: la coordinación los ocultó a todos, o todavía no cargó
 * ninguno. `hayOtros` es para cuando sí hay uno con lugar propio (por ejemplo
 * el de "Quiero jugar" arriba de la página) y la lista común quedó vacía.
 */
export function htmlSinFormularios({ hayOtros = false } = {}) {
  const cuales = hayOtros ? 'otros formularios' : 'formularios';
  return html`<div class="portal-tarjeta"><div class="d">Por ahora no hay ${cuales} abiertos. Si necesitás algo, escribile al coordinador (más abajo en esta página).</div></div>`;
}

/**
 * El acceso destacado de arriba de la página: "Quiero jugar en Newell's". Es el
 * formulario que la coordinación marcó con el destino consultas; el texto es su
 * línea de ayuda y los tres pasos son los mismos de siempre (no suponer que las
 * familias saben qué se hace con un formulario de Google). Sin formulario, o con
 * un enlace que no es de Google Forms, no se muestra nada: la sección queda oculta.
 */
export function htmlJugar(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  if (!url) return html``;
  return html`<div class="portal-destacado">
    <div class="t">Quiero jugar en Newell's</div>
    <div class="d">${formulario.texto}</div>
    <ol class="portal-ayuda">
      <li>Tocá el botón de abajo.</li>
      <li>Se abre un formulario de Google: completalo con los datos que te pida.</li>
      <li>Mandalo: con eso ya quedó tu consulta.</li>
    </ol>
    <a class="btn" href="${url}" target="_blank" rel="noopener">Quiero jugar en Newell's</a>
  </div>`;
}

/** Si la base no respondió se muestra una copia: mejor eso que nada, pero que se note. */
export function htmlAvisoRespaldo() {
  return html`<p class="portal-pronto">No pudimos actualizar la lista de formularios; te mostramos la última que conocemos.</p>`;
}

/**
 * El botón de "Sumate como sponsor o colaborador": el formulario que la
 * coordinación marcó con el destino colaboradores, con su línea de ayuda y los
 * tres pasos. Sin formulario (o con un enlace que no es de Google Forms) queda
 * "Próximamente" y no un botón a ningún lado.
 */
export function htmlColaboradores(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  if (!url) return PRONTO;
  return html`<div class="portal-tarjeta">
    <div class="d">${formulario.texto}</div>
    <ol class="portal-ayuda">
      <li>Tocá el botón de abajo.</li>
      <li>Se abre un formulario de Google: contanos quién sos y cómo querés colaborar.</li>
      <li>Mandalo: con eso ya quedó tu propuesta.</li>
    </ol>
    <a class="btn" href="${url}" target="_blank" rel="noopener">Quiero colaborar</a>
  </div>`;
}

/**
 * La franja de logos de sponsors. Sin ninguno válido no devuelve nada y la
 * franja queda oculta: no se muestra un cartel vacío.
 */
export function htmlLogos(sponsors) {
  const lista = sponsorsValidos(sponsors);
  if (!lista.length) return html``;
  return html`<ul class="portal-logos-lista">${lista.map((s) => {
    const imagen = html`<img src="${s.logo}" alt="${s.nombre}" loading="lazy">`;
    return html`<li>${s.enlace ? html`<a href="${s.enlace}" target="_blank" rel="noopener">${imagen}</a>` : imagen}</li>`;
  })}</ul>`;
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
  // La franja de logos no depende de la base: sale de src/data/portal.js y queda oculta sin ninguno.
  const logos = htmlLogos(PORTAL.sponsors);
  $('portal-logos').innerHTML = logos;
  $('portal-logos').hidden = !logos.toString();

  // Si la URL es la vuelta de un login, portalEntrada.js ya está mandando a la
  // persona a /app. Acá no se consulta nada: el cliente de Supabase canjearía
  // el ?code= o el #access_token en esta página, y la sesión es de /app.
  if (destinoDeAuth(window.location.search, window.location.hash)) return;

  const { estado, formularios } = await resolverFormularios(() => formulariosPublicos(PORTAL.clubId), PORTAL.formularios);

  // Los dos con lugar propio (consultas arriba, colaboradores en su sección) no se repiten en la lista.
  const { consultas, colaboradores, comunes } = separarFormularios(formularios);
  const jugar = htmlJugar(consultas);
  $('portal-jugar').innerHTML = jugar;
  $('jugar').hidden = !jugar.toString();
  $('portal-colaboradores').innerHTML = htmlColaboradores(colaboradores);

  $('portal-formularios').innerHTML = estado === 'vacio'
    ? htmlSinFormularios()
    : html`${estado === 'respaldo' && htmlAvisoRespaldo()}${comunes.length ? htmlFormularios(comunes) : htmlSinFormularios({ hayOtros: Boolean(consultas || colaboradores) })}`;
}
