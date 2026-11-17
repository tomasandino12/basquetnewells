import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { RecursoDelClub, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.restoreAllMocks();
});

// Todo inventado. El usuario de la sesión de prueba es 'u-1'.
const recurso = (id: string, extra: Partial<RecursoDelClub> = {}): RecursoDelClub => ({
  id, titulo: id, descripcion: 'Dos series de diez', enlace: null, tipo: null, frecuenciaSemanal: null, minutos: null,
  creadoPor: 'u-1', creadoEn: '2026-10-05T10:00:00Z', envios: [], ...extra,
});

const PROPIO = recurso('Tiro en movimiento', { envios: [{ jugadorId: 'j-1', fecha: '2026-10-06' }] });
const AJENO = recurso('Pauta ajena', { creadoPor: 'u-2' });

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerRecursos: async () => [PROPIO, AJENO],
    obtenerJugadoresDelPlantel: async () => [
      { id: 'j-1', nombreClave: 'a', nombreLimpio: 'Jugador Uno', fechaNacimiento: null },
      { id: 'j-2', nombreClave: 'b', nombreLimpio: 'Jugador Dos', fechaNacimiento: null },
      { id: 'j-3', nombreClave: 'c', nombreLimpio: 'Jugador Tres', fechaNacimiento: null },
    ],
    ...piso,
  });
}

async function abrirVideos(r: Repositorio = repo(), ruta = '/recursos') {
  const u = userEvent.setup();
  renderConDatos(rutas, { repo: r, ruta });
  if (ruta === '/recursos') await u.click(await screen.findByRole('tab', { name: 'Videos' }));
  return u;
}

const tarjetaDe = async (titulo: string) => within((await screen.findByRole('heading', { name: titulo })).closest('article')!);
const hoja = () => within(screen.getByRole('dialog'));

/** El botón de arriba arranca apagado hasta que carga el plantel. */
async function abrirOfrecer(u: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: 'Tiro en movimiento' });
  const boton = screen.getByRole('button', { name: /Ofrecer un recurso/ });
  await waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(false));
  await u.click(boton);
}

