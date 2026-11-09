import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

describe('rutas con datos', () => {
  it('muestra la carga y después los planteles del club, ordenados', async () => {
    renderConDatos(rutas);
    expect(screen.getByRole('status')).toBeTruthy();
    const lista = await screen.findByRole('list', { name: 'Planteles' });
    expect(within(lista).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Sub 13', 'Sub 15']);
    expect(screen.getByText('Club de Ejemplo')).toBeTruthy();
  });

  it('el entrenador ve sólo sus planteles asignados: con uno solo entra directo', async () => {
    const repo = repositorioInventado({
      obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
      obtenerMisPlantelesAsignados: async () => new Set(['p-2']),
    });
    renderConDatos(rutas, { repo });
    expect(await screen.findByRole('heading', { level: 1, name: 'Sub 15' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Planteles' })).toBeNull();
  });

  it('sin sesión manda a /entrar', async () => {
    const repo = repositorioInventado({ obtenerSesionActual: async () => null });
    renderConDatos(rutas, { repo });
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
  });

  it('entrar con email y clave abre la lista', async () => {
    let abierta = false;
    const repo = repositorioInventado({
      obtenerSesionActual: async () => (abierta ? { user: { id: 'u-1' } } : null),
      iniciarSesion: async () => {
        abierta = true;
        return { user: { id: 'u-1' } };
      },
    });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo });
    await u.type(await screen.findByLabelText('Email'), 'profe@ejemplo.test');
    await u.type(screen.getByLabelText('Clave'), 'una-clave');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('list', { name: 'Planteles' })).toBeTruthy();
  });

  it('con error de red dice «sin conexión» y reintentar vuelve a pedir', async () => {
    let intentos = 0;
    const repo = repositorioInventado({
      obtenerPlantelesDelClub: async () => {
        intentos += 1;
        // Falla los dos primeros pedidos (el original y el segundo intento automático).
        if (intentos <= 2) throw new TypeError('Failed to fetch');
        return [{ id: 'p-1', categoria: 'Sub 13', categoriaCodigo: null, codigoCabb: null, temporadaId: null }];
      },
    });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo });
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('Sin conexión');
    await u.click(screen.getByRole('button', { name: /Reintentar/ }));
    // Una sola categoría: entra directo al plantel.
    // (El repositorio de prueba sólo coordina: el plantel le dice que los chicos los ve el cuerpo técnico.)
    expect(await screen.findByRole('heading', { name: /cuerpo técnico/ })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Planteles' })).toBeNull();
  });

  it('un error de permiso no se reintenta solo y no muestra el texto crudo de la base', async () => {
    let intentos = 0;
    const repo = repositorioInventado({
      obtenerPlantelesDelClub: async () => {
        intentos += 1;
        throw Object.assign(new Error('permission denied for table plantel'), { code: '42501' });
      },
    });
    renderConDatos(rutas, { repo });
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('No pudimos cargar los planteles');
    expect(aviso.textContent).not.toMatch(/permission denied|plantel_/);
    expect(intentos).toBe(1);
  });

  it('al salir, los datos del club se sueltan de la memoria', async () => {
    let aviso: ((evento: string, sesion: null) => void) | undefined;
    const repo = repositorioInventado({
      alCambiarAuth: (fn) => {
        aviso = fn as typeof aviso;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    });
    const { container } = renderConDatos(rutas, { repo });
    await screen.findByRole('list', { name: 'Planteles' });
    await waitFor(() => expect(aviso).toBeDefined());
    aviso!('SIGNED_OUT', null);
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(container.textContent).not.toContain('Sub 13');
  });
});
