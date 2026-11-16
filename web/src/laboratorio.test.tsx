import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RouteObject } from 'react-router';
import { desmarcarSesionCerrada } from './datos/errores';
import { renderConDatos, repositorioInventado } from './datos/renderDePrueba';
import { EJEMPLOS, ENLACES_DEL_MENU } from './laboratorio';
import { DESTINOS_DEL_JUGADOR } from './pantallas/jugador/MarcoJugador';
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
    // La asistencia se toma desde el plantel (no tiene ítem propio) y las direcciones viejas sólo redirigen.
    // La vista del jugador tiene su propio marco: sus destinos se controlan en la prueba de abajo.
    const directas = caminos(rutas).filter(
      (c) =>
        // Las metas cuelgan de Hoy y el inventario en lectura y cargar el plan, de Físico. Armar misiones cuelga de Plantel y de Hoy; Mi perfil se abre desde la cabecera (iniciales del nombre).
        !['*', '/', '/entrar', '/nueva-clave', '/asistencia', '/asistencia/historial', '/plantel/asistencia', '/plantel/asistencia/historial', '/datos/cargar-partido', '/misiones/armar', '/perfil', '/metas', '/fisico/inventario', '/fisico/cargar-plan'].includes(c) &&
        !c.includes(':') &&
        !c.startsWith('/jugador') &&
        // Los cuatro tests se abren desde Medir.
        !c.startsWith('/medir/') &&
        // Temporada, rubros y formularios se abren desde Profes, Finanzas y Familias (la barra de /coordinacion).
        !c.startsWith('/coordinacion/'),
    );
    const alcanzables = [...ENLACES_DEL_MENU.map((e) => e.a), ...EJEMPLOS.map((e) => e.a)];
    expect([...alcanzables].sort()).toEqual([...directas].sort());
  });

  it('cada pantalla de la vista del jugador está en su barra de abajo (y la barra no lleva rutas que no existen)', () => {
    const delJugador = caminos(rutas).filter((c) => c.startsWith('/jugador') && c !== '/jugador' && !c.includes(':'));
    expect(DESTINOS_DEL_JUGADOR.map((d) => d.a).sort()).toEqual([...delJugador].sort());
    // La de misiones es del profe: no va en la barra del jugador.
    expect(DESTINOS_DEL_JUGADOR.some((d) => d.a.includes('misiones'))).toBe(false);
  });

  it('lleva a Hoy, Plantel, Físico, Medir, Recursos, Datos y Coordinación sin ids en la dirección; la asistencia se toma desde Plantel y el partido se carga desde Datos', () => {
    expect(ENLACES_DEL_MENU.map((e) => e.a)).toEqual(['/hoy', '/plantel', '/fisico', '/medir', '/recursos', '/datos', '/coordinacion']);
  });

  it('Coordinación sólo aparece en el menú para quien coordina', async () => {
    const { unmount } = renderConDatos(rutas, { ruta: '/piezas' });
    const menu = screen.getAllByRole('navigation', { name: 'Menú de la app' })[0];
    expect(await within(menu).findByRole('link', { name: 'Coordinación' })).toBeTruthy();
    unmount();
    renderConDatos(rutas, { repo: repositorioInventado({ obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }) }), ruta: '/piezas' });
    await screen.findAllByRole('link', { name: 'Hoy' });
    expect(screen.queryByRole('link', { name: 'Coordinación' })).toBeNull();
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
