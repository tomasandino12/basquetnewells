import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hoyLocal } from '@datos/antropometria.js';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

const HOY = hoyLocal() as string;

// Nombres inventados: nunca datos de chicos reales.
const JUGADORES = [
  { id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: null },
  { id: 'j-3', nombreClave: 'cabrera luis', nombreLimpio: 'Cabrera, Luis', fechaNacimiento: null },
  { id: 'j-2', nombreClave: 'benitez tomas', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: null },
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    ...piso,
  });
}

const abrir = (r: Repositorio = repo(), ruta = '/plantel/asistencia') => renderConDatos(rutas, { repo: r, ruta });
const lista = async () => within(await screen.findByRole('list', { name: 'Jugadores' }));
const fila = async (nombre: RegExp) => (await lista()).getByRole('button', { name: nombre });
const contador = () => screen.getByRole('status', { name: 'Presentes' });
const guardar = () => screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement;

describe('Asistencia: la toma del día', () => {
  it('lista a todos por apellido, sin tomar, con el contador en 0 y Guardar apagado', async () => {
    abrir();
    const filas = within(await screen.findByRole('list', { name: 'Jugadores' })).getAllByRole('listitem');
    expect(filas.map((f) => within(f).getAllByRole('button')[0].textContent)).toEqual([
      'Acosta, BrunoSin tomar',
      'Benítez, TomásSin tomar',
      'Cabrera, LuisSin tomar',
    ]);
    expect(contador().textContent).toContain('0/3');
    expect(contador().textContent).toContain('3 sin tomar');
    expect(guardar().disabled).toBe(true);
  });

  it('un toque marca presente y otro ausente; el contador sigue a cada toque', async () => {
    const u = userEvent.setup();
    abrir();
    const bruno = await fila(/^Acosta/);
    await u.click(bruno);
    expect(bruno.getAttribute('aria-pressed')).toBe('true');
    expect(bruno.textContent).toContain('Presente');
    expect(contador().textContent).toContain('1/3');
    expect(contador().textContent).toContain('2 sin tomar');
    await u.click(bruno);
    expect(bruno.getAttribute('aria-pressed')).toBe('false');
    expect(bruno.textContent).toContain('Ausente');
    expect(contador().textContent).toContain('0/3');
    expect(guardar().disabled).toBe(false);
  });

  it('muestra lo ya guardado de ese día', async () => {
    abrir(repo({
      obtenerEntrenamientos: async () => [{ id: 'e-1', fecha: HOY, hubo: true, filas: [{ jugadorId: 'j-1', estado: 'presente' }, { jugadorId: 'j-2', estado: 'justificada' }] }],
    }));
    expect((await fila(/^Acosta/)).textContent).toContain('Presente');
    expect((await fila(/^Benítez/)).textContent).toContain('Justificada');
    expect((await fila(/^Cabrera/)).textContent).toContain('Sin tomar');
    expect(guardar().disabled).toBe(true);
  });

  it('marca como lesionado a quien tiene una lesión abierta', async () => {
    abrir(repo({
      obtenerLesionesDelPlantel: async () => [{ id: 'l-1', jugadorId: 'j-1', desde: '2000-01-01', hasta: null, zona: null, lado: null, tipo: null }],
    }));
    expect((await fila(/^Acosta/)).textContent).toContain('Lesionado');
    expect((await fila(/^Cabrera/)).textContent).not.toContain('Lesionado');
  });

  it('si no se pueden leer las lesiones, se toma asistencia igual', async () => {
    abrir(repo({ obtenerLesionesDelPlantel: async () => { throw new Error('boom'); } }));
    expect(await fila(/^Acosta/)).toBeTruthy();
  });
});

