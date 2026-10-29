import {
  obtenerEntrenamientos, obtenerJugadoresDelPlantel, obtenerLesionesDelPlantel, obtenerTemporadasDelClub,
} from '../../data/repositorio.js';
import { resumenDelDia } from '../../data/asistencia.js';
import { nombreDeHoja, filasDePlanilla } from '../../data/planillaAsistencia.js';
import { hoyLocal } from '../../data/antropometria.js';
import { obtenerClubActual, obtenerPlantelActivo, obtenerPlanteles } from '../sesion.js';
import { toast } from '../nav.js';
import { html } from '../html.js';
import { $ } from '../dom.js';
import { avisoDeError, mostrarAviso, textoDeError } from '../errores.js';
import { abrirAsistencia } from './asistencia.js';

const contenedor = () => $('asistencia-historial-contenido');

// Un plantel es de una temporada: todo lo que tiene entrenamientos es de ésta.
const DESDE_SIEMPRE = '2000-01-01';

/** "mié 29/10": el día de la semana ayuda a reconocer el entrenamiento. */
function textoDeFecha(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

function detalleDelDia(dia) {
  const r = resumenDelDia(dia);
  if (!r.hubo) return html`<span class="sin">No hubo entrenamiento</span>`;
  if (!r.tomados) return html`<span class="sin">Sin tomar</span>`;
  return html`<span class="mono">${r.presentes} de ${r.tomados}</span> presentes`;
}

export async function renderAsistenciaHistorial() {
  const club = obtenerClubActual();
  const plantel = obtenerPlantelActivo();
  if (!club || !plantel) {
    contenedor().innerHTML = html`<div class="pad"><div class="p">No hay una categoría seleccionada.</div></div>`.toString();
    return;
  }
  contenedor().innerHTML = html`<div class="pad"><div class="p" role="status">Cargando…</div></div>`.toString();

  let dias;
  try {
    dias = await obtenerEntrenamientos(plantel.id, DESDE_SIEMPRE, hoyLocal());
  } catch (e) {
    contenedor().innerHTML = avisoDeError(e, 'No se pudo cargar el historial de asistencia.');
    return;
  }

  contenedor().innerHTML = html`
    <div class="pad">
      <div class="eyebrow">Asistencia · ${plantel.categoria} <span class="der">${dias.length} día${dias.length === 1 ? '' : 's'}</span></div>
      <div class="campo"><button type="button" class="btn chico" id="btn-bajar-planilla">Bajar planilla</button></div>
      <div id="historial-aviso"></div>
      ${dias.length
        ? html`<p class="p">Tocá un día para verlo o corregirlo.</p>
          <div id="historial-lista">${dias.map((d) => html`
            <button type="button" class="jug" data-fecha="${d.fecha}">
              <div>
                <div class="nom">${textoDeFecha(d.fecha)}</div>
                <div class="det">${detalleDelDia(d)}</div>
              </div>
              <div class="der"><span class="flecha" aria-hidden="true">›</span></div>
            </button>`)}</div>`
        : html`<div class="estado-vacio">
            <h2>Todavía no hay asistencia</h2>
            <div class="p">Cuando tomes asistencia, cada entrenamiento aparece acá y podés bajar la planilla para el área.</div>
            <div class="acciones"><button type="button" class="btn" id="btn-historial-tomar">Tomar asistencia</button></div>
          </div>`}
    </div>
  `.toString();

  $('btn-bajar-planilla').addEventListener('click', bajarPlanilla);
  $('btn-historial-tomar')?.addEventListener('click', () => abrirAsistencia());
  contenedor().querySelectorAll('[data-fecha]').forEach((b) => {
    b.addEventListener('click', () => abrirAsistencia(b.dataset.fecha));
  });
}

/**
 * Un archivo con una hoja por categoría asignada al profe, para entregar al
 * área. Se arma acá, en el navegador: los nombres de los chicos no pasan por
 * ningún servidor más que la base.
 */
async function bajarPlanilla() {
  const boton = $('btn-bajar-planilla');
  if (boton.disabled) return;
  const aviso = $('historial-aviso');
  aviso.innerHTML = '';
  boton.disabled = true;
  boton.textContent = 'Armando…';
  try {
    const club = obtenerClubActual();
    const [temporadas, hojas] = await Promise.all([
      obtenerTemporadasDelClub(club.id),
      Promise.all(obtenerPlanteles().map(datosDeLaHoja(club))),
    ]);
    const nombreTemporada = (id) => temporadas.find((t) => t.id === id)?.nombre ?? null;
    const XLSX = await import('xlsx');
    const libro = XLSX.utils.book_new();
    obtenerPlanteles().forEach((p, i) => {
      const nombre = nombreDeHoja({ ...p, temporada: nombreTemporada(p.temporadaId) });
      XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasDePlanilla(hojas[i])), nombre);
    });
    XLSX.writeFile(libro, `Asistencia ${hoyLocal()}.xlsx`);
    toast('Planilla lista');
  } catch (e) {
    mostrarAviso(aviso, textoDeError(e, 'No se pudo armar la planilla. Probá de nuevo.'));
  } finally {
    boton.disabled = false;
    boton.textContent = 'Bajar planilla';
  }
}

const datosDeLaHoja = (club) => async (plantel) => {
  const [jugadores, entrenamientos, lesiones] = await Promise.all([
    obtenerJugadoresDelPlantel(club.id, plantel.id),
    obtenerEntrenamientos(plantel.id, DESDE_SIEMPRE, hoyLocal()),
    // Sin .catch: una planilla sin las lesiones saldría sin avisar con los L de menos.
    obtenerLesionesDelPlantel(plantel.id),
  ]);
  return { jugadores, entrenamientos, lesiones };
};
