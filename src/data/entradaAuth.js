/**
 * Si la URL que abrió el portal es la vuelta de un login o de un mail de
 * Supabase, a dónde mandarla. Lógica pura: recibe `location.search` y
 * `location.hash` y devuelve la ruta de Semillero con los mismos parámetros,
 * o null si no es una vuelta de auth.
 *
 * Existe porque el portal pasó a vivir en "/" y Semillero en "/app": los mails
 * ya enviados (confirmar cuenta, recuperar clave) apuntan a "/". Sin este
 * reenvío, el padre o el profe que toca ese link caería en el portal con la
 * sesión sin abrir.
 *
 * El destino es siempre "/app": lo que venga en la URL (un `next=`, un
 * `redirect_to=`) viaja como parámetro y no cambia a dónde se va.
 */

const DESTINO = '/app';
const TIPOS = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change']);

function parametros(texto) {
  return new URLSearchParams(texto.replace(/^[?#]/, ''));
}

function esVueltaDeAuth(p) {
  return Boolean(p.get('code') || p.get('access_token') || p.get('error') || p.get('error_code') || TIPOS.has(p.get('type')));
}

export function destinoDeAuth(search, hash) {
  if (!esVueltaDeAuth(parametros(search ?? '')) && !esVueltaDeAuth(parametros(hash ?? ''))) return null;
  return `${DESTINO}${search ?? ''}${hash ?? ''}`;
}
