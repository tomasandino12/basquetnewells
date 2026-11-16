import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { Repositorio } from '../datos/repositorio';
import { bateria } from '../hoy/datosDePrueba';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerSesionesDeMedicion: async () => [{ id: 's-1', fecha: '2026-10-06', tipo: 'tiro' }],
    obtenerMedicionesTiroDelPlantel: async () => bateria('s-1', { frontal: 4, esq_izq: 8 }),
    obtenerMetasDelPlantel: async () => ({ frontal: 40 }),
    ...piso,
  });
}

const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/metas' });
const campo = (zona: string) => screen.findByRole('textbox', { name: `Meta de ${zona} en porcentaje` });

describe('Metas: ver y editar', () => {
  it('muestra una fila por zona, con la meta puesta y el porcentaje de hoy, sin proponer ningún número', async () => {
    abrir();
    expect(((await campo('Frontal')) as HTMLInputElement).value).toBe('40');
    expect(((await campo('Esquina izquierda')) as HTMLInputElement).value).toBe('');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(6);
    // Tres chicos inventados tiran 10 por zona: 4 de 10 cada uno es 12/30.
    expect(screen.getByText(/Hoy: 40% · 12\/30/)).toBeTruthy();
    expect(screen.getByText(/Hoy: 80% · 24\/30/)).toBeTruthy();
  });

  it('una zona sin batería dice «sin medir»', async () => {
    abrir(repo({ obtenerSesionesDeMedicion: async () => [], obtenerMedicionesTiroDelPlantel: async () => [] }));
    await campo('Frontal');
    expect(screen.getAllByText('Hoy: sin medir').length).toBeGreaterThanOrEqual(6);
  });

  it('guarda todo junto: lo escrito va como número y el campo vacío va como null (sacar la meta)', async () => {
    const u = userEvent.setup();
    const guardar = vi.fn(async () => ({}));
    const { router } = abrir(repo({ guardarMetasPlantel: guardar }));
    const frontal = await campo('Frontal');
    await u.clear(frontal);
    await u.type(await campo('Esquina izquierda'), '55');
    await u.click(screen.getByRole('button', { name: 'Guardar las metas' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    const pedido = (guardar.mock.calls[0] as unknown as [{ clubId: string; plantelId: string; metas: { zona: string; objetivoPct: number | null }[] }])[0];
    expect(pedido.clubId).toBe('c-1');
    expect(pedido.plantelId).toBe('p-1');
    expect(pedido.metas).toHaveLength(6);
    expect(pedido.metas.find((m) => m.zona === 'frontal')?.objetivoPct).toBeNull();
    expect(pedido.metas.find((m) => m.zona === 'esq_izq')?.objetivoPct).toBe(55);
    await waitFor(() => expect(router.state.location.pathname).toBe('/hoy'));
  });

  it.each(['abc', '101', '-3', '1e2'])('rechaza «%s», lo dice en la zona y no guarda nada', async (texto) => {
    const u = userEvent.setup();
    const guardar = vi.fn(async () => ({}));
    abrir(repo({ guardarMetasPlantel: guardar }));
    const frontal = await campo('Frontal');
    await u.clear(frontal);
    await u.type(frontal, texto);
    await u.click(screen.getByRole('button', { name: 'Guardar las metas' }));
    expect(await screen.findByText(/Tiene que (ser un número|estar entre 0 y 100)/)).toBeTruthy();
    expect(guardar).not.toHaveBeenCalled();
  });

  it('si la base rechaza el guardado, lo cuenta y se queda en la pantalla', async () => {
    const u = userEvent.setup();
    const { router } = abrir(repo({ guardarMetasPlantel: async () => { throw new Error('boom'); } }));
    await campo('Frontal');
    await u.click(screen.getByRole('button', { name: 'Guardar las metas' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/metas');
  });

  it('«Cancelar» vuelve a Hoy sin guardar', async () => {
    const u = userEvent.setup();
    const guardar = vi.fn(async () => ({}));
    const { router } = abrir(repo({ guardarMetasPlantel: guardar }));
    await campo('Frontal');
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(router.state.location.pathname).toBe('/hoy');
    expect(guardar).not.toHaveBeenCalled();
  });

  it('la coordinación sola no ve las metas para editar: son del cuerpo técnico', async () => {
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }) }));
    expect(await screen.findByText('Esto lo ve el cuerpo técnico')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar las metas' })).toBeNull();
  });

  it('si no cargan las metas, lo dice', async () => {
    abrir(repo({ obtenerMetasDelPlantel: async () => { throw new Error('x'); } }));
    expect(await screen.findByText('No se pudieron cargar las metas.')).toBeTruthy();
  });
});
