import {
  obtenerJugadoresDelPlantel, obtenerEntrenamientos, obtenerLesionesDelPlantel, guardarAsistencia,
  abrirLesion, darAlta,
} from '../../data/repositorio.js';
import {
  ETIQUETAS, estadoInicial, alternar, contarEstados, filasParaGuardar, huboCambios,
  lesionadoEn, accionesDeTarjeta,
} from '../../data/asistencia.js';
import { hoyLocal } from '../../data/antropometria.js';
import { obtenerClubActual, obtenerPlantelActivo } from '../sesion.js';
import { toast } from '../nav.js';
import { ir, volver } from '../main.js';
import { confirmarEnHoja } from '../componentes/confirmar.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { abrirHojaLesion } from '../componentes/hojaLesion.js';
import { ICONO } from '../componentes/iconos.js';
import { html, crudo } from '../html.js';
import { $ } from '../dom.js';
import { avisoDeError, mensajeAlGuardar, mostrarAviso } from '../errores.js';

const contenedor = () => $('asistencia-contenido');

// Lo marcado vive en el módulo mientras la pantalla está abierta; recién
// "Guardar" lo manda (RPC guardar_asistencia, 0064). Si el guardado falla no se
// pierde nada: el estado sigue acá y se reintenta.
let pedida = null;
let dia = null;

/** `fecha` (ISO) abre ese día; sin fecha, hoy. Lo usa también el historial. */
export function abrirAsistencia(fecha = null) {
  pedida = fecha;
  ir('p-asistencia', { push: true });
}

const textoEstado = (estado) => (estado ? ETIQUETAS[estado] : 'Sin tomar');

export async function renderAsistencia() {
  const club = obtenerClubActual();
  const plantel = obtenerPlantelActivo();
  dia = null;
  if (!club || !plantel) {
    contenedor().innerHTML = html`<div class="pad"><div class="p">No hay una categoría seleccionada.</div></div>`.toString();
    return;
  }
  contenedor().innerHTML = html`<div class="pad"><div class="p" role="status">Cargando…</div></div>`.toString();

  try {
    const [jugadores, lesiones] = await Promise.all([
      obtenerJugadoresDelPlantel(club.id, plantel.id),
      // La marca de lesionado es un agregado: si no se puede leer, se toma
      // asistencia igual, sin esa marca.
      obtenerLesionesDelPlantel(plantel.id).catch(() => []),
    ]);
    jugadores.sort((a, b) => a.nombreLimpio.localeCompare(b.nombreLimpio, 'es'));
    dia = { club, plantel, jugadores, lesiones, fecha: pedida ?? hoyLocal() };
    await cargarDia(dia.fecha);
  } catch (e) {
    dia = null;
    contenedor().innerHTML = avisoDeError(e, 'No se pudo cargar la asistencia.');
    return;
  }
  pedida = null;
  pintar();
}

/** Lo ya guardado de ese día (si hay) arma la línea de base contra la que se mide lo cambiado. */
async function cargarDia(fecha) {
  const [guardado] = await obtenerEntrenamientos(dia.plantel.id, fecha, fecha);
  dia.fecha = fecha;
  dia.guardado = guardado ?? null;
  dia.hubo = guardado ? guardado.hubo : true;
  dia.huboInicial = dia.hubo;
  dia.inicial = estadoInicial(dia.jugadores, guardado?.filas ?? [], dia.lesiones, fecha);
  dia.tarjetas = dia.inicial.map((t) => ({ ...t }));
}

const hayCambios = () => dia != null
  && (dia.hubo !== dia.huboInicial || (dia.hubo && huboCambios(dia.inicial, dia.tarjetas)));

// El menú es un botón aparte, hermano de la tarjeta: un botón adentro de otro
// no es HTML válido y el toque de la tarjeta (presente/ausente) es el frecuente.
function tarjetaHtml(t, jugador) {
  return html`<li class="asis-item">
    <button type="button" class="asis-tarj" data-id="${t.jugadorId}"
        data-estado="${t.estado ?? 'sin-tomar'}" aria-pressed="${String(t.estado === 'presente')}">
      <span class="nom">${jugador.nombreLimpio}</span>
      <span class="asis-estado">${textoEstado(t.estado)}</span>
      ${t.lesionado ? html`<span class="chip baja">Lesionado</span>` : ''}
    </button>
    <button type="button" class="btn-icono asis-menu" data-menu="${t.jugadorId}"
        aria-label="Justificada o lesión de ${jugador.nombreLimpio}" title="Justificada o lesión">${crudo(ICONO.lapiz)}</button>
  </li>`;
}

function cuerpoDelDia() {
  if (!dia.jugadores.length) {
    return html`<div class="estado-vacio"><h2>Esta categoría no tiene jugadores</h2><div class="p">Sumá jugadores al plantel para tomar asistencia.</div></div>`;
  }
  if (!dia.hubo) {
    return html`<div class="al" role="status"><div class="tx">Este día figura sin entrenamiento. Nadie queda con falta.<div class="mt">Si sí hubo, tocá «Sí hubo entrenamiento».</div></div></div>`;
  }
  const porId = new Map(dia.jugadores.map((j) => [j.id, j]));
  return html`<ul class="asis-grilla">${dia.tarjetas.map((t) => tarjetaHtml(t, porId.get(t.jugadorId)))}</ul>`;
}

