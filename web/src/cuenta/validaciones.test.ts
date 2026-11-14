import { describe, expect, it } from 'vitest';
import { mensajeDeCreacion, mensajeDeGoogle, validarCuenta } from './validaciones';

const base = { nombre: '  ana   ejemplo ', email: ' ana@ejemplo.test ', clave: 'abcdefgh', repetida: 'abcdefgh' };

describe('validarCuenta', () => {
  it('normaliza el nombre y recorta el mail', () => {
    const r = validarCuenta(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.email).toBe('ana@ejemplo.test');
  });
  it('pide nombre, mail válido y clave de 8 que coincida', () => {
    expect(validarCuenta({ ...base, nombre: '  ' })).toMatchObject({ ok: false, problema: 'Escribí tu nombre y apellido.' });
    expect(validarCuenta({ ...base, email: 'ana@' })).toMatchObject({ ok: false, problema: 'Escribí un mail válido.' });
    expect(validarCuenta({ ...base, clave: 'corta', repetida: 'corta' })).toMatchObject({ ok: false });
    expect(validarCuenta({ ...base, repetida: 'otra-clave' })).toMatchObject({ ok: false, problema: 'Las dos contraseñas no coinciden.' });
  });
});

describe('mensajes de error', () => {
  it('un mail ya registrado no se distingue de uno nuevo', () => {
    expect(mensajeDeCreacion(new Error('User already registered'))).toMatch(/Si ese mail no tenía cuenta/);
  });
  it('Google sin habilitar avisa que entre con mail', () => {
    expect(mensajeDeGoogle(new Error('provider is not enabled'))).toMatch(/todavía no está habilitado/);
  });
});
