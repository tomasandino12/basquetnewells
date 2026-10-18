import { obtenerPreviasDelPlantel, obtenerPartidosDelPlantel } from '../../data/repositorio.js';
import { vincularPrevias } from '../../data/misiones.js';
import { avisoDeError } from '../errores.js';
import { html } from '../html.js';
import { $ } from '../dom.js';
import { abrirPrevia } from './previa.js';
import { abrirEvaluacion } from './misionesPartido.js';

const formatearFecha = (iso) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
};

/**
 * El bloque "Misiones" de DATOS: las previas de la categoría, la más reciente
 * primero, con un aviso de si ya tienen su partido cargado. Armar una nueva
 * es el botón del encabezado.
 */
export async function renderMisionesDelPlantel(club, plantel) {
  const destino = $('datos-misiones');
  if (!destino) return;
  $('btn-armar-misiones')?.addEventListener('click', () => abrirPrevia());
  destino.innerHTML = html`<div class="p" role="status">Cargando misiones…</div>`.toString();
  let previas;
  let partidos;
  try {
    [previas, partidos] = await Promise.all([
      obtenerPreviasDelPlantel(club.id, plantel.id),
      obtenerPartidosDelPlantel(club.id, plantel.id),
    ]);
  } catch (e) {
    destino.innerHTML = avisoDeError(e, 'No se pudieron cargar las misiones.');
    return;
  }
  if (!previas.length) {
    destino.innerHTML = html`<div class="p">Todavía no armaste misiones. Antes del próximo partido, tocá <b>Armar misiones</b> y dale un aporte concreto a cada chico.</div>`.toString();
    return;
  }
  const vinculos = vincularPrevias(
    previas,
    partidos.map((p) => ({ id: p.id, fecha: p.fecha, rivalNombre: p.rivalNombre, plantelId: plantel.id })),
  );
  destino.innerHTML = html`<div class="lista-2col">${previas.map((p) => {
    const conPartido = vinculos.get(p.id)?.partidoId != null;
    return html`<div class="tarj tocable" data-previa="${p.id}" data-con-partido="${conPartido}" role="button" tabindex="0">
      <div class="tarj-h">
        <span class="t">${p.rival ?? 'Rival sin nombre'}</span>
        <span class="n">${formatearFecha(p.fecha)}</span>
      </div>
      <div class="det"><span class="chip ${conPartido ? 'sube' : 'sin'}">${conPartido ? 'Con partido cargado' : 'Esperando el partido'}</span></div>
    </div>`;
  })}</div>`.toString();
  destino.querySelectorAll('[data-previa]').forEach((f) => {
    // Con el partido cargado lo que falta es evaluar; antes, armar las misiones.
    const abrir = () => (f.dataset.conPartido === 'true' ? abrirEvaluacion(f.dataset.previa) : abrirPrevia(f.dataset.previa));
    f.addEventListener('click', abrir);
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
  });
}
