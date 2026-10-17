import { obtenerRubros, agregarRubro, editarRubro } from '../../data/repositorio.js';
import { validarRubro, nombreRepetido } from '../../data/finanzas.js';
import { LIMITE } from '../../data/limites.js';
import { obtenerClubActual } from '../sesion.js';
import { toast } from '../nav.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { $ } from '../dom.js';
import { html } from '../html.js';
import { avisoDeError, mensajeAlGuardar, mostrarAviso } from '../errores.js';

/*
 * Rubros de finanzas: los nombres con que se agrupan ingresos y egresos. Sólo
 * coordinación (0054). Se llega desde la pestaña FINANZAS. Un rubro no se
 * borra: se desactiva, porque los meses viejos lo siguen nombrando. El tipo no
 * se cambia después de creado (daría vuelta el signo de lo cargado).
 * Ver docs/superpowers/specs/2026-10-16-finanzas-design.md.
 */

let rubros = [];

const contenedor = () => $('coord-rubros-contenido');

const YA_EXISTE = 'Ya hay un rubro con ese nombre.';
const mensajeDeError = (e) => (e?.code === '23505' ? YA_EXISTE : mensajeAlGuardar(e, {
  permiso: /NO_SE_PUDO|row-level security|permission denied/i,
}));

/** "Ingreso (+)": el tipo se lee en texto y con signo, no sólo por color. */
export const ROTULO_TIPO = { ingreso: 'Ingreso (+)', egreso: 'Egreso (−)' };

function filaHtml(r) {
  return html`
    <button type="button" class="jug-fila fin-fila" data-rubro="${r.id}">
      <span class="nom">${r.nombre}</span>
      ${!r.activo && html`<span class="chip sin">Desactivado</span>`}
    </button>`;
}

function seccionHtml(titulo, lista) {
  if (!lista.length) return '';
  return html`<div class="eyebrow">${titulo}</div>${lista.map(filaHtml)}`;
}

export async function renderRubros() {
  const club = obtenerClubActual();
  if (!club) return;
  contenedor().innerHTML = html`<div class="pad"><div class="p" role="status">Cargando…</div></div>`;
  try {
    rubros = await obtenerRubros(club.id);
  } catch (e) {
    contenedor().innerHTML = avisoDeError(e, 'No se pudieron cargar los rubros.');
    return;
  }

  const cuerpo = rubros.length
    ? html`
      ${seccionHtml('Ingresos', rubros.filter((r) => r.tipo === 'ingreso'))}
      ${seccionHtml('Egresos', rubros.filter((r) => r.tipo === 'egreso'))}`
    : html`<div class="estado-vacio"><h2>Rubros</h2><div class="p">Todavía no hay rubros. Creá los de ingreso (por ejemplo, Patrocinios) y los de egreso (Arbitrajes, Alquiler de cancha) para empezar a cargar movimientos.</div></div>`;

  contenedor().innerHTML = html`
    <div class="pad">
      <div class="p det">Usá nombres genéricos, nunca de personas: algún día este resumen puede mostrarse a las familias.</div>
      ${cuerpo}
    </div>
    <div class="pie-fijo"><button class="btn" id="btn-agregar-rubro">Agregar rubro</button></div>`;

  $('btn-agregar-rubro').addEventListener('click', abrirAlta);
  contenedor().querySelectorAll('[data-rubro]').forEach((b) => b.addEventListener('click', () => {
    abrirEdicion(rubros.find((r) => r.id === b.dataset.rubro));
  }));
}

function campoNombre(valor) {
  return html`
    <div class="campo">
      <label for="rubro-nombre">Nombre</label>
      <input id="rubro-nombre" type="text" maxlength="${LIMITE.nombreRubro}" autocomplete="off" value="${valor}">
    </div>`;
}

