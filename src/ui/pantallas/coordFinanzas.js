import {
  obtenerRubros, obtenerMovimientosDelPeriodo, agregarMovimiento, editarMovimiento, borrarMovimiento,
} from '../../data/repositorio.js';
import {
  formatearPesos, montoParaEditar, resumenDelPeriodo, rangoDelMes, mesVecino, nombreDelMes, validarMovimiento,
  ROTULO_TIPO,
} from '../../data/finanzas.js';
import { hoyLocal } from '../../data/antropometria.js';
import { LIMITE } from '../../data/limites.js';
import { obtenerClubActual } from '../sesion.js';
import { toast, formatearFechaCorta } from '../nav.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { confirmarEnHoja } from '../componentes/confirmar.js';
import { ir } from '../main.js';
import { $ } from '../dom.js';
import { html } from '../html.js';
import { avisoDeError, mensajeAlGuardar, mostrarAviso } from '../errores.js';

/*
 * Finanzas del básquet, vista del coordinador: el mes elegido con ingresos,
 * egresos, resultado, totales por rubro y la lista de movimientos, que se
 * cargan, editan y borran desde una hoja. Sólo coordinación (0054); el profe
 * ni ve la pestaña y la base no le devuelve nada.
 *
 * Los montos viajan en centavos enteros. Ingreso y egreso se distinguen por el
 * signo y la palabra, además del color.
 * Ver docs/superpowers/specs/2026-10-16-finanzas-design.md.
 */

const hoy = new Date();
let periodo = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
let vista = { rubros: [], movimientos: [] };

const contenedor = () => $('coord-finanzas-contenido');

const mensajeDeError = (e) => mensajeAlGuardar(e, {
  reglas: [[/MOVIMIENTO_BORRADO/, 'Este movimiento ya estaba borrado. Actualizá la pantalla.']],
  permiso: /NO_SE_PUDO|row-level security|permission denied/i,
});

/** Signo con texto: egreso en negativo, ingreso con "+". */
const montoConSigno = (tipo, centavos) => formatearPesos(tipo === 'egreso' ? -centavos : centavos, { signo: true });

function resultadoTexto(resultado) {
  if (resultado > 0) return 'a favor';
  if (resultado < 0) return 'en contra';
  return 'en cero';
}

function totalesHtml(r) {
  return html`
    <div class="fin-totales">
      <div class="tarj fin-total">
        <div class="eyebrow">Ingresos</div>
        <div class="fin-cifra fin-ingreso">${formatearPesos(r.ingresos, { signo: true })}</div>
      </div>
      <div class="tarj fin-total">
        <div class="eyebrow">Egresos</div>
        <div class="fin-cifra fin-egreso">${formatearPesos(-r.egresos)}</div>
      </div>
      <div class="tarj fin-total">
        <div class="eyebrow">Resultado</div>
        <div class="fin-cifra">${formatearPesos(r.resultado, { signo: true })}</div>
        <div class="det">${resultadoTexto(r.resultado)}</div>
      </div>
    </div>`;
}

function porRubroHtml(lineas) {
  if (!lineas.length) return '';
  return html`
    <div class="eyebrow">Por rubro</div>
    ${lineas.map((l) => html`
      <div class="jug-fila">
        <span class="nom">${l.nombre}<span class="det fin-sub">${ROTULO_TIPO[l.tipo]} · ${l.cantidad} ${l.cantidad === 1 ? 'movimiento' : 'movimientos'}</span></span>
        <span class="fin-monto fin-${l.tipo}">${montoConSigno(l.tipo, l.total)}</span>
      </div>`)}`;
}

function movimientosHtml() {
  const rubroDe = new Map(vista.rubros.map((r) => [r.id, r]));
  return vista.movimientos.map((m) => {
    const rubro = rubroDe.get(m.rubroId);
    const detalle = [m.descripcion, m.comprobanteUrl && 'con comprobante'].filter(Boolean).join(' · ');
    return html`
      <button type="button" class="jug-fila fin-fila" data-movimiento="${m.id}">
        <span class="fin-fecha mono">${formatearFechaCorta(m.fecha)}</span>
        <span class="nom">${rubro?.nombre ?? '—'}${detalle && html`<span class="det fin-sub">${detalle}</span>`}</span>
        <span class="fin-monto fin-${rubro?.tipo}">${montoConSigno(rubro?.tipo, m.centavos)}</span>
      </button>`;
  });
}

