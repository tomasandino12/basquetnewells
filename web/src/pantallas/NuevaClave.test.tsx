import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { esVueltaDeRecuperacion, soltarRecuperacion } from '../cuenta/recuperacion';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  soltarRecuperacion();
  desmarcarSesionCerrada();
  localStorage.clear();
  sessionStorage.clear();
});

/** Un repositorio que deja disparar los avisos de sesión a mano, como hace Supabase al volver de un mail. */
function conAvisos(piso: Partial<Repositorio> = {}) {
  let aviso: Parameters<Repositorio['alCambiarAuth']>[0] | null = null;
  const repo = repositorioInventado({
    alCambiarAuth: (fn) => {
      aviso = fn;
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    ...piso,
  });
  return {
    repo,
    // El aviso se engancha cuando carga el repositorio: se espera a que esté antes de dispararlo.
    avisar: async (evento: string) => {
      await vi.waitFor(() => expect(aviso).not.toBeNull());
      await act(async () => aviso!(evento, { user: { id: 'u-1' } }));
    },
  };
}

describe('Nueva clave', () => {
  it('quien vuelve del mail de recuperación no pasa a la app hasta elegir la clave', async () => {
    const cambiarClave = vi.fn(async () => {});
    const { repo, avisar } = conAvisos({ cambiarClave });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    await avisar('PASSWORD_RECOVERY');
    expect(await screen.findByRole('heading', { name: 'Nueva clave' })).toBeTruthy();

    await u.type(screen.getByLabelText('Clave nueva'), 'clave-larga-1');
    await u.type(screen.getByLabelText('Repetí la clave'), 'clave-larga-1');
    await u.click(screen.getByRole('button', { name: 'Guardar la clave' }));
    expect(cambiarClave).toHaveBeenCalledWith('clave-larga-1');
    // Con la clave cambiada, la puerta se abre y deja de mandarlo a elegirla.
    expect(screen.queryByRole('heading', { name: 'Nueva clave' })).toBeNull();
  });

  it('claves distintas o cortas no llegan a la base', async () => {
    const cambiarClave = vi.fn(async () => {});
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: repositorioInventado({ cambiarClave }), ruta: '/nueva-clave' });
    await u.type(await screen.findByLabelText('Clave nueva'), 'clave-larga-1');
    await u.type(screen.getByLabelText('Repetí la clave'), 'otra-clave-22');
    await u.click(screen.getByRole('button', { name: 'Guardar la clave' }));
    expect(await screen.findByText('Las dos contraseñas no coinciden.')).toBeTruthy();

    await u.clear(screen.getByLabelText('Clave nueva'));
    await u.clear(screen.getByLabelText('Repetí la clave'));
    await u.type(screen.getByLabelText('Clave nueva'), 'corta');
    await u.type(screen.getByLabelText('Repetí la clave'), 'corta');
    await u.click(screen.getByRole('button', { name: 'Guardar la clave' }));
    expect(await screen.findByText(/al menos 8 caracteres/)).toBeTruthy();
    expect(cambiarClave).not.toHaveBeenCalled();
  });

  it('un fallo del servidor no muestra su texto técnico', async () => {
    const cambiarClave = async () => {
      throw new Error('New password should be different from the old password.');
    };
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: repositorioInventado({ cambiarClave }), ruta: '/nueva-clave' });
    await u.type(await screen.findByLabelText('Clave nueva'), 'clave-larga-1');
    await u.type(screen.getByLabelText('Repetí la clave'), 'clave-larga-1');
    await u.click(screen.getByRole('button', { name: 'Guardar la clave' }));
    expect(await screen.findByText(/No se pudo cambiar la clave/)).toBeTruthy();
    expect(screen.queryByText(/should be different/)).toBeNull();
  });

  it('sin sesión (link vencido) lo dice y lleva a entrar', async () => {
    renderConDatos(rutas, { repo: repositorioInventado({ obtenerSesionActual: async () => null }), ruta: '/nueva-clave' });
    expect(await screen.findByText('El link ya no sirve')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir a entrar' })).toBeTruthy();
  });

  it('reconoce la vuelta de recuperación en el hash y en la búsqueda, y no otras', () => {
    expect(esVueltaDeRecuperacion('', '#access_token=x&type=recovery')).toBe(true);
    expect(esVueltaDeRecuperacion('?type=recovery', '')).toBe(true);
    expect(esVueltaDeRecuperacion('', '#access_token=x&type=signup')).toBe(false);
    expect(esVueltaDeRecuperacion('', '')).toBe(false);
  });
});
