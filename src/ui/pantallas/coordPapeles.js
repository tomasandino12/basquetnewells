import {
  obtenerEstadoInscripcion, obtenerConexionGoogle, obtenerCatalogoDeCategorias,
  rotarConexionGoogle, desconectarGoogle,
} from '../../data/repositorio.js';
import {
  conceptosDe, contadores, filtrar, categoriaDeChico, estadoDePago, debeAlgo, porVerificar,
  linkFila, haceCuanto, envioViejo, resumenPanorama,
} from '../../data/estadoInscripcion.js';
import { linkCarpetaEnDrive } from '../../data/enlacesGoogle.js';
import { obtenerClubActual } from '../sesion.js';
import { formatearFechaCorta, toast } from '../nav.js';
import { abrirHoja, cerrarHoja } from '../componentes/hoja.js';
import { confirmarEnHoja } from '../componentes/confirmar.js';
import { html, crudo } from '../html.js';
import { avisoDeError, mensajeAlGuardar } from '../errores.js';
import { $ } from '../dom.js';

const destino = () => $('coord-papeles-contenido');

/**
 * Panel de papeles y pagos (spec 2026-10-19-panel-docs-pagos): el estado que
 * manda el script de Google del club, por chico. Sólo lectura: verificar un
 * pago se sigue haciendo en el tablero. Acá nunca hay un DNI ni un archivo:
 * los links llevan a la fila del tablero y a la carpeta de Drive, y ahí manda
 * Google con sus permisos.
 */

const FILTROS_VACIOS = { categoria: null, debe: false, faltaDoc: false, verificar: false };
let filtros = { ...FILTROS_VACIOS };
const abiertos = new Set();
let datos = null; // { chicos, conexion, nombresCategoria }

const BLOQUES = [
  { clave: 'ok', titulo: 'Chicos', ayuda: null },
  { clave: 'homonimo', titulo: 'Posible homónimo', ayuda: 'El nombre coincide con una ficha, pero la fecha de nacimiento no. Revisalo en el tablero antes de darlo por el mismo chico.' },
  { clave: 'sin_ficha', titulo: 'En Google, no en Semillero', ayuda: 'Están en el tablero y no tienen ficha en Semillero. Importalos desde Plantel → Importar inscriptos.' },
  { clave: 'sin_tablero', titulo: 'No figuran en el tablero', ayuda: 'Tienen ficha en un plantel y no se inscribieron en Google. Cuentan como que deben todo y les falta todo.' },
];

const PAGO = {
  verificado: { clase: 'sube', texto: 'Verificado' },
  subido: { clase: '', texto: 'Por verificar' },
  falta: { clase: 'baja', texto: 'Falta' },
};

const chipPago = (estado) => html`<span class="chip ${PAGO[estado].clase}">${PAGO[estado].texto}</span>`;

function chipPapeles(c) {
  if (c.completo === true) return html`<span class="chip sube">Papeles completos</span>`;
  if (c.completo === false) return html`<span class="chip baja">Faltan papeles</span>`;
  return html`<span class="chip sin">Papeles sin datos</span>`;
}

function chipPlata(c, conceptos) {
  if (debeAlgo(c, conceptos)) return html`<span class="chip baja">Debe</span>`;
  if (porVerificar(c, conceptos)) return html`<span class="chip">Por verificar</span>`;
  return html`<span class="chip sube">Al día</span>`;
}

function nombreCategoria(c) {
  const codigo = categoriaDeChico(c);
  if (codigo) return datos.nombresCategoria.get(codigo) ?? codigo;
  return c.categoriaTexto ?? 'Sin categoría';
}

