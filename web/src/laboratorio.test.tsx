import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { desmarcarSesionCerrada } from './datos/errores';
import { renderConDatos, repositorioInventado } from './datos/renderDePrueba';
import { PANTALLAS } from './laboratorio';
import { rutas } from './rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

const caminos = (lista: RouteObject[]): string[] =>
  lista.flatMap((r) => [...(r.path ? [r.path] : []), ...caminos(r.children ?? [])]);

describe('menú de /nueva', () => {
  it('cada pantalla que se puede abrir directo está en el menú (las con :id se abren desde otra)', () => {
    const directas = caminos(rutas).filter((c) => c !== '*' && c !== '/entrar' && !c.includes(':'));
    expect(PANTALLAS.map((p) => p.a).sort()).toEqual([...directas].sort());
  });

  it('se ve en una pantalla de ejemplo, marca dónde estás y lleva a las otras', async () => {
    renderConDatos(rutas, { ruta: '/piezas' });
    const menu = screen.getByRole('navigation', { name: 'Pantallas de la app nueva' });
    const enlaces = within(menu).getAllByRole('link');
    expect(enlaces.map((e) => e.textContent)).toEqual(['Planteles', 'Piezasejemplo', 'Maqueta del plantelejemplo']);
    expect(within(menu).getByRole('link', { current: 'page' }).textContent).toContain('Piezas');
    await userEvent.click(within(menu).getByRole('link', { name: /Maqueta del plantel/ }));
    expect(within(menu).getByRole('link', { current: 'page' }).textContent).toContain('Maqueta del plantel');
  });

  it('también está en Entrar, así se llega a las pantallas de ejemplo sin cuenta', async () => {
    renderConDatos(rutas, { repo: repositorioInventado({ obtenerSesionActual: async () => null }) });
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Pantallas de la app nueva' })).toBeTruthy();
  });
});
