import { html } from './html.js';
import { $ } from './dom.js';
import { formulariosPublicos, eventosDelMes } from '../data/repositorio.js';
import {
  PORTAL, enlaceFormulario, enlaceContacto, sponsorsValidos, calendariosActivos, categoriasDelPortal,
  categoriasDelAnio, sedeValida, aliasValido, fotoValida, tarjetasDeCategorias, tarjetaDelAnio, turnosDeHorario,
  fotoDeCategoriaValida, fotoDeEvento, FOTOS,
} from '../data/portal.js';
import { temporadaComoAnio } from '../data/categorias.js';
import { resolverFormularios, separarFormularios } from '../data/formulariosPortal.js';
import {
  eventosPorDia, proximosEventos, semanasDelMes, mesVecino, hoyEnRosario, tituloMes, fechaLarga,
  TIPOS_AGENDA, NOMBRE_TIPO, enlaceAgregarGoogle, textoIcs, enlacesSuscripcion, partesDeFecha, cuandoEs,
} from '../data/agenda.js';
import { destinoDeAuth } from '../data/entradaAuth.js';
import { revelar } from './animaciones.js';

/*
 * Portal "Básquet Newell's": la página pública que se reparte a las familias
 * (public/portal.html). Quien más la usa es un padre que entra a hacer en cinco
 * minutos lo que le dijeron: inscribir o mandar un comprobante. Por eso esas
 * dos acciones son las protagonistas de la banda de arriba, con el alias para
 * copiar a mano; lo demás va más abajo, y el coordinador aparece UNA vez, al
 * final de las preguntas frecuentes.
 *
 * De la base lee sólo la lista de formularios activos, por la función anónima
 * formularios_publicos (0058): nada de jugadores ni de familias, que están del
 * otro lado del login, en /app. Los eventos los pide a Google Calendar; el
 * resto sale de src/data/portal.js.
 */

const ABRE = '↗';

/** Los íconos de los atajos y de las acciones: trazos simples en currentColor, decorativos. */
const ICONO = {
  jugar: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18"/></svg>`,
  calendario: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  categorias: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  colaborar: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
  celular: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>`,
  agenda: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 5h13l-3 4 3 4H5"/></svg>`,
  ayuda: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/></svg>`,
  comprobante: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>`,
  inscribir: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14h6M9 17h4"/></svg>`,
  empresa: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>`,
  lugar: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  personaMas: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.6 3-5.5 6.5-5.5s6 1.9 6.5 5.5M19 8v6M16 11h6"/></svg>`,
  billetera: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z"/><circle cx="16" cy="13.5" r="1"/></svg>`,
  mano: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.3 14a1.5 1.5 0 0 1 2.4-1.8L8 14"/></svg>`,
  tilde: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  pizza: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21L3.5 6.5a14 14 0 0 1 17 0z"/><path d="M5.6 10a10 10 0 0 1 12.8 0"/><circle cx="10" cy="12.5" r="1"/><circle cx="13.5" cy="15" r="1"/></svg>`,
  rifa: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z"/><path d="M14 6v12" stroke-dasharray="2 2"/></svg>`,
  comida: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1.5-3 4-3 7h3"/></svg>`,
  sumate: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
};

/**
 * Un ícono por tipo de evento, para que el tipo no se distinga sólo por el
 * color (el color además lo pinta el CSS con --agenda-*).
 */
const ICONO_TIPO = {
  partido: ICONO.jugar,
  evento: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>`,
  charla: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H9l-5 4z"/></svg>`,
  entrenamiento: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M9.5 3h5"/></svg>`,
};

const botonExterno = (url, texto, clase = 'btn') => html`<a class="${clase}" href="${url}" target="_blank" rel="noopener">${texto} <span aria-hidden="true">${ABRE}</span></a>`;

/**
 * El botón de algo cuyo formulario todavía no está activo: se ve, pero no se
 * toca, y dice cuándo se habilita. Así nunca falta el botón ni hay uno que no
 * lleva a ningún lado. `aria-disabled` además de `disabled` para que el lector
 * de pantalla lo anuncie.
 */
const botonCerrado = (texto, clase = 'btn') => html`<button type="button" class="${clase}" disabled aria-disabled="true">${texto}</button>`;

/**
 * Uno de los dos botones del hero: ícono, título y una línea; todo el botón es
 * el enlace. Sin formulario activo se ve igual de macizo, con la línea que dice
 * cuándo se habilita y un "Pronto" en lugar de la flecha. `cargando`: la base
 * todavía no respondió y no se puede saber si hay formulario; se ve apagado
 * pero sin "Pronto", para no anunciar un cierre que quizá no es.
 */
function accion({ clase, icono, titulo, detalle, url, cerrado, cargando }) {
  const cuerpo = html`<i>${ICONO[icono]}</i><span><b>${titulo}</b><small>${url ? detalle : cerrado}</small></span>`;
  if (cargando) return html`<div class="portal-accion ${clase} apagada" aria-disabled="true" aria-busy="true">${cuerpo}</div>`;
  if (!url) return html`<div class="portal-accion ${clase} apagada" aria-disabled="true">${cuerpo}<em>Pronto</em></div>`;
  return html`<a class="portal-accion ${clase}" href="${url}" target="_blank" rel="noopener">${cuerpo}<em aria-hidden="true">${ABRE}</em></a>`;
}

/**
 * Los dos botones del hero. El primero depende de la inscripción: abierta
 * (destino inscripcion, 0062), es "Inscribirme"; cerrada, es "Quiero que
 * juegue" (destino consultas, 0061), el formulario para dejar los datos y
 * venir a probar. El segundo, "Pagar", NUNCA está apagado: abre la hoja con el
 * alias y, si hay, el comprobante (htmlPago). Son independientes: alguien se
 * puede inscribir sin pagar nada.
 */
