import { parsearEmergencias } from '../../parser/parserEmergencias.js';
import { importarEmergencias } from '../../data/repositorio.js';
import { cruzarEmergencias, filasParaImportarEmergencias } from '../../data/emergencias.js';
import { html } from '../html.js';
import { toast } from '../nav.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { mensajeAlGuardar, textoDeError, avisoInline } from '../errores.js';
import { $ } from '../dom.js';

/**
 * Plantel → "Importar emergencias": el profe sube la planilla "Emergencias
 * para Semillero" (otra planilla que "Para Semillero", para que esa nunca
 * lleve salud). Cruza por nombre y fecha con los chicos DEL PLANTEL: nunca
 * crea a nadie. Lo que sube pisa lo que ya había. Nada se guarda hasta el
 * último paso; y se guarda todo o nada.
 */

const REGLAS = [
  [/JUGADOR_FUERA_DEL_PLANTEL/, 'Alguno de los chicos ya no está en este plantel. Volvé a subir la planilla.'],
  [/violates check constraint/, 'Alguno de los datos no cumple la regla de la base. Revisá la planilla.'],
];

const vaciar = () => { $('hoja').innerHTML = ''; };

/** ctx: { plantel, jugadores (con fechaNacimiento), alCambiar } */
export function abrirImportarEmergencias(ctx) {
  abrirHoja({
    titulo: 'Importar emergencias',
    cuerpo: html`
      <div class="p">Cómo se hace:</div>
      <ol class="pasos">
        <li>En la planilla <b>Emergencias para Semillero</b> del club, andá a Archivo → Descargar → Microsoft Excel (.xlsx).</li>
        <li>Elegí ese archivo acá abajo.</li>
        <li>Revisá la lista: sólo se cargan los chicos de ${ctx.plantel.categoria} que figuren en la planilla.</li>
      </ol>
      <p class="det">Son datos de salud de menores. Usá sólo la planilla de emergencias, nunca la de respuestas completas. El archivo no se guarda: se lee en tu celular y se manda a Semillero.</p>
      <div class="campo">
        <label for="in-emergencias">Planilla de emergencias (.xlsx)</label>
        <input id="in-emergencias" type="file" accept=".xlsx">
      </div>
      <div id="emergencias-aviso" aria-live="polite"></div>
      <div id="emergencias-lista"></div>
    `.toString(),
    alCerrar: vaciar,
  });
  $('in-emergencias').addEventListener('change', (e) => leerArchivo(ctx, e.target.files?.[0]));
}

async function leerArchivo(ctx, archivo) {
  const aviso = $('emergencias-aviso');
  $('emergencias-lista').innerHTML = '';
  if (!archivo) return;
  aviso.innerHTML = '<div class="p" role="status">Leyendo la planilla…</div>';
  let r;
  let advertencias;
  try {
    const parseo = parsearEmergencias(await archivo.arrayBuffer(), archivo.name);
    if (!parseo.exito) {
      aviso.innerHTML = avisoInline(parseo.errores[0].replace(/^\[[A-Z_]+\]\s*/, ''));
      return;
    }
    r = cruzarEmergencias(parseo.filas, ctx.jugadores);
    advertencias = [...parseo.advertencias, ...r.advertencias];
  } catch (e) {
    aviso.innerHTML = avisoInline(textoDeError(e, 'No se pudo leer la planilla. Revisá que sea la de "Emergencias para Semillero".'));
    return;
  }
  dibujarLista(ctx, r, advertencias);
}

function dibujarLista(ctx, r, advertencias) {
  $('emergencias-aviso').innerHTML = '';
  const notas = [
    ...advertencias,
    ...r.sinCruzar.map((s) => `fila ${s.fila}: ${s.nombre} no se carga (${s.motivo}).`),
  ];
  const avisos = notas.map((n) => html`<div class="al"><div class="tx">${n}</div></div>`);
  if (!r.cruzadas.length) {
    $('emergencias-lista').innerHTML = html`${avisos}<div class="p">No hay chicos de ${ctx.plantel.categoria} en esta planilla.</div>`;
    return;
  }
  $('emergencias-lista').innerHTML = html`
    ${avisos}
    <div class="p">Tildá a quienes querés cargar. Si ya tenían datos, se reemplazan por los de la planilla.</div>
    ${r.cruzadas.map((c, i) => html`
      <label class="jug" style="gap:12px">
        <input type="checkbox" data-fila="${i}" checked style="width:24px;height:24px">
        <div style="flex:1;text-align:left">
          <div class="nom">${c.nombreLimpio}</div>
          <div class="det">${c.alertas.length ? `${c.alertas.length} alerta${c.alertas.length === 1 ? '' : 's'} médica${c.alertas.length === 1 ? '' : 's'}` : 'Sin alertas marcadas'}</div>
        </div>
      </label>`)}
    <div id="emergencias-error"></div>
    <button class="btn" id="btn-emergencias-confirmar">Cargar los datos</button>
  `;
  $('btn-emergencias-confirmar').addEventListener('click', () => confirmar(ctx, r.cruzadas));
}

async function confirmar(ctx, cruzadas) {
  const boton = $('btn-emergencias-confirmar');
  const elegidos = cruzadas.filter((_, i) => $('emergencias-lista').querySelector(`[data-fila="${i}"]`).checked);
  if (!elegidos.length) {
    $('emergencias-error').innerHTML = avisoInline('No tildaste a nadie.');
    return;
  }
  boton.disabled = true;
  try {
    const r = await importarEmergencias({ plantelId: ctx.plantel.id, filas: filasParaImportarEmergencias(elegidos) });
    cerrarHoja();
    toast(`Listo: ${r.guardados} chico${r.guardados === 1 ? '' : 's'} con datos de emergencia.`);
    ctx.alCambiar?.();
  } catch (e) {
    boton.disabled = false;
    $('emergencias-error').innerHTML = avisoInline(mensajeAlGuardar(e, { reglas: REGLAS }));
  }
}
