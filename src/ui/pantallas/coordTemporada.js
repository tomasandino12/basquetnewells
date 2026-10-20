import {
  obtenerPlantelesDelClub, obtenerCatalogoDeCategorias, obtenerTemporadasDelClub,
  obtenerMiembrosDelClub, obtenerAsignacionesDelClub, obtenerPasesDeTemporada,
  abrirTemporada, confirmarPases,
} from '../../data/repositorio.js';
import { armarProfes, temporadaMasReciente, plantelesEnOrdenDeCatalogo } from '../../data/coordinacion.js';
import { temporadaComoAnio } from '../../data/categorias.js';
import { proponerPases, agruparPases, filasParaConfirmar, NO_SIGUE, DESPUES } from '../../data/pasesDeTemporada.js';
import { obtenerClubActual } from '../sesion.js';
import { toast } from '../nav.js';
import { confirmarEnHoja } from '../componentes/confirmar.js';
import { html, crudo } from '../html.js';
import { avisoDeError, mensajeAlGuardar } from '../errores.js';
import { ir } from '../main.js';
import { $ } from '../dom.js';

const contenedor = () => $('coord-temporada-contenido');

/**
 * Cambio de temporada (spec 2026-10-19, §1), en tres pasos que se ven en
 * orden: abrir la temporada nueva, tener profe en cada plantel, y pasar a
 * cada chico. Los profes van antes de los chicos a propósito: al confirmar se
 * cierra la pertenencia vieja, y sin profe asignado en el plantel nuevo nadie
 * vería a esos chicos. Nada se borra: la historia queda en las temporadas
 * anteriores.
 */

const REGLAS = [
  [/TEMPORADA_NO_ES_POSTERIOR/, 'Esa temporada ya existe o es anterior a la actual.'],
  [/PLANTEL_FUERA_DE_LA_TEMPORADA/, 'Alguno de los planteles no es de la temporada nueva. Actualizá la pantalla.'],
  [/JUGADOR_DE_OTRO_CLUB/, 'Alguno de los chicos no es de este club. Actualizá la pantalla.'],
];

let elecciones = new Map();

export async function renderTemporada() {
  const club = obtenerClubActual();
  if (!club) return;
  contenedor().innerHTML = '<div class="pad"><div class="p" role="status">Cargando…</div></div>';
  let d;
  try {
    const [planteles, catalogo, temporadas, miembros, asignaciones, pases] = await Promise.all([
      obtenerPlantelesDelClub(club.id), obtenerCatalogoDeCategorias(), obtenerTemporadasDelClub(club.id),
      obtenerMiembrosDelClub(club.id), obtenerAsignacionesDelClub(club.id), obtenerPasesDeTemporada(club.id),
    ]);
    const vigente = temporadaMasReciente(temporadas);
    const profes = armarProfes({ planteles, catalogo, temporadas, miembros, asignaciones, pendientes: [], usuarioActualId: null });
    d = { vigente, planteles: plantelesEnOrdenDeCatalogo(planteles, catalogo, vigente?.id), sinProfe: profes.sinProfe, pases };
  } catch (e) {
    contenedor().innerHTML = html`${crudo(avisoDeError(e, 'No se pudo cargar el cambio de temporada.'))}
      <div class="pad"><button class="btn sec" id="btn-reintentar-temporada">Reintentar</button></div>`;
    $('btn-reintentar-temporada').addEventListener('click', () => renderTemporada());
    return;
  }
  const anio = temporadaComoAnio(d.vigente?.nombre);
  if (anio == null) {
    contenedor().innerHTML = html`<div class="pad"><div class="p">La temporada actual (${d.vigente?.nombre ?? 'ninguna'}) no es un año, así que no se puede armar el cambio automático.</div></div>`;
    return;
  }
  if (!d.pases.length) {
    contenedor().innerHTML = html`
      <div class="pad">
        <div class="eyebrow">Paso 1 · Abrir la temporada nueva</div>
        <p class="p">Hoy la temporada es la <b>${d.vigente.nombre}</b> y no queda ningún chico por pasar. Cuando arranque la ${anio + 1}, abrila acá: se crean los mismos planteles y después elegís a cuál pasa cada chico. No se borra nada de lo que ya está cargado.</p>
        <button class="btn" id="btn-abrir-temporada">Abrir la temporada ${anio + 1}</button>
      </div>`;
    $('btn-abrir-temporada').addEventListener('click', () => confirmarApertura(anio + 1));
    return;
  }
  elecciones = new Map();
  const propuestos = proponerPases(d.pases, d.planteles, anio);
  for (const p of propuestos) elecciones.set(p.jugadorId, p.propuesto ?? DESPUES);
  dibujarPases(club, d, propuestos);
}

