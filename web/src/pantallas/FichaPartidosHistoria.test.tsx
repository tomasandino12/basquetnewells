import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.unstubAllGlobals();
});

// Nombres inventados: nunca datos de chicos reales.
function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => [{ id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: '2013-03-02' }],
    obtenerPartidosDelPlantel: async () => [
      { id: 'pa-1', fecha: '2026-10-03', rivalNombre: 'Rival Uno' },
      { id: 'pa-2', fecha: '2026-10-17', rivalNombre: null },
    ],
    obtenerEstadisticasDelPlantel: async () => [
      { partidoId: 'pa-1', jugadorId: 'j-1', minSegundos: 1200, pts: 8, dosAnotados: 3, dosIntentados: 5, tresAnotados: 0, tresIntentados: 0, libresAnotados: null, libresIntentados: null },
      { partidoId: 'pa-2', jugadorId: 'j-1', minSegundos: null, pts: null, dosAnotados: null, dosIntentados: null, tresAnotados: 1, tresIntentados: 12, libresAnotados: 2, libresIntentados: 2 },
    ],
    ...piso,
  });
}

async function abrirPestana(nombre: string, r: Repositorio = repo()) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  renderConDatos(rutas, { repo: r, ruta: '/plantel/bruno-acosta' });
  await userEvent.click(await screen.findByRole('tab', { name: nombre }));
}

describe('Ficha: pestaña Partidos', () => {
  it('lista los partidos del más nuevo al más viejo, con «sin dato» donde no se pudo leer (no 0)', async () => {
    await abrirPestana('Partidos');
    const lista = await screen.findByRole('region', { name: 'Partido a partido' });
    const items = lista.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Rival sin nombre');
    expect(items[0].textContent).toContain('sin dato');
    expect(items[1].textContent).toContain('Rival Uno');
    expect(items[1].textContent).toContain('20′');
    expect(items[1].textContent).toContain('8 pts');
    expect(items[1].textContent).toContain('60% · 3/5');
    expect(screen.getByRole('tabpanel').querySelector('a')).toBeNull();
  });

  it('sin partidos ni misiones lo dice, sin mandar a ningún lado', async () => {
    await abrirPestana('Partidos', repo({ obtenerEstadisticasDelPlantel: async () => [] }));
    expect(await screen.findByText('Todavía no jugó ningún partido cargado.')).toBeTruthy();
    expect(screen.getByText('Todavía no tuvo misiones.')).toBeTruthy();
    expect(screen.getByRole('tabpanel').querySelector('a')).toBeNull();
  });

  it('muestra las misiones con su estado y, si no se pueden leer, el partido a partido sigue', async () => {
    await abrirPestana('Partidos', repo({
      obtenerMisionesDelJugador: async () => ({
        misiones: [{ id: 'm-1', previaId: 'pr-1', jugadorId: 'j-1', orden: 1, metrica: null, valor: null, texto: 'Hablar más en defensa', estado: 'logrado', comentario: 'Muy bien' }],
        previas: [{ id: 'pr-1', fecha: '2026-10-03', rival: 'Rival Uno', partidoId: 'pa-1' }],
      }),
    }));
    expect(await screen.findByText('Hablar más en defensa')).toBeTruthy();
    expect(screen.getByText(/Logrado/)).toBeTruthy();
    expect(screen.getByText('Muy bien')).toBeTruthy();
    cleanup();
    await abrirPestana('Partidos', repo({ obtenerMisionesDelJugador: async () => { throw new Error('x'); } }));
    expect(await screen.findByRole('region', { name: 'Partido a partido' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Misiones' })).toBeNull();
  });
});

describe('Ficha: pestaña Historia', () => {
  it('lista los recursos enviados y sólo enlaza direcciones web', async () => {
    await abrirPestana('Historia', repo({
      obtenerEnviosDeJugador: async () => [
        { fecha: '2026-10-05', recursoId: 'r-1', titulo: 'Tiro en movimiento', enlace: 'https://ejemplo.test/v' },
        { fecha: '2026-10-01', recursoId: 'r-2', titulo: 'Otro', enlace: 'javascript:alert(1)' },
      ],
    }));
    const link = await screen.findByRole('link', { name: 'Tiro en movimiento' });
    expect(link.getAttribute('href')).toBe('https://ejemplo.test/v');
    expect(screen.getByText('Otro').closest('a')).toBeNull();
  });

  it('sin envíos lo dice', async () => {
    await abrirPestana('Historia');
    expect(await screen.findByText('Todavía no se le mandó ningún recurso.')).toBeTruthy();
  });
});