function detalleHtml(c, conceptos) {
  const { conexion } = datos;
  const sinTablero = c.emparejamiento === 'sin_tablero';
  const fila = sinTablero ? null : c.fila;
  const tablero = linkFila(conexion, 'tablero', fila);
  const pagos = linkFila(conexion, 'pagos', fila);
  const carpeta = sinTablero ? null : linkCarpetaEnDrive(c.nombreGoogle ?? c.nombre);
  return html`
    ${sinTablero ? html`<div class="det">No figura en el tablero: no hay datos de papeles ni de pagos.</div>` : html`
      <div class="eyebrow">Documentos</div>
      ${conexion.documentosOrden.map((doc) => html`
        <div class="papel-linea"><span>${doc}</span>${c.documentos[doc] === true
          ? html`<span class="chip sube">Está</span>`
          : c.documentos[doc] === false ? html`<span class="chip baja">Falta</span>` : html`<span class="chip sin">Sin datos</span>`}</div>`)}`}
    <div class="eyebrow">Pagos</div>
    ${conceptos.map((k) => html`<div class="papel-linea"><span>${k}</span>${chipPago(estadoDePago(c, k))}</div>`)}
    ${c.cambioEn ? html`<div class="det">Cambió el ${formatearFechaCorta(c.cambioEn.slice(0, 10))}</div>` : ''}
    <div class="papel-links">
      ${tablero ? html`<a class="btn sec chico" href="${tablero}" target="_blank" rel="noopener noreferrer">Ver en el tablero</a>` : ''}
      ${pagos ? html`<a class="btn sec chico" href="${pagos}" target="_blank" rel="noopener noreferrer">Ver pagos</a>` : ''}
      ${carpeta ? html`<a class="btn sec chico" href="${carpeta}" target="_blank" rel="noopener noreferrer">Carpeta en Drive</a>` : ''}
    </div>
    ${carpeta ? html`<div class="det">¿No aparece la carpeta? Buscala por el DNI en Drive: puede estar escrita distinto.</div>` : ''}
  `;
}

function filaHtml(c, conceptos) {
  const abierto = abiertos.has(c.id);
  return html`
    <div class="profe papel">
      <button type="button" class="papel-cab" data-fila="${c.id}" aria-expanded="${abierto}">
        <span class="nom">${c.nombre}</span>
        <span class="det">${nombreCategoria(c)}</span>
        <span class="papel-chips">${chipPapeles(c)}${chipPlata(c, conceptos)}</span>
      </button>
      <div class="papel-detalle" ${abierto ? '' : crudo('hidden')}>${abierto ? detalleHtml(c, conceptos) : ''}</div>
    </div>`;
}

function cabeceraHtml(conexion) {
  if (!conexion.conectado) {
    return html`
      <div class="estado-vacio">
        <h2>Todavía no llegó nada de Google</h2>
        <div class="p">Cuando el script del club esté conectado, acá vas a ver quién tiene los papeles y quién pagó, sin pedir fotos por WhatsApp.</div>
        <button type="button" class="btn" data-accion="conectar">Conectar con Google</button>
      </div>`;
  }
  const gestion = html`
    <div class="papel-links">
      <button type="button" class="btn sec chico" data-accion="cambiar">Cambiar el token</button>
      <button type="button" class="btn sec chico" data-accion="desconectar">Desconectar</button>
    </div>`;
  if (!conexion.ultimoEnvioEn) {
    return html`
      <div class="al" role="status"><span class="ico">…</span><div class="tx">Token generado: falta el primer envío de Google. Si ya lo pegaste en el script, puede tardar unos minutos.</div></div>
      ${gestion}`;
  }
  const viejo = envioViejo(conexion.ultimoEnvioEn);
  return html`
    <div class="eyebrow">Último envío <span class="der">${haceCuanto(conexion.ultimoEnvioEn)}</span></div>
    ${viejo ? html`<div class="al error" role="alert"><span class="ico">!</span><div class="tx">Hace más de 2 horas que Google no manda nada. Lo que ves puede estar desactualizado: revisá que el script siga andando.</div></div>` : ''}
    ${conexion.tableroUrl ? html`<div class="papel-links"><a class="btn sec chico" href="${conexion.tableroUrl}" target="_blank" rel="noopener noreferrer">Abrir el tablero</a></div>` : ''}
    ${gestion}`;
}

function contadoresHtml(chicos, conceptos) {
  const { porConcepto, documentacion } = contadores(chicos, conceptos);
  return html`
    <div class="tarj">
      <div class="papel-linea"><span>Documentación completa</span><span class="chip mono">${documentacion.completos}/${documentacion.total}</span></div>
      ${porConcepto.map((n) => html`
        <div class="papel-linea apilada"><span>${n.concepto}</span>
          <span class="papel-chips"><span class="chip sube">${n.verificado} verif.</span><span class="chip">${n.subido} por verif.</span><span class="chip baja">${n.falta} faltan</span></span>
        </div>`)}
    </div>`;
}

