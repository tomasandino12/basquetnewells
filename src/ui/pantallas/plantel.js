import {
  obtenerJugadoresDelPlantel, obtenerMedicionesCorporalesDelClub, obtenerSolicitudesDelPlantel,
  obtenerMisionesDeEquipo, obtenerEntrenamientos, obtenerLesionesDelPlantel,
} from '../../data/repositorio.js';
import { vigentePorJugador } from '../../data/antropometria.js';
import { obtenerClubActual, obtenerPlantelActivo, obtenerPlanteles } from '../sesion.js';
import { escaparHtml } from '../nav.js';
import { ir } from '../main.js';
import { $ } from '../dom.js';
import { textoDeError } from '../errores.js';
import { abrirSolicitudes } from './aprobarJugador.js';
import { abrirImportarInscriptos } from './importarInscriptos.js';
import { abrirImportarEmergencias } from './importarEmergencias.js';
import { abrirEmergencias } from './emergencias.js';
import { logrosDelEquipo } from '../../data/misiones.js';
import { bloqueLogros } from '../componentes/logrosDelEquipo.js';
import { cargarBloqueMisiones } from './misionesAcceso.js';
import { abrirAsistencia } from './asistencia.js';
import { asistenciaDelJugador } from '../../data/asistencia.js';
import { datosDeTarjeta, claseDeNivel } from '../../data/tarjetaJugador.js';
import { hoyLocal } from '../../data/antropometria.js';
import { html } from '../html.js';

// Un plantel es de una temporada: todo lo que tiene entrenamientos es de ésta.
const DESDE_SIEMPRE = '2000-01-01';

const contenedor = () => $('plantel-contenido');

let abrirAltaManual = () => {};
let abrirFicha = () => {};

/** Task 12 registra acá la apertura de la hoja de alta manual. */
export function setAbrirAltaManual(fn) {
  abrirAltaManual = fn;
}

/** Task 11 registra acá la apertura de la ficha de un jugador. */
export function setAbrirFicha(fn) {
  abrirFicha = fn;
}

export function iniciales(nombreLimpio) {
  const partes = nombreLimpio.split(',');
  const apellido = (partes[0] ?? '').trim();
  const nombre = (partes[1] ?? '').trim();
  return ((apellido[0] ?? '') + (nombre[0] ?? '')).toUpperCase() || '?';
}

/**
 * Una tarjeta por chico, sólo con datos de básquet. Lo que no se sabe (sin
 * medir, sin asistencia tomada) no se dibuja: al profe no le sirve un cartel de
 * "sin dato" y la lista queda corta para no tener que scrollear.
 */
function tarjetaJugador(j, medicion, asistencia) {
  const d = datosDeTarjeta({ medicion, asistencia });
  const clase = claseDeNivel(d.nivelAsistencia);
  return html`
    <button class="jug-c" data-jugador="${j.id}">
      <span class="av">${iniciales(j.nombreLimpio)}</span>
      <span class="jug-c-nom">${j.nombreLimpio}</span>
      <span class="jug-c-datos">
        ${d.alturaCm == null ? '' : html`<span class="jug-c-dato"><b>${d.alturaCm}</b> cm</span>`}
        ${d.pesoKg == null ? '' : html`<span class="jug-c-dato"><b>${d.pesoKg}</b> kg</span>`}
        ${d.pctAsistencia == null ? '' : html`<span class="chip ${clase ?? ''}" title="Asistencia a los entrenamientos">${d.pctAsistencia} % asist.</span>`}
        ${d.lesionado ? html`<span class="chip baja">Lesionado</span>` : ''}
      </span>
    </button>
  `;
}

function estadoVacioHtml(categoria) {
  return `
    <div class="estado-vacio">
      <h2>${escaparHtml(categoria)} todavía no tiene jugadores</h2>
      <div class="p">La forma más rápida de armar el plantel es cargar una planilla de la CABB: un partido suele traer entre el 70% y el 80% de los jugadores de una sola vez. Los que la CABB no trae, los agregás a mano.</div>
      <div class="acciones">
        <button class="btn" id="btn-vacio-importar">Cargar un partido de la CABB</button>
        <button class="btn sec" id="btn-vacio-manual">Agregar jugador a mano</button>
        <button class="btn sec" id="btn-vacio-inscriptos">Importar inscriptos</button>
      </div>
    </div>
  `;
}

/**
 * Los chicos que pidieron entrar a esta categoría y esperan que un entrenador
 * los apruebe. Un aviso arriba de la lista; sin pendientes (o sin poder
 * leerlas) no se dibuja nada: es un agregado y no puede romper PLANTEL.
 */
function avisoDeSolicitudesHtml(solicitudes) {
  if (!solicitudes.length) return '';
  const cuantos = solicitudes.length;
  return `
    <div class="al" id="plantel-solicitudes">
      <div class="tx">${cuantos === 1 ? '1 chico pidió' : `${cuantos} chicos pidieron`} entrar a esta categoría.</div>
      <button class="btn sec chico" id="btn-ver-solicitudes">Revisar</button>
    </div>
  `;
}

function ligarSolicitudes(solicitudes, jugadores, club, plantel) {
  $('btn-ver-solicitudes')?.addEventListener('click', () => {
    abrirSolicitudes({ club, plantel, jugadores, alCambiar: () => renderPlantel() }, solicitudes);
  });
}

