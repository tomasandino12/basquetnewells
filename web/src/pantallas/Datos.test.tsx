import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { EstadisticaDePartido, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: true, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }));
});
afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.unstubAllGlobals();
});

// Todo inventado: nombres que no son de nadie.
const JUGADORES = [
  { id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'ACOSTA, BRUNO', fechaNacimiento: '2013-03-02' },
  { id: 'j-2', nombreClave: 'benitez lucas', nombreLimpio: 'BENITEZ, LUCAS', fechaNacimiento: '2013-07-10' },
  { id: 'j-3', nombreClave: 'cruz mateo', nombreLimpio: 'CRUZ, MATEO', fechaNacimiento: '2013-09-09' },
];

const PARTIDOS = [
  { id: 'pa-2', fecha: '2026-10-25', rivalNombre: 'Rival Dos', puntosPropios: 51, puntosRival: 60, condicionPropia: 'visitante' as const },
  { id: 'pa-1', fecha: '2026-10-10', rivalNombre: 'Rival Uno', puntosPropios: 70, puntosRival: 65, condicionPropia: 'local' as const },
];

const est = (partidoId: string, jugadorId: string, c: Partial<EstadisticaDePartido>): EstadisticaDePartido => ({
  partidoId, jugadorId, minSegundos: 600, pts: 10, dosAnotados: 2, dosIntentados: 4, tresAnotados: 1, tresIntentados: 3, libresAnotados: 2, libresIntentados: 2, ...c,
});

const ESTADISTICAS = [
  est('pa-1', 'j-1', { minSegundos: 1800, pts: 30 }),
  est('pa-1', 'j-2', { minSegundos: 300, pts: 4 }),
  est('pa-2', 'j-3', { minSegundos: 300, pts: 6 }),
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    obtenerPartidosDelPlantel: async () => PARTIDOS,
    obtenerEstadisticasDelPlantel: async () => ESTADISTICAS,
    ...piso,
  });
}

const abrir = (r: Repositorio) => renderConDatos(rutas, { repo: r, ruta: '/datos' });