function filtrosHtml(chicos) {
  const codigos = [...new Set(chicos.map(categoriaDeChico).filter(Boolean))].sort();
  const chip = (clave, texto, on) => html`<button type="button" class="chip-tema ${on ? 'on' : ''}" data-filtro="${clave}" aria-pressed="${on}">${texto}</button>`;
  return html`
    <div class="chips-tema" role="group" aria-label="Filtrar por categoría">
      ${chip('cat:', 'Todas', !filtros.categoria)}
      ${codigos.map((k) => chip(`cat:${k}`, datos.nombresCategoria.get(k) ?? k, filtros.categoria === k))}
    </div>
    <div class="chips-tema" role="group" aria-label="Filtrar por estado">
      ${chip('debe', 'Debe algo', filtros.debe)}
      ${chip('verificar', 'Por verificar', filtros.verificar)}
      ${chip('faltaDoc', 'Le falta documentación', filtros.faltaDoc)}
    </div>`;
}

function pintar() {
  const { chicos, conexion } = datos;
  const conceptos = conceptosDe(chicos, conexion.conceptosOrden);
  const visibles = filtrar(chicos, { ...filtros, conceptos });
  const bloques = BLOQUES.map((b) => ({ ...b, filas: visibles.filter((c) => c.emparejamiento === b.clave) }));
  destino().innerHTML = html`
    <div class="pad">
      ${cabeceraHtml(conexion)}
      ${chicos.length ? html`
        ${contadoresHtml(chicos, conceptos)}
        ${filtrosHtml(chicos)}
        ${visibles.length ? '' : html`<div class="p">Ningún chico cumple esos filtros.</div>`}
        ${bloques.filter((b) => b.filas.length).map((b) => html`
          <div class="eyebrow">${b.titulo} <span class="der">${b.filas.length}</span></div>
          ${b.ayuda ? html`<div class="p">${b.ayuda}</div>` : ''}
          ${b.filas.map((c) => filaHtml(c, conceptos))}`)}` : ''}
    </div>`;
}

const REGLAS_CONEXION = [[/42501|Sólo coordinación/, 'Sólo coordinación puede conectar con Google.']];

/**
 * El token se ve una sola vez: en la base queda su hash. Se muestra en la hoja,
 * con un botón para copiarlo, y se borra de la pantalla al cerrarla.
 */
function mostrarToken(token) {
  abrirHoja({
    titulo: 'Token del script de Google',
    cuerpo: html`
      <div class="p">Este token se ve <strong>una sola vez</strong>. Copialo ahora y pegalo en el script del club.</div>
      <div class="p">1. Tocá <strong>Copiar</strong>.</div>
      <div class="p">2. En el Apps Script del club: <em>Configuración del proyecto → Propiedades del script</em>, agregá <span class="mono">SEMILLERO_TOKEN</span> con este valor.</div>
      <div class="p">3. Seguí la guía del script (<span class="mono">google/GUIA.md</span>). En unos minutos el panel se llena solo.</div>
      <input class="campo mono" id="papeles-token" readonly value="${token}" aria-label="Token del script" />
      <div class="acciones-hoja">
        <button type="button" class="btn sec" id="papeles-token-cerrar">Ya lo pegué</button>
        <button type="button" class="btn" id="papeles-token-copiar">Copiar</button>
      </div>`.toString(),
    // Se borra de la pantalla al cerrar, sea cual sea la forma de cerrarla.
    alCerrar: () => { const t = $('papeles-token'); if (t) t.value = ''; },
  });
  $('papeles-token').addEventListener('focus', (e) => e.target.select());
  $('papeles-token-copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(token);
      toast('Copiado.');
    } catch {
      $('papeles-token').select();
      toast('No se pudo copiar solo: seleccionalo y copialo a mano.');
    }
  });
  $('papeles-token-cerrar').addEventListener('click', () => {
    cerrarHoja();
  });
}

