import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from './datos/errores';
import { renderConDatos, repositorioInventado } from './datos/renderDePrueba';
import { rutas } from './rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
});

// Un entrenador con una categoría asignada: lo de todos los días.
const entrenador = (piso = {}) =>
  repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    ...piso,
  });

describe('rutas con datos', () => {
  it('la entrada lleva a Hoy de la categoría, sin elegir de una lista ni ids en la dirección', async () => {
    const { router } = renderConDatos(rutas, { repo: entrenador() });
    await waitFor(() => expect(router.state.location.pathname).toBe('/hoy'));
    expect(screen.queryByRole('list', { name: 'Planteles' })).toBeNull();
  });

  it('sin sesión manda a /entrar', async () => {
    const repo = repositorioInventado({ obtenerSesionActual: async () => null });
    renderConDatos(rutas, { repo });
    expect(await screen.findByRole('heading', { level: 1, name: /Lo que se trabaja en inferiores/ })).toBeTruthy();
  });

  it('entrar con email y clave vuelve a donde quería ir', async () => {
    let abierta = false;
    const repo = entrenador({
      obtenerSesionActual: async () => (abierta ? { user: { id: 'u-1' } } : null),
      iniciarSesion: async () => {
        abierta = true;
        return { user: { id: 'u-1' } };
      },
    });
    const u = userEvent.setup();
    const { router } = renderConDatos(rutas, { repo, ruta: '/plantel' });
    await u.click(await screen.findByRole('button', { name: 'Ya tengo cuenta' }));
    await u.type(await screen.findByLabelText('Email'), 'profe@ejemplo.test');
    await u.type(screen.getByLabelText('Clave'), 'una-clave');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sub 13' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/plantel');
  });

  it('con error de red dice «sin conexión» y reintentar vuelve a pedir', async () => {
    let intentos = 0;
    const repo = entrenador({
      obtenerPlantelesDelClub: async () => {
        intentos += 1;
        // Falla los dos primeros pedidos (el original y el segundo intento automático).
        if (intentos <= 2) throw new TypeError('Failed to fetch');
        return [{ id: 'p-1', categoria: 'Sub 13', categoriaCodigo: null, codigoCabb: null, temporadaId: null }];
      },
    });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo, ruta: '/plantel' });
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('Sin conexión');
    await u.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sub 13' })).toBeTruthy();
  });

  it('un error de permiso no se reintenta solo y no muestra el texto crudo de la base', async () => {
    let intentos = 0;
    const repo = entrenador({
      obtenerPlantelesDelClub: async () => {
        intentos += 1;
        throw Object.assign(new Error('permission denied for table plantel'), { code: '42501' });
      },
    });
    renderConDatos(rutas, { repo, ruta: '/plantel' });
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('No pudimos cargar tu categoría');
    expect(aviso.textContent).not.toMatch(/permission denied|plantel_/);
    expect(intentos).toBe(1);
  });

  it('«Salir» está en el menú y al salir los datos del club se sueltan de la memoria', async () => {
    let aviso: ((evento: string, sesion: null) => void) | undefined;
    const repo = entrenador({
      alCambiarAuth: (fn: unknown) => {
        aviso = fn as typeof aviso;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    });
    const { container } = renderConDatos(rutas, { repo, ruta: '/plantel' });
    await screen.findByRole('heading', { level: 1, name: 'Sub 13' });
    expect(screen.getAllByRole('button', { name: 'Salir' }).length).toBeGreaterThan(0);
    await waitFor(() => expect(aviso).toBeDefined());
    aviso!('SIGNED_OUT', null);
    expect(await screen.findByRole('heading', { level: 1, name: /Lo que se trabaja en inferiores/ })).toBeTruthy();
    expect(container.textContent).not.toContain('Sub 13');
  });
});
