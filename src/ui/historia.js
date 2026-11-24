import { html, crudo } from './html.js';
import { $ } from './dom.js';
import { titulos, epocas, datosPublicables, epocaDeAnio, microDato } from '../data/historia.js';

/**
 * Página "Nuestra historia" (public/historia.html). Todo el texto que se ve sale
 * de src/data/historia.js y sólo de lo que devuelven `datosPublicables()` y
 * `microDato()`: acá no se escribe ningún dato, sólo se lo arma y se lo muestra.
 *
 * Contrato con la vitrina (la copa 3D de la tarea 3, hoy un SVG):
 *  - 'historia:seleccion' se emite sobre #vitrina (y sube por el DOM) cada vez que
 *    cambia lo elegido. detail = { epocaId, anio, anios }: `anios` son los años de
 *    título a marcar en la copa (una época → los suyos; un año → ése; nada → []).
 *  - 'historia:elegir' se escucha sobre #vitrina. detail = { anio } o { epocaId }:
 *    es como la copa pide elegir cuando se toca una placa.
 *  - `seleccionar()` hace lo mismo desde código.
 * Los eventos van por el DOM, y no por imports, para que la vitrina se cargue
 * recién cuando se acerca al viewport y pueda no estar nunca (sin WebGL).
 */

const EPOCA_INICIAL = 'doce-seguidos';

const movimientoReducido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const fechaCorta = (iso) => iso.split('-').reverse().join('/');

/** "1943–1954", o "1983" si la época es de un solo año. */
export const rangoDeEpoca = (e) => (e.desde === e.hasta ? `${e.desde}` : `${e.desde}–${e.hasta}`);

/** Los años de título que caen en una época (los de "1950" son los de ese año, aunque esté dentro de los 12 seguidos). */
export const aniosDeEpoca = (e) => titulos().filter((t) => t.anio >= e.desde && t.anio <= e.hasta).map((t) => t.anio);

/** Los hitos publicables de una época: primero el principal, después los de cada año en orden. */
export function hitosDeEpoca(e) {
  return datosPublicables()
    .filter((d) => d.texto && d.epoca === e.id)
    .sort((a, b) => (b.id === e.hitoPrincipal) - (a.id === e.hitoPrincipal) || (a.anio ?? 0) - (b.anio ?? 0));
}

// ---------------------------------------------------------------------------
// Armadores de HTML (puros: devuelven fragmentos, no tocan el DOM)
// ---------------------------------------------------------------------------

/** "Fuente: medio · título (fecha)", con link. Las que no traen fecha de publicación llevan la de consulta. */
export const htmlFuente = (f) => html`<a class="fuente" href="${f.url}" target="_blank" rel="noopener">Fuente: ${f.medio} · ${f.titulo} (${f.fecha ? fechaCorta(f.fecha) : `consultada el ${fechaCorta(f.consultada)}`})</a>`;

const htmlFuentes = (h) => [h.fuente, ...(h.otrasFuentes ?? [])].map((f) => html`<li>${htmlFuente(f)}</li>`);

const htmlEstrellaChip = (t) => html`<li class="chip-titulo"><span aria-hidden="true">★</span> ${t.anio}${t.torneo ? html` <small>${t.torneo}</small>` : ''}</li>`;

function htmlHito(h, e) {
  const conAnio = h.anio && e.desde !== e.hasta;
  return html`<article class="hito">
    ${conAnio ? html`<p class="hito-anio">${h.anio}</p>` : ''}
    <p class="hito-txt">${h.texto}</p>
    ${h.tecnico ? html`<dl class="hito-dato"><dt>Técnico</dt><dd>${h.tecnico}</dd></dl>` : ''}
    ${h.plantel ? html`<dl class="hito-dato"><dt>Plantel</dt><dd>${h.plantel.join(' · ')}</dd></dl>` : ''}
    <ul class="hito-fuentes">${htmlFuentes(h)}</ul>
  </article>`;
}

/** La tarjeta "Archivo histórico" de una época. */
export function htmlArchivo(e) {
  const anios = titulos().filter((t) => aniosDeEpoca(e).includes(t.anio));
  return html`<div class="archivo-cab"><span>Archivo histórico</span><span>${rangoDeEpoca(e)}</span></div>
    ${anios.length ? html`<ul class="chips-titulo" aria-label="Títulos de esta época">${anios.map(htmlEstrellaChip)}</ul>` : ''}
    ${hitosDeEpoca(e).map((h) => htmlHito(h, e))}`;
}