describe('Recursos: ofrecer un recurso', () => {
  it('pide título, instrucciones y al menos un jugador, y manda los textos recortados con un id por formulario', async () => {
    const guardarRecurso = vi.fn(async () => ({}));
    const u = await abrirVideos(repo({ guardarRecurso }));
    await abrirOfrecer(u);

    await u.click(hoja().getByRole('button', { name: 'Registrar el envío' }));
    expect(hoja().getByText('Poné un título y las instrucciones.')).toBeTruthy();

    await u.type(hoja().getByLabelText('Título'), '  Drill de manejo ');
    await u.type(hoja().getByLabelText('Instrucciones'), ' Diez minutos ');
    await u.type(hoja().getByLabelText('Link (opcional)'), ' https://ejemplo.test/video ');
    await u.click(hoja().getByRole('button', { name: 'Registrar el envío' }));
    expect(hoja().getByText('Elegí al menos un jugador.')).toBeTruthy();

    await u.click(hoja().getByRole('button', { name: 'Tiro' }));
    await u.type(hoja().getByLabelText('Veces por semana (opcional)'), '3');
    await u.type(hoja().getByLabelText('Minutos (opcional)'), '20');
    await u.click(hoja().getByLabelText('Jugador Dos'));
    await u.click(hoja().getByRole('button', { name: 'Registrar el envío' }));

    await waitFor(() => expect(guardarRecurso).toHaveBeenCalledTimes(1));
    const payload = (guardarRecurso.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      recursoId: null, titulo: 'Drill de manejo', descripcion: 'Diez minutos', enlace: 'https://ejemplo.test/video',
      tipo: 'tiro', frecuenciaSemanal: 3, minutos: 20, jugadorIds: ['j-2'],
    });
    expect(typeof payload.clubId).toBe('string');
    expect(typeof payload.recursoIdNuevo).toBe('string');
    expect(payload.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText('Enviado a 1 jugador')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('rechaza un link que no es web y un número fuera de rango, sin llamar a la base', async () => {
    const guardarRecurso = vi.fn(async () => ({}));
    const u = await abrirVideos(repo({ guardarRecurso }));
    await abrirOfrecer(u);
    await u.type(hoja().getByLabelText('Título'), 'Algo');
    await u.type(hoja().getByLabelText('Instrucciones'), 'Algo más');
    await u.click(hoja().getByLabelText('Jugador Uno'));
    await u.type(hoja().getByLabelText('Link (opcional)'), 'javascript:alert(1)');
    await u.click(hoja().getByRole('button', { name: 'Registrar el envío' }));
    expect(hoja().getByText('El link tiene que empezar con http:// o https://.')).toBeTruthy();

    await u.clear(hoja().getByLabelText('Link (opcional)'));
    await u.type(hoja().getByLabelText('Minutos (opcional)'), '999');
    await u.click(hoja().getByRole('button', { name: 'Registrar el envío' }));
    expect(hoja().queryByText('El link tiene que empezar con http:// o https://.')).toBeNull();
    expect(hoja().getByText(/Minutos/, { selector: '[role="alert"] *, [role="alert"]' })).toBeTruthy();
    expect(guardarRecurso).not.toHaveBeenCalled();
  });

  it('un reintento tras un error usa el mismo id de recurso nuevo (no duplica)', async () => {
    const guardarRecurso = vi.fn().mockRejectedValueOnce(new Error('falló')).mockResolvedValueOnce({});
    const u = await abrirVideos(repo({ guardarRecurso }));
    await abrirOfrecer(u);
    await u.type(hoja().getByLabelText('Título'), 'Algo');
    await u.type(hoja().getByLabelText('Instrucciones'), 'Algo más');
    await u.click(hoja().getByLabelText('Jugador Uno'));
    await u.click(hoja().getByRole('button', { name: 'Registrar el envío' }));
    await waitFor(() => expect(guardarRecurso).toHaveBeenCalledTimes(1));
    expect(await hoja().findByRole('alert')).toBeTruthy();
    await u.click(hoja().getByRole('button', { name: 'Registrar el envío' }));
    await waitFor(() => expect(guardarRecurso).toHaveBeenCalledTimes(2));
    const [a, b] = guardarRecurso.mock.calls.map((c) => (c as unknown[])[0] as { recursoIdNuevo: string });
    expect(a.recursoIdNuevo).toBe(b.recursoIdNuevo);
  });

  it('«Todo el plantel» tilda a todos', async () => {
    const u = await abrirVideos();
    await abrirOfrecer(u);
    await u.click(hoja().getByRole('button', { name: 'Todo el plantel' }));
    for (const n of ['Uno', 'Dos', 'Tres']) expect((hoja().getByLabelText(`Jugador ${n}`) as HTMLInputElement).checked).toBe(true);
  });

  it('sin jugadores en el plantel lo dice y ofrece ir a Plantel, sin formulario', async () => {
    const u = await abrirVideos(repo({ obtenerJugadoresDelPlantel: async () => [] }));
    await abrirOfrecer(u);
    expect(hoja().getByText(/todavía no tiene jugadores cargados/)).toBeTruthy();
    expect(hoja().getByRole('link', { name: 'Ir a Plantel' }).getAttribute('href')).toBe('/plantel');
    expect(hoja().queryByLabelText('Título')).toBeNull();
  });
});

describe('Recursos: enviar a los que faltan', () => {
  it('ofrece sólo a quienes no lo recibieron, avisa cuántos ya lo tienen y manda el id del recurso', async () => {
    const guardarRecurso = vi.fn(async () => ({}));
    const u = await abrirVideos(repo({ guardarRecurso }));
    const tarjeta = await tarjetaDe('Tiro en movimiento');
    await u.click(tarjeta.getByRole('button', { name: /Enviar a los 2 que faltan/ }));
    expect(hoja().getByText('Ya lo recibió 1 jugador: no aparece en la lista.')).toBeTruthy();
    expect(hoja().queryByLabelText('Jugador Uno')).toBeNull();
    expect(hoja().queryByLabelText('Título')).toBeNull();
    await u.click(hoja().getByRole('button', { name: 'Todos los que faltan' }));
    await u.click(hoja().getByRole('button', { name: 'Registrar el envío' }));
    await waitFor(() => expect(guardarRecurso).toHaveBeenCalledTimes(1));
    expect((guardarRecurso.mock.calls[0] as unknown[])[0]).toMatchObject({
      recursoId: 'Tiro en movimiento', recursoIdNuevo: null, titulo: null, jugadorIds: ['j-2', 'j-3'],
    });
    expect(await screen.findByText('Enviado a 2 jugadores')).toBeTruthy();
  });

  it('con todos servidos el botón queda apagado', async () => {
    const todos = recurso('Para todos', { envios: ['j-1', 'j-2', 'j-3'].map((jugadorId) => ({ jugadorId, fecha: '2026-10-06' })) });
    await abrirVideos(repo({ obtenerRecursos: async () => [todos] }));
    const tarjeta = await tarjetaDe('Para todos');
    expect((tarjeta.getByRole('button', { name: /Ya lo recibieron todos/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Recursos: borrar un recurso', () => {
  it('sólo lo propio ofrece Borrar', async () => {
    await abrirVideos();
    expect((await tarjetaDe('Tiro en movimiento')).getByRole('button', { name: /Borrar/ })).toBeTruthy();
    expect((await tarjetaDe('Pauta ajena')).queryByRole('button', { name: /Borrar/ })).toBeNull();
  });

  it('pide confirmación y recién ahí borra', async () => {
    const borrarRecurso = vi.fn(async () => {});
    const u = await abrirVideos(repo({ borrarRecurso }));
    await u.click((await tarjetaDe('Tiro en movimiento')).getByRole('button', { name: /Borrar/ }));
    expect(hoja().getByRole('button', { name: 'Borrar de todos modos' })).toBeTruthy();
    expect(borrarRecurso).not.toHaveBeenCalled();
    await u.click(hoja().getByRole('button', { name: 'Cancelar' }));
    expect(borrarRecurso).not.toHaveBeenCalled();

    await u.click((await tarjetaDe('Tiro en movimiento')).getByRole('button', { name: /Borrar/ }));
    await u.click(hoja().getByRole('button', { name: 'Borrar de todos modos' }));
    await waitFor(() => expect(borrarRecurso).toHaveBeenCalledTimes(1));
    expect((borrarRecurso.mock.calls[0] as unknown[])[1]).toBe('Tiro en movimiento');
  });

  it('si la base lo rechaza, lo cuenta y la hoja sigue abierta', async () => {
    const borrarRecurso = vi.fn(async () => { throw new Error('NO_ES_TUYO'); });
    const u = await abrirVideos(repo({ borrarRecurso }));
    await u.click((await tarjetaDe('Tiro en movimiento')).getByRole('button', { name: /Borrar/ }));
    await u.click(hoja().getByRole('button', { name: 'Borrar de todos modos' }));
    expect(await hoja().findByText('Este recurso ya no es tuyo: no se puede borrar.')).toBeTruthy();
  });
});

describe('Hoy: mandar un recurso por zona', () => {
  it('la ruta del link abre Recursos en la pestaña Videos, no la app de siempre', async () => {
    await abrirVideos(repo(), '/recursos?pestana=videos');
    expect(await screen.findByRole('heading', { name: 'Tiro en movimiento' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Videos', selected: true })).toBeTruthy();
  });
});
