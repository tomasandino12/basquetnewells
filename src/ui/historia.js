import { html, crudo } from './html.js';
import { $ } from './dom.js';
import { titulos, epocas, datosPublicables, epocaDeAnio, microDato, momentos, hitoDeTitulo, resumenDeTitulos } from '../data/historia.js';

/**
 * Página "Nuestra historia" (public/historia.html). Todo el texto que se ve sale
 * de src/data/historia.js y sólo de lo que devuelven `datosPublicables()`,
 * `hitoDeTitulo()`, `momentos()` y `microDato()`: acá no se escribe ningún dato,
 * sólo se lo arma y se lo muestra.
 *
 * La línea histórica: un bloque por época (barra roja, sobretítulo y título) con
 * las tarjetas de sus títulos en una tira unida por una línea. Los años sin dato
 * propio son tarjetas compactas; los hitos que no son un título (Del Vecchio, el
 * Cubierto, los 100 años de la Rosarina) van como tarjetas "momento", sin estrella.
 *
 * Contrato con la vitrina (la copa 3D de la tarea 3, hoy un SVG):
 *  - 'historia:seleccion' se emite sobre #vitrina (y sube por el DOM) cada vez que
 *    cambia lo elegido: al tocar una tarjeta o una estrella, o al llegar con el
 *    scroll a otra época. detail = { epocaId, anio, anios }: `anios` son los años
 *    de título a marcar en la copa (una época → los suyos; un año → ése; nada → []).
 *  - 'historia:elegir' se escucha sobre #vitrina. detail = { anio } o { epocaId }:
 *    es como la copa pide elegir cuando se toca una placa. La línea se desplaza
 *    hasta esa tarjeta.
 *  - `seleccionar()` hace lo mismo desde código.
 * Los eventos van por el DOM, y no por imports, para que la vitrina se cargue
 * recién cuando se acerca al viewport y pueda no estar nunca (sin WebGL).
 */

const EPOCA_INICIAL = 'doce-seguidos';

const movimientoReducido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const fechaCorta = (iso) => iso.split('-').reverse().join('/');

/** "1943 – 1954", o "1983" si la época es de un solo año. */
export const rangoDeEpoca = (e) => (e.desde === e.hasta ? `${e.desde}` : `${e.desde} – ${e.hasta}`);

/** Los años de título que caen en una época (los de "1950" son los de ese año, aunque esté dentro de los 12 seguidos). */
export const aniosDeEpoca = (e) => titulos().filter((t) => t.anio >= e.desde && t.anio <= e.hasta).map((t) => t.anio);

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// ---------------------------------------------------------------------------
// Armadores de HTML (puros: devuelven fragmentos, no tocan el DOM)
// ---------------------------------------------------------------------------

/** "Fuente: medio · título (fecha)", con link. Las que no traen fecha de publicación llevan la de consulta. */
export const htmlFuente = (f) => html`<a class="fuente" href="${f.url}" target="_blank" rel="noopener">Fuente: ${f.medio} · ${f.titulo} (${f.fecha ? fechaCorta(f.fecha) : `consultada el ${fechaCorta(f.consultada)}`})</a>`;

const htmlFuentes = (h) => [h.fuente, ...(h.otrasFuentes ?? [])].map((f) => html`<li>${htmlFuente(f)}</li>`);

// La estrella es lo único dorado de la línea: un título ganado.
const ICONO_ESTRELLA = crudo('<svg class="t-estrella" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>');

/** "Ver plantel": técnico y jugadores, plegados para que la tarjeta no se vuelva un listado. */
const htmlPlantel = (h) => (h.tecnico || h.plantel ? html`<details class="plantel">
    <summary>Ver plantel</summary>
    ${h.tecnico ? html`<dl class="hito-dato"><dt>Técnico</dt><dd>${h.tecnico}</dd></dl>` : ''}
    ${h.plantel ? html`<dl class="hito-dato"><dt>Plantel</dt><dd>${h.plantel.join(' · ')}</dd></dl>` : ''}
  </details>` : '');

/** La tarjeta de un título. Con dato propio es grande (texto, plantel, fuente); sin él, una fila compacta. */
export function htmlTarjetaTitulo(t) {
  const h = hitoDeTitulo(t.anio);
  const categoria = t.torneo ? html`<span class="t-torneo">${t.torneo}</span>` : html`<span class="t-cat">Primera División</span>`;
  return html`<li class="racha-item"><article class="t-card${h ? ' con-historia' : ''}" data-anio="${t.anio}" data-rev>
    <span class="t-marca" aria-hidden="true">${String(t.numero).padStart(2, '0')}</span>
    <header class="t-cab">
      <h3 class="t-anio"><button type="button" class="t-sel" data-anio="${t.anio}" aria-pressed="false" aria-label="Título ${t.numero}, ${t.anio}${t.torneo ? `, ${t.torneo}` : ''}">${t.anio}</button></h3>
      ${ICONO_ESTRELLA}
      ${categoria}
    </header>
    ${h ? html`<p class="t-txt">${h.texto}</p>${htmlPlantel(h)}<ul class="hito-fuentes">${htmlFuentes(h)}</ul>` : ''}
  </article></li>`;
}

