import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { DatosDePizarra, JugadaDelClub, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Todo inventado: nunca datos de chicos reales.
const PIZARRA: DatosDePizarra = {
  cancha: 'media',
  fichas: [
    { id: 'a1', tipo: 'ataque', numero: 1, x: 0.5, y: 0.7 },
    { id: 'a2', tipo: 'ataque', numero: 2, x: 0.3, y: 0.5 },
    { id: 'd1', tipo: 'defensa', numero: 1, x: 0.4, y: 0.4 },
  ],
  pelota: 'a1',
  pasos: [
    { acciones: [{ tipo: 'corte', ficha: 'a2', hasta: { x: 0.7, y: 0.3 }, control: null }], nota: 'Corta al lado fuerte' },
    { acciones: [{ tipo: 'pase', ficha: 'a1', a: 'a2' }], nota: '' },
  ],
};

const JUGADA: JugadaDelClub = { id: 'ju-1', nombre: 'Salida de lateral 1', tipo: 'lateral', datos: PIZARRA, creadoPor: 'u-1', esMia: true, actualizadoEn: '2026-10-01T10:00:00Z' };

type Guardar = (c: string, id: string, d: { nombre: string; tipo: string; datos: DatosDePizarra }) => Promise<void>;
const espiaGuardar = () => vi.fn<Guardar>(async () => {});
const ultimo = (g: ReturnType<typeof espiaGuardar>) => g.mock.calls[0][2];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1', 'p-2']),
    listarJugadas: async () => [JUGADA],
    obtenerJugada: async () => JUGADA,
    ...piso,
  });
}

const abrir = async (r: Repositorio = repo()) => {
  renderConDatos(rutas, { repo: r, ruta: '/recursos/jugadas/ju-1/editar' });
  await screen.findByRole('heading', { name: 'Salida de lateral 1' });
  return userEvent.setup();
};

