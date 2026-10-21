import { html } from './html.js';
import { $ } from './dom.js';
import { formulariosPublicos, eventosDelMes } from '../data/repositorio.js';
import {
  PORTAL, enlaceFormulario, enlaceContacto, sponsorsValidos, calendariosActivos, categoriasDelPortal,
  categoriasDelAnio, sedeValida, aliasValido, fotoValida,
} from '../data/portal.js';
import { temporadaComoAnio } from '../data/categorias.js';
import { resolverFormularios, separarFormularios } from '../data/formulariosPortal.js';
import {
  eventosPorDia, proximosEventos, semanasDelMes, mesVecino, hoyEnRosario, tituloMes, fechaLarga,
  TIPOS_AGENDA, NOMBRE_TIPO, enlaceAgregarGoogle, textoIcs, enlacesSuscripcion, partesDeFecha, cuandoEs,
} from '../data/agenda.js';
import { destinoDeAuth } from '../data/entradaAuth.js';

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
  ayuda: html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/></svg>`,
  comprobante: html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/></svg>`,
  inscribir: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14h6M9 17h4"/></svg>`,
  empresa: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>`,
  mano: html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.3 14a1.5 1.5 0 0 1 2.4-1.8L8 14"/></svg>`,
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
 * Una de las dos tarjetas de arriba: ícono, título y una línea; toda la
 * tarjeta es el botón. Sin formulario activo se ve igual de maciza, con la
 * línea que dice cuándo se habilita y un "Pronto" en lugar de la flecha.
 */
function accion({ clase, icono, titulo, detalle, url, cerrado }) {
  const cuerpo = html`<i>${ICONO[icono]}</i><span><b>${titulo}</b><small>${url ? detalle : cerrado}</small></span>`;
  if (!url) return html`<div class="portal-accion ${clase} apagada" aria-disabled="true">${cuerpo}<em>Pronto</em></div>`;
  return html`<a class="portal-accion ${clase}" href="${url}" target="_blank" rel="noopener">${cuerpo}<em aria-hidden="true">${ABRE}</em></a>`;
}

/**
 * El hero: la banda roja y negra (la camiseta) con el título de la página y,
 * adentro, las dos tarjetas protagonistas. La primera es "Inscribir a mi hijo
 * o hija" si el formulario de inscripción está activo (destino inscripcion,
 * 0062) y, si no, "Quiero jugar en Newell's" (destino consultas, 0061). La
 * segunda, "Enviar comprobante" (destino comprobante), con el alias pegado
 * abajo. Son independientes: alguien se puede inscribir sin pagar nada.
 */
