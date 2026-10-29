import { ZONAS, LADOS, TIPOS, ETIQUETAS } from '../../data/asistencia.js';
import { abrirHoja, cerrarHoja } from './hoja.js';
import { html } from '../html.js';
import { $ } from '../dom.js';
import { formatearFechaCorta } from '../nav.js';
import { mensajeAlGuardar, mostrarAviso } from '../errores.js';

// Sólo listas cerradas, sin ningún campo de texto: es un dato de salud de un
// menor y la zona alcanza para los análisis que vengan.
const GRUPOS = [
  { clave: 'zona', titulo: 'Zona', opciones: ZONAS },
  { clave: 'lado', titulo: 'Lado', opciones: LADOS },
  { clave: 'tipo', titulo: 'Tipo', opciones: TIPOS },
];

/**
 * Hoja para marcar que un chico se lesionó. Zona, lado y tipo son opcionales
 * ("no sé" es un dato válido: se marca en la cancha) y un segundo toque sobre
 * la opción elegida la desmarca. `alGuardar({ zona, lado, tipo })` es async: si
 * falla, el aviso queda en la hoja y se puede reintentar sin perder lo elegido.
 */
export function abrirHojaLesion({ nombre, fecha, alGuardar }) {
  const elegido = { zona: null, lado: null, tipo: null };
  abrirHoja({
    titulo: nombre,
    cuerpo: html`
      <p class="p">Se lesionó el ${formatearFechaCorta(fecha)}. Marcá lo que sepas: todo es opcional.</p>
      ${GRUPOS.map((g) => html`
        <div class="campo">
          <label id="lbl-lesion-${g.clave}">${g.titulo}</label>
          <div class="chips-tema" role="group" aria-labelledby="lbl-lesion-${g.clave}" data-grupo="${g.clave}">
            ${g.opciones.map((o) => html`<button type="button" class="chip-tema" aria-pressed="false" data-valor="${o}">${ETIQUETAS[o]}</button>`)}
          </div>
        </div>`)}
      <div id="lesion-aviso"></div>
      <div class="acciones-hoja">
        <button type="button" class="btn sec" id="lesion-cancelar">Cancelar</button>
        <button type="button" class="btn" id="lesion-guardar">Guardar</button>
      </div>
    `.toString(),
  });

  document.querySelectorAll('#hoja .chips-tema').forEach((grupo) => {
    grupo.querySelectorAll('.chip-tema').forEach((chip) => {
      chip.addEventListener('click', () => {
        const clave = grupo.dataset.grupo;
        elegido[clave] = elegido[clave] === chip.dataset.valor ? null : chip.dataset.valor;
        grupo.querySelectorAll('.chip-tema').forEach((c) => {
          const activo = c.dataset.valor === elegido[clave];
          c.classList.toggle('on', activo);
          c.setAttribute('aria-pressed', String(activo));
        });
      });
    });
  });

  $('lesion-cancelar').addEventListener('click', cerrarHoja);
  $('lesion-guardar').addEventListener('click', async () => {
    const boton = $('lesion-guardar');
    if (boton.disabled) return;
    $('lesion-aviso').innerHTML = '';
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      await alGuardar({ ...elegido });
    } catch (e) {
      mostrarAviso($('lesion-aviso'), mensajeAlGuardar(e, {
        reglas: [
          [/lesion_abierta_unica/, 'Ya tiene una lesión abierta. Dale el alta antes de marcar otra.'],
          [/FECHA_FUTURA/, 'Ese día todavía no llegó.'],
        ],
        generico: 'No se pudo guardar la lesión.',
      }));
      boton.disabled = false;
      boton.textContent = 'Guardar';
      return;
    }
    cerrarHoja();
  });
}
