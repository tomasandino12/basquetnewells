import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../../datos/errores';
import { renderConDatos, repositorioInventado } from '../../datos/renderDePrueba';
import type { Repositorio } from '../../datos/repositorio';
import { rutas } from '../../rutas';

function simular() {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: true,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.unstubAllGlobals();
});

// Nombres inventados: nunca datos de chicos reales.
const JUGADORES = [{ id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: '2013-03-02' }];
const SOLICITUD = { id: 's-1', nombre: 'Ruiz, Nahuel', fechaNacimiento: '2013-05-04', creadoEn: '2026-11-10T12:00:00Z', emailEnmascarado: 'n***@ejemplo.com' };

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    obtenerSolicitudesDelPlantel: async () => [SOLICITUD],
    ...piso,
  });
}

const abrir = (r: Repositorio) => renderConDatos(rutas, { repo: r, ruta: '/plantel' });

describe('Plantel: pedidos de entrada y altas', () => {
  it('«Revisar los pedidos» abre la lista con el nombre y la fecha de cada pedido', async () => {
    simular();
    const u = userEvent.setup();
    abrir(repo());
    await u.click(await screen.findByRole('button', { name: 'Revisar los pedidos' }));
    const lista = await screen.findByRole('list', { name: 'Pedidos pendientes' });
    expect(lista.textContent).toContain('Ruiz, Nahuel');
    expect(lista.textContent).toContain('Pidió el');
  });

  it('el detalle pide el código y no deja crear la ficha sin él', async () => {
    simular();
    const u = userEvent.setup();
    const aprobarSolicitud = vi.fn(async () => ({}));
    abrir(repo({ aprobarSolicitud } as Partial<Repositorio>));
    await u.click(await screen.findByRole('button', { name: 'Revisar los pedidos' }));
    await u.click(await screen.findByRole('button', { name: /Ruiz, Nahuel/ }));
    await u.click(screen.getByRole('button', { name: 'Crear la ficha y darle acceso' }));
    expect(await screen.findByText(/Pedile el código al chico/)).toBeTruthy();
    expect(aprobarSolicitud).not.toHaveBeenCalled();
  });

  it('el detalle ofrece vincular con una ficha que ya está en la categoría y rechazar', async () => {
    simular();
    const u = userEvent.setup();
    abrir(repo());
    await u.click(await screen.findByRole('button', { name: 'Revisar los pedidos' }));
    await u.click(await screen.findByRole('button', { name: /Ruiz, Nahuel/ }));
    expect(screen.getByRole('button', { name: /Acosta, Bruno/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeTruthy();
  });

  it('sin pedidos pendientes la hoja lo dice', async () => {
    simular();
    const u = userEvent.setup();
    abrir(repo({ obtenerSolicitudesDelPlantel: async () => [] }));
    await u.click(await screen.findByRole('button', { name: 'Pidieron entrar' }));
    expect(await screen.findByText('No hay pedidos pendientes.')).toBeTruthy();
  });

  it('«Agregar a mano» abre el alta y pide un nombre', async () => {
    simular();
    const u = userEvent.setup();
    abrir(repo({ obtenerSolicitudesDelPlantel: async () => [] }));
    await u.click(await screen.findByRole('button', { name: 'Agregar a mano' }));
    await u.click(await screen.findByRole('button', { name: /Agregar|Guardar/ }));
    expect(await screen.findByText('Escribí un nombre.')).toBeTruthy();
  });

  it('«Datos de emergencia» abre la hoja de sólo lectura de la categoría', async () => {
    simular();
    const u = userEvent.setup();
    abrir(repo({ obtenerSolicitudesDelPlantel: async () => [] }));
    await u.click(await screen.findByRole('button', { name: 'Datos de emergencia' }));
    expect((await screen.findAllByText(/Emergencias · Sub 13/)).length).toBeGreaterThan(0);
  });
});