export function htmlHeroe({ inscripcion = null, consultas = null, comprobante = null, temporada = null, alias = null } = {}) {
  const url = (f) => (f ? enlaceFormulario(f.enlace) : null);
  const ins = url(inscripcion);
  const primera = ins
    ? accion({ clase: 'principal', icono: 'inscribir', titulo: 'Inscribir a mi hijo o hija', url: ins, detalle: `Inscripción${temporada ? ` ${temporada}` : ''} abierta: formulario de Google` })
    : accion({ clase: 'principal', icono: 'jugar', titulo: 'Quiero jugar en Newell\'s', url: url(consultas),
      detalle: 'Dejá tus datos y te contactamos para venir a probar', cerrado: 'Se habilita cuando abra el formulario' });
  return html`<div class="portal-heroe-ey">Formativas · Rosario${temporada ? html` · Temporada ${temporada}` : ''}</div>
    <h1>Básquet formativo de Newell's</h1>
    <p class="portal-heroe-bajada">Inscripción, pagos, calendario y todo lo del básquet del club, en un solo lugar.</p>
    <div class="portal-acciones">
      ${primera}
      <div class="portal-pago">
        ${accion({ clase: 'pago', icono: 'comprobante', titulo: 'Enviar comprobante', url: url(comprobante),
          detalle: 'Subí la foto de la transferencia', cerrado: 'Se habilita cuando haya algo para pagar' })}
        ${htmlAlias(alias)}
      </div>
    </div>`;
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
 * recaudación del club. Es el formulario con destino recaudacion (0063), aparte
 * del de colaborar: quien quiere comprar una pizza no es una empresa que quiere
 * asociarse. Su planilla de respuestas vive en Google. Los partidos y charlas
 * no van por mail: para eso está el "Seguilo" del calendario.
 */
export function htmlRecaudacion(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  return html`<img class="portal-banda-escudo" src="/public/escudo.png" alt="" width="44" height="44">
    <h2 id="t-recaudacion">Enterate de los eventos de recaudación del club</h2>
    <div class="portal-banda-ej">Pizzas, rifas, comidas…</div>
    <p>Dejanos tu mail y te avisamos cuando haya uno.</p>
    ${url ? botonExterno(url, 'Quiero que me avisen', 'portal-banda-btn') : botonCerrado('Se habilita cuando abra el formulario', 'portal-banda-btn')}`;
}

/**
 * "Sumate al básquet de Newell's": el formulario con destino colaboradores
 * (0061). Es para dos cosas: una empresa o comercio que quiere asociarse con
 * el básquet, o alguien que quiere dar una mano en los eventos. Lo que deja
 * queda en la planilla de Google de "Quiero colaborar", no en Semillero.
 */
export function htmlColaborar(formulario) {
  const url = formulario ? enlaceFormulario(formulario.enlace) : null;
  return html`<ul class="portal-formas">
      <li><i>${ICONO.empresa}</i><span><b>Tengo una empresa o un comercio</b>Asociate con el básquet de Newell's y acompañá a las formativas.</span></li>
      <li><i>${ICONO.mano}</i><span><b>Quiero dar una mano</b>En los eventos del club: hacer el pollo, armar, servir, ayudar a organizar.</span></li>
    </ul>
    ${url ? botonExterno(url, 'Quiero colaborar') : botonCerrado('Se habilita cuando abra el formulario')}`;
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

/** El selector de año del "¿En qué categoría juega?": − y + alrededor del año, y el lugar del resultado al lado. */
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
 * Lo que le toca a quien nació en `anio`: la categoría, sus años y su
 * horario. Puede ser más de una (las dos Primeras). Sin ninguna (más chico
 * que la U9), lo dice y manda a las preguntas frecuentes.
 */
export function htmlCategoriaDelAnio(anio, categorias) {
  if (!categorias.length) {
    return html`<p class="portal-cat-nada">Para chicos nacidos en ${anio} todavía no hay categoría. <a href="#ayuda">¿Dudas? Mirá las preguntas frecuentes</a>.</p>`;
  }
  return html`${categorias.map(({ nombre, rama, anios, horario }) => html`<div class="portal-cat-res">
    <div class="portal-cat-nombre"><b>${nombre}</b>${rama && html`<span>${rama}</span>`}<small>Nacidos ${anios}</small></div>
    ${horario
      ? html`<ul class="portal-cat-hora">${horario.split(' · ').map((h) => html`<li>${h}</li>`)}</ul>`
      : html`<p class="portal-cat-sin">Horario a confirmar.</p>`}
  </div>`)}`;
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
    ? html`<p>Tocá <b>Inscribir a mi hijo o hija</b>, arriba de todo. Se abre un formulario de Google: completalo desde el celular. Tené a mano el DNI del chico o la chica y el tuyo.</p>`
    : html`<p>La inscripción${temporada ? html` ${temporada}` : ''} todavía no abrió. ${consultasAbierto
      ? html`Mientras tanto, tocá <b>Quiero jugar en Newell's</b>, arriba de todo: dejás tus datos y te contactamos para que venga a probar.`
      : html`Cuando abra, el botón se habilita arriba de todo.`}</p>`;
  return html`${pregunta('¿Cómo inscribo a mi hijo o hija?', comoInscribir)}
    ${pregunta('¿Cómo pago una cuota o mando el comprobante?', html`<p>${a ? html`Transferí al alias <b>${a.alias}</b> (con <b>Copiar</b>, arriba de todo, lo pegás en tu banco). ` : ''}Después tocá <b>Enviar comprobante</b> y subí la foto o la captura de la transferencia. Si ese botón está apagado, es que ahora no hay nada para pagar.</p>`)}
    ${pregunta('No tengo cuenta de Google, ¿puedo igual?', html`<p><b>Quiero jugar</b> y <b>Quiero colaborar</b> se completan sin cuenta. La inscripción y el comprobante piden entrar con Google porque llevan fotos: así sabemos quién mandó cada cosa. Crear una cuenta es gratis y te deja usar tu mail de siempre: <a href="https://accounts.google.com/signup" target="_blank" rel="noopener">crear una cuenta de Google</a>.</p>`)}
    ${pregunta('¿En qué categoría juega?', html`<p>Va por el año de nacimiento, como lo arma la CABB. En <a href="#categorias">¿En qué categoría juega?</a> elegís el año y te dice la categoría y los horarios.</p>`)}
    ${pregunta('Me equivoqué en un dato del formulario', html`<p>Si todavía no lo mandaste, corregilo y listo. Si ya lo mandaste, no lo vuelvas a llenar: escribile al coordinador${coordinador ? ' (el botón de acá abajo)' : ''} contándole qué dato hay que cambiar.</p>`)}
    ${pregunta('¿Dónde y cuándo entrena?', html`<p>Los días y los horarios dependen de la categoría: los ves en <a href="#categorias">¿En qué categoría juega?</a>.${s ? html` Se entrena en el <b>${s.nombre}</b>${s.direccion && html` (${s.direccion})`}.` : ''}</p>${s?.mapa && botonExterno(s.mapa, 'Cómo llegar', 'btn sec chico')}`)}
    ${coordinador && html`<div class="portal-faq-fin">
      <b>¿No encontraste tu respuesta?</b>
      <span>Escribile al coordinador y te ayuda.</span>
      ${botonExterno(coordinador, coordinador.startsWith('mailto:') ? 'Escribirle por mail' : 'Escribirle por WhatsApp')}
    </div>`}`;
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

const UN_TIPO = { partido: 'Partido', evento: 'Evento', charla: 'Charla', entrenamiento: 'Entrenamiento' };

/**
 * "Lo que viene": el próximo evento, arriba del mes, como un tablero (fecha
 * grande, el color del tipo en el filete). Sin ninguno por delante, nada.
 * `proximo`: { fecha, evento } de proximosEventos.
 */
export function htmlProximo(proximo, hoy) {
  if (!proximo) return html``;
  const { fecha, evento: e } = proximo;
  const f = partesDeFecha(fecha);
  const cuando = cuandoEs(fecha, hoy);
  return html`<div class="portal-prox tipo-${e.tipo}">
    <div class="portal-prox-cab"><span>Lo que viene</span>${cuando && html`<b>${cuando}</b>`}</div>
    <div class="portal-prox-ev">
      <div class="portal-prox-fecha" aria-label="${fechaLarga(fecha)}"><small>${f.semana}</small><b>${f.dia}</b><small>${f.mes}</small></div>
      <div>
        <span class="portal-prox-tipo">${UN_TIPO[e.tipo]}</span>
        <div class="portal-prox-t">${e.titulo}</div>
        <div class="portal-prox-h">${e.hora ? `${e.hora} a ${e.horaFin}` : 'Todo el día'}${e.lugar && html` · ${e.lugar}`}</div>
        <div class="portal-ev-agregar">Agendar:
          <a href="${enlaceAgregarGoogle(e)}" target="_blank" rel="noopener">Google</a>
          <button type="button" data-ics="${claveEvento(e)}">iPhone</button>
        </div>
      </div>
    </div>
  </div>`;
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
   * "Lo que viene": el próximo desde hoy. Si en lo que queda del mes no hay
   * nada, lo busca en el mes siguiente (a fin de mes, el próximo partido suele
   * caer ahí). No cambia al pasar de mes en la grilla.
   */
  async function mostrarProximo() {
    const anio = Number(hoy.slice(0, 4));
    const mes = Number(hoy.slice(5, 7));
    let [proximo] = proximosEventos((await traer(anio, mes)).porDia, hoy, 1);
    if (!proximo) {
      const sig = mesVecino(anio, mes, 1);
      [proximo] = proximosEventos((await traer(sig.anio, sig.mes)).porDia, hoy, 1);
    }
    $('portal-proximo').innerHTML = htmlProximo(proximo, hoy);
  }

  // En la sección entera: el "iPhone" de "Lo que viene" y los del mes. El
  // evento se busca en todos los meses ya traídos, porque "Lo que viene"
  // puede ser de otro mes que el de la grilla.
  $('calendario').addEventListener('click', (ev) => {
    const ics = ev.target.closest('[data-ics]');
    if (ics) {
      const evento = [...cache.values()].flatMap((c) => [...c.porDia.values()].flat()).find((e) => claveEvento(e) === ics.dataset.ics);
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
  cargar(estado.anio, estado.mes).then(mostrarProximo);
}

/* ---------- ¿En qué categoría juega? ---------- */

/**
 * Arranca en un año de U13 (el del medio de las formativas) y deja moverse de
 * a uno. Los topes cubren de Primera a unos años más chicos que la U9, para
 * que quien busca a un nene de 4 vea que todavía no hay categoría.
 */
function iniciarBuscador(temporada) {
  const rango = { min: temporada - 30, max: temporada - 4 };
  let anio = temporada - 13;
  const buscador = $('portal-buscador');
  buscador.innerHTML = htmlBuscador(anio, rango);
  // Se cambian el año, los topes y el resultado, no el selector entero: así el
  // foco queda en el botón y el resultado (aria-live) se anuncia al cambiar.
  const pintar = () => {
    $('portal-anio').textContent = anio;
    buscador.querySelector('[data-anio="-1"]').disabled = anio <= rango.min;
    buscador.querySelector('[data-anio="1"]').disabled = anio >= rango.max;
    $('portal-cat-res').innerHTML = htmlCategoriaDelAnio(anio, categoriasDelAnio(PORTAL.categorias, temporada, anio));
  };
  buscador.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-anio]');
    if (!b) return;
    anio = Math.min(rango.max, Math.max(rango.min, anio + Number(b.dataset.anio)));
    pintar();
  });
  pintar();
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
  const categorias = categoriasDelPortal(PORTAL.categorias, PORTAL.temporada);
  $('portal-categorias').innerHTML = htmlCategorias(categorias);
  $('categorias').hidden = !categorias.length;
  const temporada = temporadaComoAnio(PORTAL.temporada);
  if (temporada) $('t-categorias-temp').textContent = ` ${temporada}`;
  if (temporada && categorias.length) iniciarBuscador(temporada);
  mostrar('club', htmlFoto(PORTAL.foto), 'portal-foto');
  mostrar('sponsors', htmlLogos(PORTAL.sponsors), 'portal-logos');

  // Hasta que responda la base, todo cerrado: nunca un botón a un formulario que quizá ya no está.
  const pintarFormularios = ({ inscripcion = null, comprobante = null, consultas = null, colaboradores = null, recaudacion = null } = {}) => {
    const abierto = (f) => Boolean(f && enlaceFormulario(f.enlace));
    $('portal-heroe').innerHTML = htmlHeroe({ inscripcion, consultas, comprobante, temporada: PORTAL.temporada, alias: PORTAL.alias });
    $('portal-recaudacion').innerHTML = htmlRecaudacion(recaudacion);
    $('portal-colaborar').innerHTML = htmlColaborar(colaboradores);
    $('portal-ayuda-lista').innerHTML = htmlAyuda({
      inscripcionAbierta: abierto(inscripcion), consultasAbierto: abierto(consultas),
      temporada: PORTAL.temporada, alias: PORTAL.alias, sede: PORTAL.sede, contacto: PORTAL.contacto,
    });
  };
  pintarFormularios();
  iniciarAyuda();

  const calendarios = calendariosActivos(PORTAL.agenda);
  $('calendario').hidden = !calendarios.length;
  iniciarCopiar();

  $('portal-atajos').innerHTML = htmlAtajos([
    !$('calendario').hidden && { clave: 'calendario', texto: 'Calendario', href: '#calendario' },
    !$('categorias').hidden && { clave: 'categorias', texto: 'Categorías', href: '#categorias' },
    { clave: 'colaborar', texto: 'Sumate', href: '#colaborar' },
    { clave: 'ayuda', texto: 'Ayuda', href: '#ayuda' },
  ].filter(Boolean));

  // Si la URL es la vuelta de un login, portalEntrada.js ya está mandando a la
  // persona a /app. Acá no se consulta nada: el cliente de Supabase canjearía
  // el ?code= o el #access_token en esta página, y la sesión es de /app.
  if (destinoDeAuth(window.location.search, window.location.hash)) return;

  if (calendarios.length) iniciarCalendario(calendarios);

  const { estado, formularios } = await resolverFormularios(() => formulariosPublicos(PORTAL.clubId), PORTAL.formularios);

  // Los que tienen lugar propio (la banda, recaudación, colaborar) no se repiten en "Otros formularios".
  const { inscripcion, comprobante, consultas, colaboradores, recaudacion, comunes } = separarFormularios(formularios);
  pintarFormularios({ inscripcion, comprobante, consultas, colaboradores, recaudacion });

  const lista = htmlFormularios(comunes);
  mostrar('formularios', lista.toString() ? html`${estado === 'respaldo' && htmlAvisoRespaldo()}${lista}` : lista);
}
