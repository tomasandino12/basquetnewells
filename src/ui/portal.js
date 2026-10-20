import { html } from './html.js';
import { $ } from './dom.js';
import { formulariosPublicos, eventosDelMes } from '../data/repositorio.js';
import {
  PORTAL, enlaceFormulario, enlaceContacto, sponsorsValidos, calendariosActivos, categoriasDelPortal,
  sedeValida, aliasValido, fotoValida,
} from '../data/portal.js';
import { resolverFormularios, separarFormularios } from '../data/formulariosPortal.js';
import {
  eventosPorDia, proximosEventos, semanasDelMes, mesVecino, hoyEnRosario, tituloMes, fechaLarga,
  TIPOS_AGENDA, NOMBRE_TIPO, enlaceAgregarGoogle, textoIcs, enlacesSuscripcion,
} from '../data/agenda.js';
import { destinoDeAuth } from '../data/entradaAuth.js';

/*
 * Portal "Básquet Newell's": la página pública que se reparte a las familias
 * (public/portal.html). Arriba de todo, las dos cosas que busca un padre:
 * inscribir y mandar el comprobante. Lo que no tiene datos no se muestra.
 *
 * De la base lee sólo la lista de formularios activos, por la función anónima
 * formularios_publicos (0058): nada de jugadores ni de familias, que están del
 * otro lado del login, en /app. Los eventos los pide a Google Calendar; el
 * resto sale de src/data/portal.js.
 */

const ABRE = '↗';

/** Los íconos de los atajos: trazos simples en currentColor, decorativos. */
const ICONO = {
  jugar: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18"/></svg>`,
  calendario: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  categorias: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  colaborar: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
  ayuda: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19l1.4-4A8 8 0 1 1 9 18.6z"/></svg>`,
};

const botonExterno = (url, texto, clase = 'btn') => html`<a class="${clase}" href="${url}" target="_blank" rel="noopener">${texto} <span aria-hidden="true">${ABRE}</span></a>`;

/**
 * El botón de una tarjeta cuyo formulario todavía no está activo: se ve, pero
 * no se toca, y dice cuándo se habilita. Así nunca falta el botón ni hay uno
 * que no lleva a ningún lado. `aria-disabled` además de `disabled` para que el
 * lector de pantalla lo anuncie dentro de la tarjeta.
 */
const botonCerrado = (texto, clase = 'btn') => html`<button type="button" class="${clase}" disabled aria-disabled="true">${texto}</button>`;

/**
 * La tarjeta "Inscribir a mi hijo o hija". Con el formulario de inscripción
 * activo (destino inscripcion, 0062) es un botón grande a Google; sin él, el
 * botón queda deshabilitado y, si hay formulario de consultas, se manda ahí a
 * quien viene por primera vez. Es independiente de la de pagos.
 */
export function htmlInscripcion(formulario, { temporada = null, hayConsultas = false, contacto = null } = {}) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  const cab = html`<div class="portal-acc-cab">${url
    ? html`<span class="portal-estado abierto">Inscripción abierta</span>`
    : html`<span class="portal-estado">Abre con la temporada</span>`}</div>`;
  if (url) {
    return html`${cab}<h3>Inscribir a mi hijo o hija</h3>
      <p>${formulario.texto}</p>
      ${botonExterno(url, 'Abrir la inscripción')}
      <span class="portal-mini">Se abre un formulario de Google. Se completa desde el celular.</span>`;
  }
  return html`${cab}<h3>Inscribir a mi hijo o hija</h3>
    <p>La inscripción${temporada ? html` ${temporada}` : ''} todavía no abrió. Cuando abra, el botón se habilita acá mismo.</p>
    ${botonCerrado('Se habilita cuando abra la inscripción')}
    ${hayConsultas
      ? html`<a class="btn sec" href="#jugar">¿Es la primera vez? Dejá tus datos</a>`
      : enlaceContacto(contacto) && html`<a class="btn sec" href="${enlaceContacto(contacto)}" target="_blank" rel="noopener">Preguntale al coordinador</a>`}`;
}

