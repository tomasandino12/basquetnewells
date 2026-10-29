import {
  obtenerJugadoresDelPlantel, obtenerMedicionesCorporalesDelClub, obtenerSolicitudesDelPlantel,
  obtenerMisionesDeEquipo,
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

/** NULL = "sin medir", nunca cero (Etapa 3, Decisión 8). */
export function textoMedicion(vigente) {
  if (vigente == null) return 'Sin medir';
  const altura = vigente.alturaCm == null ? null : `${vigente.alturaCm.valor} cm`;
  const peso = vigente.pesoKg == null ? null : `${vigente.pesoKg.valor} kg`;
  if (altura == null && peso == null) return 'Sin medir';
  return [altura ?? 'altura sin medir', peso ?? 'peso sin medir'].join(' · ');
}

function filaJugador(j, medicion) {
  const sinMedir = medicion == null || (medicion.alturaCm == null && medicion.pesoKg == null);
  return `
    <button class="jug" data-jugador="${j.id}">
      <div class="av">${escaparHtml(iniciales(j.nombreLimpio))}</div>
      <div>
        <div class="nom">${escaparHtml(j.nombreLimpio)}</div>
        <div class="det">${escaparHtml(textoMedicion(medicion))}</div>
      </div>
      <div class="der">
        ${sinMedir ? '<span class="chip sin">sin medir</span>' : ''}
        <span class="flecha">›</span>
      </div>
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
  try {
    // Las mediciones van juntas con el plantel para poder marcar quién está
    // sin medir. Si sólo fallara esta consulta la lista igual se dibuja: es
    // preferible un plantel sin el detalle de altura que ningún plantel.
    // Los logros son un agregado, como las solicitudes: si no se pueden leer
    // el plantel se dibuja igual, sin ese bloque.
    [jugadores, mediciones, solicitudes, logros] = await Promise.all([
      obtenerJugadoresDelPlantel(club.id, plantel.id),
      obtenerMedicionesCorporalesDelClub(club.id).catch(() => []),
      obtenerSolicitudesDelPlantel(plantel.id).catch(() => []),
      obtenerMisionesDeEquipo(club.id, plantel.id)
        .then(({ previas, misiones }) => logrosDelEquipo(previas, misiones))
        .catch(() => null),
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
      <div class="campo"><button class="btn chico" id="btn-asistencia">Tomar asistencia</button></div>
      <div class="campo"><button class="btn sec chico" id="btn-historial-asistencia">Historial de asistencia</button></div>
      <div class="campo"><button class="btn sec chico" id="btn-emergencias-plantel">Datos de emergencia</button></div>
      <div class="lista-2col" id="plantel-lista">${jugadores.map((j) => filaJugador(j, porJugador.get(j.id) ?? null)).join('')}</div>
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
