import {
  obtenerJugadoresDelPlantel, obtenerPrevia, guardarPrevia,
} from '../../data/repositorio.js';
import {
  metricasPara, metrica, MAX_POR_JUGADOR, MAX_DE_EQUIPO,
  validarPrevia, prepararPayloadPrevia, textoDeMision,
} from '../../data/misiones.js';
import { LIMITE } from '../../data/limites.js';
import { decimalEstricto } from '../../data/numeros.js';
import { hoyLocal } from '../../data/antropometria.js';
import { obtenerClubActual, obtenerPlantelActivo } from '../sesion.js';
import { toast } from '../nav.js';
import { ir, volver } from '../main.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { ICONO } from '../componentes/iconos.js';
import { html, crudo } from '../html.js';
import { $ } from '../dom.js';
import { avisoDeError, mensajeAlGuardar, mostrarAviso } from '../errores.js';
import { abrirEvaluacion } from './misionesPartido.js';

const contenedor = () => $('previa-contenido');

// El borrador vive en el módulo mientras la pantalla está abierta. Los ids de
// la previa y de cada misión se generan una sola vez, acá: un reintento de
// "Guardar" manda los mismos y no duplica (guardar_previa, 0055).
let borrador = null;
let jugadores = [];
let existe = false;
let evaluada = false;

/** `previaId` null = previa nueva. */
export function abrirPrevia(previaId = null) {
  borrador = previaId ? { previaId } : null;
  ir('p-previa', { push: true });
}

function borradorNuevo(club, plantel) {
  return {
    previaId: crypto.randomUUID(),
    clubId: club.id,
    plantelId: plantel.id,
    fecha: hoyLocal(),
    rival: '',
    misionesJugador: [],
    misionesEquipo: [],
  };
}

export async function renderPrevia() {
  const club = obtenerClubActual();
  const plantel = obtenerPlantelActivo();
  if (!club || !plantel) {
    contenedor().innerHTML = html`<div class="pad"><div class="p">No hay una categoría seleccionada.</div></div>`.toString();
    return;
  }
  contenedor().innerHTML = html`<div class="pad"><div class="p" role="status">Cargando…</div></div>`.toString();

  const pedida = borrador?.previaId ?? null;
  try {
    jugadores = (await obtenerJugadoresDelPlantel(club.id, plantel.id))
      .sort((a, b) => a.nombreLimpio.localeCompare(b.nombreLimpio, 'es'));
    if (pedida) {
      const previa = await obtenerPrevia(pedida);
      if (!previa) throw new Error('PREVIA_NO_ENCONTRADA');
      borrador = {
        previaId: previa.id,
        clubId: previa.clubId,
        plantelId: previa.plantelId,
        fecha: previa.fecha,
        rival: previa.rival ?? '',
        misionesJugador: previa.misionesJugador,
        misionesEquipo: previa.misionesEquipo,
      };
      existe = true;
    } else {
      borrador = borradorNuevo(club, plantel);
      existe = false;
    }
  } catch (e) {
    contenedor().innerHTML = avisoDeError(e, 'No se pudieron cargar las misiones.');
    return;
  }
  evaluada = [...borrador.misionesJugador, ...borrador.misionesEquipo].some((m) => m.estado);
  pintar();
}

const nombreDe = (jugadorId) => jugadores.find((j) => j.id === jugadorId)?.nombreLimpio ?? '';

function filaMision(m, tipo) {
  return html`<div class="mision-fila">
    <span class="mision-tx">${textoDeMision(m)}</span>
    ${evaluada ? '' : html`<button type="button" class="btn-icono mision-quitar" data-tipo="${tipo}" data-id="${m.id}" aria-label="Quitar misión" title="Quitar misión">${crudo(ICONO.tacho)}</button>`}
  </div>`;
}

