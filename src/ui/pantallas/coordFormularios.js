import {
  listarFormularios, crearFormulario, actualizarFormulario, reordenarFormularios,
} from '../../data/repositorio.js';
import {
  validarFormulario, moverFormulario, ordenarFormularios, MENSAJE_ENLACE_FORMULARIO,
} from '../../data/formulariosPortal.js';
import { PORTAL } from '../../data/portal.js';
import { LIMITE } from '../../data/limites.js';
import { obtenerClubActual } from '../sesion.js';
import { toast } from '../nav.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { ICONO, botonIcono } from '../componentes/iconos.js';
import { $ } from '../dom.js';
import { html } from '../html.js';
import { avisoDeError, mensajeAlGuardar, mostrarAviso } from '../errores.js';

/*
 * Formularios del portal del básquet: los enlaces a Google Forms que las
 * familias ven en la página pública (0058, spec portal v2 §3). Los carga la
 * coordinación: "hay que pagar unas rifas, sumo el formulario y el padre lo
 * abre y sube el comprobante". Se llega desde la pestaña FAMILIAS.
 *
 * Un formulario no se borra: se oculta. Lo que se escribe acá lo ve cualquiera
 * que abra la página, sin sesión, así que el aviso de arriba pide no poner
 * nombres de chicos.
 */

let formularios = [];
let ocupado = false;

const contenedor = () => $('coord-formularios-contenido');

const mensajeDeError = (e) => mensajeAlGuardar(e, {
  reglas: [[/formulario_portal_enlace_google/, MENSAJE_ENLACE_FORMULARIO]],
  permiso: /NO_SE_PUDO|row-level security|permission denied/i,
});

function filaHtml(f, i, total) {
  return html`
    <div class="jug-fila form-fila">
      <button type="button" class="form-fila-texto" data-form="${f.id}">
        <span class="nom">${f.titulo}</span>
        <span class="det">${f.texto}</span>
      </button>
      ${!f.activo && html`<span class="chip sin">Oculto</span>`}
      ${botonIcono({ icono: ICONO.flechaArriba, etiqueta: `Subir ${f.titulo}`, disabled: i === 0, extraClase: 'form-sube' })}
      ${botonIcono({ icono: ICONO.flechaAbajo, etiqueta: `Bajar ${f.titulo}`, disabled: i === total - 1, extraClase: 'form-baja' })}
    </div>`;
}

export async function renderFormularios() {
  const club = obtenerClubActual();
  if (!club) return;
  contenedor().innerHTML = html`<div class="pad"><div class="p" role="status">Cargando…</div></div>`;
  try {
    formularios = ordenarFormularios(await listarFormularios(club.id));
  } catch (e) {
    contenedor().innerHTML = html`${avisoDeError(e, 'No se pudieron cargar los formularios.')}
      <div class="pad"><button class="btn sec" id="btn-reintentar-formularios">Reintentar</button></div>`;
    $('btn-reintentar-formularios').addEventListener('click', () => renderFormularios());
    return;
  }

  const hayInscripcion = PORTAL.formularios[0];
  const cuerpo = formularios.length
    ? html`<div class="eyebrow">En la página <span class="der">${formularios.filter((f) => f.activo).length} a la vista</span></div>
      ${formularios.map((f, i) => filaHtml(f, i, formularios.length))}`
    : html`<div class="estado-vacio"><h2>Formularios</h2>
        <div class="p">Todavía no hay formularios en la página de las familias. Sumá los que necesiten: inscripción, pase, rifas, aranceles…</div>
        ${hayInscripcion && html`<div class="acciones"><button class="btn sec" id="form-sumar-inscripcion">Agregar el de Inscripción</button></div>`}
      </div>`;

  contenedor().innerHTML = html`
    <div class="pad">
      <div class="p det">Esto lo ve cualquiera que abra la página del básquet, sin entrar con ninguna cuenta: no pongas nombres de chicos ni datos personales. Cada formulario lleva una línea que le cuenta a la familia para qué es y qué tiene que tener a mano.</div>
      <p class="p det"><a href="/" target="_blank" rel="noopener">Ver cómo lo ven las familias</a></p>
      ${cuerpo}
    </div>
    <div class="pie-fijo"><button class="btn" id="btn-agregar-formulario">Agregar formulario</button></div>`;

  $('btn-agregar-formulario').addEventListener('click', () => abrirFormulario(null));
  $('form-sumar-inscripcion')?.addEventListener('click', () => abrirFormulario(null, hayInscripcion));
  contenedor().querySelectorAll('[data-form]').forEach((b) => b.addEventListener('click', () => {
    abrirFormulario(formularios.find((f) => f.id === b.dataset.form));
  }));
  contenedor().querySelectorAll('.form-fila').forEach((fila, i) => {
    fila.querySelector('.form-sube').addEventListener('click', () => mover(formularios[i].id, 'subir'));
    fila.querySelector('.form-baja').addEventListener('click', () => mover(formularios[i].id, 'bajar'));
  });
}

