import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../../datos/errores';
import { renderConDatos, repositorioInventado } from '../../datos/renderDePrueba';
import type { Repositorio } from '../../datos/repositorio';
import { ajustesDePrueba } from '../../guia/vista';
import { rutas } from '../../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
  ajustesDePrueba.sinGuias = true;
});

// Nombres inventados: nunca datos de chicos reales.
const familia = (piso: Partial<Repositorio> = {}) =>
  repositorioInventado({
    obtenerClubesDelEntrenador: async () => [],
    obtenerMiFicha: async () => null,
    obtenerMisChicos: async () => [{ vinculoId: 'v-1', nombre: 'Lola Ejemplo', clubNombre: 'Club de Ejemplo', categorias: 'Sub 13' }],
    ...piso,
  });

describe('Portal de familias', () => {
  it('una cuenta que sólo es familia entra a su portal: ve a sus hijos, con su categoría y el club', async () => {
    renderConDatos(rutas, { repo: familia(), ruta: '/' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Tus chicos' })).toBeTruthy();
    const lista = await screen.findByRole('list', { name: 'Tus chicos' });
    expect(lista.textContent).toContain('Lola Ejemplo');
    expect(lista.textContent).toContain('Sub 13 · Club de Ejemplo');
    // Sin menú de profe: el portal sólo muestra a sus hijos.
    expect(screen.queryByRole('navigation', { name: 'Menú de la app' })).toBeNull();
  });

  it('sin hijos vinculados explica cómo anotarlos y deja volver a mirar', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: familia({ obtenerMisChicos: async () => [] }), ruta: '/familia' });
    expect(await screen.findByText('Todavía no encontramos a tu hijo')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Cómo anotar a tu hijo' }).textContent).toContain('formulario de inscripción');
    await u.click(screen.getByRole('button', { name: 'Volver a mirar' }));
    expect(await screen.findByText('Todavía no encontramos a tu hijo')).toBeTruthy();
  });

  it('con error dice qué pasó y deja reintentar', async () => {
    renderConDatos(rutas, { repo: familia({ obtenerMisChicos: async () => { throw new Error('x'); } }), ruta: '/familia' });
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('la intro de primer uso sale una vez, con sus pasos, y se marca vista al saltarla', async () => {
    ajustesDePrueba.sinGuias = false;
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: familia(), ruta: '/familia' });
    expect(await screen.findByRole('heading', { name: 'Qué es esto' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('heading', { name: 'Si no ves a tu hijo' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.queryByRole('heading', { name: 'Si no ves a tu hijo' })).toBeNull();
    expect(localStorage.getItem('guia.v1.u-1.familia')).toBe('{"version":1}');
    cleanup();
    renderConDatos(rutas, { repo: familia(), ruta: '/familia' });
    await screen.findByRole('heading', { level: 1, name: 'Tus chicos' });
    expect(screen.queryByRole('heading', { name: 'Qué es esto' })).toBeNull();
  });
});

describe('Entrada por rol', () => {
  it('quien sólo coordina arranca en el panorama del club', async () => {
    const { router } = renderConDatos(rutas, { repo: repositorioInventado({ obtenerMiFicha: async () => null, obtenerMisChicos: async () => [] }), ruta: '/' });
    await screen.findAllByText(/./);
    await import('@testing-library/react').then(({ waitFor }) => waitFor(() => expect(router.state.location.pathname).toBe('/coordinacion')));
  });
});