export async function renderFinanzas() {
  const club = obtenerClubActual();
  if (!club) return;
  const nombreMes = nombreDelMes(periodo.anio, periodo.mes);
  contenedor().innerHTML = html`<div class="pad"><div class="p" role="status">Cargando…</div></div>`;
  try {
    const [rubros, movimientos] = await Promise.all([
      obtenerRubros(club.id),
      obtenerMovimientosDelPeriodo(club.id, rangoDelMes(periodo.anio, periodo.mes)),
    ]);
    vista = { rubros, movimientos };
  } catch (e) {
    contenedor().innerHTML = avisoDeError(e, 'No se pudieron cargar las finanzas.');
    return;
  }

  if (!vista.rubros.length) {
    contenedor().innerHTML = html`
      <div class="pad"><div class="estado-vacio">
        <h2>Finanzas</h2>
        <div class="p">Para cargar ingresos y egresos, primero creá los rubros con que se agrupan (Patrocinios, Arbitrajes, Alquiler de cancha…).</div>
        <div class="acciones"><button class="btn" id="fin-ir-rubros">Crear rubros</button></div>
      </div></div>`;
    $('fin-ir-rubros').addEventListener('click', () => ir('p-coord-rubros', { push: true }));
    return;
  }

  const resumen = resumenDelPeriodo(vista.movimientos, vista.rubros);
  contenedor().innerHTML = html`
    <div class="pad">
      <div class="fin-mes">
        <button type="button" class="btn sec chico" id="fin-mes-ant" aria-label="Mes anterior">‹</button>
        <h2 class="fin-mes-nombre" aria-live="polite">${nombreMes}</h2>
        <button type="button" class="btn sec chico" id="fin-mes-sig" aria-label="Mes siguiente">›</button>
      </div>
      ${totalesHtml(resumen)}
      ${porRubroHtml(resumen.porRubro)}
      <div class="seccion-cab">
        <div class="eyebrow">Movimientos</div>
        <button type="button" class="btn sec chico" id="fin-rubros">Rubros</button>
      </div>
      ${vista.movimientos.length
        ? movimientosHtml()
        : html`<div class="p">Todavía no hay movimientos en ${nombreMes}.</div>`}
    </div>
    <div class="pie-fijo"><button class="btn" id="fin-cargar">Cargar movimiento</button></div>`;

  $('fin-mes-ant').addEventListener('click', () => cambiarMes(-1));
  $('fin-mes-sig').addEventListener('click', () => cambiarMes(1));
  $('fin-rubros').addEventListener('click', () => ir('p-coord-rubros', { push: true }));
  $('fin-cargar').addEventListener('click', () => abrirMovimiento(null));
  contenedor().querySelectorAll('[data-movimiento]').forEach((b) => b.addEventListener('click', () => {
    abrirMovimiento(vista.movimientos.find((m) => m.id === b.dataset.movimiento));
  }));
}

function cambiarMes(paso) {
  periodo = mesVecino(periodo.anio, periodo.mes, paso);
  renderFinanzas();
}

/* ---------- hoja de movimiento ---------- */

/** Rubros que se ofrecen: los activos y, al editar, el que ya tenía aunque esté desactivado. */
function opcionesDeRubro(elegido) {
  const visibles = vista.rubros.filter((r) => r.activo || r.id === elegido);
  const grupo = (tipo, rotulo) => {
    const lista = visibles.filter((r) => r.tipo === tipo);
    return lista.length ? html`
      <optgroup label="${rotulo}">
        ${lista.map((r) => html`<option value="${r.id}" ${r.id === elegido ? 'selected' : ''}>${r.nombre} (${tipo === 'ingreso' ? '+' : '−'})</option>`)}
      </optgroup>` : '';
  };
  return html`<option value="" ${elegido ? '' : 'selected'}>Elegí un rubro</option>${grupo('ingreso', 'Ingresos')}${grupo('egreso', 'Egresos')}`;
}

const CAMPOS = {
  fecha: 'mov-fecha', rubro: 'mov-rubro', monto: 'mov-monto', descripcion: 'mov-descripcion', comprobante: 'mov-comprobante',
};

