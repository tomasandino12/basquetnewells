import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { Repositorio } from '../datos/repositorio';
import { claveBorrador, leerBorrador } from '../medir/sesiones';
import { rutas } from '../rutas';
import { guardarBorrador } from '../../../src/ui/borradorMedicion.js';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
});

const SESIONES = [
  { id: 's-1', fecha: '2026-10-01', tipo: 'tiro' },
  { id: 's-2', fecha: '2026-10-20', tipo: 'tiro' },
  { id: 's-3', fecha: '2026-09-15', tipo: 'salto' },
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerSesionesDeMedicion: async () => SESIONES,
    ...piso,
  });
}
const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/medir' });

describe('Medir', () => {
  it('muestra una franja por test, con cuántas sesiones hay y la última, y lleva a la app de siempre', async () => {
    abrir();
    // Los tests están desde el principio; lo de las sesiones llega cuando carga la lista.
    await screen.findByText(/2 sesiones · última 20\/10\/26/);
    const tests = within(screen.getByRole('region', { name: 'Tests' }));
    const links = tests.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links[0].textContent).toContain('Batería de tiro');
    expect(links[0].textContent).toContain('2 sesiones · última 20/10/26');
    expect(links[1].textContent).toContain('1 sesión · última 15/09/26');
    expect(links[2].textContent).toContain('Sin mediciones todavía');
    expect(links[3].textContent).toContain('Yo-Yo');
    // Cada botón lleva a SU test en la app de siempre, no a la portada.
    expect(links.map((l) => l.getAttribute('href')?.split('ir=')[1])).toEqual(['tiro', 'salto', 'sprint', 'yoyo']);
    expect(links[0].getAttribute('href')).toContain('clasica');
  });

  it('lista las sesiones cargadas, la más nueva primero', async () => {
    abrir();
    const lista = within(await screen.findByRole('region', { name: 'Sesiones cargadas' }));
    const filas = (await lista.findAllByRole('listitem')).map((f) => f.textContent);
    expect(filas).toEqual(['Batería de tiro20/10/26', 'Batería de tiro01/10/26', 'Salto15/09/26']);
  });

  it('sin sesiones explica cómo se empieza, pero los tests siguen a mano', async () => {
    abrir(repo({ obtenerSesionesDeMedicion: async () => [] }));
    expect(await screen.findByText('Todavía no hay mediciones')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Tests' })).getAllByRole('link')).toHaveLength(4);
  });

  it('si no se pueden cargar las sesiones lo dice y deja reintentar', async () => {
    abrir(repo({ obtenerSesionesDeMedicion: async () => { throw new Error('Failed to fetch'); } }));
    expect(await screen.findByRole('button', { name: /Reintentar/ })).toBeTruthy();
    // Aunque las sesiones no carguen, se puede medir.
    expect(within(screen.getByRole('region', { name: 'Tests' })).getAllByRole('link')).toHaveLength(4);
  });

  it('la coordinación sola no entra: los datos son del cuerpo técnico', async () => {
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }) }));
    expect(await screen.findByText('Esto lo ve el cuerpo técnico')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Tests' })).toBeNull();
  });

  it('una sesión sin terminar aparece con cuántos jugadores y se descarta con confirmación', async () => {
    const u = userEvent.setup();
    // El usuario de la sesión inventada es u-1; el club c-1; el plantel p-1.
    const clave = claveBorrador('u-1', 'c-1', 'p-1', 'tiro');
    guardarBorrador(clave, { fecha: '2026-11-05', valores: { a: { anotados: 3 }, b: { ausente: true }, c: {} } });
    // Un borrador de otra categoría no se muestra.
    guardarBorrador(claveBorrador('u-1', 'c-1', 'p-2', 'salto'), { fecha: '2026-11-05', valores: {} });
    abrir();

    const aviso = within(await screen.findByRole('region', { name: 'Sesiones sin terminar' }));
    expect(aviso.getByText(/Batería de tiro del 05\/11\/26 · 2 jugadores cargados/)).toBeTruthy();
    expect(aviso.getAllByRole('status')).toHaveLength(1);

    await u.click(aviso.getByRole('button', { name: /Descartar/ }));
    expect(await screen.findByText(/Se pierde los 2 jugadores cargados en batería de tiro/)).toBeTruthy();
    expect(leerBorrador(clave)).not.toBeNull();

    await u.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Sesiones sin terminar' })).toBeNull());
    expect(leerBorrador(clave)).toBeNull();
  });

  it('cancelar no borra la sesión sin terminar', async () => {
    const u = userEvent.setup();
    const clave = claveBorrador('u-1', 'c-1', 'p-1', 'yoyo');
    guardarBorrador(clave, { fecha: '2026-11-05', valores: { a: { nivel: 4 } } });
    abrir();
    await u.click(await screen.findByRole('button', { name: /Descartar/ }));
    await u.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(leerBorrador(clave)).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Sesiones sin terminar' })).toBeTruthy();
  });

  it('el menú tiene Medir', async () => {
    abrir();
    await screen.findByRole('region', { name: 'Tests' });
    expect(screen.getAllByRole('link', { name: /Medir/ }).some((l) => l.getAttribute('href') === '/medir')).toBe(true);
  });
});