async function generarToken(clubId) {
  try {
    const token = await rotarConexionGoogle(clubId);
    mostrarToken(token);
  } catch (e) {
    toast(mensajeAlGuardar(e, { reglas: REGLAS_CONEXION, generico: 'No se pudo generar el token. Probá de nuevo.' }));
    throw e;
  }
}

function accion(nombre) {
  const club = obtenerClubActual();
  if (nombre === 'conectar') generarToken(club.id).then(renderPapeles, () => {});
  if (nombre === 'cambiar') {
    confirmarEnHoja({
      titulo: 'Cambiar el token',
      texto: 'El token anterior deja de servir ahora mismo: el script no manda nada hasta que pegues el nuevo.',
      verbo: 'Cambiar',
      alConfirmar: async () => {
        await generarToken(club.id);
        renderPapeles();
      },
    });
  }
  if (nombre === 'desconectar') {
    confirmarEnHoja({
      titulo: 'Desconectar Google',
      texto: 'Se borra el token y todo el estado de papeles y pagos que mandó el script. Los archivos de Drive no se tocan. Para volver a conectar hay que generar un token nuevo.',
      verbo: 'Desconectar',
      alConfirmar: async () => {
        try {
          await desconectarGoogle(club.id);
        } catch (e) {
          toast(mensajeAlGuardar(e, { reglas: REGLAS_CONEXION, generico: 'No se pudo desconectar. Probá de nuevo.' }));
          throw e;
        }
        toast('Listo: Google quedó desconectado.');
        renderPapeles();
      },
    });
  }
}

function alTocar(e) {
  const acc = e.target.closest('[data-accion]')?.dataset.accion;
  if (acc) {
    accion(acc);
    return;
  }
  const fila = e.target.closest('[data-fila]');
  if (fila) {
    const id = fila.dataset.fila;
    if (abiertos.has(id)) abiertos.delete(id);
    else abiertos.add(id);
    pintar();
    return;
  }
  const filtro = e.target.closest('[data-filtro]')?.dataset.filtro;
  if (!filtro) return;
  if (filtro.startsWith('cat:')) filtros.categoria = filtro.slice(4) || null;
  else filtros[filtro] = !filtros[filtro];
  pintar();
}

export async function renderPapeles() {
  const club = obtenerClubActual();
  if (!club) return;
  destino().innerHTML = '<div class="pad"><div class="p" role="status">Cargando…</div></div>';
  try {
    const [chicos, conexion, catalogo] = await Promise.all([
      obtenerEstadoInscripcion(club.id),
      obtenerConexionGoogle(club.id),
      // Los nombres de categoría son un adorno: si falla, se muestran los códigos.
      obtenerCatalogoDeCategorias().catch(() => []),
    ]);
    datos = { chicos, conexion, nombresCategoria: new Map(catalogo.map((c) => [c.codigo, c.nombre])) };
  } catch (e) {
    destino().innerHTML = `${avisoDeError(e, 'No se pudo cargar el estado de papeles y pagos.')}
      <div class="pad"><button class="btn sec" id="btn-reintentar-papeles">Reintentar</button></div>`;
    $('btn-reintentar-papeles').addEventListener('click', () => renderPapeles());
    return;
  }
  // Un chico que ya no está (o un filtro de una categoría que ya no existe) no deja la pantalla vacía.
  filtros = { ...FILTROS_VACIOS };
  destino().onclick = alTocar;
  pintar();
}

/**
 * Para la tarjeta de Panorama: "9 deben algo · 14 sin papeles completos".
 * null si no hay conexión, no hay chicos o algo falla: la tarjeta no aparece
 * y el panorama no se entera.
 */
export async function resumenDePapeles(clubId) {
  try {
    const [chicos, conexion] = await Promise.all([obtenerEstadoInscripcion(clubId), obtenerConexionGoogle(clubId)]);
    if (!conexion.conectado || !conexion.ultimoEnvioEn || !chicos.length) return null;
    return { ...resumenPanorama(chicos, conceptosDe(chicos, conexion.conceptosOrden)), viejo: envioViejo(conexion.ultimoEnvioEn) };
  } catch {
    return null;
  }
}
