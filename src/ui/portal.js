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
 * (public/portal.html). Tiene UNA acción principal, grande, en la banda roja y
 * negra de arriba: inscribir si la inscripción está abierta y, si no, "Quiero
 * jugar". Lo demás (comprobante, sponsors, coordinador) va en una lista
 * compacta, para que la página no sea una fila de tarjetas iguales.
 *
 * De la base lee sólo la lista de formularios activos, por la función anónima
 * formularios_publicos (0058): nada de jugadores ni de familias, que están del
 * otro lado del login, en /app. Los eventos los pide a Google Calendar; el
 * resto sale de src/data/portal.js.
 */

const ABRE = '↗';

/** Los íconos de los atajos y de la lista: trazos simples en currentColor, decorativos. */
const ICONO = {
  jugar: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18"/></svg>`,
  calendario: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  categorias: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  colaborar: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`,
  ayuda: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19l1.4-4A8 8 0 1 1 9 18.6z"/></svg>`,
  comprobante: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>`,
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
 * La banda de arriba: la única acción principal. Con el formulario de
 * inscripción activo (destino inscripcion, 0062) es "Inscribí a tu hijo o
 * hija"; sin él, "¿Querés jugar en Newell's?" con el formulario de consultas
 * (0061), o con el botón apagado si tampoco está.
 */
export function htmlHeroe({ inscripcion = null, consultas = null, temporada = null } = {}) {
  const ey = (estado) => html`<div class="portal-heroe-ey">${temporada ? html`Temporada ${temporada} · ` : ''}${estado}</div>`;
  const ins = inscripcion ? enlaceFormulario(inscripcion.enlace) : null;
  if (ins) {
    return html`${ey('Inscripción abierta')}<h1>Inscribí a tu hijo o hija</h1>
      <p>${inscripcion.texto}</p>
      ${botonExterno(ins, 'Inscribir', 'portal-heroe-btn')}`;
  }
  // La línea del formulario de consultas es la del panel ("para qué es"): arriba va una invitación propia.
  const jugar = consultas ? enlaceFormulario(consultas.enlace) : null;
  return html`${ey('Inscripción cerrada')}<h1>¿Querés jugar en Newell's?</h1>
    <p>Dejá tus datos y te contactamos para que vengas a probar.</p>
    ${jugar ? botonExterno(jugar, 'Quiero jugar', 'portal-heroe-btn') : botonCerrado('Se habilita cuando abra el formulario', 'portal-heroe-btn')}`;
}

/** Una fila de la lista "También podés": con enlace es tocable; sin él, se ve apagada y dice "Pronto". */
function fila({ icono, titulo, detalle, url, accion = 'Abrir', externo = true }) {
  const cuerpo = html`<i>${ICONO[icono]}</i><span><b>${titulo}</b><small>${detalle}</small></span>`;
  if (!url) return html`<div class="portal-fila apagada" aria-disabled="true">${cuerpo}<em>Pronto</em></div>`;
  return html`<a class="portal-fila" href="${url}"${externo && html` target="_blank" rel="noopener"`}>${cuerpo}<em>${accion}</em></a>`;
}

/**
 * Las acciones secundarias, compactas: comprobante, "Quiero jugar" (sólo si
 * arriba está la inscripción), sponsors y el coordinador. El mail de quien
 * colabora queda en la planilla de Google de "Quiero colaborar", no en Semillero.
 */
export function htmlMas({ comprobante = null, consultas = null, colaboradores = null, inscripcionAbierta = false, contacto = null } = {}) {
  const url = (f) => (f ? enlaceFormulario(f.enlace) : null);
  const comp = url(comprobante);
  const jugar = url(consultas);
  const colab = url(colaboradores);
  const coordinador = enlaceContacto(contacto);
  return html`${fila({ icono: 'comprobante', titulo: 'Enviar comprobante', url: comp, accion: 'Subir',
    detalle: comp ? 'Subí la foto de la transferencia' : 'Se habilita cuando haya algo para pagar' })}
    ${inscripcionAbierta && fila({ icono: 'jugar', titulo: 'Quiero jugar en Newell\'s', url: jugar,
      detalle: jugar ? 'Dejá tus datos para venir a probar' : 'Se habilita cuando abra el formulario' })}
    ${fila({ icono: 'colaborar', titulo: 'Sumate como sponsor o colaborador', url: colab, detalle: 'Dejanos tu mail y te avisamos de los eventos' })}
    ${coordinador && fila({ icono: 'ayuda', titulo: 'Hablar con el coordinador', url: coordinador, accion: 'Escribir',
      detalle: coordinador.startsWith('mailto:') ? 'Por mail' : 'Por WhatsApp' })}`;
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
 * La banda roja de debajo del calendario: el aviso por mail de los eventos de
 * recaudación del club (pizzas, rifas, comidas). Es el formulario con destino
 * recaudacion (0063), aparte del de sponsors: quien quiere comprar una pizza no
 * es una empresa que quiere ayudar. Su planilla de respuestas vive en Google.
 * Los partidos y charlas no van por mail: para eso está el "Seguilo" del calendario.
 */
export function htmlRecaudacion(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  return html`<img class="portal-banda-escudo" src="/public/escudo.png" alt="" width="44" height="44">
    <div class="portal-banda-ey">Enterate de los eventos de recaudación del club</div>
    <h2 id="t-recaudacion">Pizzas, rifas, comidas</h2>
    <p>Dejanos tu mail y te avisamos cuando haya uno.</p>
    ${url ? botonExterno(url, 'Quiero que me avisen', 'portal-banda-btn') : botonCerrado('Se habilita cuando abra el formulario', 'portal-banda-btn')}`;
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

  const categorias = categoriasDelPortal(PORTAL.categorias, PORTAL.temporada);
  $('portal-categorias').innerHTML = htmlCategorias(categorias);
  $('portal-sede').innerHTML = htmlSede(PORTAL.sede);
  $('categorias').hidden = !categorias.length && !sedeValida(PORTAL.sede);
  if (PORTAL.temporada) $('t-categorias-temp').textContent = ` ${PORTAL.temporada}`;
  mostrar('club', htmlFoto(PORTAL.foto), 'portal-foto');
  mostrar('sponsors', htmlLogos(PORTAL.sponsors), 'portal-logos');
  $('portal-alias').innerHTML = htmlAlias(PORTAL.alias);

  const calendarios = calendariosActivos(PORTAL.agenda);
  $('calendario').hidden = !calendarios.length;
  iniciarCopiar();

  $('portal-atajos').innerHTML = htmlAtajos([
    !$('calendario').hidden && { clave: 'calendario', texto: 'Calendario', href: '#calendario' },
    !$('categorias').hidden && { clave: 'categorias', texto: 'Categorías', href: '#categorias' },
    { clave: 'colaborar', texto: 'Colaborar', href: '#mas' },
    contacto && { clave: 'ayuda', texto: 'Ayuda', href: contacto, externo: true },
  ].filter(Boolean));

  // Si la URL es la vuelta de un login, portalEntrada.js ya está mandando a la
  // persona a /app. Acá no se consulta nada: el cliente de Supabase canjearía
  // el ?code= o el #access_token en esta página, y la sesión es de /app.
  if (destinoDeAuth(window.location.search, window.location.hash)) return;

  if (calendarios.length) iniciarCalendario(calendarios);

  const { estado, formularios } = await resolverFormularios(() => formulariosPublicos(PORTAL.clubId), PORTAL.formularios);

  // Los que tienen lugar propio (la banda, la lista, recaudación) no se repiten en "Otros formularios".
  const { inscripcion, comprobante, consultas, colaboradores, recaudacion, comunes } = separarFormularios(formularios);
  const inscripcionAbierta = Boolean(inscripcion && enlaceFormulario(inscripcion.enlace));
  $('portal-heroe').innerHTML = htmlHeroe({ inscripcion, consultas, temporada: PORTAL.temporada });
  $('portal-mas').innerHTML = htmlMas({ comprobante, consultas, colaboradores, inscripcionAbierta, contacto: PORTAL.contacto });
  $('portal-recaudacion').innerHTML = htmlRecaudacion(recaudacion);

  const lista = htmlFormularios(comunes);
  mostrar('formularios', lista.toString() ? html`${estado === 'respaldo' && htmlAvisoRespaldo()}${lista}` : lista);
}