function pintar() {
  const delJugador = (id) => borrador.misionesJugador.filter((m) => m.jugadorId === id);
  contenedor().innerHTML = html`
    <div class="pad">
      <div class="eyebrow">Misiones del partido</div>
      <p class="p">Antes del partido, un aporte concreto para cada chico y un objetivo para el equipo. Después marcás cómo salió.</p>
      ${evaluada ? html`<div class="al" role="status"><div class="tx">Este partido ya se evaluó. Las misiones ya no se pueden cambiar; sí podés corregir cómo salió cada una desde la evaluación.</div></div>` : ''}

      <div class="tarj">
        <div class="campo">
          <label for="in-previa-fecha">Fecha del partido</label>
          <input id="in-previa-fecha" type="date" value="${borrador.fecha}" ${evaluada ? crudo('disabled') : ''}>
        </div>
        <div class="campo">
          <label for="in-previa-rival">Rival (opcional)</label>
          <input id="in-previa-rival" type="text" maxlength="${LIMITE.rival}" value="${borrador.rival}" autocomplete="off" ${evaluada ? crudo('disabled') : ''}>
          <div class="ayuda">Sirve para encontrar el partido cuando lo cargues, si ese día hubo dos.</div>
        </div>
      </div>

      <h2 class="h2">Equipo</h2>
      <div class="tarj">
        ${borrador.misionesEquipo.length
          ? borrador.misionesEquipo.map((m) => filaMision(m, 'equipo'))
          : html`<div class="p">Todavía no hay objetivo de equipo.</div>`}
        ${!evaluada && borrador.misionesEquipo.length < MAX_DE_EQUIPO
          ? html`<button type="button" class="btn sec chico" id="btn-mision-equipo">Agregar objetivo</button>`
          : ''}
      </div>

      <h2 class="h2">Jugadores</h2>
      ${jugadores.length ? jugadores.map((j) => {
        const suyas = delJugador(j.id);
        return html`<div class="tarj">
          <div class="tarj-h"><span class="t">${j.nombreLimpio}</span></div>
          ${suyas.map((m) => filaMision(m, 'jugador'))}
          ${!evaluada && suyas.length < MAX_POR_JUGADOR
            ? html`<button type="button" class="btn sec chico" data-agregar="${j.id}">Agregar misión</button>`
            : ''}
        </div>`;
      }) : html`<div class="estado-vacio"><h2>Esta categoría no tiene jugadores</h2><div class="p">Sumá jugadores al plantel para asignarles misiones.</div></div>`}
      <div id="previa-aviso"></div>
    </div>
    <div class="pie-fijo">
      ${evaluada ? '' : html`<button type="button" class="btn" id="btn-guardar-previa">Guardar misiones</button>`}
      ${existe ? html`<button type="button" class="btn sec" id="btn-evaluar-previa">${evaluada ? 'Ver la evaluación' : 'Evaluar el partido'}</button>` : ''}
    </div>
  `.toString();

  const fecha = $('in-previa-fecha');
  fecha.addEventListener('change', () => { borrador.fecha = fecha.value; });
  const rival = $('in-previa-rival');
  rival.addEventListener('input', () => { borrador.rival = rival.value; });

  $('btn-mision-equipo')?.addEventListener('click', () => abrirSelector({ ambito: 'equipo' }));
  contenedor().querySelectorAll('[data-agregar]').forEach((b) => {
    b.addEventListener('click', () => abrirSelector({ ambito: 'jugador', jugadorId: b.dataset.agregar }));
  });
  contenedor().querySelectorAll('.mision-quitar').forEach((b) => {
    b.addEventListener('click', () => {
      const lista = b.dataset.tipo === 'equipo' ? borrador.misionesEquipo : borrador.misionesJugador;
      lista.splice(lista.findIndex((m) => m.id === b.dataset.id), 1);
      pintar();
    });
  });
  $('btn-guardar-previa')?.addEventListener('click', guardar);
  $('btn-evaluar-previa')?.addEventListener('click', () => abrirEvaluacion(borrador.previaId));
}

/**
 * Hoja para sumar una misión: se elige qué (una métrica o "Escribir mi propia
 * misión"), se teclea el número y se agrega. La app no propone ninguna
 * métrica ni ningún valor.
 */
