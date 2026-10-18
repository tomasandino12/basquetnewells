import { obtenerPreviasDelPlantel, obtenerPartidosDelPlantel } from '../../data/repositorio.js';
import { vincularPrevias, siguientePasoDeMisiones } from '../../data/misiones.js';
import { avisoDeError } from '../errores.js';
import { html } from '../html.js';
import { $ } from '../dom.js';
import { abrirPrevia } from './previa.js';
import { abrirEvaluacion } from './misionesPartido.js';

const formatearFecha = (iso) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
};

const nombreDeLaPrevia = (p) => `${p.rival ?? 'Rival sin nombre'} · ${formatearFecha(p.fecha)}`;

function tarjetaDelPaso({ paso, previa }) {
  if (paso === 'evaluar') {
    return html`<div class="tarj tocable" data-evaluar="${previa.id}" role="button" tabindex="0">
      <div class="tarj-h"><span class="t">Evaluá cómo salió</span></div>
      <div class="det">${nombreDeLaPrevia(previa)}</div>
    </div>`;
  }
  if (paso === 'esperar') {
    return html`<div class="tarj tocable" data-previa="${previa.id}" role="button" tabindex="0">
      <div class="tarj-h"><span class="t">Misiones armadas</span></div>
      <div class="det">${nombreDeLaPrevia(previa)}</div>
      <div class="p">Cuando cargues el partido, las evaluás desde acá.</div>
    </div>`;
  }
  return html`<div class="tarj tocable" data-nueva role="button" tabindex="0">
    <div class="tarj-h"><span class="t">Armá las misiones del próximo partido</span></div>
    <div class="p">Un aporte concreto para cada chico y un objetivo para el equipo.</div>
  </div>`;
}

/**
 * Las misiones del partido donde el profe las busca: la tarjeta de lo que
 * toca hacer ahora (armar, esperar el partido o evaluar) y, con `lista`, las
 * previas de la categoría. Se usa en PLANTEL (con la lista) y en HOY (sólo la
 * tarjeta). Es un agregado: si no carga, en HOY no se dibuja nada.
 */
export async function cargarBloqueMisiones(destinoId, club, plantel, { lista = false } = {}) {
  const destino = $(destinoId);
  if (!destino) return;
  let previas;
  let partidos;
  try {
    [previas, partidos] = await Promise.all([
      obtenerPreviasDelPlantel(club.id, plantel.id),
      obtenerPartidosDelPlantel(club.id, plantel.id),
    ]);
  } catch (e) {
    destino.innerHTML = lista ? avisoDeError(e, 'No se pudieron cargar las misiones.') : '';
    return;
  }
  const vinculos = vincularPrevias(
    previas,
    partidos.map((p) => ({ id: p.id, fecha: p.fecha, rivalNombre: p.rivalNombre, plantelId: plantel.id })),
  );
  const paso = siguientePasoDeMisiones(previas, vinculos);
  destino.innerHTML = html`
    <div class="eyebrow">Misiones del partido</div>
    ${tarjetaDelPaso(paso)}
    ${paso.paso !== 'armar' ? html`<button type="button" class="btn sec chico" data-nueva>Armar otras misiones</button>` : ''}
    ${lista && previas.length ? html`
      <div class="eyebrow">Anteriores</div>
      <div class="lista-2col">${previas.map((p) => html`
        <div class="tarj tocable" data-previa="${p.id}" data-evaluable="${vinculos.get(p.id)?.partidoId != null}" role="button" tabindex="0">
          <div class="tarj-h"><span class="t">${p.rival ?? 'Rival sin nombre'}</span><span class="n">${formatearFecha(p.fecha)}</span></div>
          <div class="det"><span class="chip ${p.evaluada ? 'sube' : 'sin'}">${p.evaluada ? 'Evaluadas' : vinculos.get(p.id)?.partidoId != null ? 'Falta evaluar' : 'Esperando el partido'}</span></div>
        </div>`)}</div>` : ''}
  `.toString();

  const ligar = (el, accion) => {
    el.addEventListener('click', accion);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); accion(); } });
  };
  destino.querySelectorAll('[data-nueva]').forEach((el) => ligar(el, () => abrirPrevia()));
  destino.querySelectorAll('[data-evaluar]').forEach((el) => ligar(el, () => abrirEvaluacion(el.dataset.evaluar)));
  destino.querySelectorAll('[data-previa]').forEach((el) => {
    // Con el partido cargado, lo que falta es evaluar; si no, se abre la
    // previa (que también lleva a la evaluación desde su pie).
    ligar(el, () => (el.dataset.evaluable === 'true' ? abrirEvaluacion(el.dataset.previa) : abrirPrevia(el.dataset.previa)));
  });
}
