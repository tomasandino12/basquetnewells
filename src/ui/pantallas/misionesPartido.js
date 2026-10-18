import {
  obtenerPrevia, obtenerPreviasDelPlantel, obtenerPartidosDelPlantel,
  obtenerJugadoresDelPlantel, obtenerEstadisticasParaMisiones, evaluarMisiones,
} from '../../data/repositorio.js';
import {
  ESTADOS, vincularPrevias, valorReal, totalesDelEquipo, textoDeMision, textoDelValor,
} from '../../data/misiones.js';
import { LIMITE } from '../../data/limites.js';
import { obtenerClubActual, obtenerPlantelActivo } from '../sesion.js';
import { toast } from '../nav.js';
import { ir, volver } from '../main.js';
import { html } from '../html.js';
import { $ } from '../dom.js';
import { avisoDeError, mensajeAlGuardar, mostrarAviso } from '../errores.js';

const contenedor = () => $('misiones-partido-contenido');

// La señal de cada estado no es sólo el color: lleva palabra y un glifo.
const GLIFO = { logrado: '✓', en_proceso: '◐', no_logrado: '✕' };

let previaId = null;
let previa = null;
let partidos = [];
let ocupados = new Set();
let jugadores = [];
let partidoId = null;
let elegirPartido = false;
let motivo = 'sin_partido';
let estadisticas = [];
let evaluaciones = new Map();

export function abrirEvaluacion(id) {
  previaId = id;
  ir('p-misiones-partido', { push: true });
}

const formatearFecha = (iso) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
};

export async function renderMisionesPartido() {
  const club = obtenerClubActual();
  const plantel = obtenerPlantelActivo();
  if (!club || !plantel || !previaId) {
    contenedor().innerHTML = html`<div class="pad"><div class="p">No hay misiones para evaluar.</div></div>`.toString();
    return;
  }
  contenedor().innerHTML = html`<div class="pad"><div class="p" role="status">Cargando…</div></div>`.toString();
  try {
    let previas;
    [previa, previas, partidos, jugadores] = await Promise.all([
      obtenerPrevia(previaId),
      obtenerPreviasDelPlantel(club.id, plantel.id),
      obtenerPartidosDelPlantel(club.id, plantel.id),
      obtenerJugadoresDelPlantel(club.id, plantel.id),
    ]);
    if (!previa) throw new Error('PREVIA_NO_ENCONTRADA');
    ocupados = new Set(previas.filter((p) => p.id !== previaId && p.partidoId).map((p) => p.partidoId));
    const vinculo = vincularPrevias(
      previas.map((p) => ({ ...p })),
      partidos.map((p) => ({ id: p.id, fecha: p.fecha, rivalNombre: p.rivalNombre, plantelId: plantel.id })),
    ).get(previaId);
    partidoId = vinculo.partidoId;
    motivo = vinculo.motivo;
    elegirPartido = partidoId == null;
    estadisticas = partidoId ? await obtenerEstadisticasParaMisiones(partidoId) : [];
  } catch (e) {
    contenedor().innerHTML = avisoDeError(e, 'No se pudieron cargar las misiones.');
    return;
  }
  evaluaciones = new Map([...previa.misionesJugador, ...previa.misionesEquipo]
    .map((m) => [m.id, { estado: m.estado, comentario: m.comentario ?? '' }]));
  pintar();
}

const nombreDe = (jugadorId) => jugadores.find((j) => j.id === jugadorId)?.nombreLimpio ?? '';
const partidoActual = () => partidos.find((p) => p.id === partidoId) ?? null;

function bloquePartido() {
  const p = partidoActual();
  if (p && !elegirPartido) {
    const marcador = p.puntosPropios != null && p.puntosRival != null ? `${p.puntosPropios}–${p.puntosRival}` : null;
    return html`<div class="tarj">
      <div class="tarj-h">
        <span class="t">${p.rivalNombre ?? 'Rival sin nombre'}</span>
        <span class="n">${formatearFecha(p.fecha)}</span>
      </div>
      <div class="det">${marcador ? html`<span class="chip mono">${marcador}</span>` : html`<span class="chip sin">Sin marcador</span>`}</div>
      ${motivo === 'fijado' ? '' : html`<div class="p">Lo encontramos por la fecha${motivo === 'rival' ? ' y el rival' : ''}. Si no es este, cambialo.</div>`}
      <button type="button" class="btn sec chico" id="btn-cambiar-partido">Cambiar partido</button>
    </div>`;
  }
  const opciones = partidos.filter((x) => !ocupados.has(x.id));
  return html`<div class="tarj">
    <div class="eyebrow">¿De qué partido son estas misiones?</div>
    ${opciones.length
      ? html`<div class="p">${motivo === 'ambiguo' ? 'Hay más de un partido posible. ' : ''}Elegí el partido para ver cuánto hizo cada uno. Podés evaluar igual sin elegirlo.</div>
        ${opciones.map((x) => html`<div class="tarj tocable" data-partido="${x.id}" role="button" tabindex="0">
          <div class="tarj-h"><span class="t">${x.rivalNombre ?? 'Rival sin nombre'}</span><span class="n">${formatearFecha(x.fecha)}</span></div>
        </div>`)}`
      : html`<div class="p">Todavía no cargaste el partido. Podés evaluar igual: va a decir "sin dato" donde falte el número.</div>`}
  </div>`;
}

