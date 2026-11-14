import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../../datos/errores';
import { renderConDatos, repositorioInventado } from '../../datos/renderDePrueba';
import type { Repositorio } from '../../datos/repositorio';
import { rutas } from '../../rutas';

const lector = vi.hoisted(() => ({ cabb: vi.fn() }));
vi.mock('@parser/parserCabb.js', () => ({ parsearPartidoCabb: lector.cabb }));
// crypto.subtle no está en el entorno de pruebas: el hash se inventa (lo que importa es que se pregunte por él).
vi.mock('@datos/mapearImportacion.js', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  calcularHashArchivo: async () => 'hash-de-prueba',
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: true, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }));
});
afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.unstubAllGlobals();
  lector.cabb.mockReset();
});

// Todo inventado: ni un nombre de chico real.
const jugador = (nombreLimpio: string, nombreClave: string) => ({
  numero: 4, nombreCrudo: nombreLimpio.toUpperCase(), nombreLimpio, nombreClave, apellido: nombreLimpio.split(',')[0],
  min: { segundos: 600 }, pts: 10,
  dos: { anotados: 2, intentados: 4, porcentaje: 50 }, tres: { anotados: 1, intentados: 3, porcentaje: 33 }, libres: { anotados: 2, intentados: 2, porcentaje: 100 },
  reb: { def: 1, of: 1, tot: 2 }, ast: 1, rec: 0, per: 0, tap: { cometidos: 0, recibidos: 0 }, fal: { cometidas: 0, recibidas: 0 }, val: 5, masMenos: 0,
});

const PARTIDO = {
  errores: [],
  advertencias: [{ mensaje: 'No se pudo leer el minuto de un jugador' }],
  partido: { categoria: 'U13' },
  origen: { idPartidoCabb: '1234' },
  equipos: [
    {
      nombre: 'Club de Ejemplo', condicion: 'local', totales: { pts: 70 },
      jugadores: [
        jugador('Acosta, Bruno', 'ACOSTA BRUNO'), // ya está en Sub 13
        jugador('Benitez, Lucas', 'BENITEZ LUCAS'), // está en otra categoría
        jugador('Dominguez, Tomi', 'DOMINGUEZ TOMI'), // se parece a uno cargado
        jugador('Ferreyra, Nico', 'FERREYRA NICO'), // nuevo
      ],
    },
    { nombre: 'Rival de Ejemplo', condicion: 'visitante', totales: { pts: 65 }, jugadores: [] },
  ],
};

const CLUB = [
  { id: 'j-1', nombreClave: 'ACOSTA BRUNO', nombreLimpio: 'Acosta, Bruno', plantelesActuales: ['p-1'] },
  { id: 'j-2', nombreClave: 'BENITEZ LUCAS', nombreLimpio: 'Benitez, Lucas', plantelesActuales: ['p-2'] },
  { id: 'j-3', nombreClave: 'DOMINGUEZ TOMAS', nombreLimpio: 'Dominguez, Tomas', plantelesActuales: ['p-1'] },
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerPlantelesDelClub: async () => [
      { id: 'p-1', categoria: 'Sub 13', categoriaCodigo: 'U13M', codigoCabb: 'U13', temporadaId: 't-1' },
      { id: 'p-2', categoria: 'Sub 15', categoriaCodigo: 'U15M', codigoCabb: 'U15', temporadaId: 't-1' },
    ],
    obtenerJugadoresDelClub: async () => CLUB,
    ...piso,
  });
}

function archivo(nombre = 'partido.xlsx') {
  const f = new File(['x'], nombre);
  Object.defineProperty(f, 'arrayBuffer', { value: async () => new ArrayBuffer(8) });
  return f;
}

async function subir(r: Repositorio) {
  const u = userEvent.setup();
  const pantalla = renderConDatos(rutas, { repo: r, ruta: '/datos/cargar-partido' });
  await u.upload(await screen.findByLabelText('Planilla del partido (.xlsx)'), archivo());
  return { u, ...pantalla };
}

/** Hasta el paso de los jugadores: elige tu equipo y deja el plantel sugerido. */
async function hastaLosJugadores(r: Repositorio) {
  const ctx = await subir(r);
  await ctx.u.click(await screen.findByRole('button', { name: 'Club de Ejemplo' }));
  await ctx.u.click(screen.getByRole('button', { name: 'Ver jugadores' }));
  await screen.findByRole('list', { name: 'Nuevos' });
  return ctx;
}

