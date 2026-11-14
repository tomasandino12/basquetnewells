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

  it('guardar dice si se pudo recordar; si no, el cambio vale mientras la pestaña esté abierta', () => {
    expect(guardarTema('claro')).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('modo privado');
    });
    expect(guardarTema('oscuro')).toBe(false);
    expect(leerTema()).toBe('oscuro');
    vi.restoreAllMocks();
    // Con el teléfono otra vez de acuerdo, lo guardado manda de nuevo.
    expect(guardarTema('claro')).toBe(true);
    expect(leerTema()).toBe('claro');
  });

  it('se aplica en <html>, así lo heredan las hojas que se dibujan en <body>', () => {
    aplicarTema('oscuro');
    expect(document.documentElement.dataset.tema).toBe('oscuro');
  });
});