/** La línea de tiempo: una época por nodo; la elegida muestra su tarjeta. */
export function htmlLinea(abiertaId) {
  return html`<ol class="linea">${epocas().map((e) => {
    const abierta = e.id === abiertaId;
    return html`<li class="linea-item${e.solapada ? ' solapada' : ''}${abierta ? ' on' : ''}" data-epoca="${e.id}">
      <h3><button type="button" class="linea-btn" id="btn-${e.id}" data-epoca="${e.id}" aria-expanded="${String(abierta)}" aria-controls="archivo-${e.id}">
        <span class="linea-anio">${rangoDeEpoca(e)}</span>
        <span class="linea-nombre">${e.nombre}</span>
        <svg class="linea-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button></h3>
      <div class="archivo" id="archivo-${e.id}" role="region" aria-labelledby="btn-${e.id}"${abierta ? '' : crudo(' hidden')}>${htmlArchivo(e)}</div>
    </li>`;
  })}</ol>`;
}

/** La grilla de las 15 estrellas, con una nota para los años que llevan aclaración (1983). */
export function htmlEstrellas() {
  const todos = titulos();
  const aclarados = todos.filter((t) => t.torneo);
  return html`<ol class="estrellas" id="estrellas">${todos.map((t, i) => html`<li style="--i:${i}">
      <button type="button" class="estrella" data-anio="${t.anio}" aria-pressed="false" aria-label="Título ${t.numero}, ${t.anio}${t.torneo ? `, ${t.torneo}` : ''}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>
        <b>${t.anio}${t.torneo ? '*' : ''}</b>
        <small>N.º ${t.numero}</small>
      </button>
    </li>`)}</ol>
    <div class="ficha" id="ficha" aria-live="polite"></div>
    ${aclarados.length ? html`<p class="estrellas-nota">${aclarados.map((t) => html`<span>* ${t.anio}: ${t.torneo}.</span>`)}</p>` : ''}`;
}

/** La ficha de un año de título: su dato propio o, si no tiene, el de su época. */
export function htmlFicha(anio) {
  const t = titulos().find((x) => x.anio === anio);
  if (!t) return html`<p class="ficha-vacia">Tocá una estrella.</p>`;
  const dato = microDato(anio);
  const epoca = epocaDeAnio(anio);
  return html`<div class="ficha-cab">
      <span class="ficha-anio">${t.anio}</span>
      <span class="ficha-num">Título N.º ${t.numero} de ${titulos().length}</span>
      ${t.torneo ? html`<span class="ficha-torneo">${t.torneo}</span>` : ''}
    </div>
    ${dato ? html`<p class="ficha-txt">${dato.texto}</p>
      ${dato.anio !== anio && epoca ? html`<p class="ficha-epoca">Dato de la época «${epoca.nombre}».</p>` : ''}
      <ul class="hito-fuentes">${htmlFuentes(dato)}</ul>` : html`<p class="ficha-epoca">Todavía no hay un dato verificado de este año.</p>`}`;
}