/** La tarjeta del comprobante (destino comprobante, 0062), con el alias para copiar si el club lo cargó. */
export function htmlComprobante(formulario, alias = null) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  const a = aliasValido(alias);
  const caja = a && html`<div class="portal-alias">
    <div><small>Alias para transferir</small><b>${a.alias}</b>${a.titular && html`<span>${a.titular}</span>`}</div>
    <button type="button" class="portal-copiar" data-copiar="${a.alias}">Copiar</button>
  </div>`;
  const cab = (abierto) => html`<div class="portal-acc-cab">${abierto
    ? html`<span class="portal-estado abierto">Pagos abiertos</span>`
    : html`<span class="portal-estado">Sin pagos por ahora</span>`}</div>`;
  if (url) {
    return html`${cab(true)}<h3>Enviar comprobante</h3>
      <p>${formulario.texto}</p>${caja}
      ${botonExterno(url, 'Subir comprobante', 'btn portal-btn-claro')}`;
  }
  return html`${cab(false)}<h3>Enviar comprobante</h3>
    <p>Cuando haya algo para pagar (una cuota, unas rifas), acá vas a subir la foto del comprobante.</p>${caja}
    ${botonCerrado('Se habilita cuando haya un pago', 'btn portal-btn-claro')}`;
}

/**
 * Los atajos de abajo de las tarjetas: sólo a lo que existe en la página. Con
 * menos de dos no vale la fila: no devuelve nada.
 */
export function htmlAtajos(atajos) {
  if (atajos.length < 2) return html``;
  return html`${atajos.map(({ clave, texto, href, externo }) => html`<a href="${href}"${externo && html` target="_blank" rel="noopener"`}><i>${ICONO[clave]}</i>${texto}</a>`)}`;
}

/**
 * El acceso destacado "Quiero jugar en Newell's": el formulario que la
 * coordinación marcó con el destino consultas. Sin formulario, o con un enlace
 * que no es de Google Forms, la tarjeta se ve igual con el botón deshabilitado.
 */
export function htmlJugar(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  if (!url) {
    return html`<div class="portal-destacado">
      <div class="t">Quiero jugar en Newell's</div>
      <div class="d">Si querés probar el básquet o consultar por una categoría, vas a poder dejar tus datos acá.</div>
      ${botonCerrado('Se habilita cuando abra el formulario')}
    </div>`;
  }
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
  return html`<p class="portal-aviso">No pudimos actualizar la lista de formularios; te mostramos la última que conocemos.</p>`;
}

/**
 * La tarjeta de "Sumate como sponsor o colaborador": el formulario que la
 * coordinación marcó con el destino colaboradores. Sin formulario se ve igual,
 * con el botón deshabilitado. El mail que dejan queda en Google (la planilla de
 * "Quiero colaborar"), no en Semillero.
 */
export function htmlColaboradores(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  const titulo = html`<div class="t">Dejanos tu mail y te avisamos de los eventos</div>`;
  if (!url) {
    return html`<div class="portal-tarjeta">${titulo}
      <div class="d">Eventos donde podés dar una mano. Vas a poder dejar tu mail y cómo querés colaborar.</div>
      ${botonCerrado('Se habilita cuando abra el formulario')}
    </div>`;
  }
  return html`<div class="portal-tarjeta">${titulo}
    <div class="d">${formulario.texto}</div>
    <ol class="portal-ayuda">
      <li>Tocá el botón de abajo.</li>
      <li>Se abre un formulario de Google: contanos quién sos, dejá tu mail y cómo querés colaborar.</li>
      <li>Mandalo: te escribimos cuando haya un evento donde podés dar una mano.</li>
    </ol>
    <a class="btn" href="${url}" target="_blank" rel="noopener">Quiero colaborar</a>
  </div>`;
}