function abrirMovimiento(movimiento) {
  const editando = Boolean(movimiento);
  const m = movimiento ?? { fecha: hoyLocal(), rubroId: '', centavos: null, descripcion: '', comprobanteUrl: null };
  abrirHoja({
    titulo: editando ? 'Editar movimiento' : 'Cargar movimiento',
    cuerpo: html`
      <div class="campo">
        <label for="mov-fecha">Fecha</label>
        <input type="date" id="mov-fecha" value="${m.fecha}" min="2000-01-01">
      </div>
      <div class="campo">
        <label for="mov-rubro">Rubro</label>
        <select id="mov-rubro">${opcionesDeRubro(m.rubroId)}</select>
      </div>
      <div class="campo">
        <label for="mov-monto">Monto en pesos</label>
        <input type="text" id="mov-monto" inputmode="decimal" autocomplete="off" placeholder="1.234,50"
          value="${m.centavos == null ? '' : montoParaEditar(m.centavos)}">
        <div class="ayuda">Siempre positivo: si es ingreso o egreso lo dice el rubro.</div>
      </div>
      <div class="campo">
        <label for="mov-descripcion">Descripción (opcional)</label>
        <input type="text" id="mov-descripcion" maxlength="${LIMITE.descripcionMovimiento}" autocomplete="off" value="${m.descripcion}">
      </div>
      <div class="campo">
        <label for="mov-comprobante">Link al comprobante (opcional)</label>
        <input type="url" id="mov-comprobante" inputmode="url" maxlength="${LIMITE.enlace}" autocomplete="off"
          placeholder="https://drive.google.com/…" value="${m.comprobanteUrl ?? ''}">
        ${m.comprobanteUrl && html`<div class="ayuda"><a href="${m.comprobanteUrl}" target="_blank" rel="noopener noreferrer">Abrir el comprobante</a></div>`}
      </div>
      <div id="mov-aviso"></div>
      <div class="acciones-hoja">
        <button type="button" class="btn sec" id="mov-cancelar">Cancelar</button>
        <button type="button" class="btn" id="mov-guardar">Guardar</button>
      </div>
      ${editando && html`
        <div class="acciones-hoja">
          <button type="button" class="btn sec" id="mov-borrar">Borrar movimiento</button>
        </div>`}`.toString(),
  });

  $('mov-cancelar').addEventListener('click', cerrarHoja);
  if (editando) $('mov-borrar').addEventListener('click', () => confirmarBorrar(movimiento));
  $('mov-guardar').addEventListener('click', async () => {
    const boton = $('mov-guardar');
    if (boton.disabled) return;
    const r = validarMovimiento({
      fecha: $('mov-fecha').value,
      rubroId: $('mov-rubro').value,
      monto: $('mov-monto').value,
      descripcion: $('mov-descripcion').value,
      comprobanteUrl: $('mov-comprobante').value,
    }, vista.rubros, { rubroOriginal: movimiento?.rubroId ?? null });
    if (r.error) { mostrarAviso($('mov-aviso'), r.error, { campo: $(CAMPOS[r.campo]) }); return; }

    $('mov-aviso').innerHTML = '';
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      if (editando) await editarMovimiento(movimiento.id, r.fila);
      else await agregarMovimiento({ clubId: obtenerClubActual().id, ...r.fila });
      cerrarHoja();
      const [anio, mes] = r.fila.fecha.split('-').map(Number);
      toast(anio === periodo.anio && mes === periodo.mes ? 'Listo.' : `Listo: quedó en ${nombreDelMes(anio, mes)}.`);
      await renderFinanzas();
    } catch (e) {
      mostrarAviso($('mov-aviso'), mensajeDeError(e));
      boton.disabled = false;
      boton.textContent = 'Guardar';
    }
  });
}

function confirmarBorrar(movimiento) {
  const rubro = vista.rubros.find((r) => r.id === movimiento.rubroId);
  confirmarEnHoja({
    titulo: 'Borrar movimiento',
    texto: `${rubro?.nombre ?? 'Movimiento'} del ${formatearFechaCorta(movimiento.fecha)} por ${formatearPesos(movimiento.centavos)}: deja de contar en los totales. Queda registrado quién lo borró y cuándo.`,
    verbo: 'Borrar',
    alConfirmar: async () => {
      try {
        await borrarMovimiento(movimiento.id);
      } catch (e) {
        toast(mensajeDeError(e));
        throw e;
      }
      cerrarHoja();
      toast('Listo: movimiento borrado.');
      await renderFinanzas();
    },
  });
}