function tarjetaMision(m, titulo, real) {
  const ev = evaluaciones.get(m.id);
  const valor = textoDelValor(m, real);
  return html`<div class="tarj" data-mision="${m.id}">
    <div class="eyebrow">${titulo}</div>
    <div class="nom">${textoDeMision(m)}</div>
    ${valor ? html`<div class="mono${real == null ? ' sin' : ''}">${valor}</div>` : ''}
    <div class="chips-tema" role="group" aria-label="Cómo salió: ${textoDeMision(m)}">
      ${ESTADOS.map((e) => html`<button type="button" class="chip-tema${ev.estado === e.id ? ' on' : ''}" aria-pressed="${ev.estado === e.id}" data-estado="${e.id}"><span aria-hidden="true">${GLIFO[e.id]}</span> ${e.nombre}</button>`)}
    </div>
    <div class="campo">
      <label for="com-${m.id}">Comentario (opcional)</label>
      <input id="com-${m.id}" type="text" maxlength="${LIMITE.comentarioMision}" autocomplete="off" value="${ev.comentario}" data-comentario="${m.id}">
    </div>
  </div>`;
}

function pintar() {
  const partido = partidoActual();
  const totales = totalesDelEquipo(estadisticas);
  const porJugador = new Map();
  for (const m of previa.misionesJugador) porJugador.set(m.jugadorId, [...(porJugador.get(m.jugadorId) ?? []), m]);
  const sinMisiones = !previa.misionesJugador.length && !previa.misionesEquipo.length;

  contenedor().innerHTML = html`
    <div class="pad">
      <div class="eyebrow">Misiones · ${formatearFecha(previa.fecha)}${previa.rival ? ` · ${previa.rival}` : ''}</div>
      <p class="p">Vos decidís cómo salió cada misión: el número es una ayuda, la app no marca nada sola.</p>
      ${bloquePartido()}
      ${sinMisiones ? html`<div class="estado-vacio"><h2>Esta previa no tiene misiones</h2></div>` : ''}
      ${previa.misionesEquipo.length ? html`<h2 class="h2">Equipo</h2>
        ${previa.misionesEquipo.map((m) => tarjetaMision(m, 'Objetivo de equipo', valorReal(m, totales, partido)))}` : ''}
      ${porJugador.size ? html`<h2 class="h2">Jugadores</h2>
        ${[...porJugador.entries()]
          .sort((a, b) => nombreDe(a[0]).localeCompare(nombreDe(b[0]), 'es'))
          .map(([jugadorId, lista]) => lista.map((m) => tarjetaMision(
            m, nombreDe(jugadorId),
            valorReal(m, estadisticas.find((e) => e.jugadorId === jugadorId), partido),
          )))}` : ''}
      <div id="misiones-aviso"></div>
    </div>
    ${sinMisiones ? '' : html`<div class="pie-fijo"><button type="button" class="btn" id="btn-guardar-evaluacion">Guardar evaluación</button></div>`}
  `.toString();

  $('btn-cambiar-partido')?.addEventListener('click', () => { elegirPartido = true; pintar(); });
  contenedor().querySelectorAll('[data-partido]').forEach((f) => {
    const elegir = () => elegirEsePartido(f.dataset.partido);
    f.addEventListener('click', elegir);
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } });
  });
  contenedor().querySelectorAll('[data-mision]').forEach((tarjeta) => {
    const id = tarjeta.dataset.mision;
    tarjeta.querySelectorAll('[data-estado]').forEach((b) => {
      b.addEventListener('click', () => {
        const ev = evaluaciones.get(id);
        // Tocar el estado elegido lo desmarca: se pudo errar el botón.
        ev.estado = ev.estado === b.dataset.estado ? null : b.dataset.estado;
        tarjeta.querySelectorAll('[data-estado]').forEach((c) => {
          const activo = c.dataset.estado === ev.estado;
          c.classList.toggle('on', activo);
          c.setAttribute('aria-pressed', String(activo));
        });
      });
    });
    tarjeta.querySelector('[data-comentario]').addEventListener('input', (e) => {
      evaluaciones.get(id).comentario = e.target.value;
    });
  });
  $('btn-guardar-evaluacion')?.addEventListener('click', guardar);
}

async function elegirEsePartido(id) {
  partidoId = id;
  elegirPartido = false;
  motivo = 'manual';
  try {
    estadisticas = await obtenerEstadisticasParaMisiones(id);
  } catch (e) {
    partidoId = null;
    elegirPartido = true;
    pintar();
    mostrarAviso($('misiones-aviso'), mensajeAlGuardar(e, { generico: 'No se pudieron cargar los datos de ese partido.' }));
    return;
  }
  pintar();
}

async function guardar() {
  const boton = $('btn-guardar-evaluacion');
  if (boton.disabled) return;
  const aviso = $('misiones-aviso');
  aviso.innerHTML = '';
  const tipos = new Map([
    ...previa.misionesJugador.map((m) => [m.id, 'jugador']),
    ...previa.misionesEquipo.map((m) => [m.id, 'equipo']),
  ]);
  const payload = {
    previaId,
    partidoId,
    evaluaciones: [...tipos.entries()].map(([id, tipo]) => {
      const ev = evaluaciones.get(id);
      return { tipo, id, estado: ev.estado, comentario: ev.estado ? ev.comentario.trim() || null : null };
    }),
  };
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await evaluarMisiones(payload);
  } catch (e) {
    mostrarAviso(aviso, mensajeAlGuardar(e, {
      reglas: [
        [/PARTIDO_YA_VINCULADO/, 'Ese partido ya es de otras misiones. Elegí otro.'],
        [/PARTIDO_DE_OTRO_PLANTEL/, 'Ese partido es de otra categoría.'],
        [/SIN_PERMISO/, 'No tenés permiso para evaluar misiones en esta categoría.'],
      ],
      generico: 'No se pudo guardar la evaluación.',
    }));
    boton.disabled = false;
    boton.textContent = 'Guardar evaluación';
    return;
  }
  toast('Evaluación guardada');
  await volver();
}