/** Deshabilita el botón mientras guarda; si falla, muestra el aviso y lo rehabilita. */
async function guardarCon(boton, accion) {
  if (boton.disabled) return;
  const texto = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await accion();
    cerrarHoja();
    toast('Listo.');
    await renderRubros();
  } catch (e) {
    mostrarAviso($('rubro-aviso'), mensajeDeError(e));
    boton.disabled = false;
    boton.textContent = texto;
  }
}

function abrirAlta() {
  let tipo = null;
  abrirHoja({
    titulo: 'Agregar rubro',
    cuerpo: html`
      ${campoNombre('')}
      <div class="campo"><span class="etiqueta" id="rubro-tipo-rotulo">Tipo</span></div>
      <div class="segmentado" role="group" aria-labelledby="rubro-tipo-rotulo">
        ${Object.entries(ROTULO_TIPO).map(([clave, rotulo]) => html`
          <button type="button" class="segmento" data-tipo="${clave}" aria-pressed="false">${rotulo}</button>`)}
      </div>
      <div class="p det">El tipo no se puede cambiar después.</div>
      <div id="rubro-aviso"></div>
      <div class="acciones-hoja">
        <button type="button" class="btn sec" id="rubro-cancelar">Cancelar</button>
        <button type="button" class="btn" id="rubro-guardar">Guardar</button>
      </div>`.toString(),
  });
  document.querySelectorAll('#hoja [data-tipo]').forEach((b) => b.addEventListener('click', () => {
    tipo = b.dataset.tipo;
    document.querySelectorAll('#hoja [data-tipo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $('rubro-cancelar').addEventListener('click', cerrarHoja);
  $('rubro-guardar').addEventListener('click', () => {
    const r = validarRubro({ nombre: $('rubro-nombre').value, tipo });
    if (r.error) { mostrarAviso($('rubro-aviso'), r.error, { campo: tipo ? $('rubro-nombre') : null }); return; }
    if (nombreRepetido(rubros, r.fila.nombre)) { mostrarAviso($('rubro-aviso'), YA_EXISTE, { campo: $('rubro-nombre') }); return; }
    const club = obtenerClubActual();
    guardarCon($('rubro-guardar'), () => agregarRubro({ clubId: club.id, ...r.fila }));
  });
}

function abrirEdicion(rubro) {
  abrirHoja({
    titulo: rubro.nombre,
    cuerpo: html`
      ${campoNombre(rubro.nombre)}
      <div class="p det">Tipo: ${ROTULO_TIPO[rubro.tipo]}. ${rubro.activo
        ? 'Si lo desactivás, no se ofrece al cargar, pero sigue sumando en los meses donde se usó.'
        : 'Está desactivado: no se ofrece al cargar.'}</div>
      <div id="rubro-aviso"></div>
      <div class="acciones-hoja">
        <button type="button" class="btn sec" id="rubro-cancelar">Cancelar</button>
        <button type="button" class="btn" id="rubro-guardar">Guardar</button>
      </div>
      <div class="acciones-hoja">
        <button type="button" class="btn sec" id="rubro-activo">${rubro.activo ? 'Desactivar' : 'Activar'}</button>
      </div>`.toString(),
  });
  $('rubro-cancelar').addEventListener('click', cerrarHoja);
  $('rubro-activo').addEventListener('click', () => {
    guardarCon($('rubro-activo'), () => editarRubro(rubro.id, { activo: !rubro.activo }));
  });
  $('rubro-guardar').addEventListener('click', () => {
    const r = validarRubro({ nombre: $('rubro-nombre').value, tipo: rubro.tipo });
    if (r.error) { mostrarAviso($('rubro-aviso'), r.error, { campo: $('rubro-nombre') }); return; }
    if (nombreRepetido(rubros, r.fila.nombre, rubro.id)) { mostrarAviso($('rubro-aviso'), YA_EXISTE, { campo: $('rubro-nombre') }); return; }
    guardarCon($('rubro-guardar'), () => editarRubro(rubro.id, { nombre: r.fila.nombre }));
  });
}