export function htmlAcciones({ inscripcion = null, consultas = null, temporada = null, cargando = false } = {}) {
  const url = (f) => (f ? enlaceFormulario(f.enlace) : null);
  const ins = url(inscripcion);
  const primera = ins
    ? accion({ clase: 'principal', icono: 'personaMas', titulo: 'Inscribirme', url: ins, detalle: `Inscripción${temporada ? ` ${temporada}` : ''} abierta` })
    : accion({ clase: 'principal', icono: 'personaMas', titulo: 'Quiero que juegue', url: url(consultas), cargando,
      detalle: 'Dejá tus datos y te avisamos', cerrado: 'Se habilita cuando abra el formulario' });
  return html`${primera}
    <button type="button" class="portal-accion pago" data-abrir-pago aria-haspopup="dialog">
      <i>${ICONO.billetera}</i><span><b>Pagar</b><small>Alias y comprobante</small></span><em aria-hidden="true">›</em>
    </button>`;
}

/**
 * La barra fija de abajo: el mismo botón principal del hero (con su mismo
 * texto y destino) y "Pagar". Sin formulario para el principal (o mientras la
 * base no respondió) queda sólo "Pagar": un botón apagado abajo de todo sería
 * ruido, y el del hero ya cuenta cuándo se habilita.
 */
export function htmlDock({ inscripcion = null, consultas = null } = {}) {
  const url = (f) => (f ? enlaceFormulario(f.enlace) : null);
  const ins = url(inscripcion);
  const principal = ins ?? url(consultas);
  return html`${principal && html`<a class="portal-dock-btn principal" href="${principal}" target="_blank" rel="noopener">${ICONO.personaMas}${ins ? 'Inscribirme' : 'Quiero que juegue'}</a>`}
    <button type="button" class="portal-dock-btn pago" data-abrir-pago aria-haspopup="dialog">${ICONO.billetera}Pagar</button>`;
}

/**
 * El contenido de la hoja "Pagar": el alias para copiar y el comprobante. Se
 * paga más que cuotas, así que no promete nada en particular. Sin formulario
 * de comprobante activo lo dice y deja el alias igual; sin alias válido, sólo
 * el comprobante.
 */
export function htmlPago({ alias = null, comprobante = null } = {}) {
  const url = comprobante ? enlaceFormulario(comprobante.enlace) : null;
  return html`<p class="intro">Transferí al alias del club y, después, mandanos el comprobante.</p>
    ${htmlAlias(alias)}
    ${url
      ? html`<p class="portal-pago-paso">¿Ya transferiste? Subí la foto o la captura.</p>${botonExterno(url, 'Enviar comprobante')}`
      : html`<p class="portal-pago-nada">Por ahora no hay nada para pagar.</p>`}`;
}

/** El alias para transferir, con un botón para copiarlo. Sin un alias válido, nada. */
export function htmlAlias(alias) {
  const a = aliasValido(alias);
  if (!a) return html``;
  return html`<div class="portal-alias">
    <div><small>Alias para transferir</small><b>${a.alias}</b>${a.titular && html`<span>${a.titular}</span>`}</div>
    <button type="button" class="portal-copiar" data-copiar="${a.alias}">Copiar</button>
  </div>`;
}

/**
 * Los atajos de abajo de la banda: sólo a lo que existe en la página. Con
 * menos de dos no vale la fila: no devuelve nada.
 */
export function htmlAtajos(atajos) {
  if (atajos.length < 2) return html``;
  return html`${atajos.map(({ clave, texto, href, externo }) => html`<a href="${href}"${externo && html` target="_blank" rel="noopener"`}><i>${ICONO[clave]}</i>${texto}</a>`)}`;
}

/** Si la base no respondió se muestra una copia: mejor eso que nada, pero que se note. */
export function htmlAvisoRespaldo() {
  return html`<p class="portal-aviso">No pudimos actualizar la lista de formularios; te mostramos la última que conocemos.</p>`;
}

/**
 * La franja de Recaudación: el aviso por mail de los eventos de recaudación
 * del club. Sin foto y en dorado (como en la propuesta de v0): el botón es
 * dorado para que el rojo quede en el hero. Es el formulario con destino
 * recaudacion (0063), aparte del de colaborar: quien quiere comprar una pizza
 * no es una empresa que quiere asociarse. Su planilla de respuestas vive en
 * Google. Los partidos y charlas no van por mail: para eso está el "Seguilo"
 * del calendario.
 */
export function htmlRecaudacion(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  return html`<div class="portal-rec-txt">
      <div class="portal-st">Recaudación</div>
      <h2 id="t-recaudacion">Enterate de los eventos de recaudación</h2>
      <p>Dejanos tu mail y te avisamos cuando haya uno. Nada más.</p>
      <ul class="portal-rec-ej" aria-label="Por ejemplo">
        <li><i>${ICONO.pizza}</i>Noches de pizza</li><li><i>${ICONO.rifa}</i>Rifas</li><li><i>${ICONO.comida}</i>Comidas</li>
      </ul>
    </div>
    <div class="portal-rec-accion">
      ${url ? botonExterno(url, 'Quiero que me avisen', 'portal-rec-btn') : botonCerrado('Se habilita cuando abra el formulario', 'portal-rec-btn')}
    </div>`;
}

/**
 * "Sumate al básquet de Newell's": el formulario con destino colaboradores
 * (0061). Es para dos cosas: una empresa o comercio que quiere asociarse con
 * el básquet, o alguien que quiere dar una mano en los eventos. Lo que deja
 * queda en la planilla de Google de "Quiero colaborar", no en Semillero. Al
 * lado, el afiche que el club usa para buscar sponsors (el texto, en el alt).
 */
export function htmlColaborar(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  const afiche = fotoDeCategoriaValida(FOTOS.sponsor);
  return html`<div class="portal-colaborar-txt">
      <ul class="portal-formas">
        <li><i>${ICONO.empresa}</i><span><b>Tengo una empresa o un comercio</b>Poné tu marca en la camiseta y acompañá a las formativas.</span></li>
        <li><i>${ICONO.mano}</i><span><b>Quiero dar una mano</b>En los eventos del club: hacer el pollo, armar, servir, ayudar a organizar.</span></li>
      </ul>
      ${url ? botonExterno(url, 'Quiero colaborar', 'btn sec') : botonCerrado('Se habilita cuando abra el formulario')}
    </div>
    ${afiche && html`<img class="portal-afiche" src="${afiche.src640}" srcset="${afiche.src640} 640w, ${afiche.src} 1080w" sizes="(min-width: 48rem) 22rem, 80vw" width="640" height="853" alt="${afiche.alt}" loading="lazy">`}`;
}

