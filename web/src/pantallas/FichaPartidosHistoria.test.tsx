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

describe('Ficha: historia por temporada', () => {
  const HISTORIA = {
    temporadas: [{ id: 't-1', nombre: '2025' }, { id: 't-2', nombre: '2026' }],
    planteles: [
      { id: 'p-a', categoria: 'Sub 12', temporadaId: 't-1', profes: ['Profe Uno'] },
      { id: 'p-b', categoria: 'Sub 13', temporadaId: 't-2', profes: [] },
    ],
    pertenencias: [
      { plantelId: 'p-a', temporadaId: 't-1', desde: '2025-03-01', hasta: '2025-12-15' },
      { plantelId: 'p-b', temporadaId: 't-2', desde: '2026-03-01', hasta: null },
    ],
    partidos: [{ plantelId: 'p-a', pts: 6, minSegundos: 600, dosAnotados: 3, dosIntentados: 6, tresAnotados: null, tresIntentados: null, libresAnotados: null, libresIntentados: null }],
    corporales: [{ fechaMedicion: '2025-11-10', alturaCm: 150, pesoKg: 41.5 }],
  };

  it('muestra una tarjeta por temporada, la actual marcada, y «cómo llega» con lo último anterior', async () => {
    await abrirPestana('Historia', repo({ obtenerHistoriaDelJugador: async () => HISTORIA }));
    const region = await screen.findByRole('region', { name: 'Historia por temporada' });
    expect(region.textContent).toContain('Cómo llega a Sub 13');
    expect(region.textContent).toContain('2026 · Sub 13');
    expect(region.textContent).toContain('Temporada actual');
    expect(region.textContent).toContain('2025 · Sub 12');
    expect(region.textContent).toContain('Profes: Profe Uno');
    expect(region.textContent).toContain('1 partido');
    expect(region.textContent).toContain('150 cm');
  });

  it('sin temporadas lo dice; si falla, el resto de la pestaña se ve igual', async () => {
    await abrirPestana('Historia');
    expect(await screen.findByText('Todavía no hay temporadas anteriores cargadas.')).toBeTruthy();
    cleanup();
    await abrirPestana('Historia', repo({ obtenerHistoriaDelJugador: async () => { throw new Error('x'); } }));
    expect(await screen.findByRole('region', { name: 'Recursos enviados' })).toBeTruthy();
    expect(screen.getByText(/No pudimos cargar la historia por temporada/)).toBeTruthy();
  });
});

describe('Ficha: pestaña Físico y fecha de nacimiento', () => {
  it('la pestaña Físico muestra lo último medido de la temporada actual, sin mandar a la app anterior', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    renderConDatos(rutas, {
      repo: repo({
        obtenerHistoriaDelJugador: async () => ({
          temporadas: [{ id: 't-2', nombre: '2026' }],
          planteles: [{ id: 'p-b', categoria: 'Sub 13', temporadaId: 't-2', profes: [] }],
          pertenencias: [{ plantelId: 'p-b', temporadaId: 't-2', desde: '2026-03-01', hasta: null }],
          corporales: [{ fechaMedicion: '2026-10-10', alturaCm: 158, pesoKg: 47.5 }],
        }),
      }),
      ruta: '/plantel/bruno-acosta',
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Físico' }));
    const region = await screen.findByRole('region', { name: 'Últimas mediciones' });
    expect(region.textContent).toContain('158 cm');
    expect(region.textContent).toContain('47,5 kg');
    expect(screen.getByRole('tabpanel').querySelector('a')).toBeNull();
  });

  it('se edita la fecha de nacimiento desde la ficha, y una futura se rechaza sin guardar', async () => {
    const guardado: unknown[] = [];
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    renderConDatos(rutas, {
      repo: repo({ actualizarFechaNacimiento: async (_c, j, f) => { guardado.push([j, f]); } }),
      ruta: '/plantel/bruno-acosta',
    });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Editar fecha de nacimiento' }));
    await screen.findByRole('dialog');
    const campo = document.querySelector('input[type=date]') as HTMLInputElement;
    await u.clear(campo);
    await u.type(campo, '2999-01-01');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/no puede ser futura/)).toBeTruthy();
    expect(guardado).toEqual([]);
    await u.clear(campo);
    await u.type(campo, '2013-04-05');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(guardado).toEqual([['j-1', '2013-04-05']]));
  });
});
