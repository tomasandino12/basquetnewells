import { parsearInscriptos } from '../../parser/parserInscriptos.js';
import { obtenerJugadoresDelClub, obtenerTemporadasDelClub, importarInscriptos } from '../../data/repositorio.js';
import { temporadaComoAnio } from '../../data/categorias.js';
import { inscriptosDelPlantel, cruzarConPadron, filasParaImportar } from '../../data/inscriptos.js';
import { html, crudo } from '../html.js';
import { toast } from '../nav.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { mensajeAlGuardar, textoDeError, avisoInline } from '../errores.js';
import { $ } from '../dom.js';

/**
 * Plantel → "Importar inscriptos": el profe baja la planilla "Para Semillero"
 * (la arma el club con las inscripciones de Google, sin DNI) y la sube acá.
 * Ve fila por fila qué se va a hacer, tilda lo que quiere y confirma. Nada se
 * guarda hasta ese último paso; y se guarda todo o nada.
 */

const REGLAS = [
  [/JUGADOR_DE_OTRO_CLUB/, 'Una de las fichas no es de este club. Volvé a subir la planilla.'],
  [/JUGADOR_YA_EXISTE/, 'Ya hay un chico con ese nombre y esa fecha. Volvé a subir la planilla.'],
  [/FECHA_NACIMIENTO_REQUERIDA/, 'A uno de los chicos le falta la fecha de nacimiento.'],
];

const ETIQUETA = {
  existente: 'Ya está en el club',
  nuevo: 'Chico nuevo',
  conflicto: 'Mismo nombre, otra fecha',
};

/** ctx: { club, plantel, jugadores (los del plantel, con fechaNacimiento), alCambiar } */
export function abrirImportarInscriptos(ctx) {
  abrirHoja({
    titulo: 'Importar inscriptos',
    cuerpo: html`
      <div class="p">Cómo se hace:</div>
      <ol class="pasos">
        <li>En la planilla <b>Para Semillero</b> del club, andá a Archivo → Descargar → Microsoft Excel (.xlsx).</li>
        <li>Elegí ese archivo acá abajo.</li>
        <li>Revisá la lista: sólo se muestran los chicos de ${ctx.plantel.categoria}.</li>
      </ol>
      <div class="campo">
        <label for="in-inscriptos">Planilla de inscriptos (.xlsx)</label>
        <input id="in-inscriptos" type="file" accept=".xlsx">
      </div>
      <div id="inscriptos-aviso" aria-live="polite"></div>
      <div id="inscriptos-lista"></div>
    `,
  });
  $('in-inscriptos').addEventListener('change', (e) => leerArchivo(ctx, e.target.files?.[0]));
}

async function leerArchivo(ctx, archivo) {
  const aviso = $('inscriptos-aviso');
  $('inscriptos-lista').innerHTML = '';
  if (!archivo) return;
  aviso.innerHTML = '<div class="p" role="status">Leyendo la planilla…</div>';
  let cruzados;
  let salteadas;
  let advertencias;
  try {
    const parseo = parsearInscriptos(await archivo.arrayBuffer(), archivo.name);
    if (!parseo.exito) {
      aviso.innerHTML = avisoInline(parseo.errores[0].replace(/^\[[A-Z_]+\]\s*/, ''));
      return;
    }
    const temporadas = await obtenerTemporadasDelClub(ctx.club.id);
    const temporada = temporadas.find((t) => t.id === ctx.plantel.temporadaId);
    const delPlantel = inscriptosDelPlantel(parseo.filas, ctx.plantel.categoriaCodigo, temporadaComoAnio(temporada?.nombre));
    salteadas = delPlantel.salteadas;
    advertencias = [...parseo.advertencias.map((a) => a.replace(/^\[[A-Z_]+\]\s*/, '')), ...delPlantel.advertencias];
    // La fecha sólo la conocemos de las fichas de este plantel; el resto del
    // club aporta el nombre, que alcanza para no duplicar a alguien.
    const fechaPorId = new Map(ctx.jugadores.map((j) => [j.id, j.fechaNacimiento ?? null]));
    const padron = (await obtenerJugadoresDelClub(ctx.club.id)).map((j) => ({
      id: j.id, nombreClave: j.nombreClave, fechaNacimiento: fechaPorId.get(j.id) ?? null,
    }));
    cruzados = cruzarConPadron(delPlantel.inscriptos, padron);
  } catch (e) {
    aviso.innerHTML = avisoInline(textoDeError(e, 'No se pudo leer la planilla. Revisá que sea la de "Para Semillero".'));
    return;
  }
  dibujarLista(ctx, cruzados, salteadas, advertencias);
}