/** La franja de logos de sponsors. Sin ninguno válido no devuelve nada. */
export function htmlLogos(sponsors) {
  const lista = sponsorsValidos(sponsors);
  if (!lista.length) return html``;
  return html`<ul class="portal-logos-lista">${lista.map((s) => {
    const imagen = html`<img src="${s.logo}" alt="${s.nombre}" loading="lazy">`;
    return html`<li>${s.enlace ? html`<a href="${s.enlace}" target="_blank" rel="noopener">${imagen}</a>` : imagen}</li>`;
  })}</ul>`;
}

/**
 * Los otros formularios (sin destino): una tarjeta por formulario, con su
 * línea de para qué es y qué tener a mano. Uno con un enlace que no es de
 * Google Forms no se muestra. Sin ninguno, nada: la sección se oculta.
 */
export function htmlFormularios(formularios) {
  const validos = (formularios ?? []).filter((f) => enlaceFormulario(f.enlace));
  return html`${validos.map(({ titulo, texto, enlace }) => html`<div class="portal-tarjeta">
    <div class="t">${titulo}</div>
    <div class="d">${texto}</div>
    ${botonExterno(enlaceFormulario(enlace), 'Abrir el formulario')}
  </div>`)}`;
}

/**
 * La fila de categorías debajo del buscador (como en la propuesta de v0): una
 * tarjeta por categoría, con su foto en duotono suave (grises + un poco del
 * color del club, en CSS) y el nombre grande. Cada tarjeta es un botón: al
 * tocarla, el buscador salta a su año; la del año elegido queda marcada con
 * "Su categoría" (aria-pressed). La pista se desliza con el dedo
 * (scroll-snap) y, para quien tiene mouse, con dos flechas. Sin foto, la
 * tarjeta lleva un fondo del club y una pelota. Sin categorías, nada.
 * `tarjetas`: de tarjetasDeCategorias.
 */
export function htmlCarrusel(tarjetas) {
  if (!tarjetas.length) return html``;
  return html`<div class="portal-carrusel-cab">
      <h3>Todas las categorías</h3>
      <span class="portal-carrusel-flechas">
        <button type="button" data-carrusel="-1" aria-label="Ver las categorías anteriores">‹</button>
        <button type="button" data-carrusel="1" aria-label="Ver las categorías siguientes">›</button>
      </span>
    </div>
    <ul class="portal-carrusel-pista">${tarjetas.map(({ nombre, rama, anios, foto, anio }) => html`<li class="portal-card${foto ? '' : ' sin-foto'}">
      <button type="button" data-anio-cat="${anio}" aria-pressed="false">
        ${foto
          ? html`<img src="${foto.src640}" srcset="${foto.src640} 640w, ${foto.src} 1080w" sizes="(min-width: 64rem) 13rem, (min-width: 48rem) 15rem, 70vw" width="640" height="427" alt="${foto.alt}" loading="lazy" style="object-position:${foto.posicion}">`
          : html`<i aria-hidden="true">${ICONO.jugar}</i>`}
        <span class="portal-card-su"><i>${ICONO.tilde}</i>Su categoría</span>
        <span class="portal-card-txt"><b>${nombre}</b>${rama && html`<span>${rama}</span>`}<small>Nacidos ${anios}</small></span>
      </button>
    </li>`)}</ul>
    <p class="portal-carrusel-guia" aria-hidden="true">Deslizá para ver todas →</p>`;
}

/** Las flechas del carrusel: corren la pista una tarjeta y media. Con movimiento reducido, sin deslizar. */
function iniciarCarrusel() {
  document.addEventListener('click', (ev) => {
    const flecha = ev.target.closest('[data-carrusel]');
    const pista = flecha?.closest('.portal-carrusel')?.querySelector('.portal-carrusel-pista');
    if (!pista) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pista.scrollBy({ left: Number(flecha.dataset.carrusel) * pista.clientWidth * 0.8, behavior: reducido ? 'auto' : 'smooth' });
  });
}

/**
 * El selector de año del "¿En qué categoría juega?": una caja con − y +
 * redondos alrededor del año grande y, al lado, otra caja con el resultado.
 */
export function htmlBuscador(anio, { min, max }) {
  return html`<div class="portal-anio-caja">
      <span class="portal-anio-et" id="portal-anio-et">Año de nacimiento</span>
      <div class="portal-anio" role="group" aria-labelledby="portal-anio-et">
        <button type="button" data-anio="-1" aria-label="Un año antes"${anio <= min && html` disabled`}>−</button>
        <output id="portal-anio">${anio}</output>
        <button type="button" data-anio="1" aria-label="Un año después"${anio >= max && html` disabled`}>+</button>
      </div>
    </div>
    <div class="portal-cat-resultado" id="portal-cat-res" aria-live="polite"></div>`;
}

/**
 * Lo que le toca a quien nació en `anio`: la categoría en grande, su rama y
 * sus años, y un renglón por turno (cuándo y dónde). Puede ser más de una
 * (las dos Primeras). Sin ninguna (más chico que la U9), lo dice y manda a
 * las preguntas frecuentes.
 */
export function htmlCategoriaDelAnio(anio, categorias) {
  if (!categorias.length) {
    return html`<p class="portal-cat-nada">Para chicos nacidos en ${anio} todavía no hay categoría. <a href="#ayuda">¿Dudas? Mirá las preguntas frecuentes</a>.</p>`;
  }
  return html`${categorias.map(({ nombre, rama, anios, horario }) => {
    const turnos = turnosDeHorario(horario);
    return html`<div class="portal-cat-res">
    <div class="portal-cat-nombre"><b>${nombre}</b><span>${rama && html`<em>${rama}</em>`}<small>Nacidos ${anios}</small></span></div>
    ${turnos.length
      ? html`<ul class="portal-cat-hora">${turnos.map(({ cuando, lugar }) => html`<li><span><i>${ICONO.categorias}</i>${cuando}</span>${lugar && html`<span class="lugar"><i>${ICONO.lugar}</i>${lugar}</span>`}</li>`)}</ul>`
      : html`<p class="portal-cat-sin">Horario a confirmar.</p>`}
  </div>`;
  })}`;
}

