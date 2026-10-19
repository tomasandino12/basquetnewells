import { obtenerResponsablesDeJugador, agregarResponsable, quitarResponsable } from '../../data/repositorio.js';
import { normalizarMail } from '../../data/inscriptos.js';
import { LIMITE } from '../../data/limites.js';
import { html } from '../html.js';
import { toast } from '../nav.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { confirmarEnHoja } from '../componentes/confirmar.js';
import { mensajeAlGuardar, avisoInline, textoDeError } from '../errores.js';
import { $ } from '../dom.js';

/**
 * En la ficha del chico: los mails de su familia. La familia que entra a la
 * app con alguno de estos mails queda vinculada con el chico (0057). Se cargan
 * solos con el import de inscriptos; acá se corrige un mail mal escrito o se
 * suma el de otro familiar. La ve y la edita quien tiene el plantel a cargo.
 */

const REGLAS = [[/duplicate key|23505/, 'Ese mail ya está cargado.']];

export async function renderResponsables(contenedor, club, jugador) {
  let responsables;
  try {
    responsables = await obtenerResponsablesDeJugador(jugador.id);
  } catch (e) {
    contenedor.innerHTML = html`<div class="p">${textoDeError(e, 'No se pudieron cargar los mails de la familia.')}</div>`;
    return;
  }
  contenedor.innerHTML = html`
    <div class="eyebrow">Mails de la familia <button class="btn sec chico" id="btn-agregar-responsable">Agregar</button></div>
    ${responsables.length
      ? responsables.map((r) => html`
          <div class="jug-fila">
            <div class="nom" style="word-break:break-all">${r.email}</div>
            <button class="btn sec chico" data-quitar-responsable="${r.id}">Quitar</button>
          </div>`)
      : html`<div class="p">Todavía no hay ningún mail. Se cargan con "Importar inscriptos", o podés agregar uno a mano.</div>`}
    <div class="p">La familia ve a este chico cuando entra a la app con alguno de estos mails.</div>
  `;
  $('btn-agregar-responsable').addEventListener('click', () => abrirAgregar(contenedor, club, jugador));
  contenedor.querySelectorAll('[data-quitar-responsable]').forEach((b) => {
    b.addEventListener('click', () => {
      const r = responsables.find((x) => x.id === b.dataset.quitarResponsable);
      if (r) pedirQuitar(contenedor, club, jugador, r);
    });
  });
}

function pedirQuitar(contenedor, club, jugador, r) {
  confirmarEnHoja({
    titulo: 'Quitar el mail',
    texto: `${r.email} deja de poder ver a ${jugador.nombreLimpio}. Si ya estaba vinculada, la coordinación la da de baja desde Familias.`,
    verbo: 'Quitar',
    alConfirmar: async () => {
      try {
        await quitarResponsable(r.id);
      } catch (e) {
        toast(mensajeAlGuardar(e, { generico: 'No se pudo quitar. Probá de nuevo.' }));
        throw e;
      }
      renderResponsables(contenedor, club, jugador);
    },
  });
}

function abrirAgregar(contenedor, club, jugador) {
  abrirHoja({
    titulo: 'Agregar un mail',
    cuerpo: html`
      <div class="campo">
        <label for="in-responsable">Mail de la mamá, el papá o quien lo inscribió</label>
        <input id="in-responsable" type="email" inputmode="email" autocomplete="off" maxlength="${LIMITE.mail}" placeholder="nombre@ejemplo.com">
      </div>
      <div id="responsable-aviso"></div>
      <button class="btn" id="btn-guardar-responsable">Guardar</button>
    `,
  });
  $('btn-guardar-responsable').addEventListener('click', async () => {
    const boton = $('btn-guardar-responsable');
    if (boton.disabled) return;
    const mail = normalizarMail($('in-responsable').value);
    if (!mail) {
      $('responsable-aviso').innerHTML = avisoInline('Ese mail no parece válido. Revisalo.');
      return;
    }
    boton.disabled = true;
    try {
      await agregarResponsable(club.id, jugador.id, mail);
    } catch (e) {
      boton.disabled = false;
      $('responsable-aviso').innerHTML = avisoInline(mensajeAlGuardar(e, { reglas: REGLAS }));
      return;
    }
    cerrarHoja();
    renderResponsables(contenedor, club, jugador);
  });
}
