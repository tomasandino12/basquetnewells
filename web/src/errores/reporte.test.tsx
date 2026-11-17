import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AvisoDeFalla, PantallaRota, iniciarReporteDeErrores } from './reporte';

describe('Errores que nadie atrapó', () => {
  it('avisa una vez y guarda el registro depurado, con un tope por carga', () => {
    const guardar = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AvisoDeFalla />);
    iniciarReporteDeErrores(guardar);
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { error: new Error('falló con ana@ejemplo.test y 20301234') }));
    });
    expect(screen.getByRole('alert').textContent).toContain('Algo falló. Si se repite, contale al coordinador.');
    expect(guardar).toHaveBeenCalledTimes(1);
    const { mensaje, pantalla } = guardar.mock.calls[0][0];
    expect(mensaje).not.toContain('ana@ejemplo.test');
    expect(mensaje).not.toContain('20301234');
    expect(pantalla.length).toBeGreaterThan(0);
    // Sigue anotando hasta el tope (10), no más.
    act(() => {
      for (let i = 0; i < 20; i++) window.dispatchEvent(new ErrorEvent('error', { error: new Error('otra') }));
    });
    expect(guardar).toHaveBeenCalledTimes(10);
    vi.restoreAllMocks();
  });

  it('una pantalla que se rompe al dibujarse no queda en blanco: lo dice y deja recargar', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Rota = () => {
      throw new Error('boom');
    };
    render(<PantallaRota><Rota /></PantallaRota>);
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy();
    vi.restoreAllMocks();
  });
});