function pintar() {
  const hoy = hoyLocal();
  contenedor().innerHTML = html`
    <div class="pad">
      <div class="eyebrow">Asistencia · ${dia.plantel.categoria}</div>
      <div class="campo">
        <label for="in-asis-fecha">Día del entrenamiento</label>
        <input id="in-asis-fecha" type="date" value="${dia.fecha}" max="${hoy}">
      </div>
      <p class="p" id="asis-ayuda"></p>
      ${dia.jugadores.length
        ? html`<div class="campo"><button type="button" class="btn sec chico" id="btn-sin-entrenamiento">${dia.hubo ? 'No hubo entrenamiento' : 'Sí hubo entrenamiento'}</button></div>`
        : ''}
      <div id="asis-cuerpo">${cuerpoDelDia()}</div>
    </div>
    <div class="pie-fijo">
      <div id="asis-aviso"></div>
      <div class="asis-barra">
        <div class="asis-cuenta" id="asis-cuenta" role="status"></div>
        <button type="button" class="btn" id="btn-guardar-asistencia">Guardar</button>
      </div>
    </div>
  `.toString();

  $('in-asis-fecha').addEventListener('change', cambiarFecha);
  $('btn-sin-entrenamiento')?.addEventListener('click', alternarSinEntrenamiento);
  $('btn-guardar-asistencia').addEventListener('click', guardar);
  ligarTarjetas();
  actualizarBarra();
}

function ligarTarjetas() {
  contenedor().querySelectorAll('.asis-tarj').forEach((b) => b.addEventListener('click', () => tocar(b)));
  contenedor().querySelectorAll('.asis-menu').forEach((b) => b.addEventListener('click', () => abrirMenu(b.dataset.menu)));
}

/** Repinta sólo las tarjetas (no la fecha ni la barra): lo usa lo que cambia por fuera del día. */
function repintarTarjetas() {
  $('asis-cuerpo').innerHTML = cuerpoDelDia().toString();
  ligarTarjetas();
  actualizarBarra();
}

/** Un toque cambia sólo esa tarjeta: repintar todo le sacaría el foco al botón tocado. */
function tocar(boton) {
  const t = dia.tarjetas.find((x) => x.jugadorId === boton.dataset.id);
  t.estado = alternar(t.estado);
  boton.dataset.estado = t.estado;
  boton.setAttribute('aria-pressed', String(t.estado === 'presente'));
  boton.querySelector('.asis-estado').textContent = textoEstado(t.estado);
  actualizarBarra();
}

const lesionesDe = (jugadorId) => dia.lesiones.filter((l) => l.jugadorId === jugadorId);

/**
 * El menú de una tarjeta: falta justificada (se guarda con el día) y lesión
 * (se guarda al instante: es del jugador, no de este entrenamiento, y no se
 * pierde si se sale sin guardar la asistencia).
 */
function abrirMenu(jugadorId) {
  const t = dia.tarjetas.find((x) => x.jugadorId === jugadorId);
  const jugador = dia.jugadores.find((j) => j.id === jugadorId);
  const { justificada, lesionar, altaDe } = accionesDeTarjeta({
    estado: t.estado, lesiones: lesionesDe(jugadorId), fecha: dia.fecha,
  });
  abrirHoja({
    titulo: jugador.nombreLimpio,
    cuerpo: html`
      <div class="asis-opciones">
        ${justificada ? html`<button type="button" class="btn sec" id="menu-justificada">Falta justificada</button>` : ''}
        ${lesionar ? html`<button type="button" class="btn sec" id="menu-lesion">Se lesionó</button>` : ''}
        ${altaDe ? html`<button type="button" class="btn sec" id="menu-alta">Dar el alta</button>` : ''}
      </div>
      <div id="menu-aviso"></div>
      <div class="acciones-hoja"><button type="button" class="btn sec" id="menu-cerrar">Cerrar</button></div>
    `.toString(),
  });
  $('menu-cerrar').addEventListener('click', cerrarHoja);
  $('menu-justificada')?.addEventListener('click', () => {
    t.estado = 'justificada';
    cerrarHoja();
    repintarTarjetas();
  });
  $('menu-lesion')?.addEventListener('click', () => {
    abrirHojaLesion({
      nombre: jugador.nombreLimpio,
      fecha: dia.fecha,
      alGuardar: async (marcas) => {
        await abrirLesion({ clubId: dia.club.id, jugadorId, desde: dia.fecha, ...marcas });
        await refrescarLesiones();
      },
    });
  });
  $('menu-alta')?.addEventListener('click', async () => {
    const boton = $('menu-alta');
    if (boton.disabled) return;
    boton.disabled = true;
    try {
      await darAlta(altaDe, dia.fecha);
    } catch (e) {
      mostrarAviso($('menu-aviso'), mensajeAlGuardar(e, { generico: 'No se pudo dar el alta.' }));
      boton.disabled = false;
      return;
    }
    await refrescarLesiones();
    cerrarHoja();
    toast('Alta registrada');
  });
}

