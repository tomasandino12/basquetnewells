import { obtenerEmergenciasDelPlantel } from '../../data/repositorio.js';
import { enlaceTelefono, etiquetasDeAlertas } from '../../data/emergencias.js';
import { linkCarpetaEnDrive } from '../../data/enlacesGoogle.js';
import { abrirHoja } from '../componentes/hoja.js';
import { html } from '../html.js';
import { avisoInline, textoDeError } from '../errores.js';
import { $ } from '../dom.js';

/**
 * Datos de emergencia: lo que el profe necesita a mano si un chico se golpea
 * o se siente mal. Es salud de menores, así que:
 * - se pide a la base cada vez que se abre y vive sólo en esta hoja: nada va
 *   a localStorage ni a la caché, y al cerrar se vacía el contenido;
 * - quién lo puede ver lo decide la base (profe del plantel y coordinador).
 * Spec: docs/superpowers/specs/2026-10-19-datos-conectados-design.md §3.
 */

const vaciar = () => { $('hoja').innerHTML = ''; };

function telefonoHtml(texto) {
  if (!texto) return html`<span class="det">sin cargar</span>`;
  const tel = enlaceTelefono(texto);
  return tel ? html`<a href="${tel}">${texto}</a>` : html`${texto}`;
}

function dato(titulo, valor) {
  return valor ? html`<div class="det"><b>${titulo}:</b> ${valor}</div>` : '';
}

function fichaHtml(e) {
  if (!e.cargado) {
    return html`
      <div class="profe">
        <div class="nom">${e.nombreLimpio}</div>
        <div class="det"><span class="chip sin">sin datos cargados</span></div>
      </div>`;
  }
  const alertas = etiquetasDeAlertas(e.alertas);
  return html`
    <div class="profe">
      <div class="nom">${e.nombreLimpio}</div>
      ${alertas.length ? html`<div>${alertas.map((a) => html`<span class="chip baja">${a}</span> `)}</div>` : ''}
      <div class="det"><b>Adulto:</b> ${telefonoHtml(e.telefonoAdulto)}</div>
      <div class="det"><b>Urgencia:</b> ${telefonoHtml(e.contactoUrgencia)}</div>
      ${dato('Alergias', e.alergias)}
      ${dato('Medicación', e.medicacion)}
      ${dato('Indicación médica', e.indicacion)}
      ${dato('Obra social', e.obraSocial)}
    </div>`;
}

/**
 * Abre la hoja con los datos de emergencia de `plantel` ({ id, categoria }).
 * Con `jugadorId` muestra sólo a ese chico (acceso rápido desde su ficha); si
 * no, la lista del plantel con los que tienen alertas primero.
 * `nombreParaDrive` (opcional): arma "Ver ficha completa en Google".
 */
export async function abrirEmergencias({ plantel, jugadorId = null }) {
  abrirHoja({
    titulo: jugadorId ? 'Datos de emergencia' : `Emergencias · ${plantel.categoria}`,
    cuerpo: '<div class="p" role="status">Cargando…</div>',
    alCerrar: vaciar,
  });
  let lista;
  try {
    lista = await obtenerEmergenciasDelPlantel(plantel.id);
  } catch (e) {
    $('hoja').querySelector('.pad').innerHTML = avisoInline(textoDeError(e, 'No se pudieron cargar los datos de emergencia.'));
    return;
  }
  if (jugadorId) lista = lista.filter((e) => e.jugadorId === jugadorId);
  else lista = [...lista].sort((a, b) => (b.alertas.length > 0) - (a.alertas.length > 0));

  const drive = jugadorId && lista[0] ? linkCarpetaEnDrive(lista[0].nombreLimpio) : null;
  const cuerpo = html`
    ${lista.length ? lista.map(fichaHtml) : html`<div class="p">No hay chicos en este plantel.</div>`}
    ${drive ? html`
      <p class="det">La ficha completa está en la carpeta del club en Google. Se abre sólo si tu cuenta tiene acceso.</p>
      <a class="btn sec" href="${drive}" target="_blank" rel="noopener noreferrer">Ver ficha completa en Google</a>` : ''}
    <p class="det">Estos datos son sólo para cuidar al chico. No se guardan en tu celular: si cerrás esta pantalla, se vuelven a pedir.</p>`;
  $('hoja').querySelector('.pad').innerHTML = cuerpo;
}