describe('Editor de jugadas', () => {
  it('abre la jugada con su nombre, tipo, pasos y la cancha', async () => {
    await abrir();
    expect(screen.getByText('Salida de lateral')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Editor de la jugada/ })).toBeTruthy();
    const pasos = within(screen.getByRole('region', { name: 'Pasos' }));
    expect(pasos.getByRole('button', { name: /Corta al lado fuerte/ })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Indicaciones del paso 1/ })).toBeTruthy();
    expect(screen.queryByText('Sin guardar')).toBeNull();
  });

  it('suma una ficha, marca «Sin guardar» y guarda los datos nuevos', async () => {
    const guardarJugada = espiaGuardar();
    const u = await abrir(repo({ guardarJugada }));
    await u.click(screen.getByRole('button', { name: '+ Defensor' }));
    expect(screen.getByText('Sin guardar')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(guardarJugada).toHaveBeenCalledTimes(1));
    expect(guardarJugada.mock.calls[0].slice(0, 2)).toEqual(['c-1', 'ju-1']);
    const cuerpo = ultimo(guardarJugada);
    expect(cuerpo).toMatchObject({ nombre: 'Salida de lateral 1', tipo: 'lateral' });
    expect(cuerpo.datos.fichas).toHaveLength(4);
    expect(cuerpo.datos.fichas[3]).toMatchObject({ tipo: 'defensa', numero: 2 });
    await waitFor(() => expect(screen.queryByText('Sin guardar')).toBeNull());
  });

  it('deshacer y rehacer van y vienen, y deshacer hasta lo guardado limpia el aviso', async () => {
    const u = await abrir();
    await u.click(screen.getByRole('button', { name: '+ Cono' }));
    expect(screen.getByText('Sin guardar')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.queryByText('Sin guardar')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Rehacer' }));
    expect(screen.getByText('Sin guardar')).toBeTruthy();
  });

  it('una acción de dos toques suma el pase en el paso elegido', async () => {
    const guardarJugada = espiaGuardar();
    const u = await abrir(repo({ guardarJugada }));
    await u.click(screen.getByRole('button', { name: 'Nuevo paso' }));
    await u.click(screen.getByRole('button', { name: 'Pase' }));
    const cancha = screen.getByRole('img', { name: /Editor de la jugada/ });
    fireEvent.pointerDown(cancha.querySelector('[data-ficha="a2"]')!);
    fireEvent.pointerDown(cancha.querySelector('[data-ficha="a1"]')!);
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(guardarJugada).toHaveBeenCalled());
    const datos = ultimo(guardarJugada).datos;
    expect(datos.pasos).toHaveLength(3);
    expect(datos.pasos[2].acciones).toEqual([{ tipo: 'pase', ficha: 'a2', a: 'a1' }]);
  });

  it('una regla que no se cumple se lee en pantalla y no cambia nada', async () => {
    const u = await abrir();
    await u.click(screen.getByRole('button', { name: 'Pase' }));
    const cancha = screen.getByRole('img', { name: /Editor de la jugada/ });
    // En el paso 1 la pelota la tiene a1: un pase de a2 no vale.
    fireEvent.pointerDown(cancha.querySelector('[data-ficha="a2"]')!);
    fireEvent.pointerDown(cancha.querySelector('[data-ficha="a1"]')!);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Sin guardar')).toBeNull();
  });

  it('edita las indicaciones del paso y borra un paso', async () => {
    const guardarJugada = espiaGuardar();
    const u = await abrir(repo({ guardarJugada }));
    const nota = screen.getByRole('textbox', { name: /Indicaciones del paso 1/ });
    await u.clear(nota);
    await u.type(nota, 'Todos abren');
    await u.tab();
    expect(within(screen.getByRole('region', { name: 'Pasos' })).getByRole('button', { name: /Todos abren/ })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Borrar este paso' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(guardarJugada).toHaveBeenCalled());
    const datos = ultimo(guardarJugada).datos;
    expect(datos.pasos).toHaveLength(1);
    expect(datos.pasos[0].acciones[0].tipo).toBe('pase');
  });

  it('si no se pudo guardar, lo dice y sigue sin guardar', async () => {
    const u = await abrir(repo({ guardarJugada: async () => { throw new Error('NO_ES_TUYA'); } }));
    await u.click(screen.getByRole('button', { name: '+ Cono' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Esta jugada ya no es tuya: no se puede guardar.')).toBeTruthy();
    expect(screen.getByText('Sin guardar')).toBeTruthy();
  });

  it('con cambios sin guardar, volver pide confirmación; seguir editando se queda y salir se va', async () => {
    const u = await abrir();
    await u.click(screen.getByRole('button', { name: '+ Cono' }));
    await u.click(screen.getByRole('link', { name: /Volver/ }));
    expect(await screen.findByText('Tenés cambios sin guardar. Si salís ahora se pierden.')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Seguir editando' }));
    await waitFor(() => expect(screen.queryByText('Tenés cambios sin guardar. Si salís ahora se pierden.')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Salida de lateral 1' })).toBeTruthy();
    await u.click(screen.getByRole('link', { name: /Volver/ }));
    await u.click(await screen.findByRole('button', { name: 'Salir sin guardar' }));
    expect(await screen.findByRole('tab', { name: 'Jugadas' })).toBeTruthy(); // volvió a Recursos
  });

  it('sin cambios, volver no pregunta nada', async () => {
    const u = await abrir();
    await u.click(screen.getByRole('link', { name: /Volver/ }));
    expect(await screen.findByRole('tab', { name: 'Jugadas' })).toBeTruthy();
  });

  it('renombra con lo ya guardado, sin llevarse los cambios sin guardar', async () => {
    const guardarJugada = espiaGuardar();
    const u = await abrir(repo({ guardarJugada }));
    await u.click(screen.getByRole('button', { name: '+ Cono' }));
    await u.click(screen.getByRole('button', { name: 'Renombrar jugada' }));
    const campo = await screen.findByRole('textbox', { name: 'Nombre' });
    await u.clear(campo);
    await u.type(campo, 'Salida corta');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(guardarJugada).toHaveBeenCalledTimes(1));
    const cuerpo = ultimo(guardarJugada);
    expect(cuerpo.nombre).toBe('Salida corta');
    expect(cuerpo.datos.fichas).toHaveLength(3); // el cono todavía no se guardó
    expect(await screen.findByRole('heading', { name: 'Salida corta' })).toBeTruthy();
    expect(screen.getByText('Sin guardar')).toBeTruthy();
  });

  it('el nombre vacío no se guarda', async () => {
    const guardarJugada = espiaGuardar();
    const u = await abrir(repo({ guardarJugada }));
    await u.click(screen.getByRole('button', { name: 'Renombrar jugada' }));
    await u.clear(await screen.findByRole('textbox', { name: 'Nombre' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Poné un nombre.')).toBeTruthy();
    expect(guardarJugada).not.toHaveBeenCalled();
  });

  it('una jugada de otro profe no se edita', async () => {
    renderConDatos(rutas, { repo: repo({ obtenerJugada: async () => ({ ...JUGADA, esMia: false }) }), ruta: '/recursos/jugadas/ju-1/editar' });
    expect(await screen.findByText(/sólo quien la creó puede editarla/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
  });

  it('en una pantalla chica explica que el editor es para compu o tablet', async () => {
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('innerHeight', 800);
    renderConDatos(rutas, { repo: repo(), ruta: '/recursos/jugadas/ju-1/editar' });
    expect(await screen.findByText(/es para compu o tablet/)).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Editor de la jugada/ })).toBeNull();
  });

  it('una jugada que ya no existe lo dice', async () => {
    renderConDatos(rutas, { repo: repo({ obtenerJugada: async () => null }), ruta: '/recursos/jugadas/ju-1/editar' });
    expect(await screen.findByText('Esta jugada ya no existe.')).toBeTruthy();
  });
});