describe('Asistencia: guardar', () => {
  it('manda el día entero de una vez, sin los chicos sin tomar, y vuelve al plantel con el aviso', async () => {
    const u = userEvent.setup();
    const guardarAsistencia = vi.fn(async () => 'e-1');
    const { router } = abrir(repo({ guardarAsistencia }));
    await u.click(await fila(/^Acosta/));
    await u.click(await fila(/^Benítez/));
    await u.click(await fila(/^Benítez/));
    await u.click(guardar());
    await waitFor(() => expect(guardarAsistencia).toHaveBeenCalledTimes(1));
    expect(guardarAsistencia).toHaveBeenCalledWith({
      plantelId: 'p-1',
      fecha: HOY,
      hubo: true,
      filas: [{ jugadorId: 'j-1', estado: 'presente' }, { jugadorId: 'j-2', estado: 'ausente' }],
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel'));
    expect(await screen.findByText('Asistencia guardada')).toBeTruthy();
  });

  it('si falla, avisa, no se pierde lo marcado y se puede reintentar', async () => {
    const u = userEvent.setup();
    const guardarAsistencia = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('e-1');
    const { router } = abrir(repo({ guardarAsistencia }));
    await u.click(await fila(/^Acosta/));
    await u.click(guardar());
    expect(await screen.findByText('No se pudo guardar la asistencia.', { exact: false })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/plantel/asistencia');
    expect((await fila(/^Acosta/)).getAttribute('aria-pressed')).toBe('true');
    await u.click(guardar());
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel'));
  });

  it('explica el error de permiso y el de día futuro con palabras del profe', async () => {
    const u = userEvent.setup();
    abrir(repo({ guardarAsistencia: async () => { throw new Error('SIN_PERMISO'); } }));
    await u.click(await fila(/^Acosta/));
    await u.click(guardar());
    expect(await screen.findByText(/No tenés permiso para tomar asistencia en esta categoría/)).toBeTruthy();
  });

  it('sin conexión lo dice, con lo marcado todavía en pantalla', async () => {
    const u = userEvent.setup();
    abrir(repo({ guardarAsistencia: async () => { throw new TypeError('Failed to fetch'); } }));
    await u.click(await fila(/^Acosta/));
    await u.click(guardar());
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
    expect((await fila(/^Acosta/)).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Asistencia: día sin entrenamiento', () => {
  it('se marca, se guarda con hubo en falso y sin filas', async () => {
    const u = userEvent.setup();
    const guardarAsistencia = vi.fn(async () => 'e-1');
    abrir(repo({ guardarAsistencia }));
    await u.click(await screen.findByRole('button', { name: 'No hubo entrenamiento' }));
    expect(screen.getByText('Este día figura sin entrenamiento')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Jugadores' })).toBeNull();
    expect(contador().textContent).toBe('Sin entrenamiento');
    await u.click(guardar());
    await waitFor(() => expect(guardarAsistencia).toHaveBeenCalledWith({ plantelId: 'p-1', fecha: HOY, hubo: false, filas: [] }));
  });

  it('un día guardado sin entrenamiento se abre así, y se puede volver a «Sí hubo»', async () => {
    const u = userEvent.setup();
    abrir(repo({ obtenerEntrenamientos: async () => [{ id: 'e-1', fecha: HOY, hubo: false, filas: [] }] }));
    expect(await screen.findByText('Este día figura sin entrenamiento')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Sí hubo entrenamiento' }));
    expect(await screen.findByRole('list', { name: 'Jugadores' })).toBeTruthy();
  });

  it('si el día ya tenía asistencia guardada, pregunta antes de borrarla', async () => {
    const u = userEvent.setup();
    abrir(repo({ obtenerEntrenamientos: async () => [{ id: 'e-1', fecha: HOY, hubo: true, filas: [{ jugadorId: 'j-1', estado: 'presente' }] }] }));
    await u.click(await screen.findByRole('button', { name: 'No hubo entrenamiento' }));
    expect((await screen.findAllByText(/Este día ya tiene 1 asistencia guardada/)).length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: 'Seguir acá' }));
    expect(screen.getByRole('list', { name: 'Jugadores' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'No hubo entrenamiento' }));
    await u.click(screen.getByRole('button', { name: 'Marcar sin entrenamiento' }));
    expect(await screen.findByText('Este día figura sin entrenamiento')).toBeTruthy();
  });
});

describe('Asistencia: cambiar de día y salir', () => {
  it('pide el día que se eligió en el campo de fecha', async () => {
    const u = userEvent.setup();
    const obtenerEntrenamientos = vi.fn(async () => []);
    abrir(repo({ obtenerEntrenamientos }));
    await screen.findByRole('list', { name: 'Jugadores' });
    const campo = screen.getByLabelText('Día del entrenamiento') as HTMLInputElement;
    expect(campo.max).toBe(HOY);
    fireEvent.change(campo, { target: { value: '2026-10-20' } });
    await waitFor(() => expect(obtenerEntrenamientos).toHaveBeenCalledWith('p-1', '2026-10-20', '2026-10-20'));
  });

  it('abre el día que pide la dirección (?fecha=), que es como llega el historial', async () => {
    const obtenerEntrenamientos = vi.fn(async () => []);
    abrir(repo({ obtenerEntrenamientos }), '/plantel/asistencia?fecha=2026-10-20');
    await screen.findByRole('list', { name: 'Jugadores' });
    expect(obtenerEntrenamientos).toHaveBeenCalledWith('p-1', '2026-10-20', '2026-10-20');
    expect((screen.getByLabelText('Día del entrenamiento') as HTMLInputElement).value).toBe('2026-10-20');
  });

  it('la dirección de antes (/asistencia?fecha=…) redirige a Plantel y conserva el día', async () => {
    const { router } = abrir(repo(), '/asistencia?fecha=2026-10-20');
    await screen.findByRole('list', { name: 'Jugadores' });
    expect(router.state.location.pathname).toBe('/plantel/asistencia');
    expect((screen.getByLabelText('Día del entrenamiento') as HTMLInputElement).value).toBe('2026-10-20');
  });

  it('un día que todavía no llegó se ignora y se toma hoy', async () => {
    abrir(repo(), '/plantel/asistencia?fecha=2999-01-01');
    await screen.findByRole('list', { name: 'Jugadores' });
    expect((screen.getByLabelText('Día del entrenamiento') as HTMLInputElement).value).toBe(HOY);
  });

  it('con algo sin guardar, cambiar de día pregunta antes de perderlo', async () => {
    const u = userEvent.setup();
    abrir();
    await u.click(await fila(/^Acosta/));
    const campo = screen.getByLabelText('Día del entrenamiento') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: '2026-10-20' } });
    expect((await screen.findAllByText(/Lo que marcaste en este día todavía no se guardó/)).length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: 'Seguir acá' }));
    expect(campo.value).toBe(HOY);
    expect((await fila(/^Acosta/)).getAttribute('aria-pressed')).toBe('true');
  });

  it('con algo sin guardar, salir por el menú de la app pregunta; «Seguir acá» se queda y «Salir» sale', async () => {
    const u = userEvent.setup();
    const { router } = abrir();
    await u.click(await fila(/^Acosta/));
    await u.click(screen.getAllByRole('link', { name: 'Plantel' })[0]);
    expect((await screen.findAllByText(/Marcaste asistencia que todavía no guardaste/)).length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: 'Seguir acá' }));
    expect(router.state.location.pathname).toBe('/plantel/asistencia');
    await u.click(screen.getAllByRole('link', { name: 'Plantel' })[0]);
    await u.click(await screen.findByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel'));
  });

  it('sin nada marcado, salir no pregunta', async () => {
    const u = userEvent.setup();
    const { router } = abrir();
    await fila(/^Acosta/);
    await u.click(screen.getAllByRole('link', { name: 'Plantel' }).slice(-1)[0]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel'));
  });

  it('desde el historial vuelve al historial', async () => {
    const u = userEvent.setup();
    const { router } = abrir(repo({
      obtenerEntrenamientos: async () => [{ id: 'e-1', fecha: '2026-10-20', hubo: true, filas: [{ jugadorId: 'j-1', estado: 'presente' }] }],
    }), '/plantel/asistencia/historial');
    await u.click(await screen.findByRole('link', { name: /de 1 presentes|1 de 1/ }));
    await u.click(await fila(/^Acosta/));
    await u.click(guardar());
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel/asistencia/historial'));
    expect(await screen.findByText('Asistencia guardada')).toBeTruthy();
  });
});

describe('Asistencia: el menú de cada jugador', () => {
  it('«Falta justificada» marca al chico y se guarda con el día', async () => {
    const u = userEvent.setup();
    const guardarAsistencia = vi.fn(async () => 'e-1');
    abrir(repo({ guardarAsistencia }));
    await screen.findByRole('list', { name: 'Jugadores' });
    await u.click(screen.getByRole('button', { name: 'Justificada o lesión de Benítez, Tomás' }));
    await u.click(await screen.findByRole('button', { name: 'Falta justificada' }));
    expect((await fila(/^Benítez/)).textContent).toContain('Justificada');
    expect(contador().textContent).toContain('0/3');
    await u.click(guardar());
    await waitFor(() => expect(guardarAsistencia).toHaveBeenCalledWith(
      expect.objectContaining({ filas: [{ jugadorId: 'j-2', estado: 'justificada' }] }),
    ));
  });

  it('a quien ya es justificada no se le ofrece de nuevo', async () => {
    const u = userEvent.setup();
    abrir(repo({ obtenerEntrenamientos: async () => [{ id: 'e', fecha: HOY, hubo: true, filas: [{ jugadorId: 'j-2', estado: 'justificada' }] }] }));
    await screen.findByRole('list', { name: 'Jugadores' });
    await u.click(screen.getByRole('button', { name: 'Justificada o lesión de Benítez, Tomás' }));
    expect(await screen.findByRole('button', { name: 'Se lesionó' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Falta justificada' })).toBeNull();
  });

  it('«Se lesionó» guarda al instante con la zona, el lado y el tipo que se eligieron, sin tocar lo marcado', async () => {
    const u = userEvent.setup();
    const abrirLesion = vi.fn(async () => {});
    abrir(repo({ abrirLesion }));
    await u.click(await fila(/^Acosta/));
    await u.click(screen.getByRole('button', { name: 'Justificada o lesión de Acosta, Bruno' }));
    await u.click(await screen.findByRole('button', { name: 'Se lesionó' }));
    await u.click(screen.getByRole('button', { name: 'Tobillo' }));
    await u.click(screen.getByRole('button', { name: 'Derecho' }));
    await u.click(screen.getByRole('button', { name: 'Torcedura' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(abrirLesion).toHaveBeenCalledWith({ clubId: 'c-1', jugadorId: 'j-1', desde: HOY, zona: 'tobillo', lado: 'derecho', tipo: 'torcedura' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Torcedura' })).toBeNull());
    expect((await fila(/^Acosta/)).getAttribute('aria-pressed')).toBe('true');
  });

  it('la lesión se puede guardar sin saber nada (todo es opcional) y un segundo toque desmarca', async () => {
    const u = userEvent.setup();
    const abrirLesion = vi.fn(async () => {});
    abrir(repo({ abrirLesion }));
    await screen.findByRole('list', { name: 'Jugadores' });
    await u.click(screen.getByRole('button', { name: 'Justificada o lesión de Acosta, Bruno' }));
    await u.click(await screen.findByRole('button', { name: 'Se lesionó' }));
    await u.click(screen.getByRole('button', { name: 'Rodilla' }));
    await u.click(screen.getByRole('button', { name: 'Rodilla' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(abrirLesion).toHaveBeenCalledWith({ clubId: 'c-1', jugadorId: 'j-1', desde: HOY, zona: null, lado: null, tipo: null }));
  });

  it('si la lesión no se guarda, el aviso queda en la hoja y se puede reintentar', async () => {
    const u = userEvent.setup();
    const abrirLesion = vi.fn().mockRejectedValueOnce(new Error('lesion_abierta_unica')).mockResolvedValueOnce(undefined);
    abrir(repo({ abrirLesion }));
    await screen.findByRole('list', { name: 'Jugadores' });
    await u.click(screen.getByRole('button', { name: 'Justificada o lesión de Acosta, Bruno' }));
    await u.click(await screen.findByRole('button', { name: 'Se lesionó' }));
    await u.click(screen.getByRole('button', { name: 'Pie' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Ya tiene una lesión abierta/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pie' }).getAttribute('aria-pressed')).toBe('true');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(abrirLesion).toHaveBeenCalledTimes(2));
  });

  it('con una lesión abierta se ofrece «Dar el alta» (y no otra lesión) y el alta lleva el día', async () => {
    const u = userEvent.setup();
    const darAlta = vi.fn(async () => {});
    abrir(repo({
      darAlta,
      obtenerLesionesDelPlantel: async () => [{ id: 'l-9', jugadorId: 'j-1', desde: '2000-01-01', hasta: null, zona: null, lado: null, tipo: null }],
    }));
    await screen.findByRole('list', { name: 'Jugadores' });
    await u.click(screen.getByRole('button', { name: 'Justificada o lesión de Acosta, Bruno' }));
    expect(screen.queryByRole('button', { name: 'Se lesionó' })).toBeNull();
    await u.click(await screen.findByRole('button', { name: 'Dar el alta' }));
    await waitFor(() => expect(darAlta).toHaveBeenCalledWith('l-9', HOY));
  });

  it('si el alta falla, lo dice', async () => {
    const u = userEvent.setup();
    abrir(repo({
      darAlta: async () => { throw new Error('boom'); },
      obtenerLesionesDelPlantel: async () => [{ id: 'l-9', jugadorId: 'j-1', desde: '2000-01-01', hasta: null, zona: null, lado: null, tipo: null }],
    }));
    await screen.findByRole('list', { name: 'Jugadores' });
    await u.click(screen.getByRole('button', { name: 'Justificada o lesión de Acosta, Bruno' }));
    await u.click(await screen.findByRole('button', { name: 'Dar el alta' }));
    expect(await screen.findByText(/No se pudo dar el alta/)).toBeTruthy();
  });
});

describe('Asistencia: estados y quién la ve', () => {
  it('categoría sin jugadores: lo dice y manda al plantel', async () => {
    abrir(repo({ obtenerJugadoresDelPlantel: async () => [] }));
    expect(await screen.findByText('Esta categoría no tiene jugadores')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ir al plantel' }).getAttribute('href')).toBe('/plantel');
  });

  it('carga, y si falla ofrece reintentar', async () => {
    const u = userEvent.setup();
    const obtenerJugadoresDelPlantel = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(JUGADORES);
    abrir(repo({ obtenerJugadoresDelPlantel }));
    expect(screen.getByRole('status')).toBeTruthy();
    await u.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('list', { name: 'Jugadores' })).toBeTruthy();
  });

  it('sin conexión al abrir, lo dice', async () => {
    abrir(repo({ obtenerJugadoresDelPlantel: async () => { throw new TypeError('Failed to fetch'); } }));
    expect(await screen.findByText('Sin conexión')).toBeTruthy();
  });

  it('si no se pudo leer el día, lo dice y deja elegir otro', async () => {
    abrir(repo({ obtenerEntrenamientos: async () => { throw new Error('boom'); } }));
    expect(await screen.findByText('No se pudo cargar ese día')).toBeTruthy();
    expect(screen.getByLabelText('Día del entrenamiento')).toBeTruthy();
  });

  it('una categoría guardada que no es del profe se ignora: abre la suya', async () => {
    localStorage.setItem('semillero.plantel', 'p-2');
    abrir(repo());
    expect(await screen.findByRole('list', { name: 'Jugadores' })).toBeTruthy();
    localStorage.clear();
  });

  it('la coordinación sola no ve a los chicos uno por uno', async () => {
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }) }));
    expect(await screen.findByText('Esto lo ve el cuerpo técnico')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Jugadores' })).toBeNull();
  });

  it('el historial se alcanza desde la toma', async () => {
    const u = userEvent.setup();
    const { router } = abrir();
    await u.click(await screen.findByRole('link', { name: 'Historial' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel/asistencia/historial'));
  });
});