/**
 * Las preguntas frecuentes, en acordeón: lo que un padre pregunta antes de
 * escribirle al coordinador. Las respuestas cambian con lo que hay abierto
 * (inscripción, "Quiero jugar") para no mandar a un botón apagado. Al final,
 * la ÚNICA vez que aparece el WhatsApp del coordinador en la página.
 */
export function htmlAyuda({ inscripcionAbierta = false, consultasAbierto = false, temporada = null, alias = null, sede = null, contacto = null } = {}) {
  const a = aliasValido(alias);
  const s = sedeValida(sede);
  const coordinador = enlaceContacto(contacto);
  const pregunta = (titulo, respuesta) => html`<details class="portal-faq"><summary>${titulo}</summary><div class="portal-faq-r">${respuesta}</div></details>`;
  const comoInscribir = inscripcionAbierta
    ? html`<p>Tocá <b>Inscribirme</b>, arriba de todo. Se abre un formulario de Google: completalo desde el celular. Tené a mano el DNI del chico o la chica y el tuyo.</p>`
    : html`<p>La inscripción${temporada ? html` ${temporada}` : ''} todavía no abrió. ${consultasAbierto
      ? html`Mientras tanto, tocá <b>Quiero que juegue</b>, arriba de todo: dejás tus datos y te avisamos para que venga a probar.`
      : html`Cuando abra, el botón se habilita arriba de todo.`}</p>`;
  const alCoordinador = coordinador ? 'escribile al coordinador (el botón de acá abajo)' : 'escribile al coordinador';
  // Las preguntas van en la voz del padre y con sujeto: así las busca con la vista.
  return html`${pregunta('¿Cómo inscribo a mi hijo o hija?', comoInscribir)}
    ${pregunta('¿Cómo pago o mando el comprobante?', html`<p>Tocá <b>Pagar</b>, arriba de todo. ${a ? html`Ahí está el alias <b>${a.alias}</b>, con un botón <b>Copiar</b> para pegarlo en tu banco. ` : ''}Después, en esa misma hoja, tocá <b>Enviar comprobante</b> y subí la foto o la captura de la transferencia. Sirve para cuotas y para cualquier otro pago del club. Si no aparece ese botón, es que ahora no hay nada para pagar.</p>`)}
    ${pregunta('Me pide iniciar sesión con Google, ¿qué hago?', html`<p>La inscripción y el comprobante la piden porque se suben fotos (los DNI, la transferencia). Si no tenés Gmail, creá una cuenta de Google con el mail que ya usás, sin abrir uno nuevo:</p>
      <ol class="portal-faq-pasos">
        <li>Entrá a <a href="https://accounts.google.com/signup" target="_blank" rel="noopener">accounts.google.com</a> y tocá <b>Crear cuenta</b> → <b>Para uso personal</b>.</li>
        <li>Tocá <b>Usar mi dirección de correo electrónico actual</b> y escribí tu mail de siempre.</li>
        <li>Pegá el código que te llega a ese mail y elegí una contraseña.</li>
      </ol>
      <p>Si no podés, ${alCoordinador} y te ayuda.</p>`)}
    ${pregunta('¿En qué categoría juega mi hijo o hija?', html`<p>Va por el año de nacimiento, como lo arma la CABB. En <a href="#categorias">¿En qué categoría juega?</a> elegís el año y te dice la categoría y los horarios.</p>`)}
    ${pregunta('Me equivoqué en un dato del formulario, ¿qué hago?', html`<p>Volvé a mandar el formulario con el dato bien: tomamos siempre el último que mandaste. Si te equivocaste en el DNI, ${alCoordinador.replace('escribile', 'avisale')}.</p>`)}
    ${pregunta('¿Dónde y cuándo entrena mi hijo o hija?', html`<p>Los días y los horarios dependen de la categoría: los ves en <a href="#categorias">¿En qué categoría juega?</a>.${s ? html` Se entrena en el <b>${s.nombre}</b>${s.direccion && html` (${s.direccion})`}.` : ''}</p>${s?.mapa && botonExterno(s.mapa, 'Cómo llegar', 'btn sec chico')}`)}
    ${coordinador && html`<div class="portal-faq-fin">
      <b>¿No encontraste tu respuesta?</b>
      <span>Escribile al coordinador y te ayuda.</span>
      ${botonExterno(coordinador, coordinador.startsWith('mailto:') ? 'Escribirle por mail' : 'Escribirle por WhatsApp')}
    </div>`}`;
}

/**
 * "Dónde se entrena": los lugares de los horarios, "Cómo llegar" y el mapa de
 * Google. El mapa NO se carga solo: hasta que la persona toca "Ver mapa" es un
 * cuadro propio, sin pedirle nada a Google (ni cookies) a quien no lo usa.
 */
export function htmlSede(sede) {
  const s = sedeValida(sede);
  if (!s) return html``;
  const foto = fotoDeCategoriaValida(FOTOS.sede);
  return html`<div class="portal-sede-txt">
      <p class="portal-sede-dir">Rosario. En cuál de los tres te toca lo dice el horario de tu categoría.</p>
      ${s.lugares.length > 0 && html`<ul class="portal-sede-lugares">${s.lugares.map((l) => html`<li>${l}</li>`)}</ul>`}
      ${s.mapa && botonExterno(s.mapa, 'Cómo llegar', 'btn sec chico')}
    </div>
    ${s.embed && html`<div class="portal-mapa" data-embed="${s.embed}" data-titulo="Mapa: ${s.nombre}">
      ${foto && html`<img class="portal-mapa-foto" src="${foto.src640}" srcset="${foto.src640} 640w, ${foto.src} 1080w" sizes="(min-width: 48rem) 36rem, 100vw" width="640" height="427" alt="${foto.alt}" loading="lazy" style="object-position:${foto.posicion}">`}
      <button type="button" class="portal-mapa-ver"><i aria-hidden="true">${ICONO.lugar}</i><b>Ver mapa</b><small>Se abre el mapa de Google</small></button>
    </div>`}`;
}

