import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

const DIAS = [
  { id: 'e-3', fecha: '2026-10-29', hubo: true, filas: [{ jugadorId: 'j-1', estado: 'presente' as const }, { jugadorId: 'j-2', estado: 'ausente' as const }, { jugadorId: 'j-3', estado: 'presente' as const }] },
  { id: 'e-2', fecha: '2026-10-27', hubo: false, filas: [] },
  { id: 'e-1', fecha: '2026-10-22', hubo: true, filas: [] },
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerEntrenamientos: async () => DIAS,
    obtenerJugadoresDelPlantel: async () => [
      { id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: null },
      { id: 'j-2', nombreClave: 'benitez tomas', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: null },
    ],
    ...piso,
  });
}

const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/plantel/asistencia/historial' });

describe('Asistencia: historial', () => {
  it('lista los días con cuántos vinieron de los que se tomaron, o por qué no hay número', async () => {
    abrir();
    const filas = within(await screen.findByRole('list', { name: 'Entrenamientos' })).getAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(filas[0].textContent).toMatch(/29\/10/);
    expect(filas[0].textContent).toContain('2 de 3 presentes');
    expect(filas[1].textContent).toContain('No hubo entrenamiento');
    expect(filas[2].textContent).toContain('Sin tomar');
    expect(screen.getByText('3 días')).toBeTruthy();
  });

  it('tocar un día lo abre para verlo o corregirlo', async () => {
    const u = userEvent.setup();
    const { router } = abrir();
    const filas = within(await screen.findByRole('list', { name: 'Entrenamientos' })).getAllByRole('link');
    await u.click(filas[0]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel/asistencia'));
    expect(router.state.location.search).toBe('?fecha=2026-10-29');
  });

  it('el día pedido llega a la toma con lo que se había guardado', async () => {
    const u = userEvent.setup();
    abrir();
    await u.click(within(await screen.findByRole('list', { name: 'Entrenamientos' })).getAllByRole('link')[0]);
    const lista = await screen.findByRole('list', { name: 'Jugadores' });
    expect(lista).toBeTruthy();
    expect((screen.getByLabelText('Día del entrenamiento') as HTMLInputElement).value).toBe('2026-10-29');
  });

  it('sin días explica y ofrece tomar asistencia', async () => {
    const u = userEvent.setup();
    const { router } = abrir(repo({ obtenerEntrenamientos: async () => [] }));
    expect(await screen.findByText('Todavía no hay asistencia')).toBeTruthy();
    await u.click(screen.getByRole('link', { name: 'Tomar asistencia' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel/asistencia'));
  });

  it('un solo día se cuenta en singular', async () => {
    abrir(repo({ obtenerEntrenamientos: async () => [DIAS[0]] }));
    expect(await screen.findByText('1 día')).toBeTruthy();
  });

  it('la planilla para el área se baja todavía en la app anterior', async () => {
    abrir();
    expect((await screen.findByRole('link', { name: 'Bajar planilla' })).getAttribute('href')).toBe('/app/clasica?desde=nueva');
  });

  it('muestra la carga y, si falla, ofrece reintentar', async () => {
    const u = userEvent.setup();
    const obtenerEntrenamientos = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(DIAS);
    abrir(repo({ obtenerEntrenamientos }));
    expect(screen.getByRole('status')).toBeTruthy();
    await u.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('list', { name: 'Entrenamientos' })).toBeTruthy();
  });

  it('la coordinación sola no ve la asistencia de cada chico', async () => {
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }) }));
    expect(await screen.findByText('Esto lo ve el cuerpo técnico')).toBeTruthy();
  });
});

describe('Asistencia: el plantel lleva a las dos pantallas', () => {
  it('«Tomar asistencia» e «Historial de asistencia» salen del plantel', async () => {
    const u = userEvent.setup();
    const { router } = renderConDatos(rutas, { repo: repo({ obtenerJugadoresDelPlantel: async () => [] }), ruta: '/plantel' });
    expect((await screen.findByRole('link', { name: /Tomar asistencia/ })).getAttribute('href')).toBe('/plantel/asistencia');
    await u.click(screen.getByRole('link', { name: 'Historial de asistencia' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel/asistencia/historial'));
  });
});