describe('Cargar partido: leer el archivo', () => {
  it('el primer paso pide la planilla .xlsx y la lee en el dispositivo', async () => {
    renderConDatos(rutas, { repo: repo(), ruta: '/datos/cargar-partido' });
    const campo = (await screen.findByLabelText('Planilla del partido (.xlsx)')) as HTMLInputElement;
    expect(campo.accept).toBe('.xlsx');
    expect(screen.getByRole('link', { name: 'Volver a Datos' }).getAttribute('href')).toBe('/datos');
  });

  it('un archivo que no se puede leer cuenta cada error y ofrece volver', async () => {
    lector.cabb.mockReturnValue({ errores: [{ mensaje: 'No es una planilla de la CABB' }, { mensaje: 'Falta el marcador' }], advertencias: [] });
    await subir(repo());
    expect(await screen.findByText('No es una planilla de la CABB')).toBeTruthy();
    expect(screen.getByText('Falta el marcador')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/datos');
  });

  it('un partido que ya se importó (mismo hash) lo dice con el nombre del archivo', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const buscarImportacionPorHash = vi.fn(async () => ({ id: 'i-1', nombre_archivo: 'viejo.xlsx', id_partido_cabb: '1234' }));
    await subir(repo({ buscarImportacionPorHash }));
    expect(await screen.findByText('Este partido ya fue importado (viejo.xlsx).')).toBeTruthy();
    expect(buscarImportacionPorHash).toHaveBeenCalledWith('c-1', 'hash-de-prueba');
  });

  it('si no se puede revisar si ya se importó, cuenta el error y deja volver', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    await subir(repo({ buscarImportacionPorHash: async () => { throw new TypeError('Failed to fetch'); } }));
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver' })).toBeTruthy();
  });
});

