import { html } from './html.js';
import { $ } from './dom.js';
import { formulariosPublicos } from '../data/repositorio.js';
import { PORTAL, enlaceContacto } from '../data/portal.js';
import { resolverConsultas } from '../data/formulariosPortal.js';
import { destinoDeAuth } from '../data/entradaAuth.js';

/*
 * /consultas: la dirección fija del QR impreso ("Escaneá y venite a jugar al
 * básquet"). Busca el formulario de consultas vigente (el que la coordinación
 * marcó con ese destino) y lleva ahí; así el QR de la pared no vence aunque se
 * cambie el formulario. Sin sesión: lo único que lee es formularios_publicos.
 */

/** Qué se ve en cada caso. Los tres dejan una salida: el formulario, el portal o el contacto. */
export function htmlConsultas(r, contacto = null) {
  if (r.estado === 'redirigir') {
    return html`<div class="portal-tarjeta">
      <div class="t">Te llevamos al formulario de consultas…</div>
      <div class="d">Si no se abre solo en unos segundos, tocá el botón.</div>
      <a class="btn" href="${r.url}">Abrir el formulario de consultas</a>
    </div>`;
  }
  const portal = html`<a class="btn sec" href="/">Ir a la página del básquet</a>`;
  if (r.estado === 'sin-formulario') {
    const url = enlaceContacto(contacto);
    return html`<div class="portal-tarjeta">
      <div class="t">Por ahora no hay un formulario de consultas abierto</div>
      <div class="d">Si querés sumarte al básquet, escribile al coordinador o mirá la página del club.</div>
      ${url && html`<a class="btn" href="${url}" target="_blank" rel="noopener">Escribirle al coordinador</a>`}
      ${portal}
    </div>`;
  }
  return html`<div class="portal-tarjeta">
    <div class="t">No pudimos abrir el formulario</div>
    <div class="d">Probá de nuevo en un rato. Si sigue sin andar, entrá a la página del básquet.</div>
    <button type="button" class="btn" id="consultas-reintentar">Probar de nuevo</button>
    ${portal}
  </div>`;
}

export async function iniciarConsultas() {
  // Si la URL es la vuelta de un login, portalEntrada.js ya está mandando a /app:
  // acá no se consulta nada (el cliente de Supabase canjearía el código).
  if (destinoDeAuth(window.location.search, window.location.hash)) return;

  const r = await resolverConsultas(() => formulariosPublicos(PORTAL.clubId));
  $('consultas-estado').innerHTML = htmlConsultas(r, PORTAL.contacto);
  if (r.estado === 'redirigir') window.location.replace(r.url);
  $('consultas-reintentar')?.addEventListener('click', () => window.location.reload());
}
