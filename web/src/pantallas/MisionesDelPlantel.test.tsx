import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { PreviaDelPlantel, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

// Nombres inventados: nunca datos de chicos reales.
const JUGADORES = [{ id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: null }];
const previa = (id: string, fecha: string, extra: Partial<PreviaDelPlantel> = {}): PreviaDelPlantel => ({
  id, fecha, rival: 'Rival de Ejemplo', plantelId: 'p-1', partidoId: null, evaluada: false, ...extra,
});
const partido = (id: string, fecha: string) => ({ id, fecha, rivalNombre: 'Rival de Ejemplo' });

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    ...piso,
  });
}

const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/plantel' });
/** El bloque pasa de «cargando» a su contenido: se espera a que termine. */
const bloque = async () => {
  await screen.findByRole('list', { name: 'Jugadores del plantel' });
  return within(await screen.findByRole('region', { name: 'Misiones del partido' }));
};

describe('Plantel: misiones del partido', () => {
  it('sin previas invita a armar las misiones, sin lista de anteriores', async () => {
    abrir();
    const m = await bloque();
    const armar = await m.findByRole('link', { name: /Armá las misiones del próximo partido/ });
    expect(armar.getAttribute('href')).toBe('/misiones/armar');
    expect(m.queryByRole('link', { name: 'Armar otras misiones' })).toBeNull();
    expect(m.queryByText('Anteriores')).toBeNull();
  });

  it('con misiones armadas y sin partido cargado, se espera el partido y se pueden corregir', async () => {
    abrir(repo({ obtenerPreviasDelPlantel: async () => [previa('pr-1', '2026-11-20')] }));
    const m = await bloque();
    const tarjeta = await m.findByRole('link', { name: /Misiones armadas/ });
    expect(tarjeta.getAttribute('href')).toBe('/misiones/pr-1/armar');
    expect(tarjeta.textContent).toContain('Cuando cargues el partido, las evaluás desde acá.');
    expect(m.getByRole('link', { name: 'Armar otras misiones' }).getAttribute('href')).toBe('/misiones/armar');
    const anteriores = within(m.getByRole('region', { name: 'Misiones anteriores' }));
    expect(anteriores.getByText('Esperando el partido')).toBeTruthy();
    expect(anteriores.getByRole('link').getAttribute('href')).toBe('/misiones/pr-1/armar');
  });

  it('con el partido cargado, lo que toca es evaluar', async () => {
    abrir(repo({
      obtenerPreviasDelPlantel: async () => [previa('pr-1', '2026-11-20')],
      obtenerPartidosDelPlantel: async () => [partido('pa-1', '2026-11-20')],
    }));
    const m = await bloque();
    const tarjeta = await m.findByRole('link', { name: /Evaluá cómo salió/ });
    expect(tarjeta.getAttribute('href')).toBe('/misiones/pr-1');
    const anteriores = within(m.getByRole('region', { name: 'Misiones anteriores' }));
    expect(anteriores.getByText('Falta evaluar')).toBeTruthy();
    expect(anteriores.getByRole('link').getAttribute('href')).toBe('/misiones/pr-1');
  });

  it('una previa ya evaluada cierra el ciclo: vuelve a invitar a armar y queda en la lista', async () => {
    abrir(repo({ obtenerPreviasDelPlantel: async () => [previa('pr-1', '2026-11-20', { evaluada: true })] }));
    const m = await bloque();
    expect(await m.findByRole('link', { name: /Armá las misiones del próximo partido/ })).toBeTruthy();
    expect(within(m.getByRole('region', { name: 'Misiones anteriores' })).getByText('Evaluadas')).toBeTruthy();
  });

  it('lista las anteriores de la más nueva a la más vieja', async () => {
    abrir(repo({
      obtenerPreviasDelPlantel: async () => [
        previa('pr-1', '2026-10-01', { rival: 'Primero', evaluada: true, partidoId: 'pa-1' }),
        previa('pr-2', '2026-11-20', { rival: 'Último' }),
        previa('pr-3', '2026-10-15', { rival: 'Medio', evaluada: true, partidoId: 'pa-3' }),
      ],
    }));
    const m = await bloque();
    const filas = within(await m.findByRole('region', { name: 'Misiones anteriores' })).getAllByRole('link');
    expect(filas.map((f) => f.getAttribute('href'))).toEqual(['/misiones/pr-2/armar', '/misiones/pr-3', '/misiones/pr-1']);
  });

  it('si las misiones no cargan lo dice acá y el resto del plantel sigue', async () => {
    abrir(repo({ obtenerPreviasDelPlantel: async () => { throw new Error('x'); } }));
    const m = await bloque();
    expect(await m.findByText('No se pudieron cargar las misiones')).toBeTruthy();
    expect(m.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Jugadores del plantel' })).toBeTruthy();
  });
});
