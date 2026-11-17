import { afterEach, describe, expect, it, vi } from 'vitest';
import { destinoDeAuth } from '@datos/entradaAuth.js';
import { direccionSinError, fallaDeLaVuelta, reiniciarFallaDeLaVuelta, registrarFallaDeLaVuelta } from './vuelta';

afterEach(() => {
  reiniciarFallaDeLaVuelta();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Vuelta de mails y de Google: falla', () => {
  it('un link vencido se explica y manda a pedir otro', () => {
    const t = fallaDeLaVuelta('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(t).toMatch(/venció o ya se usó/);
  });

  it('el error puede venir en la búsqueda, no sólo en el hash', () => {
    expect(fallaDeLaVuelta('?error=access_denied&error_code=otp_expired', '')).toMatch(/venció/);
  });

  it('cualquier otro error dice que entre con mail y clave, sin repetir el texto del servidor', () => {
    const t = fallaDeLaVuelta('?error=server_error&error_description=Database+error+saving+new+user', '');
    expect(t).toMatch(/Entrá con tu mail y tu clave/);
    expect(t).not.toMatch(/Database/);
  });

  it('una vuelta que salió bien no tiene falla', () => {
    expect(fallaDeLaVuelta('', '#access_token=abc&refresh_token=def&type=signup')).toBeNull();
    expect(fallaDeLaVuelta('?code=abc', '')).toBeNull();
    expect(fallaDeLaVuelta('', '')).toBeNull();
  });

  it('al limpiar saca el error y deja lo demás', () => {
    expect(direccionSinError('?error=x&error_code=y&ir=hoy', '#error_description=z')).toEqual({ search: '?ir=hoy', hash: '' });
  });

  it('registrarla deja la dirección limpia (recargar no repite el aviso)', () => {
    window.history.replaceState(null, '', '/nueva/#error=access_denied&error_code=otp_expired');
    registrarFallaDeLaVuelta();
    expect(window.location.hash).toBe('');
  });
});

describe('Vuelta de mails y de Google: no pasa por la app de siempre', () => {
  const VUELTAS = [
    ['confirmar la cuenta', '', '#access_token=a&refresh_token=b&type=signup'],
    ['Google', '', '#access_token=a&refresh_token=b&provider_token=c'],
    ['Google con código', '?code=abc', ''],
    ['nueva clave', '', '#access_token=a&refresh_token=b&type=recovery'],
    ['link vencido', '', '#error=access_denied&error_code=otp_expired'],
  ] as const;

  for (const [nombre, search, hash] of VUELTAS) {
    it(`la vuelta de ${nombre} la resuelve esta app, con el interruptor prendido o apagado`, async () => {
      expect(destinoDeAuth(search, hash)).not.toBeNull();
      for (const apagada of [false, true]) {
        vi.resetModules();
        vi.stubEnv('PROD', true);
        const replace = vi.fn();
        vi.stubGlobal('location', { pathname: '/app', search, hash, replace });
        if (apagada) localStorage.setItem('semillero.nueva', 'no');
        const { reenviarSiCorresponde } = await import('../clasica');
        expect(reenviarSiCorresponde()).toBe(false);
        expect(replace).not.toHaveBeenCalled();
        localStorage.clear();
      }
    });
  }

  it('control: sin vuelta y con el interruptor apagado, sí abre la de siempre (los dobles de prueba funcionan)', async () => {
    vi.stubEnv('PROD', true);
    const replace = vi.fn();
    vi.stubGlobal('location', { pathname: '/app', search: '', hash: '', replace });
    localStorage.setItem('semillero.nueva', 'no');
    const { reenviarSiCorresponde } = await import('../clasica');
    expect(reenviarSiCorresponde()).toBe(true);
    expect(replace).toHaveBeenCalledOnce();
    localStorage.clear();
  });
});
