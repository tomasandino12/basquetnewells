import { obtenerVinculosFamiliaDelClub, cerrarVinculoFamilia } from '../../data/repositorio.js';
import { obtenerClubActual } from '../sesion.js';
import { toast, formatearFechaCorta } from '../nav.js';
import { confirmarEnHoja } from '../componentes/confirmar.js';
import { html } from '../html.js';
import { avisoDeError, mensajeAlGuardar } from '../errores.js';
import { $ } from '../dom.js';

const contenedor = () => $('coord-familias-contenido');

/**
 * Control posterior de los vínculos de familia (spec 2026-10-18, §6.2): nadie
 * aprueba un vínculo antes, pero acá se ve quién se vinculó con qué chico y
 * cuándo, y se puede dar de baja. La baja cierra el vínculo, no lo borra, y
 * no se reabre sola si la familia vuelve a entrar.
 */

const REGLAS = [[/VINCULO_NO_ENCONTRADO/, 'Ese vínculo ya no está. Actualizá la lista.']];

const filaHtml = (v) => html`
  <div class="profe">
    <div class="nom">${v.jugador}</div>
    <div class="det">${v.categorias ?? 'Sin categoría'}</div>
    <div class="det">Cuenta: ${v.nombre ?? 'sin nombre'} · ${v.emailEnmascarado} · desde el ${formatearFechaCorta(v.desde.slice(0, 10))}</div>
    <button class="btn sec chico" data-baja="${v.id}">Dar de baja</button>
  </div>
`;

export async function renderFamilias() {
  const club = obtenerClubActual();
  contenedor().innerHTML = '<div class="pad"><div class="p" role="status">Cargando…</div></div>';
  let vinculos;
  try {
    vinculos = await obtenerVinculosFamiliaDelClub(club.id);
  } catch (e) {
    contenedor().innerHTML = `${avisoDeError(e, 'No se pudieron cargar las familias.')}
      <div class="pad"><button class="btn sec" id="btn-reintentar-familias">Reintentar</button></div>`;
    $('btn-reintentar-familias').addEventListener('click', () => renderFamilias());
    return;
  }

  const explicacion = html`
    <p class="p">Cada familia se vincula sola, con el mail con el que inscribió a su hijo. Acá ves quién quedó vinculado con quién. Si algo no corresponde, dalo de baja.</p>
  `;
  if (!vinculos.length) {
    contenedor().innerHTML = html`
      <div class="pad">
        <div class="estado-vacio">
          <h2>Todavía no hay familias vinculadas</h2>
          <div class="p">Aparecen cuando un padre entra a la app con el mail con el que inscribió a su hijo y el profe ya cargó la inscripción en su categoría.</div>
        </div>
      </div>`;
    return;
  }
  contenedor().innerHTML = html`
    <div class="pad">
      ${explicacion}
      <div class="eyebrow">Vinculadas <span class="der">${vinculos.length}</span></div>
      ${vinculos.map(filaHtml)}
    </div>`;
  contenedor().querySelectorAll('[data-baja]').forEach((b) => {
    b.addEventListener('click', () => {
      const v = vinculos.find((x) => x.id === b.dataset.baja);
      if (v) pedirBaja(v);
    });
  });
}

function pedirBaja(v) {
  confirmarEnHoja({
    titulo: 'Dar de baja el vínculo',
    texto: `${v.nombre ?? 'Esta cuenta'} (${v.emailEnmascarado}) deja de ver a ${v.jugador}. Si la familia vuelve a entrar, no se vuelve a vincular sola.`,
    verbo: 'Dar de baja',
    alConfirmar: async () => {
      try {
        await cerrarVinculoFamilia(v.id);
      } catch (e) {
        toast(mensajeAlGuardar(e, { reglas: REGLAS, generico: 'No se pudo dar de baja. Probá de nuevo.' }));
        throw e;
      }
      toast('Listo: el vínculo se dio de baja.');
      renderFamilias();
    },
  });
}