/**
 * Relee las lesiones del plantel y vuelve a marcar a los lesionados de este
 * día. Lo marcado de asistencia no se toca: vive en dia.tarjetas.
 */
async function refrescarLesiones() {
  try {
    dia.lesiones = await obtenerLesionesDelPlantel(dia.plantel.id);
  } catch {
    // La lesión ya se escribió: avisar que falló el guardado haría reintentar
    // y chocar con "una abierta por jugador".
    toast('Se guardó, pero no se pudo actualizar la lista. Volvé a abrir la pantalla.');
    return;
  }
  dia.tarjetas.forEach((t) => { t.lesionado = lesionadoEn(lesionesDe(t.jugadorId), dia.fecha); });
  repintarTarjetas();
}

function actualizarBarra() {
  const boton = $('btn-guardar-asistencia');
  boton.disabled = !hayCambios();
  if (!dia.jugadores.length) {
    $('asis-cuenta').textContent = '';
    $('asis-ayuda').textContent = '';
    return;
  }
  if (!dia.hubo) {
    $('asis-cuenta').textContent = 'Sin entrenamiento';
    $('asis-ayuda').textContent = '';
    return;
  }
  const { total, presentes, sinTomar } = contarEstados(dia.tarjetas);
  $('asis-cuenta').innerHTML = html`<span class="mono"><b>${presentes}</b>/${total}</span> presentes${sinTomar ? html` <span class="sin">· ${sinTomar} sin tomar</span>` : ''}`.toString();
  $('asis-ayuda').textContent = 'Tocá cada tarjeta para marcar presente o ausente. Las que dicen «Sin tomar» no se guardan.';
}

function cambiarFecha() {
  const input = $('in-asis-fecha');
  const nueva = input.value;
  // Un campo vacío o una fecha que todavía no llegó: se queda en el día actual.
  input.value = dia.fecha;
  if (!nueva || nueva > hoyLocal() || nueva === dia.fecha) return;
  const cargar = async () => {
    try {
      await cargarDia(nueva);
    } catch (e) {
      mostrarAviso($('asis-aviso'), mensajeAlGuardar(e, { generico: 'No se pudo cargar ese día.' }));
      return;
    }
    pintar();
  };
  if (!hayCambios()) { cargar(); return; }
  confirmarEnHoja({
    titulo: 'Cambiar de día',
    texto: 'Lo que marcaste en este día todavía no se guardó. Si cambiás de día, se pierde.',
    verbo: 'Cambiar de día',
    alConfirmar: cargar,
  });
}

function alternarSinEntrenamiento() {
  const cambiar = () => { dia.hubo = !dia.hubo; pintar(); };
  const yaTomados = dia.guardado?.filas.length ?? 0;
  if (dia.hubo && yaTomados) {
    confirmarEnHoja({
      titulo: 'Marcar sin entrenamiento',
      texto: `Este día ya tiene ${yaTomados} asistencia${yaTomados === 1 ? '' : 's'} guardada${yaTomados === 1 ? '' : 's'}. Al guardar, se borran.`,
      verbo: 'Marcar sin entrenamiento',
      alConfirmar: cambiar,
    });
    return;
  }
  cambiar();
}

async function guardar() {
  const boton = $('btn-guardar-asistencia');
  if (boton.disabled) return;
  $('asis-aviso').innerHTML = '';
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await guardarAsistencia({
      plantelId: dia.plantel.id,
      fecha: dia.fecha,
      hubo: dia.hubo,
      filas: dia.hubo ? filasParaGuardar(dia.tarjetas) : [],
    });
  } catch (e) {
    mostrarAviso($('asis-aviso'), mensajeAlGuardar(e, {
      reglas: [
        [/SIN_PERMISO/, 'No tenés permiso para tomar asistencia en esta categoría.'],
        [/FECHA_FUTURA/, 'Ese día todavía no llegó.'],
      ],
      generico: 'No se pudo guardar la asistencia.',
    }));
    boton.disabled = false;
    boton.textContent = 'Guardar';
    return;
  }
  toast(dia.hubo ? 'Asistencia guardada' : 'Día sin entrenamiento guardado');
  // Lo guardado pasa a ser la línea de base: si no, volver() preguntaría si
  // se quiere salir sin guardar.
  dia.inicial = dia.tarjetas.map((t) => ({ ...t }));
  dia.huboInicial = dia.hubo;
  await volver();
}

/** Pide confirmación al salir con algo marcado que no se guardó. */
export function confirmarSalidaAsistencia() {
  if (!hayCambios()) return null;
  return {
    titulo: 'Salir sin guardar',
    texto: 'Marcaste asistencia que todavía no guardaste. Si salís, se pierde.',
    verbo: 'Salir',
  };
}