/** La tarjeta "momento": un hito que no es un título. Ancha, con borde rojo a la izquierda y sin estrella. */
export function htmlMomento(h) {
  return html`<article class="momento" data-momento="${h.id}" data-epoca="${h.epoca ?? ''}" data-rev>
    <p class="momento-rotulo">Momento</p>
    <h3 class="momento-anio"><button type="button" class="t-sel" data-epoca="${h.epoca}" aria-pressed="false">${h.anio}</button></h3>
    <p class="t-txt">${h.texto}</p>
    <ul class="hito-fuentes">${htmlFuentes(h)}</ul>
  </article>`;
}

/** Un momento pertenece a la época que lo contiene: la suya, o la que abarca a su época solapada (Del Vecchio, 1950, cae en los 12 seguidos). */
function momentosDeEpoca(e) {
  const todas = epocas();
  return momentos().filter((m) => {
    if (m.epoca === e.id) return true;
    const propia = todas.find((x) => x.id === m.epoca);
    return !!propia?.solapada && !e.solapada && propia.desde >= e.desde && propia.hasta <= e.hasta;
  });
}

/** Un bloque de la línea: barra roja, sobretítulo, título, intro de la época y la tira de tarjetas. */
export function htmlEpoca(e) {
  const ts = titulos().filter((t) => t.epoca === e.id);
  const ms = momentosDeEpoca(e);
  const intro = datosPublicables().find((d) => d.texto && d.epoca === e.id && d.anio == null);
  // En la tira, cada momento va justo después del título de su año (o al final, si es posterior).
  const items = [...ts.map((t) => ({ t, anio: t.anio, orden: 0 })), ...ms.map((m) => ({ m, anio: m.anio, orden: 1 }))]
    .sort((a, b) => a.anio - b.anio || a.orden - b.orden);
  const sobre = `${rangoDeEpoca(e)}${ts.length ? ` · ${plural(ts.length, 'título', 'títulos')}` : ''}`;
  return html`<section class="epoca" data-epoca="${e.id}" aria-labelledby="ep-${e.id}">
    <header class="epoca-cab" data-rev>
      <p class="epoca-sobre">${sobre}</p>
      <h2 class="epoca-tit" id="ep-${e.id}">${e.nombre}</h2>
    </header>
    ${intro ? html`<div class="epoca-intro" data-rev><p>${intro.texto}</p><ul class="hito-fuentes">${htmlFuentes(intro)}</ul></div>` : ''}
    ${ts.length
    ? html`<ol class="racha" data-linea>${items.map((i) => (i.t ? htmlTarjetaTitulo(i.t) : html`<li class="racha-item es-momento">${htmlMomento(i.m)}</li>`))}</ol>`
    : html`<div class="momentos">${ms.map(htmlMomento)}</div>`}
  </section>`;
}

/**
 * La línea histórica entera: una época tras otra. Los momentos sin época (los 100 años
 * de la Asociación) no se muestran: Tomás prefirió que la línea arranque en 1943.
 */
export function htmlLinea() {
  return html`${epocas().filter((e) => !e.solapada).map(htmlEpoca)}`;
}

/** El panel de cifras del encabezado: todo sale de `resumenDeTitulos()`. */
export function htmlCifras() {
  const r = resumenDeTitulos();
  return html`<span class="cifras-fantasma" aria-hidden="true">${r.total}</span>
    <dl class="cifras">
      <div><dt>Títulos de Primera</dt><dd>${r.total}</dd></div>
      <div><dt>Seguidos</dt><dd>${r.racha.cantidad}<small>${r.racha.desde}–${r.racha.hasta}</small></dd></div>
      <div><dt>Primer título</dt><dd>${r.primero}</dd></div>
    </dl>`;
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
  const epoca = epocas().find((e) => e.id === estado.epocaId);
  const deLaEpoca = epoca ? aniosDeEpoca(epoca) : [];
  document.querySelectorAll('.epoca').forEach((el) => el.classList.toggle('on', el.dataset.epoca === estado.epocaId));
  document.querySelectorAll('.t-card').forEach((c) => {
    const anio = Number(c.dataset.anio);
    c.classList.toggle('on', anio === estado.anio);
    c.classList.toggle('en-epoca', estado.anio == null && deLaEpoca.includes(anio));
  });
  document.querySelectorAll('.momento').forEach((m) => {
    const elegido = m.dataset.epoca !== '' && m.dataset.epoca === estado.epocaId && estado.anio == null;
    m.classList.toggle('on', elegido);
  });
  document.querySelectorAll('.t-sel').forEach((b) => {
    const activo = b.dataset.anio ? Number(b.dataset.anio) === estado.anio : estado.anio == null && b.dataset.epoca === estado.epocaId;
    b.setAttribute('aria-pressed', String(activo));
  });
  document.querySelectorAll('.estrella').forEach((b) => {
    const anio = Number(b.dataset.anio);
    b.setAttribute('aria-pressed', String(anio === estado.anio));
    b.classList.toggle('en-epoca', deLaEpoca.includes(anio));
  });
  pintarFicha();
}

