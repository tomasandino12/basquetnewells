import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { RecursoDelClub, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

// Todo inventado: títulos, links y conteos. Nunca datos de chicos reales.
const recurso = (id: string, extra: Partial<RecursoDelClub> = {}): RecursoDelClub => ({
  id, titulo: id, descripcion: 'Dos series de diez', enlace: null, tipo: null, frecuenciaSemanal: null, minutos: null,
  creadoPor: 'u-x', creadoEn: '2026-10-05T10:00:00Z', envios: [], ...extra,
});

const RECURSOS = [
  recurso('Tiro en movimiento', {
    enlace: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    tipo: 'tiro',
    frecuenciaSemanal: 3,
    minutos: 20,
    envios: [{ jugadorId: 'j-1', fecha: '2026-10-06' }, { jugadorId: 'j-2', fecha: '2026-10-07' }],
  }),
  recurso('Pauta de elongación', { enlace: 'https://ejemplo.test/pauta.pdf', tipo: 'fisico' }),
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerRecursos: async () => RECURSOS,
    obtenerJugadoresDelPlantel: async () => [
      { id: 'j-1', nombreClave: 'a', nombreLimpio: 'Jugador Uno', fechaNacimiento: null },
      { id: 'j-2', nombreClave: 'b', nombreLimpio: 'Jugador Dos', fechaNacimiento: null },
      { id: 'j-3', nombreClave: 'c', nombreLimpio: 'Jugador Tres', fechaNacimiento: null },
    ],
    obtenerResumenRecursos: async () => ({
      conCuenta: 9,
      abrieronAlguno: 6,
      recursos: [{ recursoId: 'Tiro en movimiento', enviados: 2, conCuenta: 9, abrieron: 6, primerasEsteMes: 2, primerasMesAnterior: 1 }],
    }),
    ...piso,
  });
}

async function abrirVideos(r: Repositorio = repo()) {
  const u = userEvent.setup();
  renderConDatos(rutas, { repo: r, ruta: '/recursos' });
  await u.click(await screen.findByRole('tab', { name: 'Videos' }));
  return u;
}

describe('Recursos: videos para jugadores', () => {
  it('la tarjeta muestra miniatura, datos de dedicación, a quién se envió y cuántos lo vieron', async () => {
    await abrirVideos();
    const tarjeta = within((await screen.findByRole('heading', { name: 'Tiro en movimiento' })).closest('article')!);
    expect(tarjeta.getByText('Tiro · 05/10')).toBeTruthy();
    expect(tarjeta.getByText('3 por semana')).toBeTruthy();
    expect(tarjeta.getByText('20 min')).toBeTruthy();
    expect(tarjeta.getByText('Enviado a 2 de 3 (Sub 13)')).toBeTruthy();
    expect(tarjeta.getByText(/Lo vieron/).textContent).toBe('Lo vieron 6 de 9 con cuenta');
    // Dos entradas al mismo video: la miniatura con su play y el botón.
    expect(tarjeta.getAllByRole('button', { name: /Ver video/ })).toHaveLength(2);
    expect(document.querySelector('img[src*="dQw4w9WgXcQ"]')).not.toBeNull();
  });

  it('Ver video abre el reproductor recién al tocar', async () => {
    const u = await abrirVideos();
    expect(document.querySelector('iframe')).toBeNull();
    const tarjeta = within((await screen.findByRole('heading', { name: 'Tiro en movimiento' })).closest('article')!);
    await u.click(tarjeta.getAllByRole('button', { name: /Ver video/ })[0]);
    const marco = await screen.findByTitle('Video: Tiro en movimiento');
    expect(marco.getAttribute('src')).toContain('dQw4w9WgXcQ');
  });

  it('un link que no es video lleva a Material, sin reproductor, y no inventa un porcentaje', async () => {
    await abrirVideos();
    const tarjeta = within((await screen.findByRole('heading', { name: 'Pauta de elongación' })).closest('article')!);
    expect(tarjeta.queryAllByRole('button', { name: /Ver video/ })).toHaveLength(0);
    expect(tarjeta.getByRole('link', { name: /Material/ }).getAttribute('href')).toBe('https://ejemplo.test/pauta.pdf');
    expect(tarjeta.getByText('Todavía no se lo enviaste a nadie de este plantel.')).toBeTruthy();
    expect(tarjeta.queryByText('0%')).toBeNull();
  });

  it('sin recursos lo explica y deja el camino para ofrecer uno', async () => {
    await abrirVideos(repo({ obtenerRecursos: async () => [] }));
    expect(await screen.findByText('Todavía no compartiste ningún recurso')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ofrecer un recurso/ }).getAttribute('href')).toContain('clasica');
  });

  it('si el resumen falla, las tarjetas salen igual y dicen que no se pudo leer', async () => {
    await abrirVideos(repo({ obtenerResumenRecursos: async () => { throw new Error('boom'); } }));
    expect((await screen.findAllByText('No se pudo leer cuántos lo vieron.')).length).toBe(2);
    expect(screen.queryByRole('region', { name: 'Impacto' })).toBeNull();
  });

  it('filtra por tipo', async () => {
    const u = await abrirVideos();
    await screen.findByRole('heading', { name: 'Tiro en movimiento' });
    await u.click(screen.getByRole('button', { name: /Físico/ }));
    expect(screen.queryByRole('heading', { name: 'Tiro en movimiento' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Pauta de elongación' })).toBeTruthy();
  });
});