describe('Cargar partido: equipo, fecha y plantel', () => {
  it('ofrece los dos equipos, sugiere el plantel por categoría y no avanza hasta elegir', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const { u } = await subir(repo());
    const boton = await screen.findByRole('button', { name: 'Elegí tu equipo y el plantel' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Club de Ejemplo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rival de Ejemplo' })).toBeTruthy();
    // Sub 13 es la categoría del archivo (U13): viene sugerida y elegida.
    const sub13 = screen.getByRole('button', { name: /Sub 13/ });
    expect(sub13.textContent).toContain('Sugerido');
    expect(sub13.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Sub 15/ }).getAttribute('aria-pressed')).toBe('false');
    await u.click(screen.getByRole('button', { name: 'Club de Ejemplo' }));
    expect((screen.getByRole('button', { name: 'Ver jugadores' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('elegir equipo muestra el marcador con «Nosotros» y el rival; cambiarlo lo da vuelta', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const { u } = await subir(repo());
    await u.click(await screen.findByRole('button', { name: 'Club de Ejemplo' }));
    let marcador = screen.getByLabelText('Marcador');
    expect(marcador.textContent).toContain('70');
    expect(marcador.textContent).toContain('Nosotros');
    expect(marcador.textContent).toContain('Rival de Ejemplo');
    await u.click(screen.getByRole('button', { name: 'Rival de Ejemplo' }));
    marcador = screen.getByLabelText('Marcador');
    expect(within(marcador).getAllByText(/^(65|70)$/).map((n) => n.textContent)).toEqual(['65', '70']);
  });

  it('la fecha viene con hoy y se puede cambiar', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const { u } = await subir(repo());
    const fecha = (await screen.findByLabelText('Día en que se jugó')) as HTMLInputElement;
    expect(fecha.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await u.clear(fecha);
    await u.type(fecha, '2026-11-08');
    expect(fecha.value).toBe('2026-11-08');
  });
});

describe('Cargar partido: los jugadores', () => {
  it('los separa en ya cargados, otra categoría, posible coincidencia y nuevos', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    await hastaLosJugadores(repo());
    expect(within(screen.getByRole('list', { name: 'Ya cargados' })).getByText('ACOSTA BRUNO')).toBeTruthy();
    const otra = screen.getByRole('list', { name: 'Ya está en otra categoría' });
    expect(within(otra).getByText('BENITEZ LUCAS')).toBeTruthy();
    expect(otra.textContent).toContain('se lo suma también a Sub 13');
    const coincidencia = screen.getByRole('list', { name: 'Posible coincidencia' });
    expect(coincidencia.textContent).toContain('Dominguez, Tomi');
    expect(coincidencia.textContent).toContain('¿Es Dominguez, Tomas, ya cargado?');
    expect(within(screen.getByRole('list', { name: 'Nuevos' })).getByText('Ferreyra, Nico')).toBeTruthy();
  });

  it('Guardar queda bloqueado hasta decidir cada coincidencia; después cuenta los nuevos', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const { u } = await hastaLosJugadores(repo());
    const guardar = () => screen.getByRole('button', { name: /Confirmá las coincidencias|Guardar \(/ }) as HTMLButtonElement;
    expect(guardar().textContent).toBe('Confirmá las coincidencias');
    expect(guardar().disabled).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Es el mismo' }));
    expect(guardar().textContent).toBe('Guardar (1 jugador nuevo)');
    await u.click(screen.getByRole('button', { name: 'Es otro' }));
    expect(guardar().textContent).toBe('Guardar (2 jugadores nuevos)');
    expect(guardar().disabled).toBe(false);
  });

  it('destildar a un nuevo lo saca de la cuenta', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const { u } = await hastaLosJugadores(repo());
    await u.click(screen.getByRole('button', { name: 'Es el mismo' }));
    await u.click(screen.getByRole('checkbox', { name: 'Ferreyra, Nico' }));
    expect(screen.getByRole('button', { name: 'Guardar (0 jugadores nuevos)' })).toBeTruthy();
  });

  it('un grupo vacío dice «Ninguno»', async () => {
    lector.cabb.mockReturnValue({ ...PARTIDO, equipos: [{ ...PARTIDO.equipos[0], jugadores: [PARTIDO.equipos[0].jugadores[0], PARTIDO.equipos[0].jugadores[3]] }, PARTIDO.equipos[1]] });
    await hastaLosJugadores(repo());
    expect(screen.getAllByText('Ninguno.').length).toBe(2);
  });
});

describe('Cargar partido: guardar', () => {
  it('manda el partido con las decisiones, muestra el resultado con sus advertencias y deja cargar otro', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const importarPartido = vi.fn(async () => ({}));
    const { u } = await hastaLosJugadores(repo({ importarPartido }));
    await u.click(screen.getByRole('button', { name: 'Es otro' }));
    await u.click(screen.getByRole('button', { name: 'Guardar (2 jugadores nuevos)' }));
    expect(await screen.findByText('Partido vs. Rival de Ejemplo guardado — 2 jugadores nuevos.')).toBeTruthy();
    expect(importarPartido).toHaveBeenCalledTimes(1);
    const [payload] = importarPartido.mock.calls[0] as unknown as [{
      clubId: string; hashArchivo: string; nombreArchivo: string; idPartidoCabb: string;
      partido: { plantelId: string; rivalNombre: string; puntosPropios: number; puntosRival: number; condicionPropia: string };
      jugadoresNuevos: { nombreClave: string }[]; pertenenciasNuevas: { jugadorId: string }[];
    }];
    expect(payload.clubId).toBe('c-1');
    expect(payload.hashArchivo).toBe('hash-de-prueba');
    expect(payload.nombreArchivo).toBe('partido.xlsx');
    expect(payload.idPartidoCabb).toBe('1234');
    expect(payload.partido).toMatchObject({ plantelId: 'p-1', rivalNombre: 'Rival de Ejemplo', puntosPropios: 70, puntosRival: 65, condicionPropia: 'local' });
    expect(payload.jugadoresNuevos.map((j) => j.nombreClave).sort()).toEqual(['DOMINGUEZ TOMI', 'FERREYRA NICO']);
    expect(payload.pertenenciasNuevas.map((p) => p.jugadorId)).toEqual(['j-2']);

    await u.click(screen.getByText('1 advertencia del archivo'));
    expect(screen.getByText('No se pudo leer el minuto de un jugador')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver los datos' }).getAttribute('href')).toBe('/datos');
    await u.click(screen.getByRole('button', { name: 'Cargar otro partido' }));
    expect(await screen.findByLabelText('Planilla del partido (.xlsx)')).toBeTruthy();
  });

  it('«Es el mismo» suma al chico ya cargado a este plantel en vez de crear uno', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const importarPartido = vi.fn(async () => ({}));
    const { u } = await hastaLosJugadores(repo({ importarPartido }));
    await u.click(screen.getByRole('button', { name: 'Es el mismo' }));
    await u.click(screen.getByRole('button', { name: 'Guardar (1 jugador nuevo)' }));
    await screen.findByText('Partido vs. Rival de Ejemplo guardado — 1 jugador nuevo.');
    const [payload] = importarPartido.mock.calls[0] as unknown as [{ jugadoresNuevos: { nombreClave: string }[]; estadisticas: { nombreClave: string; jugadorId: string | null }[] }];
    expect(payload.jugadoresNuevos.map((j) => j.nombreClave)).toEqual(['FERREYRA NICO']);
    expect(payload.estadisticas.find((e) => e.nombreClave === 'DOMINGUEZ TOMI')?.jugadorId).toBe('j-3');
  });

  it('un error cualquiera lo cuenta y deja guardar de nuevo', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const importarPartido = vi.fn(async () => { throw new Error('boom'); });
    const { u } = await hastaLosJugadores(repo({ importarPartido }));
    await u.click(screen.getByRole('button', { name: 'Es el mismo' }));
    await u.click(screen.getByRole('button', { name: /Guardar \(/ }));
    expect(await screen.findByText(/No se pudo guardar\. Intentá de nuevo\./)).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', { name: /Guardar \(/ }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('si otro profe cargó al mismo chico mientras tanto, lo cuenta, vuelve a leer el club y pide decidir de nuevo', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const importarPartido = vi.fn(async () => { throw new Error('JUGADOR_YA_EXISTE: ferreyra nico'); });
    const obtenerJugadoresDelClub = vi.fn(async () => CLUB);
    const { u } = await hastaLosJugadores(repo({ importarPartido, obtenerJugadoresDelClub }));
    expect(obtenerJugadoresDelClub).toHaveBeenCalledTimes(1);
    await u.click(screen.getByRole('button', { name: 'Es el mismo' }));
    await u.click(screen.getByRole('button', { name: /Guardar \(/ }));
    expect(await screen.findByText('Alguien más acaba de cargar a ese jugador. Revisá la lista actualizada y guardá de nuevo.')).toBeTruthy();
    await waitFor(() => expect(obtenerJugadoresDelClub).toHaveBeenCalledTimes(2));
    // Las decisiones se borran: la lista nueva puede ser otra.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmá las coincidencias' })).toBeTruthy());
  });

  it('si ni siquiera se puede releer el club tras el choque, Guardar queda apagado', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const importarPartido = vi.fn(async () => { throw new Error('PERTENENCIA_YA_VIGENTE'); });
    let llamadas = 0;
    const obtenerJugadoresDelClub = vi.fn(async () => {
      if (++llamadas > 1) throw new TypeError('Failed to fetch');
      return CLUB;
    });
    const { u } = await hastaLosJugadores(repo({ importarPartido, obtenerJugadoresDelClub }));
    await u.click(screen.getByRole('button', { name: 'Es el mismo' }));
    await u.click(screen.getByRole('button', { name: /Guardar \(/ }));
    expect(await screen.findByText(/Alguien más acaba de sumar a ese jugador/)).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', { name: /Guardar \(|Confirmá/ }) as HTMLButtonElement).disabled).toBe(true));
  });

  it('un partido duplicado en la base se cuenta como ya importado', async () => {
    lector.cabb.mockReturnValue(PARTIDO);
    const importarPartido = vi.fn(async () => { throw new Error('IMPORTACION_DUPLICADA'); });
    const { u } = await hastaLosJugadores(repo({ importarPartido }));
    await u.click(screen.getByRole('button', { name: 'Es el mismo' }));
    await u.click(screen.getByRole('button', { name: /Guardar \(/ }));
    expect(await screen.findByText('Este partido ya fue importado.')).toBeTruthy();
  });
});
