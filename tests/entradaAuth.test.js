import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { destinoDeAuth } from '../src/data/entradaAuth.js';

/**
 * Los mails ya enviados (confirmar cuenta, recuperar clave) y las vueltas de
 * Google apuntan a "/", que ahora es el portal. El portal tiene que mandar
 * esos links a /app sin perder ni un parámetro: con ellos Supabase abre la
 * sesión o la pantalla de nueva contraseña.
 */

test('un código de retorno (?code=) va a /app con su query', () => {
  assert.equal(destinoDeAuth('?code=abc123', ''), '/app?code=abc123');
});

test('el hash de recuperación de clave va a /app con su hash', () => {
  const hash = '#access_token=AAA&refresh_token=BBB&type=recovery';
  assert.equal(destinoDeAuth('', hash), `/app${hash}`);
});

test('confirmación de mail, invitación e ingreso por link también van a /app', () => {
  for (const tipo of ['signup', 'invite', 'magiclink', 'email_change', 'recovery']) {
    assert.equal(destinoDeAuth('', `#type=${tipo}`), `/app#type=${tipo}`, tipo);
  }
});

test('un error de retorno también va a /app, así la app lo muestra', () => {
  assert.equal(destinoDeAuth('', '#error=access_denied&error_code=otp_expired'), '/app#error=access_denied&error_code=otp_expired');
  assert.equal(destinoDeAuth('?error=access_denied&error_description=x', ''), '/app?error=access_denied&error_description=x');
});

test('conserva query y hash juntos', () => {
  assert.equal(destinoDeAuth('?code=abc', '#type=recovery'), '/app?code=abc#type=recovery');
});

test('sin parámetros de auth no actúa: anclas, utm y vacío', () => {
  for (const [q, h] of [['', ''], ['', '#formularios'], ['', '#que-hacer'], ['?utm_source=whatsapp', ''], ['?fbclid=1', '#calendario']]) {
    assert.equal(destinoDeAuth(q, h), null, `${q}${h}`);
  }
});

test('un parámetro vacío o con otro valor no cuenta', () => {
  assert.equal(destinoDeAuth('?code=', ''), null);
  assert.equal(destinoDeAuth('', '#type=otra-cosa'), null);
});

test('el destino siempre es /app: nada que venga en la URL cambia el sitio', () => {
  const maliciosos = ['?code=1&next=https://evil.com', '#access_token=1&redirect_to=//evil.com'];
  for (const m of maliciosos) {
    const d = destinoDeAuth(m.startsWith('?') ? m : '', m.startsWith('#') ? m : '');
    assert.ok(d.startsWith('/app?') || d.startsWith('/app#'), d);
  }
});

test('el portal carga el reenvío antes que el resto de sus scripts', () => {
  const pagina = readFileSync('public/portal.html', 'utf8');
  const scripts = [...pagina.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['/public/config.js', '/src/ui/portalEntrada.js', '/src/ui/portalArranque.js']);
});

test('portalEntrada.js sólo reenvía: sin red y sin importar repos', () => {
  const codigo = readFileSync('src/ui/portalEntrada.js', 'utf8');
  assert.match(codigo, /location\.replace\(/);
  assert.doesNotMatch(codigo, /\bfetch\s*\(|repositorio|repos\/|cliente|supabase/);
});