function dibujarLista(ctx, cruzados, salteadas, advertencias) {
  const aviso = $('inscriptos-aviso');
  aviso.innerHTML = '';
  const notas = [
    salteadas.length && `${salteadas.length} fila${salteadas.length === 1 ? '' : 's'} no se ${salteadas.length === 1 ? 'muestra' : 'muestran'}: son de otras categorías o de una que Semillero todavía no tiene.`,
    ...advertencias,
  ].filter(Boolean);
  const avisos = notas.map((n) => html`<div class="al"><div class="tx">${n}</div></div>`);

  if (!cruzados.length) {
    $('inscriptos-lista').innerHTML = html`
      ${avisos}
      <div class="p">No hay chicos de ${ctx.plantel.categoria} en esta planilla.</div>`;
    return;
  }
  $('inscriptos-lista').innerHTML = html`
    ${avisos}
    <div class="p">Tildá los que querés sumar a ${ctx.plantel.categoria}. Los que ya están en el club sólo se agregan a esta categoría; no se duplican.</div>
    ${cruzados.map((c, i) => html`
      <label class="jug" style="gap:12px">
        <input type="checkbox" data-fila="${i}" ${crudo(c.estado === 'conflicto' || c.sinRama ? '' : 'checked')} style="width:24px;height:24px">
        <div style="flex:1;text-align:left">
          <div class="nom">${c.nombreLimpio}</div>
          <div class="det">${ETIQUETA[c.estado]} · ${c.mails.length} mail${c.mails.length === 1 ? '' : 's'}</div>
          ${c.sinRama ? html`<div class="det">Anotado en U13 mixto sin decir la rama. Tildalo sólo si juega en U13 masculino.</div>` : ''}
          ${c.aviso ? html`<div class="det">${c.aviso}</div>` : ''}
          ${c.estado === 'conflicto' ? html`<div class="det">Ya hay un chico con ese nombre y otra fecha. Tildalo sólo si son dos chicos distintos.</div>` : ''}
        </div>
      </label>
    `)}
    <div id="inscriptos-error"></div>
    <button class="btn" id="btn-inscriptos-confirmar">Sumar a ${ctx.plantel.categoria}</button>
  `;
  $('btn-inscriptos-confirmar').addEventListener('click', () => confirmar(ctx, cruzados));
}

async function confirmar(ctx, cruzados) {
  const boton = $('btn-inscriptos-confirmar');
  const elegidos = cruzados.filter((_, i) => $('inscriptos-lista').querySelector(`[data-fila="${i}"]`).checked);
  if (!elegidos.length) {
    $('inscriptos-error').innerHTML = avisoInline('No tildaste a nadie.');
    return;
  }
  boton.disabled = true;
  try {
    const r = await importarInscriptos({ plantelId: ctx.plantel.id, filas: filasParaImportar(elegidos) });
    cerrarHoja();
    toast(`Listo: ${r.creados} nuevo${r.creados === 1 ? '' : 's'}, ${r.existentes} que ya estaba${r.existentes === 1 ? '' : 'n'}.`);
    ctx.alCambiar?.();
  } catch (e) {
    boton.disabled = false;
    $('inscriptos-error').innerHTML = avisoInline(mensajeAlGuardar(e, { reglas: REGLAS }));
  }
}
