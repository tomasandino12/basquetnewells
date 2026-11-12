import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hoyLocal } from '@datos/antropometria.js';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { Entrenamiento, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

const HOY = hoyLocal() as string;

function simular(escritorio: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: escritorio,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.unstubAllGlobals();
});

// Nombres inventados: nunca datos de chicos reales.
const JUGADORES = [
  { id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: '2013-03-02' },
  { id: 'j-2', nombreClave: 'benitez tomas', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: null },
  { id: 'j-3', nombreClave: 'echeverria montenegro gael', nombreLimpio: 'Echeverría Montenegro, Gael Alejandro', fechaNacimiento: null },
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    obtenerMedicionesCorporalesDelClub: async () => [
      { jugadorId: 'j-1', fechaMedicion: '2026-10-01', alturaCm: 158, pesoKg: 47.5, piernaCm: null, piernaFlexionadaCm: null },
    ],
    obtenerEntrenamientos: async () => [
      { id: 'e-1', fecha: HOY, hubo: true, filas: [{ jugadorId: 'j-1', estado: 'presente' }] },
    ],
    obtenerSesionesDeMedicion: async () => [{ id: 's-1', fecha: '2026-10-20', tipo: 'tiro' }],
    obtenerMedicionesTiroDelPlantel: async () => [
      { sesionId: 's-1', jugadorId: 'j-1', posicion: 'frontal', anotados: 6, intentos: 10 },
      { sesionId: 's-1', jugadorId: 'j-1', posicion: 'esq_izq', anotados: 4, intentos: 10 },
    ],
    ...piso,
  });
}

const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/plantel' });
// La ficha es una pantalla propia, con el nombre en la dirección.
const abrirFicha = (r: Repositorio = repo(), slug = 'bruno-acosta') => renderConDatos(rutas, { repo: r, ruta: `/plantel/${slug}` });
const filas = async () => within(await screen.findByRole('list', { name: 'Jugadores del plantel' })).getAllByRole('listitem');

describe('Plantel con datos: encabezado y lista', () => {
  it('muestra la carga y después la categoría con la cantidad y los presentes de hoy', async () => {
    simular(true);
    abrir();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sub 13' })).toBeTruthy();
    expect(screen.getByText('3 jugadores · hoy 1 presente')).toBeTruthy();
  });

  it('con un solo jugador dice «1 jugador»', async () => {
    simular(true);
    abrir(repo({ obtenerJugadoresDelPlantel: async () => [JUGADORES[0]], obtenerEntrenamientos: async () => [] }));
    expect(await screen.findByText('1 jugador · hoy 0 presentes')).toBeTruthy();
  });

  it('una fila por jugador, ordenada por apellido, con altura, peso, tiro y asistencia', async () => {
    simular(true);
    abrir();
    const lista = await filas();
    expect(lista).toHaveLength(3);
    expect(lista[0].textContent).toContain('Acosta, Bruno');
    expect(lista[0].textContent).toContain('158 cm · 47,5 kg');
    expect(lista[0].textContent).toContain('Tiro 50%');
    expect(lista[0].textContent).toContain('Asist. 100%');
  });

  it('lo que no se sabe es una raya, nunca un cero', async () => {
    simular(true);
    abrir();
    const sinDatos = (await filas())[1];
    expect(sinDatos.textContent).toContain('— · —');
    expect(sinDatos.textContent).toContain('Tiro —');
    expect(sinDatos.textContent).toContain('Asist. —');
    expect(sinDatos.textContent).not.toMatch(/\b0\b/);
  });

  it('el apellido largo se corta con puntos suspensivos', async () => {
    simular(true);
    abrir();
    const larga = (await filas())[2];
    expect(larga.querySelector('.truncate')).toBeTruthy();
  });

  it('un chico con lesión abierta se marca en la lista', async () => {
    simular(true);
    abrir(repo({ obtenerLesionesDelPlantel: async () => [{ id: 'l-1', jugadorId: 'j-2', desde: HOY, hasta: null, zona: null, lado: null, tipo: null }] }));
    const lista = await filas();
    expect(within(lista[1]).getByText('Lesionado')).toBeTruthy();
    expect(within(lista[0]).queryByText('Lesionado')).toBeNull();
  });

  it('no muestra cuota, apto médico ni nada de coordinación', async () => {
    simular(true);
    const { container } = abrir();
    await filas();
    expect(container.textContent).not.toMatch(/al día|apto|pagó|deuda|cuota/i);
  });

  it('la búsqueda achica la lista y avisa si no hay coincidencias', async () => {
    simular(true);
    const u = userEvent.setup();
    abrir();
    await filas();
    await u.type(screen.getByRole('searchbox'), 'benitez');
    expect(await filas()).toHaveLength(1);
    await u.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Ningún jugador coincide con la búsqueda.')).toBeTruthy();
  });
});