describe('Datos: partidos y reparto', () => {
  it('lista cada partido con rival, fecha, condición y marcador; marca el ganado también con texto', async () => {
    abrir(repo());
    const lista = await screen.findByRole('list', { name: 'Partidos cargados' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('Rival Dos');
    expect(filas[0].textContent).toContain('25/10/26 · Visitante');
    expect(filas[0].textContent).toContain('51–60');
    expect(filas[0].textContent).not.toContain('ganado');
    expect(filas[1].textContent).toContain('10/10/26 · Local');
    expect(filas[1].textContent).toContain('70–65');
    expect(filas[1].textContent).toContain('(ganado)');
  });

  it('un marcador que no se pudo leer muestra «-», no 0', async () => {
    abrir(repo({ obtenerPartidosDelPlantel: async () => [{ id: 'pa-3', fecha: '2026-10-01', rivalNombre: null, puntosPropios: null, puntosRival: null, condicionPropia: 'local' }] }));
    const lista = await screen.findByRole('list', { name: 'Partidos cargados' });
    expect(lista.textContent).toContain('Rival sin nombre');
    expect(lista.textContent).toContain('-–-');
  });

  it('el reparto de minutos y de puntos va por jugador, con nombre corto, y se lee en una frase', async () => {
    abrir(repo());
    const minutos = await screen.findByRole('list', { name: 'Minutos por jugador' });
    const filas = within(minutos).getAllByRole('listitem');
    expect(filas[0].textContent).toContain('ACOSTA, B.');
    // 1800 s = 30′, y concentra más de la mitad de 2400 s.
    expect(filas[0].textContent).toContain('30′');
    expect(screen.getByText('El primero concentra más de la mitad de los minutos.')).toBeTruthy();
    const puntos = screen.getByRole('list', { name: 'Puntos por jugador' });
    expect(within(puntos).getAllByRole('listitem')[0].textContent).toContain('30');
    expect(screen.getByText('El primero concentra más de la mitad de los puntos.')).toBeTruthy();
  });

  it('con «Los primeros N» cuando hace falta más de uno', async () => {
    abrir(repo({
      obtenerEstadisticasDelPlantel: async () => [
        est('pa-1', 'j-1', { minSegundos: 600, pts: 10 }),
        est('pa-1', 'j-2', { minSegundos: 600, pts: 10 }),
        est('pa-1', 'j-3', { minSegundos: 600, pts: 10 }),
      ],
    }));
    expect(await screen.findByText('Los primeros 2 jugadores concentran más de la mitad de los minutos.')).toBeTruthy();
  });

  it('un jugador que ya no está en el plantel aparece como «Otra categoría»', async () => {
    abrir(repo({ obtenerEstadisticasDelPlantel: async () => [est('pa-1', 'j-fuera', { minSegundos: 600 })] }));
    const minutos = await screen.findByRole('list', { name: 'Minutos por jugador' });
    expect(minutos.textContent).toContain('Otra categoría');
  });

  it('sin partidos explica qué hacer y lleva a cargar uno', async () => {
    abrir(repo({ obtenerPartidosDelPlantel: async () => [], obtenerEstadisticasDelPlantel: async () => [] }));
    expect(await screen.findByText('Todavía no cargaste partidos')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Cargar partido' }).every((a) => a.getAttribute('href') === '/datos/cargar-partido')).toBe(true);
    expect(screen.getByText('Cuando cargues un partido va a aparecer acá cómo tiró el equipo en cada uno.')).toBeTruthy();
  });

  it('con partidos pero sin estadísticas, el reparto explica que todavía no hay', async () => {
    abrir(repo({ obtenerEstadisticasDelPlantel: async () => [] }));
    expect(await screen.findByText('Cuando cargues un partido va a aparecer acá cuánto juega y cuánto anota cada uno.')).toBeTruthy();
  });

  it('si fallan los partidos, lo cuenta con «Reintentar» y el resto de los bloques se dibuja igual', async () => {
    abrir(repo({ obtenerPartidosDelPlantel: async () => { throw new Error('x'); } }));
    expect((await screen.findAllByText('No se pudieron cargar los partidos')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Todavía no hay ninguna batería cargada/)).toBeTruthy();
  });

  it('sin conexión lo dice', async () => {
    abrir(repo({ obtenerPartidosDelPlantel: async () => { throw new TypeError('Failed to fetch'); } }));
    expect((await screen.findAllByText('Sin conexión')).length).toBeGreaterThan(0);
  });

  it('«Cargar partido» del encabezado lleva a la pantalla de carga', async () => {
    abrir(repo());
    const botones = await screen.findAllByRole('link', { name: /Cargar partido/ });
    expect(botones[0].getAttribute('href')).toBe('/datos/cargar-partido');
    const u = userEvent.setup();
    await u.click(botones[0]);
    expect(await screen.findByLabelText('Planilla del partido (.xlsx)')).toBeTruthy();
  });
});

describe('Datos: tiro', () => {
  it('el tiro del equipo va partido a partido, con 2P, 3P y TL, y los números abajo con su denominador', async () => {
    abrir(repo());
    const dibujo = await screen.findByRole('img', { name: /Porcentaje de tiro del equipo en 2 partidos/ });
    expect(dibujo).toBeTruthy();
    const lista = screen.getByRole('list', { name: 'Tiro por partido' });
    const filas = within(lista).getAllByRole('listitem');
    // Más nuevo primero. Partido pa-2: sólo j-3 → 2P 2/4, 3P 1/3, TL 2/2.
    expect(filas[0].textContent).toContain('25/10');
    expect(filas[0].textContent).toContain('2P 50% · 2/4');
    expect(filas[0].textContent).toContain('3P 33% · 1/3');
    expect(filas[0].textContent).toContain('TL 100% · 2/2');
    // Con pocos intentos, el porcentaje lo avisa.
    expect(filas[0].textContent).toContain('(pocos datos)');
  });

  it('un partido sin intentos de una clase dice «sin datos», nunca 0 %', async () => {
    abrir(repo({
      obtenerEstadisticasDelPlantel: async () => [est('pa-1', 'j-1', { libresAnotados: null, libresIntentados: null })],
      obtenerPartidosDelPlantel: async () => [PARTIDOS[1]],
    }));
    const lista = await screen.findByRole('list', { name: 'Tiro por partido' });
    expect(lista.textContent).toContain('TL sin datos');
  });

  it('sin baterías, explica cuándo empieza a haber serie', async () => {
    abrir(repo());
    expect(await screen.findByText(/Todavía no hay ninguna batería cargada\. Con la primera vas a ver el punto de partida de cada zona/)).toBeTruthy();
  });

  it('una curva por zona con sus baterías, la serie corta marcada con «pocos datos» y la tabla debajo', async () => {
    abrir(repo({
      obtenerSesionesDeMedicion: async () => [
        { id: 's1', fecha: '2026-10-01', tipo: 'tiro' },
        { id: 's2', fecha: '2026-10-15', tipo: 'tiro' },
      ],
      obtenerMedicionesTiroDelPlantel: async () => [
        { sesionId: 's1', jugadorId: 'j-1', posicion: 'frontal', anotados: 4, intentos: 10 },
        { sesionId: 's2', jugadorId: 'j-1', posicion: 'frontal', anotados: 6, intentos: 10 },
        { sesionId: 's2', jugadorId: 'j-1', posicion: 'libres', anotados: 8, intentos: 10 },
      ],
    }));
    const zonas = await screen.findByRole('list', { name: 'Curvas de tiro por zona' });
    expect(within(zonas).getByRole('heading', { name: 'Frontal' })).toBeTruthy();
    expect(within(zonas).getByRole('heading', { name: 'Tiros libres' })).toBeTruthy();
    expect(within(zonas).queryByRole('heading', { name: 'Esquina izquierda' })).toBeNull();
    expect(zonas.textContent).toContain('2 baterías');
    expect(zonas.textContent).toContain('1 batería');
    const tabla = within(zonas).getByRole('list', { name: 'Frontal, por batería' });
    expect(within(tabla).getAllByRole('listitem')[0].textContent).toContain('15/10');
    expect(within(tabla).getAllByRole('listitem')[0].textContent).toContain('60% · 6/10');
    expect(screen.getByRole('img', { name: /Frontal: 01\/10 40%, 15\/10 60%/ })).toBeTruthy();
  });

  it('si fallan las mediciones de tiro lo cuenta, y los partidos siguen', async () => {
    abrir(repo({ obtenerSesionesDeMedicion: async () => { throw new Error('x'); } }));
    expect(await screen.findByText('No se pudieron cargar las mediciones de tiro')).toBeTruthy();
    expect(await screen.findByRole('list', { name: 'Partidos cargados' })).toBeTruthy();
  });
});

describe('Datos: físico', () => {
  it('sin pesos ni pruebas, cada bloque dice qué hace falta', async () => {
    abrir(repo());
    expect(await screen.findByText(/Todavía no hay pesos anotados/)).toBeTruthy();
    expect(screen.getByText(/Todavía no hay nada medido\. Las pruebas se cargan desde Medir/)).toBeTruthy();
  });

  it('las cargas van por bloque del plan con el cambio en % y el signo, y los ejercicios en kg', async () => {
    abrir(repo({
      obtenerCargasDelPlantel: async () => ({
        ejercicios: [{ pasoId: 'pa', nombre: 'Sentadilla', bloque: 'FUERZA' }],
        movimientos: [
          { jugadorId: 'j-1', pasoId: 'pa', kg: 40, fecha: '2026-09-01', orden: 1 },
          { jugadorId: 'j-1', pasoId: 'pa', kg: 50, fecha: '2026-10-01', orden: 2 },
          { jugadorId: 'j-2', pasoId: 'pa', kg: 20, fecha: '2026-09-01', orden: 3 },
        ],
      }),
    }));
    const bloques = await screen.findByRole('list', { name: 'Cargas por bloque' });
    expect(within(bloques).getByRole('heading', { name: 'FUERZA' })).toBeTruthy();
    expect(bloques.textContent).toContain('+13%');
    expect(bloques.textContent).toContain('2 chicos');
    const detalle = within(bloques).getByRole('list', { name: 'Ejercicios de FUERZA' });
    expect(detalle.textContent).toContain('Sentadilla');
    expect(detalle.textContent).toMatch(/30.*→.*35.*kg · 2 chicos/);
    expect(bloques.textContent).toContain('1 ejercicio');
  });

  it('un bloque que bajó lleva el signo menos', async () => {
    abrir(repo({
      obtenerCargasDelPlantel: async () => ({
        ejercicios: [{ pasoId: 'pa', nombre: 'Press', bloque: 'POTENCIA' }],
        movimientos: [
          { jugadorId: 'j-1', pasoId: 'pa', kg: 40, fecha: '2026-09-01', orden: 1 },
          { jugadorId: 'j-1', pasoId: 'pa', kg: 36, fecha: '2026-10-01', orden: 2 },
        ],
      }),
    }));
    const bloques = await screen.findByRole('list', { name: 'Cargas por bloque' });
    expect(bloques.textContent).toContain('−10%');
  });

  it('las pruebas: sprint en segundos con coma, y sólo las que el club cargó', async () => {
    abrir(repo({
      obtenerMedicionesSprintDelPlantel: async () => [
        { sesionId: 's1', fecha: '2026-10-01', jugadorId: 'j-1', distanciaM: 20, tiempoMs: 6500 },
        { sesionId: 's1', fecha: '2026-10-01', jugadorId: 'j-2', distanciaM: 20, tiempoMs: 7500 },
      ],
    }));
    const pruebas = await screen.findByRole('list', { name: 'Pruebas físicas' });
    expect(within(pruebas).getByRole('heading', { name: 'Velocidad · 20 + 20 metros' })).toBeTruthy();
    expect(pruebas.textContent).toContain('7,0 s · 2 chicos');
    expect(pruebas.textContent).toContain('Tiempo de ida y vuelta: baja cuando mejoran.');
    expect(within(pruebas).queryByRole('heading', { name: /Yo-Yo/ })).toBeNull();
    expect(within(pruebas).queryByRole('heading', { name: /Salto/ })).toBeNull();
    const tabla = within(pruebas).getByRole('list', { name: 'Velocidad · 20 + 20 metros, por medición' });
    expect(tabla.textContent).toContain('01/10');
  });

  it('el Yo-Yo y el salto aparecen cuando hay mediciones', async () => {
    abrir(repo({
      obtenerMedicionesYoyoDelPlantel: async () => [{ sesionId: 's1', fecha: '2026-10-01', jugadorId: 'j-1', idas: 10 }],
      obtenerMedicionesSaltoDelPlantel: async () => [{ sesionId: 's2', fecha: '2026-10-02', jugadorId: 'j-1', testSalto: 'cmj', tiempoVueloMs: 500 }],
    }));
    const pruebas = await screen.findByRole('list', { name: 'Pruebas físicas' });
    expect(within(pruebas).getByRole('heading', { name: 'Resistencia · Yo-Yo' })).toBeTruthy();
    expect(within(pruebas).getByRole('heading', { name: 'Salto · CMJ (manos en la cadera)' })).toBeTruthy();
    expect(pruebas.textContent).toMatch(/\d+,\d cm/);
  });

  it('si fallan los pesos o las pruebas, cada bloque cuenta lo suyo', async () => {
    abrir(repo({
      obtenerCargasDelPlantel: async () => { throw new Error('x'); },
      obtenerMedicionesYoyoDelPlantel: async () => { throw new Error('x'); },
    }));
    expect(await screen.findByText('No se pudieron cargar las cargas de los ejercicios')).toBeTruthy();
    expect(await screen.findByText('No se pudieron cargar las mediciones de velocidad, resistencia y salto')).toBeTruthy();
  });
});

describe('Datos: categoría y permisos', () => {
  it('sin categorías lo dice', async () => {
    abrir(repo({ obtenerPlantelesDelClub: async () => [] }));
    expect(await screen.findByText('Todavía no tenés categorías')).toBeTruthy();
  });

  it('la coordinación sola no ve los datos de cada chico', async () => {
    const pedirEstadisticas = vi.fn(async () => ESTADISTICAS);
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }), obtenerEstadisticasDelPlantel: pedirEstadisticas }));
    expect(await screen.findByText('Los chicos los ve el cuerpo técnico')).toBeTruthy();
    expect(pedirEstadisticas).not.toHaveBeenCalled();
  });

  it('el menú lleva a Datos y la marca como la pantalla actual', async () => {
    abrir(repo());
    const menu = (await screen.findAllByRole('navigation', { name: 'Menú de la app' }))[0];
    expect(within(menu).getByRole('link', { name: 'Datos' }).getAttribute('aria-current')).toBe('page');
  });

  it('muestra la categoría elegida arriba', async () => {
    abrir(repo());
    expect(await screen.findByRole('heading', { level: 1, name: 'Sub 13' })).toBeTruthy();
  });
});