function confirmarApertura(anio) {
  const club = obtenerClubActual();
  confirmarEnHoja({
    titulo: `Abrir la temporada ${anio}`,
    texto: `Se crea la temporada ${anio} con los mismos planteles que la actual. Desde ahora el panel de coordinación muestra la ${anio}. Los chicos siguen en su plantel de ahora hasta que los pases.`,
    verbo: `Abrir la ${anio}`,
    alConfirmar: async () => {
      try {
        await abrirTemporada({ clubId: club.id, nombre: String(anio) });
      } catch (e) {
        toast(mensajeAlGuardar(e, { reglas: REGLAS }));
        throw e;
      }
      toast(`Listo: la temporada ${anio} está abierta.`);
      renderTemporada();
    },
  });
}

function opcionesHtml(d, elegido) {
  return html`
    <option value="${DESPUES}" ${crudo(elegido === DESPUES ? 'selected' : '')}>Decidir después</option>
    ${d.planteles.map((p) => html`<option value="${p.id}" ${crudo(elegido === p.id ? 'selected' : '')}>${p.categoria}</option>`)}
    <option value="${NO_SIGUE}" ${crudo(elegido === NO_SIGUE ? 'selected' : '')}>No sigue en el club</option>
  `;
}

function filaHtml(d, c) {
  const nota = c.propuesto
    ? (c.sube ? 'Sube de categoría' : 'Sigue en la misma')
    : c.motivo;
  return html`
    <div class="campo">
      <label for="pase-${c.jugadorId}">${c.nombreLimpio}</label>
      <div class="det">Nació en ${c.anioNacimiento ?? '¿?'} · hoy en ${c.codigos.join(' y ')} · ${nota}</div>
      <select id="pase-${c.jugadorId}" data-jugador="${c.jugadorId}">${opcionesHtml(d, elecciones.get(c.jugadorId))}</select>
    </div>`;
}

function dibujarPases(club, d, propuestos) {
  const sinProfe = d.sinProfe.length
    ? html`<div class="al"><div class="tx">
        <b>Paso 2 · Falta profe en ${d.sinProfe.map((p) => p.categoria).join(', ')}.</b>
        Si pasás a los chicos ahora, nadie los va a ver hasta que haya un profe asignado.
        <button class="btn sec chico" id="btn-ir-profes">Asignar profes</button>
      </div></div>`
    : html`<div class="p">Paso 2 · Todos los planteles de la ${d.vigente.nombre} tienen profe. ✔</div>`;
  const grupos = agruparPases(propuestos, d.planteles);
  contenedor().innerHTML = html`
    <div class="pad">
      <div class="eyebrow">Paso 1 · Temporada ${d.vigente.nombre} abierta ✔</div>
      ${sinProfe}
      <div class="eyebrow">Paso 3 · Pasar a los chicos <span class="der">${propuestos.length}</span></div>
      <p class="p">Esta es la propuesta según el año de nacimiento. Cambiala donde no coincida y confirmá. Podés confirmar de a tandas: los que dejes en "Decidir después" siguen en esta pantalla.</p>
      ${grupos.map((g) => html`
        <div class="eyebrow">${g.plantelId ? `Van a ${d.planteles.find((p) => p.id === g.plantelId).categoria}` : 'Para decidir vos'} <span class="der">${g.filas.length}</span></div>
        ${g.filas.map((c) => filaHtml(d, c))}`)}
      <div id="temporada-error"></div>
      <button class="btn" id="btn-confirmar-pases">Confirmar los pases</button>
    </div>`;
  $('btn-ir-profes')?.addEventListener('click', () => ir('p-coord-profes', { push: true }));
  contenedor().querySelectorAll('select[data-jugador]').forEach((s) =>
    s.addEventListener('change', () => elecciones.set(s.dataset.jugador, s.value)));
  $('btn-confirmar-pases').addEventListener('click', () => confirmar(club, d));
}

function confirmar(club, d) {
  const filas = filasParaConfirmar([...elecciones].map(([jugadorId, eleccion]) => ({ jugadorId, eleccion })));
  if (!filas.length) {
    toast('No elegiste a nadie todavía.');
    return;
  }
  const noSiguen = filas.filter((f) => f.plantelId === null).length;
  const pasan = filas.length - noSiguen;
  confirmarEnHoja({
    titulo: 'Confirmar los pases',
    texto: `Pasan ${pasan} chico${pasan === 1 ? '' : 's'} a su categoría nueva${noSiguen ? ` y ${noSiguen} dejan de estar en el club (se borran sus datos de emergencia; su historia queda)` : ''}. Su recorrido en la ${d.vigente.nombre} queda guardado.`,
    verbo: 'Confirmar',
    alConfirmar: async () => {
      try {
        const r = await confirmarPases({ clubId: club.id, filas });
        toast(`Listo: ${r.pasados} pasado${r.pasados === 1 ? '' : 's'}.`);
      } catch (e) {
        toast(mensajeAlGuardar(e, { reglas: REGLAS }));
        throw e;
      }
      renderTemporada();
    },
  });
}
