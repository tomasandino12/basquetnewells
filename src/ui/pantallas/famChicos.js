import { vincularPorMail, obtenerMisChicos } from '../../data/repositorio.js';
import { obtenerCuenta, setChicos } from '../sesion.js';
import { html } from '../html.js';
import { avisoDeError } from '../errores.js';
import { $ } from '../dom.js';

const contenedor = () => $('fam-chicos-contenido');

/**
 * Lo único que ve una familia: sus hijos vinculados, con nombre y categoría.
 * Nada de partidos, mediciones ni misiones (por la base, no por esta pantalla).
 * Los textos están escritos para quien no sabe de computadoras: qué es esto,
 * dónde se carga cada cosa y qué hacer si no aparece su hijo.
 */

const comoFunciona = (email) => html`
  <section class="fam-ayuda">
    <h2 class="h2">Cómo anotar a tu hijo</h2>
    <ol class="pasos">
      <li>Entrá a la página del básquet y completá el <b>formulario de inscripción</b>.</li>
      <li>Poné este mismo mail: <b>${email ?? 'el de tu cuenta'}</b>.</li>
      <li>El club carga la inscripción y tu hijo aparece acá. Puede tardar unos días.</li>
    </ol>
    <p class="p">Los documentos (DNI y fotos) también se suben por la página del básquet, no por WhatsApp.</p>
  </section>
`;

const tarjeta = (c) => html`
  <article class="jug" style="cursor:default">
    <div style="flex:1;text-align:left">
      <div class="nom">${c.nombre}</div>
      <div class="det">${c.categorias ?? 'Todavía sin categoría'} · ${c.clubNombre}</div>
    </div>
  </article>
`;

export async function renderFamChicos() {
  contenedor().innerHTML = '<div class="pad"><div class="p" role="status">Cargando…</div></div>';
  const email = obtenerCuenta()?.email;
  let chicos;
  try {
    // Si el club cargó a otro hijo desde la última vez, el vínculo se crea acá.
    await vincularPorMail().catch(() => {});
    chicos = await obtenerMisChicos();
  } catch (e) {
    contenedor().innerHTML = `${avisoDeError(e, 'No se pudo cargar. Probá de nuevo en un rato.')}
      <div class="pad"><button class="btn sec" id="btn-reintentar-fam">Reintentar</button></div>`;
    $('btn-reintentar-fam').addEventListener('click', () => renderFamChicos());
    return;
  }
  setChicos(chicos);

  if (!chicos.length) {
    contenedor().innerHTML = html`
      <div class="pad">
        <div class="estado-vacio">
          <h2>Todavía no encontramos a tu hijo</h2>
          <div class="p">Si ya lo anotaste, el club lo carga en unos días. Si pasó tiempo y no aparece, avisale al coordinador.</div>
        </div>
        ${comoFunciona(email)}
        <button class="btn sec" id="btn-actualizar-fam">Volver a mirar</button>
      </div>
    `;
    $('btn-actualizar-fam').addEventListener('click', () => renderFamChicos());
    return;
  }

  contenedor().innerHTML = html`
    <div class="pad">
      <div class="eyebrow">Tus chicos <span class="der">${chicos.length}</span></div>
      <div class="lista-2col">${chicos.map(tarjeta)}</div>
      <p class="p">Si falta alguno, avisale al coordinador del club.</p>
      ${comoFunciona(email)}
    </div>
  `;
}