/** Hitos publicables que no son de ninguna época (el contexto de la Asociación). */
export function htmlContexto() {
  const sueltos = datosPublicables().filter((d) => d.texto && d.epoca == null);
  if (!sueltos.length) return null;
  return html`<p class="portal-st">Contexto</p>${sueltos.map((h) => html`<p class="contexto-txt">${h.texto}</p><ul class="hito-fuentes">${htmlFuentes(h)}</ul>`)}`;
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const estado = { epocaId: null, anio: null, previa: null };

/** Cuenta de 0 al total en poco más de un segundo; con movimiento reducido, directo al número. */
function animarContador(el, total) {
  el.textContent = String(total);
  if (movimientoReducido() || typeof requestAnimationFrame !== 'function') return;
  const inicio = performance.now();
  const duracion = 1400;
  const paso = (ahora) => {
    const p = Math.min(1, (ahora - inicio) / duracion);
    el.textContent = String(Math.round((1 - (1 - p) ** 3) * total));
    if (p < 1) requestAnimationFrame(paso);
  };
  el.textContent = '0';
  requestAnimationFrame(paso);
}

function pintarFicha() {
  const anio = estado.previa ?? estado.anio;
  $('ficha').innerHTML = anio == null ? html`<p class="ficha-vacia">Tocá una estrella para ver su dato.</p>` : htmlFicha(anio);
  $('ficha').classList.toggle('con-dato', anio != null);
}

function pintarSeleccion() {
  document.querySelectorAll('.linea-item').forEach((li) => {
    const abierta = li.dataset.epoca === estado.epocaId;
    li.classList.toggle('on', abierta);
    li.querySelector('.linea-btn').setAttribute('aria-expanded', String(abierta));
    li.querySelector('.archivo').hidden = !abierta;
  });
  const epoca = epocas().find((e) => e.id === estado.epocaId);
  const deLaEpoca = epoca ? aniosDeEpoca(epoca) : [];
  document.querySelectorAll('.estrella').forEach((b) => {
    const anio = Number(b.dataset.anio);
    b.setAttribute('aria-pressed', String(anio === estado.anio));
    b.classList.toggle('en-epoca', deLaEpoca.includes(anio));
  });
  pintarFicha();
}

/**
 * Elige una época ({ epocaId }), un año ({ anio }) o nada ({ epocaId: null }), actualiza
 * la página y avisa a la vitrina con 'historia:seleccion'. Un año abre también su época.
 */
export function seleccionar({ epocaId = null, anio = null } = {}) {
  if (anio != null && !titulos().some((t) => t.anio === anio)) return;
  if (epocaId != null && !epocas().some((e) => e.id === epocaId)) return;
  estado.anio = anio;
  estado.epocaId = anio != null ? epocaDeAnio(anio)?.id ?? null : epocaId;
  estado.previa = null;
  pintarSeleccion();
  const epoca = epocas().find((e) => e.id === estado.epocaId);
  const anios = anio != null ? [anio] : epoca ? aniosDeEpoca(epoca) : [];
  $('vitrina').dispatchEvent(new CustomEvent('historia:seleccion', { bubbles: true, detail: { epocaId: estado.epocaId, anio: estado.anio, anios } }));
}

// Con movimiento permitido, las estrellas entran de a una cuando la grilla llega a la
// pantalla. Si algo falla, la clase no se pone y las estrellas se ven igual.
function revelarEstrellas() {
  const grilla = $('estrellas');
  if (movimientoReducido() || typeof IntersectionObserver !== 'function') return;
  grilla.classList.add('anim');
  new IntersectionObserver((entradas, obs) => {
    if (!entradas.some((e) => e.isIntersecting)) return;
    grilla.classList.add('visto');
    obs.disconnect();
  }, { threshold: 0.25 }).observe(grilla);
}

export function iniciarHistoria() {
  animarContador($('hist-contador'), titulos().length);

  $('hist-linea').innerHTML = htmlLinea(EPOCA_INICIAL);
  $('hist-estrellas').innerHTML = htmlEstrellas();
  const contexto = htmlContexto();
  if (contexto) {
    $('hist-contexto').innerHTML = contexto;
    $('hist-contexto').hidden = false;
  }
  estado.epocaId = EPOCA_INICIAL;
  pintarSeleccion();
  revelarEstrellas();

  $('hist-linea').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.linea-btn');
    if (!btn) return;
    // Tocar la época abierta la cierra.
    seleccionar({ epocaId: btn.dataset.epoca === estado.epocaId && estado.anio == null ? null : btn.dataset.epoca });
  });

  const grilla = $('estrellas');
  grilla.addEventListener('click', (ev) => {
    const b = ev.target.closest('.estrella');
    if (!b) return;
    // Elegir un año abre su época en la línea de tiempo, que queda arriba: si cambia de alto,
    // el contenido se corre debajo del dedo (Safari no compensa). Se deja la estrella donde estaba.
    const antes = b.getBoundingClientRect().top;
    seleccionar({ anio: Number(b.dataset.anio) });
    window.scrollBy(0, b.getBoundingClientRect().top - antes);
  });
  // Con mouse, pasar por encima muestra el dato sin cambiar lo elegido.
  grilla.addEventListener('pointerover', (ev) => {
    const b = ev.target.closest('.estrella');
    if (!b || ev.pointerType !== 'mouse') return;
    estado.previa = Number(b.dataset.anio);
    pintarFicha();
  });
  grilla.addEventListener('pointerleave', () => {
    if (estado.previa == null) return;
    estado.previa = null;
    pintarFicha();
  });

  $('vitrina').addEventListener('historia:elegir', (ev) => seleccionar(ev.detail ?? {}));
}

// En los tests (node) el módulo sólo se importa por los armadores de HTML.
if (typeof document !== 'undefined' && document.getElementById('hist-linea')) iniciarHistoria();