/** Arma el iframe del mapa recién cuando la persona toca "Ver mapa". */
function iniciarMapa() {
  document.addEventListener('click', (ev) => {
    const caja = ev.target.closest('.portal-mapa-ver')?.parentElement;
    if (!caja) return;
    const iframe = document.createElement('iframe');
    iframe.src = caja.dataset.embed;
    iframe.title = caja.dataset.titulo;
    iframe.referrerPolicy = 'no-referrer';
    caja.replaceChildren(iframe);
    caja.classList.add('abierto');
  });
}

export function htmlFoto(foto) {
  const f = fotoValida(foto);
  if (!f) return html``;
  return html`<figure class="portal-foto"><img src="${f.src}" alt="${f.alt}" loading="lazy">${f.epigrafe && html`<figcaption>${f.epigrafe}</figcaption>`}</figure>`;
}

/* ---------- Calendario ---------- */

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** La clave con la que el botón "iPhone" encuentra su evento: un torneo de varios días es uno solo. */
export const claveEvento = (e) => `${e.id}|${e.dia}`;

/**
 * Un evento de la lista, con "Agregar a mi calendario": Google abre el evento
 * armado (Android, compu); el botón del iPhone baja un .ics que el calendario
 * del celular ofrece agregar. `fecha`: para la lista de lo que viene.
 */
export function htmlEvento(e, fecha = null) {
  const cuando = e.hora ? `${e.hora} a ${e.horaFin}` : 'Todo el día';
  return html`<li class="portal-ev tipo-${e.tipo}">
    <small><i class="portal-tipo-ico">${ICONO_TIPO[e.tipo]}</i>${fecha ? fechaLarga(fecha) : NOMBRE_TIPO[e.tipo]} · ${cuando}</small>
    <b>${e.titulo}</b>${e.lugar && html`<span>${e.lugar}</span>`}
    <div class="portal-ev-agregar">Agregar a mi calendario:
      <a href="${enlaceAgregarGoogle(e)}" target="_blank" rel="noopener">${ICONO.calendario}Google</a>
      <button type="button" data-ics="${claveEvento(e)}">${ICONO.celular}iPhone</button>
    </div>
  </li>`;
}

const UN_TIPO = { partido: 'Partido', evento: 'Evento', charla: 'Charla', entrenamiento: 'Entrenamiento' };

/**
 * "Lo que viene": el próximo evento en grande. Una foto según su tipo (los
 * eventos no traen la suya) en duotono, con la fecha en el color del tipo; al
 * lado, el tipo, el título, cuándo y dónde, y cómo agendarlo. Sin ninguno por
 * delante, nada. De Google no se toma la descripción: en un calendario público
 * puede traer nombres. `proximo`: { fecha, evento } de proximosEventos.
 */
export function htmlProximo(proximo, hoy) {
  if (!proximo) return html``;
  const { fecha, evento: e } = proximo;
  const f = partesDeFecha(fecha);
  const cuando = cuandoEs(fecha, hoy);
  const foto = fotoDeEvento(e.tipo);
  return html`<article class="portal-prox tipo-${e.tipo}">
    <div class="portal-prox-foto">
      ${foto && html`<img src="${foto.src640}" srcset="${foto.src640} 640w, ${foto.src} 1080w" sizes="(min-width: 40rem) 32rem, 100vw" width="640" height="427" alt="${foto.alt}" loading="lazy" style="object-position:${foto.posicion}">`}
      <div class="portal-prox-fecha" aria-label="${fechaLarga(fecha)}"><small>${f.semana}</small><b>${f.dia}</b><small>${f.mes}</small></div>
    </div>
    <div class="portal-prox-cuerpo">
      <p class="portal-prox-cab"><i class="portal-tipo-ico">${ICONO_TIPO[e.tipo]}</i><span class="portal-prox-tipo">${UN_TIPO[e.tipo]}</span>${cuando && html`<b>${cuando}</b>`}</p>
      <h3 class="portal-prox-t">${e.titulo}</h3>
      <p class="portal-prox-h">${fechaLarga(fecha)} · ${e.hora ? `${e.hora} a ${e.horaFin}` : 'Todo el día'}</p>
      ${e.lugar && html`<p class="portal-prox-lugar"><i>${ICONO.lugar}</i>${e.lugar}</p>`}
      <div class="portal-ev-agregar"><span>Agendar:</span>
        <a href="${enlaceAgregarGoogle(e)}" target="_blank" rel="noopener">${ICONO.calendario}Google</a>
        <button type="button" data-ics="${claveEvento(e)}">${ICONO.celular}iPhone</button>
      </div>
    </div>
  </article>`;
}

/**
 * La cinta de abajo del hero: sólo las próximas fechas (fecha con el ícono y el
 * color de su tipo, título y un rombo entre una y otra). Sin fechas no devuelve
 * nada y la sección se oculta: pedir sponsors no es cosa de la cinta, para eso
 * está el sticker del hero. `proximos`: [{ fecha, evento }] de proximosEventos.
 * Con tres o más corre sola (la fila se repite, la copia aria-hidden, y
 * arrancar de nuevo parece infinito) y trae un botón para pausarla; con menos
 * se queda quieta, porque un cartel que se mueve para mostrar dos cosas no
 * aporta.
 */