/** Guarda sólo lo que cambió de lugar; si algo falla, se recarga la lista de la base. */
async function mover(id, direccion) {
  if (ocupado) return;
  const { cambios } = moverFormulario(formularios, id, direccion);
  if (!cambios.length) return;
  ocupado = true;
  try {
    await reordenarFormularios(cambios);
  } catch (e) {
    toast(mensajeDeError(e));
  } finally {
    ocupado = false;
    await renderFormularios();
  }
}

/** Deshabilita el botón mientras guarda; si falla, muestra el aviso y lo rehabilita. */
async function guardarCon(boton, accion) {
  if (boton.disabled) return;
  const texto = boton.textContent;
  $('form-aviso').innerHTML = '';
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await accion();
    cerrarHoja();
    toast('Listo.');
    await renderFormularios();
  } catch (e) {
    mostrarAviso($('form-aviso'), mensajeDeError(e));
    boton.disabled = false;
    boton.textContent = texto;
  }
}

/** Alta (formulario nulo, con datos iniciales opcionales) o edición. */
function abrirFormulario(formulario, inicial = null) {
  const v = formulario ?? inicial ?? { titulo: '', texto: '', enlace: '' };
  abrirHoja({
    titulo: formulario ? formulario.titulo : 'Agregar formulario',
    cuerpo: html`
      <div class="campo">
        <label for="form-titulo">Título</label>
        <input id="form-titulo" type="text" maxlength="${LIMITE.titulo}" autocomplete="off" value="${v.titulo}" placeholder="Ej.: Comprobante de rifas">
      </div>
      <div class="campo">
        <label for="form-texto">Para qué es y qué tienen que tener a mano</label>
        <textarea id="form-texto" rows="4" maxlength="${LIMITE.textoFormulario}" placeholder="Ej.: Para subir la foto del comprobante de pago de las rifas. Tené a mano la foto del comprobante.">${v.texto}</textarea>
      </div>
      <div class="campo">
        <label for="form-enlace">Enlace del formulario</label>
        <input id="form-enlace" type="url" inputmode="url" maxlength="${LIMITE.enlace}" autocomplete="off" autocapitalize="none" spellcheck="false" value="${v.enlace}" placeholder="https://forms.gle/…">
      </div>
      <div class="p det">Pegá el enlace de Google Forms (empieza con https://docs.google.com/forms o https://forms.gle).${formulario ? (formulario.activo
        ? ' Si lo ocultás, las familias dejan de verlo; podés volver a mostrarlo cuando quieras.'
        : ' Está oculto: las familias no lo ven.') : ''}</div>
      <div id="form-aviso"></div>
      <div class="acciones-hoja">
        <button type="button" class="btn sec" id="form-cancelar">Cancelar</button>
        <button type="button" class="btn" id="form-guardar">Guardar</button>
      </div>
      ${formulario && html`<div class="acciones-hoja">
        <button type="button" class="btn sec" id="form-activo">${formulario.activo ? 'Ocultar de la página' : 'Mostrar en la página'}</button>
      </div>`}`.toString(),
  });
  $('form-cancelar').addEventListener('click', cerrarHoja);
  $('form-activo')?.addEventListener('click', () => {
    guardarCon($('form-activo'), () => actualizarFormulario(formulario.id, {
      titulo: formulario.titulo, texto: formulario.texto, enlace: formulario.enlace, activo: !formulario.activo,
    }));
  });
  $('form-guardar').addEventListener('click', () => {
    const r = validarFormulario({
      titulo: $('form-titulo').value, texto: $('form-texto').value, enlace: $('form-enlace').value,
    });
    if (r.error) {
      const campo = /título/i.test(r.error) ? 'form-titulo' : /enlace/i.test(r.error) ? 'form-enlace' : 'form-texto';
      mostrarAviso($('form-aviso'), r.error, { campo: $(campo) });
      return;
    }
    if (formulario) {
      guardarCon($('form-guardar'), () => actualizarFormulario(formulario.id, { ...r.formulario, activo: formulario.activo }));
      return;
    }
    const club = obtenerClubActual();
    const orden = Math.min(1000, (formularios.at(-1)?.orden ?? 0) + 1);
    guardarCon($('form-guardar'), () => crearFormulario({ clubId: club.id, ...r.formulario, orden }));
  });
}
