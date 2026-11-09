import { afterEach, describe, expect, it, vi } from 'vitest';
import { aplicarTema, guardarTema, leerTema } from './tema';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.tema;
});

describe('tema', () => {
  it('sin nada guardado es claro', () => {
    expect(leerTema()).toBe('claro');
  });

  it('usa la misma clave que la app vieja, así la preferencia pasa de /app a /nueva', () => {
    localStorage.setItem('semillero.tema', 'oscuro');
    expect(leerTema()).toBe('oscuro');
    guardarTema('claro');
    expect(localStorage.getItem('semillero.tema')).toBeNull();
    guardarTema('oscuro');
    expect(leerTema()).toBe('oscuro');
  });

  it('si el teléfono no deja leer ni guardar, queda claro y no rompe', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('modo privado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('modo privado');
    });
    expect(leerTema()).toBe('claro');
    expect(() => guardarTema('oscuro')).not.toThrow();
  });

  it('se aplica en <html>, así lo heredan las hojas que se dibujan en <body>', () => {
    aplicarTema('oscuro');
    expect(document.documentElement.dataset.tema).toBe('oscuro');
  });
});