export function htmlCinta(proximos) {
  if (!proximos.length) return html``;
  const anda = proximos.length >= 3;
  const fila = (oculta) => html`<ul class="portal-cinta-fila"${oculta && html` aria-hidden="true"`}>${proximos.map(({ fecha, evento }) => {
    const f = partesDeFecha(fecha);
    return html`<li class="tipo-${evento.tipo}"><i>${ICONO_TIPO[evento.tipo]}</i><b>${f.semana} ${f.dia} ${f.mes}</b><span>${evento.titulo}</span><em aria-hidden="true"></em></li>`;
  })}</ul>`;
  return html`<div class="portal-cinta-banda">
      <div class="portal-cinta-pista${anda ? ' anda' : ''}"${anda && html` style="--dur-cinta:${proximos.length * 7}s"`}>${fila(false)}${anda && fila(true)}</div>
    </div>
    ${anda && html`<button type="button" class="portal-cinta-pausa" data-cinta-pausa aria-pressed="false" aria-label="Pausar la cinta">
      <svg class="p" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>
      <svg class="r" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>
    </button>`}`;
}

/** Para tener el calendario entero en el celular, una vez, y que los eventos nuevos aparezcan solos. */
export function htmlSuscripcion(calendarios) {
  const enlaces = calendarios.map((c) => enlacesSuscripcion(c.id)).filter(Boolean);
  if (!enlaces.length) return html``;
  return html`<div class="portal-seguir">
    <b>¿Querés tener todo el calendario en tu celular?</b>
    <span>Seguilo una vez y los partidos y eventos nuevos te aparecen solos.</span>
    ${enlaces.map(({ google, ical }) => html`<div class="portal-seguir-bot">
      <a class="btn sec" href="${google}" target="_blank" rel="noopener">Android o compu</a>
      <a class="btn sec" href="${ical}">iPhone</a>
    </div>`)}
  </div>`;
}

/**
 * El calendario del mes: grilla de lunes a domingo con un puntito por evento
 * (color por tipo) y, abajo, lo del día elegido. Si ese día no hay nada, los
 * próximos que haya en el mes. La leyenda muestra sólo los tipos que hay en
 * el mes. `estado`: { anio, mes, elegido, hoy, porDia, fallidos, cargando }.
 */
export function htmlCalendario(estado, calendarios) {
  const { anio, mes, elegido, hoy, porDia, fallidos, cargando } = estado;
  const presentes = new Set([...porDia.values()].flat().map((e) => e.tipo));
  const tipos = TIPOS_AGENDA.filter((t) => presentes.has(t));
  const delDia = porDia.get(elegido) ?? [];
  const proximos = delDia.length ? [] : proximosEventos(porDia, elegido > hoy ? elegido : hoy, 3);

  const celda = ({ fecha, dia, delMes }) => {
    const eventos = porDia.get(fecha) ?? [];
    const clases = ['portal-dia', !delMes && 'fuera', fecha === hoy && 'hoy', fecha === elegido && 'elegido'].filter(Boolean).join(' ');
    const etiqueta = `${fechaLarga(fecha)}${eventos.length ? `, ${eventos.length === 1 ? '1 evento' : `${eventos.length} eventos`}` : ''}`;
    return html`<button type="button" class="${clases}" data-dia="${fecha}" aria-label="${etiqueta}" aria-pressed="${fecha === elegido ? 'true' : 'false'}">
      <span>${dia}</span>${eventos.length > 0 && html`<span class="portal-puntos">${eventos.slice(0, 3).map((e) => html`<i class="tipo-${e.tipo}"></i>`)}</span>`}
    </button>`;
  };

  return html`<div class="portal-cal${cargando ? ' cargando' : ''}">
    <div class="portal-cal-cab">
      <b aria-live="polite">${tituloMes(anio, mes)}</b>
      <span>
        <button type="button" class="portal-cal-nav" data-mes="-1" aria-label="Mes anterior">‹</button>
        <button type="button" class="portal-cal-nav" data-mes="1" aria-label="Mes siguiente">›</button>
      </span>
    </div>
    ${tipos.length > 1 && html`<ul class="portal-ley">${tipos.map((t) => html`<li class="tipo-${t}">${NOMBRE_TIPO[t]}</li>`)}</ul>`}
    <div class="portal-grilla" role="group" aria-label="Días de ${tituloMes(anio, mes)}">
      ${DIAS_SEMANA.map((d) => html`<span class="portal-dn" aria-hidden="true">${d}</span>`)}
      ${semanasDelMes(anio, mes).flat().map(celda)}
    </div>
    <div class="portal-cal-dia">
      ${fallidos > 0 && html`<p class="portal-aviso">No pudimos traer una parte del calendario. Probá de nuevo en un rato.</p>`}
      <div class="portal-cal-t">${fechaLarga(elegido)}</div>
      ${delDia.length
        ? html`<ul class="portal-evs">${delDia.map((e) => htmlEvento(e))}</ul>`
        : html`<p class="portal-cal-nada">${cargando ? 'Cargando…' : 'No hay nada cargado para este día.'}</p>
          ${proximos.length > 0 && html`<div class="portal-cal-t">Lo que viene</div><ul class="portal-evs">${proximos.map(({ fecha, evento }) => htmlEvento(evento, fecha))}</ul>`}`}
      ${htmlSuscripcion(calendarios)}
    </div>
  </div>`;
}