export async function renderPlantel() {
  const club = obtenerClubActual();
  const plantel = obtenerPlantelActivo();
  if (!club || !plantel) {
    // Sin ninguna categoría no es "no elegiste": es que todavía no le
    // asignaron. Decírselo evita que piense que la app está rota.
    const mensaje = obtenerPlanteles().length === 0
      ? 'Todavía no tenés categorías asignadas. Pedíselas al coordinador del club.'
      : 'No hay una categoría seleccionada.';
    contenedor().innerHTML = `<div class="pad"><div class="p">${mensaje}</div></div>`;
    return;
  }

  contenedor().innerHTML = `<div class="pad"><div class="p" id="plantel-estado" role="status">Cargando plantel…</div><div id="plantel-lista"></div></div>`;

  let jugadores;
  let mediciones = [];
  let solicitudes = [];
  let logros = [];
  let entrenamientos = [];
  let lesiones = [];
  try {
    // Las mediciones van juntas con el plantel para poder marcar quién está
    // sin medir. Si sólo fallara esta consulta la lista igual se dibuja: es
    // preferible un plantel sin el detalle de altura que ningún plantel.
    // Los logros son un agregado, como las solicitudes: si no se pueden leer
    // el plantel se dibuja igual, sin ese bloque.
    // La asistencia de la tarjeta también es un agregado: sin ella, la
    // tarjeta se dibuja sin ese chip.
    [jugadores, mediciones, solicitudes, logros, entrenamientos, lesiones] = await Promise.all([
      obtenerJugadoresDelPlantel(club.id, plantel.id),
      obtenerMedicionesCorporalesDelClub(club.id).catch(() => []),
      obtenerSolicitudesDelPlantel(plantel.id).catch(() => []),
      obtenerMisionesDeEquipo(club.id, plantel.id)
        .then(({ previas, misiones }) => logrosDelEquipo(previas, misiones))
        .catch(() => null),
      obtenerEntrenamientos(plantel.id, DESDE_SIEMPRE, hoyLocal()).catch(() => []),
      obtenerLesionesDelPlantel(plantel.id).catch(() => []),
    ]);
  } catch (e) {
    $('plantel-estado').textContent = textoDeError(e, 'No se pudo cargar el plantel.');
    return;
  }

  if (!jugadores.length) {
    contenedor().innerHTML = `<div class="pad">${avisoDeSolicitudesHtml(solicitudes)}${estadoVacioHtml(plantel.categoria)}</div>`;
    ligarSolicitudes(solicitudes, jugadores, club, plantel);
    $('btn-vacio-importar').addEventListener('click', () => ir('p-datos'));
    $('btn-vacio-manual').addEventListener('click', () => abrirAltaManual());
    $('btn-vacio-inscriptos').addEventListener('click', () => abrirInscriptos(club, plantel, jugadores));
    return;
  }

  const porJugador = vigentePorJugador(mediciones);
  contenedor().innerHTML = `
    <div class="pad">
      ${avisoDeSolicitudesHtml(solicitudes)}
      <div id="plantel-misiones"></div>
      <div class="eyebrow">${escaparHtml(plantel.categoria)} <span class="der">${jugadores.length} jugador${jugadores.length === 1 ? '' : 'es'}</span></div>
      <div class="plantel-acciones">
        <button class="btn chico" id="btn-asistencia">Tomar asistencia</button>
        <button class="btn sec chico" id="btn-historial-asistencia">Historial de asistencia</button>
        <button class="btn sec chico" id="btn-emergencias-plantel">Datos de emergencia</button>
      </div>
      <div class="plantel-grilla" id="plantel-lista">${jugadores.map((j) => tarjetaJugador(j, porJugador.get(j.id) ?? null, asistenciaDelJugador(entrenamientos, lesiones, j.id)).toString()).join('')}</div>
      ${logros ? bloqueLogros(logros) : ''}
    </div>
    <div class="pie-fijo"><button class="btn sec" id="btn-agregar-jugador">Agregar jugador a mano</button><button class="btn sec" id="btn-importar-inscriptos">Importar inscriptos</button><button class="btn sec" id="btn-importar-emergencias">Importar emergencias</button></div>
  `;
  $('btn-agregar-jugador').addEventListener('click', () => abrirAltaManual());
  $('btn-importar-inscriptos').addEventListener('click', () => abrirInscriptos(club, plantel, jugadores));
  $('btn-importar-emergencias').addEventListener('click', () => abrirImportarEmergencias({ plantel, jugadores, alCambiar: () => {} }));
  $('btn-emergencias-plantel').addEventListener('click', () => abrirEmergencias({ plantel }));
  $('btn-asistencia').addEventListener('click', () => abrirAsistencia());
  $('btn-historial-asistencia').addEventListener('click', () => ir('p-asistencia-historial', { push: true }));
  cargarBloqueMisiones('plantel-misiones', club, plantel, { lista: true });
  ligarSolicitudes(solicitudes, jugadores, club, plantel);
  contenedor().querySelectorAll('[data-jugador]').forEach((boton) => {
    boton.addEventListener('click', () => abrirFicha(boton.dataset.jugador));
  });
}

function abrirInscriptos(club, plantel, jugadores) {
  abrirImportarInscriptos({ club, plantel, jugadores, alCambiar: () => renderPlantel() });
}