/**
 * La tarjeta chica de abajo del calendario: el aviso por mail de los eventos de
 * recaudación del club (pizzas, rifas, comidas). Es el formulario con destino
 * recaudacion (0063), aparte del de sponsors: quien quiere comprar una pizza no
 * es una empresa que quiere ayudar. Su planilla de respuestas vive en Google.
 * Los partidos y charlas no van por mail: para eso está el "Seguilo" del calendario.
 */
export function htmlRecaudacion(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  return html`<div class="portal-tarjeta"><div class="t">Enterate de los eventos de recaudación del club</div>
    <div class="d">Pizzas, rifas, comidas: dejanos tu mail y te avisamos cuando haya uno.</div>
    ${url
      ? html`<a class="btn" href="${url}" target="_blank" rel="noopener">Quiero que me avisen</a>`
      : botonCerrado('Se habilita cuando abra el formulario')}
  </div>`;
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

/** Categorías con sus años de nacimiento y, si el club los pasó, sus horarios. Sin ninguna, nada. */
export function htmlCategorias(categorias) {
  if (!categorias.length) return html``;
  return html`<ul class="portal-cats">${categorias.map(({ nombre, rama, anios, horario }) => html`<li>
    <div><b>${nombre}</b>${rama && html`<span>${rama}</span>`}</div>
    <div class="portal-cats-anios">${anios}</div>
    ${horario && html`<div class="portal-cats-hora">${horario.split(' · ').map((h) => html`<span>${h}</span>`)}</div>`}
  </li>`)}</ul>`;
}

export function htmlSede(sede) {
  const s = sedeValida(sede);
  if (!s) return html``;
  return html`<div class="portal-sede">
    <div><small>Dónde se entrena</small><b>${s.nombre}</b>${s.direccion && html`<span>${s.direccion}</span>`}</div>
    ${s.mapa && botonExterno(s.mapa, 'Cómo llegar', 'btn sec chico')}
  </div>`;
}

export function htmlFoto(foto) {
  const f = fotoValida(foto);
  if (!f) return html``;
  return html`<figure class="portal-foto"><img src="${f.src}" alt="${f.alt}" loading="lazy">${f.epigrafe && html`<figcaption>${f.epigrafe}</figcaption>`}</figure>`;
}

export function htmlContacto(contacto) {
  const url = enlaceContacto(contacto);
  if (!url) return html``;
  const etiqueta = url.startsWith('mailto:') ? 'Escribirle por mail' : 'Escribirle por WhatsApp';
  return html`<a class="btn" href="${url}" target="_blank" rel="noopener">${etiqueta}</a>`;
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
    <small>${fecha ? fechaLarga(fecha) : NOMBRE_TIPO[e.tipo]} · ${cuando}</small>
    <b>${e.titulo}</b>${e.lugar && html`<span>${e.lugar}</span>`}
    <div class="portal-ev-agregar">Agregar a mi calendario:
      <a href="${enlaceAgregarGoogle(e)}" target="_blank" rel="noopener">Google</a>
      <button type="button" data-ics="${claveEvento(e)}">iPhone</button>
    </div>
  </li>`;
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

function iniciarCalendario(calendarios) {
  const hoy = hoyEnRosario();
  const cache = new Map();
  const estado = { anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)), elegido: hoy, hoy, porDia: new Map(), fallidos: 0, cargando: true };
  const pintar = () => { $('portal-calendario').innerHTML = htmlCalendario(estado, calendarios); };

  async function cargar(anio, mes) {
    const clave = `${anio}-${mes}`;
    Object.assign(estado, { anio, mes, cargando: !cache.has(clave) });
    if (!cache.has(clave)) {
      estado.porDia = new Map();
      estado.elegido = diaInicial(anio, mes, hoy, estado.porDia);
      pintar();
      const { eventos, fallidos } = await eventosDelMes(calendarios, PORTAL.agenda.clave, anio, mes);
      cache.set(clave, { porDia: eventosPorDia(eventos), fallidos });
      // Si mientras tanto la persona pasó a otro mes, este resultado queda guardado y no se pinta.
      if (estado.anio !== anio || estado.mes !== mes) return;
    }
    Object.assign(estado, cache.get(clave), { cargando: false });
    estado.elegido = diaInicial(anio, mes, hoy, estado.porDia);
    pintar();
  }

  $('portal-calendario').addEventListener('click', (ev) => {
    const ics = ev.target.closest('[data-ics]');
    if (ics) {
      const evento = [...estado.porDia.values()].flat().find((e) => claveEvento(e) === ics.dataset.ics);
      if (evento) bajarIcs(evento);
      return;
    }
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
  cargar(estado.anio, estado.mes);
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
  });
}

export async function iniciarPortal() {
  const contacto = enlaceContacto(PORTAL.contacto);
  if (contacto) {
    $('portal-ayuda').href = contacto;
    $('portal-ayuda').hidden = false;
  }
  mostrar('dudas', htmlContacto(PORTAL.contacto), 'portal-contacto');

  const categorias = categoriasDelPortal(PORTAL.categorias, PORTAL.temporada);
  $('portal-categorias').innerHTML = htmlCategorias(categorias);
  $('portal-sede').innerHTML = htmlSede(PORTAL.sede);
  $('categorias').hidden = !categorias.length && !sedeValida(PORTAL.sede);
  if (PORTAL.temporada) $('t-categorias-temp').textContent = ` ${PORTAL.temporada}`;
  mostrar('club', htmlFoto(PORTAL.foto), 'portal-foto');

  const calendarios = calendariosActivos(PORTAL.agenda);
  $('calendario').hidden = !calendarios.length;
  iniciarCopiar();

  // Si la URL es la vuelta de un login, portalEntrada.js ya está mandando a la
  // persona a /app. Acá no se consulta nada: el cliente de Supabase canjearía
  // el ?code= o el #access_token en esta página, y la sesión es de /app.
  if (destinoDeAuth(window.location.search, window.location.hash)) return;

  if (calendarios.length) iniciarCalendario(calendarios);

  const { estado, formularios } = await resolverFormularios(() => formulariosPublicos(PORTAL.clubId), PORTAL.formularios);

  // Los que tienen lugar propio (las dos tarjetas, consultas, colaboradores) no se repiten en la lista.
  const { inscripcion, comprobante, consultas, colaboradores, recaudacion, comunes } = separarFormularios(formularios);
  // "Quiero jugar" y "Quiero colaborar" se ven siempre: sin formulario activo
  // llevan el botón deshabilitado. Sólo el link "primera vez" de la inscripción
  // necesita saber si el de consultas está de verdad abierto.
  mostrar('jugar', htmlJugar(consultas));
  const consultasAbierto = Boolean(consultas && enlaceFormulario(consultas.enlace));
  $('portal-inscripcion').innerHTML = htmlInscripcion(inscripcion, { temporada: PORTAL.temporada, hayConsultas: consultasAbierto, contacto: PORTAL.contacto });
  $('portal-comprobante').innerHTML = htmlComprobante(comprobante, PORTAL.alias);

  mostrar('recaudacion', htmlRecaudacion(recaudacion));
  $('portal-colaboradores').innerHTML = htmlColaboradores(colaboradores);
  $('portal-logos').innerHTML = htmlLogos(PORTAL.sponsors);
  $('sponsors').hidden = false;

  const lista = htmlFormularios(comunes);
  mostrar('formularios', lista.toString() ? html`${estado === 'respaldo' && htmlAvisoRespaldo()}${lista}` : lista);

  $('portal-atajos').innerHTML = htmlAtajos([
    !$('jugar').hidden && { clave: 'jugar', texto: 'Quiero jugar', href: '#jugar' },
    !$('calendario').hidden && { clave: 'calendario', texto: 'Calendario', href: '#calendario' },
    !$('categorias').hidden && { clave: 'categorias', texto: 'Categorías', href: '#categorias' },
    !$('sponsors').hidden && { clave: 'colaborar', texto: 'Colaborar', href: '#sponsors' },
    contacto && { clave: 'ayuda', texto: 'Ayuda', href: contacto, externo: true },
  ].filter(Boolean));
}
