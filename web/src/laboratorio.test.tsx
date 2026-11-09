import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { desmarcarSesionCerrada } from './datos/errores';
import { renderConDatos, repositorioInventado } from './datos/renderDePrueba';
import { EJEMPLOS, enlacesDelMenu } from './laboratorio';
import { rutas } from './rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
});

const caminos = (lista: RouteObject[]): string[] =>
  lista.flatMap((r) => [...(r.path ? [r.path] : []), ...caminos(r.children ?? [])]);

describe('menú de la app', () => {
  it('cada pantalla que se abre directo está en el menú o en los ejemplos', () => {
    const directas = caminos(rutas).filter((c) => c !== '*' && c !== '/entrar' && !c.includes(':'));
    const alcanzables = [...enlacesDelMenu(undefined).map((e) => e.a), ...EJEMPLOS.map((e) => e.a)];
    expect([...alcanzables].sort()).toEqual([...directas].sort());
  });

  it('con un plantel elegido lleva a Hoy, Plantel, Asistencia y Físico de ese plantel', () => {
    expect(enlacesDelMenu('p1').map((e) => e.a)).toEqual(['/', '/hoy/p1', '/plantel/p1', '/asistencia/p1', '/fisico/p1']);
  });

  it('los ejemplos no van en el menú: van aparte y lo dicen', async () => {
    renderConDatos(rutas, { ruta: '/piezas' });
    const menu = screen.getAllByRole('navigation', { name: 'Menú de la app' })[0];
    expect(within(menu).queryByRole('link', { name: /Piezas/ })).toBeNull();
    const ejemplos = screen.getByRole('navigation', { name: 'Pantallas de ejemplo' });
    expect(within(ejemplos).getByRole('link', { name: /Piezas/ }).getAttribute('aria-current')).toBe('page');
  });

  it('también está en Entrar, así se llega a las pantallas de ejemplo sin cuenta', async () => {
    renderConDatos(rutas, { repo: repositorioInventado({ obtenerSesionActual: async () => null }) });
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(screen.getAllByRole('navigation', { name: 'Menú de la app' }).length).toBeGreaterThan(0);
  });

  it('el botón de tema cambia toda la app y lo recuerda', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, { ruta: '/piezas' });
    await u.click(screen.getAllByRole('button', { name: 'Pasar al tema oscuro' })[0]);
    expect(document.documentElement.dataset.tema).toBe('oscuro');
    expect(localStorage.getItem('semillero.tema')).toBe('oscuro');
    await u.click(screen.getAllByRole('button', { name: 'Pasar al tema claro' })[0]);
    expect(document.documentElement.dataset.tema).toBe('claro');
  });
});