/** El día que se elige al abrir un mes: hoy si es de ese mes; si no, el primero con algo, o el 1. */
export function diaInicial(anio, mes, hoy, porDia) {
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`;
  if (hoy.startsWith(prefijo)) return hoy;
  const conAlgo = [...porDia.keys()].filter((f) => f.startsWith(prefijo)).sort()[0];
  return conAlgo ?? `${prefijo}-01`;
}

/**
 * Baja el .ics del evento. En el iPhone, Safari lo abre con "Agregar al
 * calendario"; en otros celulares queda en Descargas y se abre desde ahí.
 */
function bajarIcs(evento) {
  const url = URL.createObjectURL(new Blob([textoIcs(evento)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'evento-basquet-newells.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function iniciarCalendario(calendarios, alMostrarProximo) {
  const hoy = hoyEnRosario();
  const cache = new Map();
  const estado = { anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)), elegido: hoy, hoy, porDia: new Map(), fallidos: 0, cargando: true };
  const pintar = () => { $('portal-calendario').innerHTML = htmlCalendario(estado, calendarios); };

  /** Los eventos de un mes, de la caché o de Google (y quedan en la caché). */
  async function traer(anio, mes) {
    const clave = `${anio}-${mes}`;
    if (!cache.has(clave)) {
      const { eventos, fallidos } = await eventosDelMes(calendarios, PORTAL.agenda.clave, anio, mes);
      cache.set(clave, { porDia: eventosPorDia(eventos), fallidos });
    }
    return cache.get(clave);
  }

  async function cargar(anio, mes) {
    const clave = `${anio}-${mes}`;
    Object.assign(estado, { anio, mes, cargando: !cache.has(clave) });
    if (!cache.has(clave)) {
      estado.porDia = new Map();
      estado.elegido = diaInicial(anio, mes, hoy, estado.porDia);
      pintar();
      await traer(anio, mes);
      // Si mientras tanto la persona pasó a otro mes, este resultado queda guardado y no se pinta.
      if (estado.anio !== anio || estado.mes !== mes) return;
    }
    Object.assign(estado, cache.get(clave), { cargando: false });
    estado.elegido = diaInicial(anio, mes, hoy, estado.porDia);
    pintar();
  }

  /**
   * "Lo que viene" y la cinta: lo próximo desde hoy, mirando este mes y el
   * siguiente (a fin de mes, el próximo partido suele caer ahí). No cambian al
   * pasar de mes en la grilla.
   */
  async function mostrarProximo() {
    const anio = Number(hoy.slice(0, 4));
    const mes = Number(hoy.slice(5, 7));
    const sig = mesVecino(anio, mes, 1);
    const [actual, siguiente] = await Promise.all([traer(anio, mes), traer(sig.anio, sig.mes)]);
    // Un torneo que cruza el fin de mes está en los dos: proximosEventos lo cuenta una vez.
    const proximos = proximosEventos(new Map([...actual.porDia, ...siguiente.porDia]), hoy, 6);
    $('portal-viene').innerHTML = htmlProximo(proximos[0], hoy);
    $('lo-que-viene').hidden = !proximos.length;
    $('portal-cinta').innerHTML = htmlCinta(proximos);
    $('cinta').hidden = !proximos.length;
    revelar($('lo-que-viene'));
    alMostrarProximo();
  }

  // En toda la página: el "iPhone" de "Lo que viene" (que ya no está dentro del
  // calendario) y los del mes. El evento se busca en todos los meses ya
  // traídos, porque "Lo que viene" puede ser de otro mes que el de la grilla.
  document.addEventListener('click', (ev) => {
    const ics = ev.target.closest('[data-ics]');
    if (!ics) return;
    const evento = [...cache.values()].flatMap((c) => [...c.porDia.values()].flat()).find((e) => claveEvento(e) === ics.dataset.ics);
    if (evento) bajarIcs(evento);
  });
  $('calendario').addEventListener('click', (ev) => {
    const dia = ev.target.closest('[data-dia]');
    if (dia) {
      estado.elegido = dia.dataset.dia;
      pintar();
      return;
    }
    const nav = ev.target.closest('[data-mes]');
    if (nav) {
      const { anio, mes } = mesVecino(estado.anio, estado.mes, Number(nav.dataset.mes));
      cargar(anio, mes);
    }
  });
  cargar(estado.anio, estado.mes).then(mostrarProximo);
}

/* ---------- ¿En qué categoría juega? ---------- */

/**
 * Arranca en un año de U13 (el del medio de las formativas) y deja moverse de
 * a uno. Los topes cubren de Primera a unos años más chicos que la U9, para
 * que quien busca a un nene de 4 vea que todavía no hay categoría.
 */
function iniciarBuscador(temporada, tarjetas) {
  const rango = { min: temporada - 30, max: temporada - 4 };
  let anio = temporada - 13;
  const buscador = $('portal-buscador');
  buscador.innerHTML = htmlBuscador(anio, rango);
  const botones = [...document.querySelectorAll('#portal-carrusel [data-anio-cat]')];
  const pista = document.querySelector('#portal-carrusel .portal-carrusel-pista');
  // Se cambian el año, los topes, el resultado y la tarjeta marcada, no el
  // selector entero: así el foco queda en el botón y el resultado (aria-live)
  // se anuncia al cambiar. La pista corre hasta la marcada; al cargar, sin
  // animar, y con movimiento reducido, nunca.
  const pintar = (animar) => {
    $('portal-anio').textContent = anio;
    buscador.querySelector('[data-anio="-1"]').disabled = anio <= rango.min;
    buscador.querySelector('[data-anio="1"]').disabled = anio >= rango.max;
    $('portal-cat-res').innerHTML = htmlCategoriaDelAnio(anio, categoriasDelAnio(PORTAL.categorias, temporada, anio));
    botones.forEach((b, i) => b.setAttribute('aria-pressed', String(tarjetaDelAnio(tarjetas[i], anio))));
    const marcada = botones.find((b) => b.getAttribute('aria-pressed') === 'true')?.parentElement;
    if (!marcada || !pista) return;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pista.scrollTo({ left: marcada.offsetLeft - pista.offsetLeft - parseFloat(getComputedStyle(pista).scrollPaddingLeft || 0), behavior: animar && !reducido ? 'smooth' : 'auto' });
  };
  const elegir = (nuevo) => {
    anio = Math.min(rango.max, Math.max(rango.min, nuevo));
    pintar(true);
  };
  buscador.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-anio]');
    if (b) elegir(anio + Number(b.dataset.anio));
  });
  botones.forEach((b) => b.addEventListener('click', () => elegir(Number(b.dataset.anioCat))));
  pintar(false);
}

/* ---------- Ayuda: una hoja encima de la página ---------- */

/**
 * Todo link a #ayuda (el botón del encabezado, el atajo, "¿Dudas?") abre la
 * hoja en vez de saltar a una sección. <dialog> con showModal da el foco
 * atrapado, Escape y la vuelta del foco al botón que la abrió; acá se suman
 * la X y el toque afuera (el fondo es el propio <dialog>, el contenido está
 * en .portal-hoja-cuerpo). Un link de adentro a otra parte de la página
 * (#categorias) cierra la hoja y deja que el navegador baje hasta ahí.
 */
function iniciarAyuda() {
  const hoja = $('ayuda');
  if (typeof hoja.showModal !== 'function') return; // Sin <dialog>: queda la página sin la hoja, nada se rompe.
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('a[href="#ayuda"]')) return;
    ev.preventDefault();
    if (!hoja.open) hoja.showModal();
  });
  hoja.addEventListener('click', (ev) => {
    if (ev.target === hoja || ev.target.closest('[data-cerrar-ayuda]') || ev.target.closest('a[href^="#"]')) hoja.close();
  });
  if (window.location.hash === '#ayuda') hoja.showModal();
}

/**
 * "Pagar": abre su hoja desde el botón del hero. Mismo <dialog> que Ayuda
 * (foco atrapado, Escape y vuelta del foco gratis); se cierra con la X o
 * tocando afuera. Sin <dialog>, el botón queda sin efecto y nada se rompe.
 */
function iniciarPago() {
  const hoja = $('pago');
  if (typeof hoja.showModal !== 'function') return;
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-abrir-pago]') && !hoja.open) hoja.showModal();
  });
  hoja.addEventListener('click', (ev) => {
    if (ev.target === hoja || ev.target.closest('[data-cerrar-pago]')) hoja.close();
  });
}

/* ---------- Armado de la página ---------- */

function mostrar(id, contenido, contenedor = `portal-${id}`) {
  const texto = contenido.toString();
  $(contenedor).innerHTML = texto;
  $(id).hidden = !texto.trim();
}

function iniciarCopiar() {
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-copiar]');
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.copiar);
      b.textContent = '¡Copiado!';
    } catch {
      // Sin permiso para el portapapeles: el alias queda a la vista para copiarlo a mano.
      b.textContent = 'Copialo a mano';
    }
    // La hoja se reabre con el mismo botón: vuelve a decir "Copiar".
    clearTimeout(Number(b.dataset.vuelta));
    b.dataset.vuelta = String(setTimeout(() => { b.textContent = 'Copiar'; }, 2500));
  });
}

export async function iniciarPortal() {
  const categorias = categoriasDelPortal(PORTAL.categorias, PORTAL.temporada);
  $('categorias').hidden = !categorias.length;
  const tarjetas = tarjetasDeCategorias(PORTAL.categorias, PORTAL.temporada);
  $('portal-carrusel').innerHTML = htmlCarrusel(tarjetas);
  iniciarCarrusel();
  const temporada = temporadaComoAnio(PORTAL.temporada);
  if (temporada) $('t-categorias-temp').textContent = ` ${temporada}`;
  if (temporada && categorias.length) iniciarBuscador(temporada, tarjetas);
  if (temporada) $('portal-heroe-ey').textContent = `Temporada ${temporada} · Formativas`;
  mostrar('sede', htmlSede(PORTAL.sede));
  iniciarMapa();
  mostrar('club', htmlFoto(PORTAL.foto), 'portal-foto');
  mostrar('sponsors', htmlLogos(PORTAL.sponsors), 'portal-logos');

  // Hasta que responda la base, todo cerrado: nunca un botón a un formulario que quizá ya no está.
  const pintarFormularios = ({ inscripcion = null, comprobante = null, consultas = null, colaboradores = null, recaudacion = null } = {}, cargando = false) => {
    const abierto = (f) => Boolean(f && enlaceFormulario(f.enlace));
    $('portal-heroe').innerHTML = htmlAcciones({ inscripcion, consultas, temporada: PORTAL.temporada, cargando });
    $('portal-dock-acc').innerHTML = htmlDock({ inscripcion, consultas });
    $('portal-pago-cuerpo').innerHTML = htmlPago({ alias: PORTAL.alias, comprobante });
    $('portal-recaudacion').innerHTML = htmlRecaudacion(recaudacion);
    $('portal-colaborar').innerHTML = htmlColaborar(colaboradores);
    $('portal-ayuda-lista').innerHTML = htmlAyuda({
      inscripcionAbierta: abierto(inscripcion), consultasAbierto: abierto(consultas),
      temporada: PORTAL.temporada, alias: PORTAL.alias, sede: PORTAL.sede, contacto: PORTAL.contacto,
    });
  };
  pintarFormularios({}, true);
  iniciarAyuda();
  iniciarPago();

  const calendarios = calendariosActivos(PORTAL.agenda);
  $('calendario').hidden = !calendarios.length;
  iniciarCopiar();

  // "Agenda" aparece cuando se sabe que hay un próximo evento: se vuelve a pintar entonces.
  const pintarAtajos = () => {
    $('portal-atajos').innerHTML = htmlAtajos([
      !$('lo-que-viene').hidden && { clave: 'agenda', texto: 'Agenda', href: '#lo-que-viene' },
      !$('categorias').hidden && { clave: 'categorias', texto: 'Categorías', href: '#categorias' },
      !$('calendario').hidden && { clave: 'calendario', texto: 'Calendario', href: '#calendario' },
      { clave: 'colaborar', texto: 'Sumate', href: '#colaborar' },
      { clave: 'ayuda', texto: 'Ayuda', href: '#ayuda' },
    ].filter(Boolean));
  };
  pintarAtajos();

  // Si la URL es la vuelta de un login, portalEntrada.js ya está mandando a la
  // persona a /app. Acá no se consulta nada: el cliente de Supabase canjearía
  // el ?code= o el #access_token en esta página, y la sesión es de /app.
  if (destinoDeAuth(window.location.search, window.location.hash)) return;

  if (calendarios.length) iniciarCalendario(calendarios, pintarAtajos);

  const { estado, formularios } = await resolverFormularios(() => formulariosPublicos(PORTAL.clubId), PORTAL.formularios);

  // Los que tienen lugar propio (la banda, recaudación, colaborar) no se repiten en "Otros formularios".
  const { inscripcion, comprobante, consultas, colaboradores, recaudacion, comunes } = separarFormularios(formularios);
  pintarFormularios({ inscripcion, comprobante, consultas, colaboradores, recaudacion });

  const lista = htmlFormularios(comunes);
  mostrar('formularios', lista.toString() ? html`${estado === 'respaldo' && htmlAvisoRespaldo()}${lista}` : lista);
}