/**
 * Elige una época ({ epocaId }), un año ({ anio }) o nada ({ epocaId: null }), actualiza
 * la página y avisa a la vitrina con 'historia:seleccion'. Un año elige también su época.
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

// Con movimiento permitido, cada pieza de la línea aparece al entrar en pantalla (y la línea de la
// tira se dibuja de arriba abajo). La clase `anim` la pone el script: si algo falla, todo se ve igual.
function revelarLinea() {
  const linea = $('hist-linea');
  if (movimientoReducido() || typeof IntersectionObserver !== 'function') return;
  linea.classList.add('anim');
  const obs = new IntersectionObserver((entradas) => {
    // Las que entran juntas (varias tarjetas compactas) lo hacen escalonadas.
    entradas.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.transitionDelay = `${i * 70}ms`;
      e.target.classList.add('visto');
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.1 });
  linea.querySelectorAll('[data-rev], [data-linea]').forEach((el) => obs.observe(el));
}

// Cuando el scroll llega a otra época, la vitrina la sigue. Una franja fina a mitad de pantalla decide cuál es.
function seguirEpoca() {
  if (typeof IntersectionObserver !== 'function') return;
  const obs = new IntersectionObserver((entradas) => {
    for (const en of entradas) {
      if (!en.isIntersecting) continue;
      const id = en.target.dataset.epoca;
      const e = epocas().find((x) => x.id === id);
      const actual = epocas().find((x) => x.id === estado.epocaId);
      // Lo elegido ya está en este bloque (un año suyo, o una época solapada como Del Vecchio): no se pisa.
      if (id === estado.epocaId || (actual?.solapada && e && actual.desde >= e.desde && actual.hasta <= e.hasta)) continue;
      seleccionar({ epocaId: id });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('.epoca').forEach((el) => obs.observe(el));
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

/** Lleva la línea hasta lo elegido (cuando la copa pide un año o una época). */
function llevarALinea() {
  const sel = estado.anio != null ? `.t-card[data-anio="${estado.anio}"]` : `.epoca[data-epoca="${estado.epocaId}"], .momento[data-epoca="${estado.epocaId}"]`;
  document.querySelector(sel)?.scrollIntoView({ block: 'center', behavior: movimientoReducido() ? 'auto' : 'smooth' });
}

export function iniciarHistoria() {
  animarContador($('hist-contador'), titulos().length);
  $('hist-cifras').innerHTML = htmlCifras();

  $('hist-linea').innerHTML = htmlLinea();
  $('hist-estrellas').innerHTML = htmlEstrellas();
  estado.epocaId = EPOCA_INICIAL;
  pintarSeleccion();
  revelarLinea();
  revelarEstrellas();
  seguirEpoca();

  $('hist-linea').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.t-sel');
    if (!btn) return;
    if (btn.dataset.anio) {
      const anio = Number(btn.dataset.anio);
      // Tocar de nuevo el año elegido lo suelta y deja marcada su época.
      seleccionar(anio === estado.anio ? { epocaId: epocaDeAnio(anio)?.id } : { anio });
    } else {
      seleccionar({ epocaId: btn.dataset.epoca === estado.epocaId && estado.anio == null ? null : btn.dataset.epoca });
    }
  });

  const grilla = $('estrellas');
  grilla.addEventListener('click', (ev) => {
    const b = ev.target.closest('.estrella');
    if (b) seleccionar({ anio: Number(b.dataset.anio) });
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

  $('vitrina').addEventListener('historia:elegir', (ev) => {
    seleccionar(ev.detail ?? {});
    llevarALinea();
  });
}

// En los tests (node) el módulo sólo se importa por los armadores de HTML.
if (typeof document !== 'undefined' && document.getElementById('hist-linea')) iniciarHistoria();