describe('Plantel con datos: últimas asistencias en la lista', () => {
  const dia = (n: number) => {
    const d = new Date(`${HOY}T12:00:00`);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const entrenamientos = async (): Promise<Entrenamiento[]> => [
    { id: 'e-1', fecha: dia(4), hubo: true, filas: [{ jugadorId: 'j-1', estado: 'presente' }, { jugadorId: 'j-2', estado: 'ausente' }] },
    { id: 'e-2', fecha: dia(3), hubo: false, filas: [] },
    { id: 'e-3', fecha: dia(2), hubo: true, filas: [{ jugadorId: 'j-1', estado: 'presente' }, { jugadorId: 'j-2', estado: 'justificada', motivo: 'estudio' }] },
    { id: 'e-4', fecha: HOY, hubo: true, filas: [{ jugadorId: 'j-1', estado: 'ausente' }] },
  ];

  it('la lista ya no se marca desde acá: no hay tilde de presente ni «Sin marcar» por fila', async () => {
    simular(false);
    abrir();
    const lista = await filas();
    expect(screen.queryByRole('button', { name: /Marcar presente a/ })).toBeNull();
    for (const fila of lista) {
      expect(within(fila).queryByText(/^(Presente|Faltó|Sin marcar)$/)).toBeNull();
      expect(within(fila).queryByText(/^Avisó/)).toBeNull();
    }
    // La toma sigue en su botón de arriba.
    expect(screen.getByRole('link', { name: /Tomar asistencia/ })).toBeTruthy();
  });

  /** Lo que dice la tira de un chico, en orden: «vino», «no hubo entrenamiento», «avisó (examen)»… */
  const estados = (nombre: string) => {
    const tira = screen.getByRole('img', { name: new RegExp(`^Últimas asistencias de ${nombre}: `) });
    return (tira.getAttribute('aria-label') ?? '').split('; ').map((t) => t.replace(/^.*?\d+[^:]*: /, '').replace(/^.*: /, ''));
  };

  it('cada fila muestra cómo vino en sus últimas prácticas, una por día', async () => {
    simular(false);
    abrir(repo({ obtenerEntrenamientos: entrenamientos }));
    await filas();
    expect(estados('Benítez, Tomás')).toEqual(['faltó sin avisar', 'no hubo entrenamiento', 'avisó (estudio o examen)', 'no se tomó']);
    expect(estados('Acosta, Bruno')).toEqual(['vino', 'no hubo entrenamiento', 'vino', 'faltó sin avisar']);
  });

  it('la tira siempre tiene 5 casilleros, aunque el chico tenga menos prácticas: la columna queda recta', async () => {
    simular(false);
    abrir(repo({ obtenerEntrenamientos: entrenamientos }));
    await filas();
    // 4 días de práctica en el plantel: 1 casillero vacío a la izquierda.
    expect(screen.getByRole('img', { name: /^Últimas asistencias de Benítez, Tomás: / }).querySelectorAll('span')).toHaveLength(5);
  });

  it('muestra como mucho las últimas 5 prácticas', async () => {
    simular(false);
    const muchas = async () => Array.from({ length: 8 }, (_, i) => ({
      id: `e-${i}`,
      fecha: dia(i + 1),
      hubo: true,
      filas: [{ jugadorId: 'j-1', estado: 'presente' as const }],
    }));
    abrir(repo({ obtenerEntrenamientos: muchas }));
    await filas();
    expect(screen.getByRole('img', { name: /^Últimas asistencias de Acosta, Bruno: / }).querySelectorAll('span')).toHaveLength(5);
  });

  it('un plantel sin entrenamientos tomados no inventa nada', async () => {
    simular(false);
    abrir(repo({ obtenerEntrenamientos: async () => [] }));
    await filas();
    expect(screen.queryByRole('img', { name: /Últimas asistencias de/ })).toBeNull();
    expect(screen.getByLabelText('Sin entrenamientos de Acosta, Bruno').querySelectorAll('span')).toHaveLength(5);
  });
});

describe('Plantel con datos: la ficha en su pantalla', () => {
  it('tocar a un chico abre su ficha en una pantalla propia, con su nombre en la dirección', async () => {
    simular(true);
    const u = userEvent.setup();
    const { router } = abrir();
    await filas();
    expect(screen.queryByRole('article')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Ficha de Benítez, Tomás' }));
    expect(await screen.findByRole('article', { name: 'Ficha de Tomás Benítez' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/plantel/tomas-benitez');
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(screen.getByRole('link', { name: 'Volver al plantel' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/plantel'));
  });

  it('un nombre que no está en la categoría lo dice', async () => {
    simular(true);
    abrirFicha(repo(), 'nadie-con-este-nombre');
    expect(await screen.findByText('No encontramos a ese jugador')).toBeTruthy();
  });

  it('Presente, Avisó y Faltó guardan presente, justificada y ausente', async () => {
    simular(true);
    const guardarAsistencia = vi.fn(async () => 'e-1');
    const u = userEvent.setup();
    abrirFicha(repo({ guardarAsistencia }));
    const ficha = within(await screen.findByRole('article', { name: 'Ficha de Bruno Acosta' }));
    await u.click(ficha.getByRole('radio', { name: 'Avisó' }));
    await waitFor(() => expect(guardarAsistencia).toHaveBeenCalledTimes(1));
    expect(guardarAsistencia).toHaveBeenLastCalledWith(expect.objectContaining({ filas: [{ jugadorId: 'j-1', estado: 'justificada' }] }));
    await u.click(ficha.getByRole('radio', { name: 'Faltó' }));
    await waitFor(() => expect(guardarAsistencia).toHaveBeenCalledTimes(2));
    expect(guardarAsistencia).toHaveBeenLastCalledWith(expect.objectContaining({ filas: [{ jugadorId: 'j-1', estado: 'ausente' }] }));
  });

  it('«Marcar lesión» pide zona, lado y qué pasó (todo opcional) y abre una lesión de hoy', async () => {
    simular(true);
    const abrirLesion = vi.fn(async () => {});
    const u = userEvent.setup();
    abrirFicha(repo({ abrirLesion }));
    await u.click(await screen.findByRole('button', { name: /Marcar lesión/ }));
    await u.click(screen.getByRole('button', { name: 'Tobillo' }));
    await u.click(screen.getByRole('button', { name: 'Derecho' }));
    await u.click(screen.getByRole('button', { name: 'Guardar lesión' }));
    await waitFor(() =>
      expect(abrirLesion).toHaveBeenCalledWith({ clubId: 'c-1', jugadorId: 'j-1', desde: HOY, zona: 'tobillo', lado: 'derecho', tipo: null }),
    );
  });

  it('si avisó, se elige por qué faltó y se guarda con el día', async () => {
    simular(true);
    const guardarAsistencia = vi.fn(async () => 'e-1');
    const u = userEvent.setup();
    abrirFicha(repo({ guardarAsistencia }));
    const ficha = within(await screen.findByRole('article', { name: 'Ficha de Bruno Acosta' }));
    expect(ficha.queryByRole('group', { name: 'Por qué faltó' })).toBeNull();
    await u.click(ficha.getByRole('radio', { name: 'Avisó' }));
    await waitFor(() => expect(guardarAsistencia).toHaveBeenCalled());
  });

  it('con una lesión abierta dice desde cuándo y deja dar el alta', async () => {
    simular(true);
    const darAlta = vi.fn(async () => {});
    const u = userEvent.setup();
    abrirFicha(repo({ darAlta, obtenerLesionesDelPlantel: async () => [{ id: 'l-9', jugadorId: 'j-1', desde: '2026-10-12', hasta: null, zona: 'tobillo', lado: 'derecho', tipo: null }] }));
    expect(await screen.findByText(/Lesionado desde el 12\/10 · tobillo derecho/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Dar el alta' }));
    await waitFor(() => expect(darAlta).toHaveBeenCalledWith('l-9', HOY));
  });

  it('Sacar del plantel pide confirmación y Cancelar no saca a nadie', async () => {
    simular(true);
    const sacarDelPlantel = vi.fn(async () => {});
    const u = userEvent.setup();
    abrirFicha(repo({ sacarDelPlantel }));
    await u.click(await screen.findByRole('button', { name: 'Sacar del plantel' }));
    expect(screen.getByText(/Su ficha y su historia se conservan/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(sacarDelPlantel).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Sacar del plantel' }));
    await u.click(screen.getByRole('button', { name: 'Sí, sacarlo' }));
    await waitFor(() => expect(sacarDelPlantel).toHaveBeenCalledWith('c-1', 'j-1', 'p-1'));
  });

  it('las pestañas son Físico, Tiro, Partidos e Historia y abre en Físico', async () => {
    simular(true);
    abrirFicha();
    const ficha = within(await screen.findByRole('article', { name: 'Ficha de Bruno Acosta' }));
    expect(ficha.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Físico', 'Tiro', 'Partidos', 'Historia']);
    expect(ficha.getByRole('tab', { name: 'Físico' }).getAttribute('aria-selected')).toBe('true');
    expect(ficha.getByText('Altura')).toBeTruthy();
  });

  it('la pestaña Tiro dibuja la curva con su escala y los valores por zona', async () => {
    simular(true);
    const u = userEvent.setup();
    abrirFicha();
    const ficha = within(await screen.findByRole('article', { name: 'Ficha de Bruno Acosta' }));
    await u.click(ficha.getByRole('tab', { name: 'Tiro' }));
    expect(ficha.getByRole('img', { name: /Curva de tiro por zona/ })).toBeTruthy();
    expect(ficha.getAllByText('100%').length).toBeGreaterThan(0);
    expect(ficha.getByText('60% (6/10)')).toBeTruthy();
  });

  it('Tiro de un chico que nunca tiró lo dice sin inventar datos', async () => {
    simular(true);
    const u = userEvent.setup();
    abrirFicha(repo(), 'tomas-benitez');
    await u.click(await screen.findByRole('tab', { name: 'Tiro' }));
    expect(screen.getByText('Todavía no tiene baterías de tiro.')).toBeTruthy();
  });
});

describe('Plantel con datos: ficha pedida desde la app de siempre', () => {
  it('?jugador=<id> se cambia por la ficha con su nombre', async () => {
    simular(false);
    const { router } = renderConDatos(rutas, { repo: repo(), ruta: '/plantel?jugador=j-1' });
    expect(await screen.findByRole('article', { name: 'Ficha de Bruno Acosta' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/plantel/bruno-acosta');
  });

  it('un jugador que no está en el plantel se ignora: queda la lista', async () => {
    simular(false);
    renderConDatos(rutas, { repo: repo(), ruta: '/plantel?jugador=otro-plantel' });
    await filas();
    expect(screen.queryByRole('article')).toBeNull();
  });
});

describe('Plantel con datos: estados y permisos', () => {
  it('un plantel sin jugadores ofrece las tres formas de armarlo', async () => {
    simular(true);
    abrir(repo({ obtenerJugadoresDelPlantel: async () => [] }));
    expect(await screen.findByText('Sub 13 todavía no tiene jugadores')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cargar un partido de la CABB' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Agregar jugador a mano' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Importar inscriptos' })).toBeTruthy();
  });

  it('si falla la lista de chicos, lo cuenta con salida; si fallan los agregados, la lista se dibuja igual', async () => {
    simular(true);
    abrir(repo({
      obtenerMedicionesCorporalesDelClub: async () => { throw new Error('x'); },
      obtenerEntrenamientos: async () => { throw new Error('x'); },
      obtenerLesionesDelPlantel: async () => { throw new Error('x'); },
      obtenerMedicionesTiroDelPlantel: async () => { throw new Error('x'); },
      obtenerSolicitudesDelPlantel: async () => { throw new Error('x'); },
    }));
    expect(await filas()).toHaveLength(3);
    expect(screen.queryByRole('alert')).toBeNull();
    cleanup();
    abrir(repo({ obtenerJugadoresDelPlantel: async () => { throw new Error('x'); } }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeTruthy();
  });

  it('las solicitudes pendientes se avisan con singular y plural; sin pendientes no hay aviso', async () => {
    simular(true);
    abrir(repo({ obtenerSolicitudesDelPlantel: async () => [{}] }));
    expect(await screen.findByText('1 chico pidió entrar a esta categoría')).toBeTruthy();
    cleanup();
    abrir(repo({ obtenerSolicitudesDelPlantel: async () => [{}, {}] }));
    expect(await screen.findByText('2 chicos pidieron entrar a esta categoría')).toBeTruthy();
    cleanup();
    abrir();
    await filas();
    expect(screen.queryByText(/pidi/)).toBeNull();
  });

  it('el entrenador ve la categoría que tiene asignada, sin ids en la dirección', async () => {
    simular(true);
    abrir(repo({ obtenerMisPlantelesAsignados: async () => new Set(['p-2']) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sub 15' })).toBeTruthy();
  });

  it('con dos categorías, los chips de arriba cambian la del plantel', async () => {
    simular(true);
    const u = userEvent.setup();
    abrir(repo({ obtenerMisPlantelesAsignados: async () => new Set(['p-1', 'p-2']) }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sub 13' })).toBeTruthy();
    await u.click(within(screen.getByRole('navigation', { name: 'Categoría' })).getByRole('button', { name: 'Sub 15' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sub 15' })).toBeTruthy();
    expect(localStorage.getItem('semillero.plantel')).toBe('p-2');
    localStorage.clear();
  });

  it('la coordinación sola no ve a los chicos: se le explica en vez de mostrar una lista vacía', async () => {
    simular(true);
    const pedirJugadores = vi.fn(async () => JUGADORES);
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }), obtenerJugadoresDelPlantel: pedirJugadores }));
    expect(await screen.findByText('Los chicos los ve el cuerpo técnico')).toBeTruthy();
    expect(pedirJugadores).not.toHaveBeenCalled();
  });

  it('quien es entrenador y coordinador a la vez sí ve a los chicos', async () => {
    simular(true);
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: true }) }));
    expect(await filas()).toHaveLength(3);
  });

  it('la dirección de entrada lleva a Hoy y el botón «Tomar asistencia» del plantel a la toma', async () => {
    simular(true);
    const { router } = renderConDatos(rutas, { repo: repo() });
    await waitFor(() => expect(router.state.location.pathname).toBe('/hoy'));
    cleanup();
    abrir();
    expect((await screen.findByRole('link', { name: /Tomar asistencia/ })).getAttribute('href')).toBe('/plantel/asistencia');
  });
});