function abrirSelector({ ambito, jugadorId = null }) {
  const titulo = ambito === 'equipo' ? 'Objetivo de equipo' : nombreDe(jugadorId);
  abrirHoja({
    titulo,
    cuerpo: html`
      <div class="campo">
        <label id="lbl-mision">¿Qué le pedís?</label>
        <div class="chips-tema" id="mision-chips" role="group" aria-labelledby="lbl-mision">
          ${metricasPara(ambito).map((m) => html`<button type="button" class="chip-tema" aria-pressed="false" data-metrica="${m.clave}">${m.etiqueta}</button>`)}
          <button type="button" class="chip-tema" aria-pressed="false" data-metrica="">Escribir otra</button>
        </div>
      </div>
      <div id="mision-form"></div>
    `.toString(),
  });
  $('mision-chips').querySelectorAll('.chip-tema').forEach((chip) => {
    chip.addEventListener('click', () => {
      $('mision-chips').querySelectorAll('.chip-tema').forEach((c) => {
        const activo = c === chip;
        c.classList.toggle('on', activo);
        c.setAttribute('aria-pressed', String(activo));
      });
      pintarFormulario({ ambito, jugadorId, clave: chip.dataset.metrica });
    });
  });
}

const SENTIDO = { al_menos: 'Al menos', como_maximo: 'Como máximo' };

function pintarFormulario({ ambito, jugadorId, clave }) {
  const m = clave ? metrica(clave) : null;
  $('mision-form').innerHTML = html`
    <div class="campo">
      ${m
        ? html`<label for="in-mision">${SENTIDO[m.sentido]} · ${m.plural}</label>
          <input id="in-mision" type="text" inputmode="numeric" maxlength="3" autocomplete="off" placeholder="Cuántos">`
        : html`<label for="in-mision">Qué tiene que hacer</label>
          <input id="in-mision" type="text" maxlength="${LIMITE.textoMision}" autocomplete="off" placeholder="Ej.: defender al base de ellos">`}
    </div>
    <div id="mision-aviso"></div>
    <div class="acciones-hoja">
      <button type="button" class="btn sec" id="mision-cancelar">Cancelar</button>
      <button type="button" class="btn" id="mision-agregar">Agregar</button>
    </div>
  `.toString();
  $('in-mision').focus();
  $('mision-cancelar').addEventListener('click', cerrarHoja);
  $('mision-agregar').addEventListener('click', () => agregar({ ambito, jugadorId, m }));
}

function agregar({ ambito, jugadorId, m }) {
  const entrada = $('in-mision');
  const mision = { id: crypto.randomUUID(), estado: null, comentario: null };
  if (m) {
    const valor = decimalEstricto(entrada.value);
    if (valor === null || Number.isNaN(valor) || !Number.isInteger(valor) || valor < 0) {
      mostrarAviso($('mision-aviso'), 'Escribí un número entero, de 0 para arriba.', { campo: entrada });
      return;
    }
    Object.assign(mision, { metrica: m.clave, valor, texto: null });
  } else {
    const texto = entrada.value.trim();
    if (!texto) {
      mostrarAviso($('mision-aviso'), 'Escribí qué tiene que hacer.', { campo: entrada });
      return;
    }
    Object.assign(mision, { metrica: null, valor: null, texto });
  }
  if (ambito === 'equipo') borrador.misionesEquipo.push(mision);
  else borrador.misionesJugador.push({ ...mision, jugadorId });
  cerrarHoja();
  pintar();
}

async function guardar() {
  const boton = $('btn-guardar-previa');
  if (boton.disabled) return;
  const aviso = $('previa-aviso');
  aviso.innerHTML = '';
  const resultado = validarPrevia(borrador);
  if (!resultado.ok) {
    mostrarAviso(aviso, resultado.errores.join(' '));
    return;
  }
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await guardarPrevia(prepararPayloadPrevia(borrador));
  } catch (e) {
    mostrarAviso(aviso, mensajeAlGuardar(e, {
      reglas: [
        [/MISION_EVALUADA/, 'Alguna misión ya se evaluó y no se puede reemplazar.'],
        [/PREVIA_AJENA/, 'Esa previa es de otra categoría.'],
        [/SIN_PERMISO/, 'No tenés permiso para cargar misiones en esta categoría.'],
      ],
      generico: 'No se pudieron guardar las misiones.',
    }));
    boton.disabled = false;
    boton.textContent = 'Guardar misiones';
    return;
  }
  toast('Misiones guardadas');
  await volver();
}
