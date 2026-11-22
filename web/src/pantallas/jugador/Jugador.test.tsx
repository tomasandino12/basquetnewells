import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { claveDeEjercicio, fechaLocal } from '@datos/escalones.js';
import { desmarcarSesionCerrada } from '../../datos/errores';
import { renderConDatos, repositorioInventado } from '../../datos/renderDePrueba';
import type { FichaDeJugador, MiPlan, MiProgreso, Repositorio } from '../../datos/repositorio';
import { rutas } from '../../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
});

// Todo inventado: un jugador y un plan de ejemplo, nunca datos de chicos reales.
const ficha: FichaDeJugador = {
  jugadorId: 'j-1',
  clubId: 'c-1',
  clubNombre: 'Club de Ejemplo',
  nombre: 'Jugador de Ejemplo',
  planteles: [{ plantelId: 'p-1', categoriaCodigo: 'U13', categoria: 'Sub 13' }],
};

const plan: MiPlan = {
  planes: [
    {
      planId: 'pl-1',
      plantelId: 'p-1',
      categoria: 'Sub 13',
      nombreArchivo: 'plan.xlsx',
      sesiones: [
        {
          id: 's-1',
          fecha: '2099-01-05',
          lineas: [
            { id: 'l-1', orden: 1, bloque: 'Fuerza', nombreOriginal: 'Sentadilla', series: 3, reps: '8', cargaSugerida: null, pausa: '60"', notas: 'Bajar controlado', video: null },
            { id: 'l-2', orden: 2, bloque: 'Core', nombreOriginal: 'Plancha', series: 2, reps: '30"', cargaSugerida: null, pausa: null, notas: null, video: null },
          ],
        },
        { id: 's-2', fecha: '2099-01-12', lineas: [] },
      ],
    },
  ],
  // La clave es la del import (normalizada): línea y peso se unen por ella, no por el texto suelto.
  pesos: [{ clave: claveDeEjercicio('Sentadilla') as string, nombre: 'Sentadilla', kg: 42.5 }],
};

const jugador = (piso: Partial<Repositorio> = {}) =>
  repositorioInventado({ obtenerMiFicha: async () => ficha, obtenerMiPlan: async () => plan, ...piso });

describe('vista del jugador', () => {
  it('quien tiene ficha de jugador entra a lo suyo, con la barra de abajo de cinco destinos', async () => {
    const { router } = renderConDatos(rutas, { repo: jugador() });
    await waitFor(() => expect(router.state.location.pathname).toBe('/jugador/inicio'));
    const barra = await screen.findByRole('navigation', { name: 'Menú del jugador' });
    expect(within(barra).getAllByRole('link').map((a) => a.textContent)).toEqual(['Inicio', 'Físico', 'Progreso', 'Jugadas', 'Recursos']);
    expect(within(barra).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBe('page');
  });

  it('una cuenta que no es de jugador no ve nada de esta vista y puede ir a Hoy', async () => {
    renderConDatos(rutas, { repo: repositorioInventado(), ruta: '/jugador/fisico' });
    expect(await screen.findByText('Esta cuenta no es de jugador')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir a Hoy' })).toBeTruthy();
  });

  it('Físico lista la próxima sesión y todas las del plan; tocar una abre sus ejercicios por bloque con el peso propio', async () => {
    const u = userEvent.setup();
    const { router } = renderConDatos(rutas, { repo: jugador(), ruta: '/jugador/fisico' });
    expect(await screen.findByRole('heading', { name: 'Físico' })).toBeTruthy();
    // La próxima va arriba y la lista de todas abajo: la sesión del 05/01 aparece en las dos.
    const dosEjercicios = await screen.findAllByRole('link', { name: /2 ejercicios · Fuerza, Core/ });
    expect(dosEjercicios).toHaveLength(2);
    expect(screen.getByRole('link', { name: /0 ejercicios/ })).toBeTruthy();
    await u.click(dosEjercicios[0]);
    expect(router.state.location.pathname).toBe('/jugador/sesion/s-1');
    expect(await screen.findByRole('heading', { name: 'Fuerza' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Core' })).toBeTruthy();
    expect(screen.getByText('Bajar controlado')).toBeTruthy();
    expect(screen.getByText('Tu peso: 42,5 kg')).toBeTruthy();
    // Sin escalones ni botones de + y −: eso lo maneja el profe.
    expect(screen.queryByRole('button', { name: /[+−]/ })).toBeNull();
  });

  it('Sesión, sin id, muestra la próxima; sin plan dice qué falta y a dónde ir', async () => {
    renderConDatos(rutas, { repo: jugador(), ruta: '/jugador/sesion' });
    expect(await screen.findByRole('heading', { level: 1, name: /05\/01/ })).toBeTruthy();
    cleanup();
    renderConDatos(rutas, { repo: jugador({ obtenerMiPlan: async () => ({ planes: [], pesos: [] }) }), ruta: '/jugador/sesion' });
    expect(await screen.findByText('No hay sesión para mostrar')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver todas las sesiones' })).toBeTruthy();
  });

  it('Físico sin plan: estado vacío; con error de conexión: aviso y reintentar', async () => {
    renderConDatos(rutas, { repo: jugador({ obtenerMiPlan: async () => ({ planes: [], pesos: [] }) }), ruta: '/jugador/fisico' });
    expect(await screen.findByText('Todavía no hay nada cargado')).toBeTruthy();
    cleanup();
    renderConDatos(rutas, {
      repo: jugador({ obtenerMiPlan: async () => { throw new TypeError('Failed to fetch'); } }),
      ruta: '/jugador/fisico',
    });
    expect((await screen.findByRole('alert')).textContent).toContain('Sin conexión');
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeTruthy();
  });

  it('Progreso sin nada cargado dice que todavía no hay nada para mostrar', async () => {
    renderConDatos(rutas, { repo: jugador(), ruta: '/jugador/progreso' });
    expect(await screen.findByText('Todavía no hay nada para mostrar')).toBeTruthy();
  });

  it('Progreso muestra sólo lo propio: pesos por bloque, partidos con sus intentos y «pocos datos» en muestras chicas', async () => {
    const progreso: MiProgreso = {
      partidos: [
        { partidoId: 'pa-1', fecha: '2026-10-03', rivalNombre: 'Rival de Ejemplo', minSegundos: 600, pts: 8, dosAnotados: 2, dosIntentados: 3, tresAnotados: null, tresIntentados: null, libresAnotados: 1, libresIntentados: 2 },
      ],
      tiro: [],
      saltos: [{ sesionId: 'ss-1', fecha: '2026-10-01', test: 'cmj', intentos: [{ intento: 1, tiempoVueloMs: 500 }] }],
      sprints: [],
      yoyos: [],
      escalones: [
        { clave: 'sentadilla', nombre: 'Sentadilla', kg: 40, fecha: '2026-09-01' },
        { clave: 'sentadilla', nombre: 'Sentadilla', kg: 45, fecha: '2026-10-01' },
      ],
    };
    renderConDatos(rutas, { repo: jugador({ obtenerMiProgreso: async () => progreso }), ruta: '/jugador/progreso' });
    expect(await screen.findByRole('heading', { name: 'Partido a partido' })).toBeTruthy();
    expect(screen.getByText('Rival de Ejemplo')).toBeTruthy();
    expect(screen.getAllByText('pocos datos').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/67% · 2\/3/).length).toBeGreaterThan(0);
    // Lo que no se leyó es «sin datos», nunca 0 %.
    expect(screen.getAllByText('sin datos').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Salto' })).toBeTruthy();
    expect(screen.getByText('Todavía no te midieron el sprint.')).toBeTruthy();
    expect(screen.getByText('Todavía no te midieron la resistencia.')).toBeTruthy();
    expect(screen.getByText(/no reemplazan una evaluación médica/)).toBeTruthy();
    const pesos = screen.getByRole('region', { name: 'Tus pesos' });
    expect(within(pesos).getByText(/Sentadilla/)).toBeTruthy();
    expect(within(pesos).getByText(/\+5 kg/)).toBeTruthy();
  });

  it('Recursos: anota la apertura al abrir el material y no avisa quién ni cuántos', async () => {
    const abrir = vi.fn(async () => {});
    const u = userEvent.setup();
    renderConDatos(rutas, {
      repo: jugador({
        obtenerMisRecursos: async () => [{ id: 'r-1', titulo: 'Rutina de movilidad', descripcion: 'Antes de entrenar', enlace: 'https://ejemplo.test/rutina', fecha: '2026-10-02' }],
        registrarAperturaDeRecurso: abrir,
      }),
      ruta: '/jugador/recursos',
    });
    const enlace = await screen.findByRole('link', { name: /Abrir el material/ });
    enlace.addEventListener('click', (e) => e.preventDefault());
    await u.click(enlace);
    expect(abrir).toHaveBeenCalledWith('r-1');
    expect(screen.getByText(/no quién/)).toBeTruthy();
  });

  it('Recursos: si anotar la apertura falla, el material se abre igual', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, {
      repo: jugador({
        obtenerMisRecursos: async () => [{ id: 'r-1', titulo: 'Rutina', descripcion: null, enlace: 'https://ejemplo.test/rutina', fecha: '2026-10-02' }],
        registrarAperturaDeRecurso: async () => { throw new Error('sin red'); },
      }),
      ruta: '/jugador/recursos',
    });
    const enlace = await screen.findByRole('link', { name: /Abrir el material/ });
    enlace.addEventListener('click', (e) => e.preventDefault());
    await u.click(enlace);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Jugadas: agrupadas por tipo, sin autor, y tocar una la abre a pantalla completa', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, {
      repo: jugador({
        misJugadas: async () => [
          { id: 'ju-1', nombre: 'Salida de lateral', tipo: 'ataque', datos: { cancha: 'media', fichas: [{ id: 'a1', tipo: 'ataque', numero: 1, x: 0.5, y: 0.7 }], pasos: [{ acciones: [] }] } },
        ],
      }),
      ruta: '/jugador/jugadas',
    });
    await u.click(await screen.findByRole('button', { name: /Salida de lateral/ }));
    expect(await screen.findByRole('button', { name: 'Cerrar la jugada' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Jugada: Salida de lateral' })).toBeTruthy();
  });
});

describe('Inicio del jugador', () => {
  const hoy = fechaLocal() as string;
  const tiro = { id: 'r-1', titulo: 'Tiro libre', descripcion: null, enlace: null, fecha: '2026-10-02' };
  const manejo = { id: 'r-2', titulo: 'Manejo con dos pelotas', descripcion: null, enlace: null, fecha: '2026-10-02' };

  it('Inicio: es la primera pestaña y /jugador abre ahí', async () => {
    const { router } = renderConDatos(rutas, { repo: jugador(), ruta: '/jugador' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/jugador/inicio'));
    const barra = await screen.findByRole('navigation', { name: 'Menú del jugador' });
    expect(within(barra).getAllByRole('link')[0].textContent).toBe('Inicio');
    // La sesión que la pestaña ya no tiene sigue a un toque, y su ruta sigue existiendo.
    const enlace = await screen.findByRole('link', { name: /2 ejercicios · Fuerza, Core/ });
    expect(enlace.getAttribute('href')).toBe('/jugador/sesion/s-1');
    expect(screen.getByRole('heading', { name: 'Tu semana' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tu asistencia' })).toBeTruthy();
  });

  it('Inicio: marcar elige el recurso y llama a marcarPractica', async () => {
    // La base recuerda lo marcado: la consulta que sigue a la marca vuelve con él.
    let guardadas: { fecha: string; recursoId: string }[] = [];
    const marcar = vi.fn(async (recursoId: string) => (guardadas = [{ fecha: hoy, recursoId }]));
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: jugador({ obtenerMisRecursos: async () => [tiro, manejo], misPracticas: async () => guardadas, marcarPractica: marcar }), ruta: '/jugador/inicio' });
    const check = await screen.findByRole('checkbox', { name: /Hice mi rutina de hoy/ });
    expect(check.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('group', { name: '¿Qué practicaste?' })).toBeNull();
    await u.click(check);
    const lista = await screen.findByRole('group', { name: '¿Qué practicaste?' });
    expect(marcar).not.toHaveBeenCalled();
    await u.click(within(lista).getByRole('button', { name: /Manejo con dos pelotas/ }));
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('r-2', true));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Hice mi rutina de hoy/ }).getAttribute('aria-checked')).toBe('true'));
  });

  it('Inicio: con un solo recurso marca directo', async () => {
    const marcar = vi.fn(async (recursoId: string) => [{ fecha: hoy, recursoId }]);
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: jugador({ obtenerMisRecursos: async () => [tiro], marcarPractica: marcar }), ruta: '/jugador/inicio' });
    await u.click(await screen.findByRole('checkbox', { name: /Hice mi rutina de hoy/ }));
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('r-1', true));
    expect(screen.queryByRole('group', { name: '¿Qué practicaste?' })).toBeNull();
    // Se equivocó: hoy se puede desmarcar.
    const desmarcar = vi.fn(async () => []);
    cleanup();
    renderConDatos(rutas, {
      repo: jugador({ obtenerMisRecursos: async () => [tiro], misPracticas: async () => [{ fecha: hoy, recursoId: 'r-1' }], marcarPractica: desmarcar }),
      ruta: '/jugador/inicio',
    });
    const hecho = await screen.findByRole('checkbox', { name: /Hice mi rutina de hoy/ });
    await waitFor(() => expect(hecho.getAttribute('aria-checked')).toBe('true'));
    await u.click(hecho);
    await waitFor(() => expect(desmarcar).toHaveBeenCalledWith('r-1', false));
  });

  it('Inicio: sin recursos no muestra el check', async () => {
    renderConDatos(rutas, { repo: jugador({ obtenerMisRecursos: async () => [] }), ruta: '/jugador/inicio' });
    expect(await screen.findByText(/llega cuando tu profe te mande uno/)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    cleanup();
    // Los de lectura de juego se miran, no se practican: si son todos de ésos, tampoco hay check.
    renderConDatos(rutas, { repo: jugador({ obtenerMisRecursos: async () => [{ ...tiro, tipo: 'lectura' }] }), ruta: '/jugador/inicio' });
    expect(await screen.findByText(/llega cuando tu profe te mande uno/)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('Inicio: el texto dice que el profe ve cuántos, nunca quién', async () => {
    renderConDatos(rutas, { repo: jugador({ obtenerMisRecursos: async () => [tiro] }), ruta: '/jugador/inicio' });
    expect(await screen.findByText('Registro personal para tu progreso · tu profe ve cuántos lo practicaron, nunca quién')).toBeTruthy();
  });

  it('Inicio: la lista dice «2 de 3 esta semana» si el recurso tiene frecuencia', async () => {
    const u = userEvent.setup();
    const marcas = [{ fecha: hoy, recursoId: 'r-1' }];
    renderConDatos(rutas, {
      repo: jugador({ obtenerMisRecursos: async () => [{ ...tiro, frecuenciaSemanal: 3 }, manejo], misPracticas: async () => marcas }),
      ruta: '/jugador/inicio',
    });
    await u.click(await screen.findByRole('checkbox', { name: /Hice mi rutina de hoy/ }));
    const lista = await screen.findByRole('group', { name: '¿Qué practicaste?' });
    expect(within(lista).getByText('1 de 3 esta semana')).toBeTruthy();
    // Sin frecuencia, no se inventa una meta.
    expect(within(lista).queryAllByText(/de \d+ esta semana/)).toHaveLength(1);
  });

  describe('asistencia', () => {
    // Se fija el día para que «mes» y «año» no dependan de cuándo corre el test.
    const dia = (fecha: string, vino: boolean | null) => ({ fecha, vino });
    const dias = [
      dia('2026-02-02', true), dia('2026-02-09', false), dia('2026-03-02', true),
      dia('2026-10-05', true), dia('2026-10-12', true), dia('2026-10-19', true), dia('2026-10-26', true),
      dia('2026-11-02', true), dia('2026-11-04', false), dia('2026-11-09', true), dia('2026-11-11', true),
      dia('2026-11-16', null), dia('2026-11-18', true), dia('2026-11-20', true),
    ];

    it('Inicio: asistencia cambia entre últimos 10, mes y año', async () => {
      const u = userEvent.setup();
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-22T15:00:00Z') });
      try {
        renderConDatos(rutas, { repo: jugador({ miAsistencia: async () => dias }), ruta: '/jugador/inicio' });
        expect(await screen.findByText('Viniste a 8 de 9')).toBeTruthy();
        const selector = screen.getByRole('group', { name: 'Período de la asistencia' });
        expect(within(selector).getByRole('button', { name: 'Últimos 10' }).getAttribute('aria-pressed')).toBe('true');
        await u.click(within(selector).getByRole('button', { name: 'Mes' }));
        expect(await screen.findByText('Viniste a 5 de 6')).toBeTruthy();
        await u.click(within(selector).getByRole('button', { name: 'Año' }));
        expect(await screen.findByText('Viniste a 11 de 13')).toBeTruthy();
        expect(screen.getByText(/Mejor racha del período: 6/)).toBeTruthy();
      } finally {
        vi.useRealTimers();
      }
    });

    it('Inicio: no muestra motivo ni lesión', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-22T15:00:00Z') });
      try {
        const { container } = renderConDatos(rutas, { repo: jugador({ miAsistencia: async () => dias }), ruta: '/jugador/inicio' });
        await screen.findByText('Viniste a 8 de 9');
        // Un día sin tomar y una falta se ven igual de sencillos: «sin tomar» y «faltó», sin por qué.
        expect(screen.getAllByText('faltó').length).toBeGreaterThan(0);
        expect(screen.getAllByText('sin tomar').length).toBeGreaterThan(0);
        expect(container.textContent).not.toMatch(/motivo|lesi[oó]n|lesionad|justific/i);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('misiones del partido (es del profe)', () => {
  const profe = (piso: Partial<Repositorio> = {}) =>
    repositorioInventado({
      obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
      obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
      obtenerJugadoresDelPlantel: async () => [{ id: 'j-9', nombreClave: 'x', nombreLimpio: 'Ejemplo, Jugador', fechaNacimiento: null }],
      obtenerPrevia: async () => ({
        id: 'pv-1',
        fecha: '2026-10-03',
        rival: 'Rival de Ejemplo',
        partidoId: null,
        misionesEquipo: [{ id: 'me-1', metrica: 'texto', estado: null, comentario: null, texto: 'Defender en equipo' }],
        misionesJugador: [{ id: 'mj-1', jugadorId: 'j-9', metrica: 'texto', estado: null, comentario: null, texto: 'Pasar más' }],
      }),
      ...piso,
    });

  it('se evalúa cada misión, se puede desmarcar y guarda con el estado y el comentario', async () => {
    const guardar = vi.fn(async () => ({}));
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: profe({ evaluarMisiones: guardar }), ruta: '/misiones/pv-1' });
    expect(await screen.findByRole('heading', { name: 'Evaluar misiones' })).toBeTruthy();
    const grupo = screen.getByRole('group', { name: /Pasar más/ });
    await u.click(within(grupo).getByRole('button', { name: /Logrado/ }));
    expect(within(grupo).getByRole('button', { name: /Logrado/ }).getAttribute('aria-pressed')).toBe('true');
    await u.click(within(grupo).getByRole('button', { name: /Logrado/ }));
    expect(within(grupo).getByRole('button', { name: /Logrado/ }).getAttribute('aria-pressed')).toBe('false');
    await u.click(within(grupo).getByRole('button', { name: /En proceso/ }));
    await u.type(screen.getAllByLabelText('Comentario (opcional)')[1], 'Mejoró en el segundo tiempo');
    await u.click(screen.getByRole('button', { name: 'Guardar evaluación' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(guardar).toHaveBeenCalledWith({
      previaId: 'pv-1',
      partidoId: null,
      evaluaciones: [
        { tipo: 'jugador', id: 'mj-1', estado: 'en_proceso', comentario: 'Mejoró en el segundo tiempo' },
        { tipo: 'equipo', id: 'me-1', estado: null, comentario: null },
      ],
    });
  });

  it('si el partido ya es de otras misiones, lo dice con palabras y no con el código de la base', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: profe({ evaluarMisiones: async () => { throw new Error('PARTIDO_YA_VINCULADO'); } }), ruta: '/misiones/pv-1' });
    await u.click(await screen.findByRole('button', { name: 'Guardar evaluación' }));
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('Ese partido ya es de otras misiones');
    expect(aviso.textContent).not.toContain('PARTIDO_YA_VINCULADO');
  });

  it('sin partido cargado avisa que se puede evaluar igual; con varios, deja elegir y muestra el marcador', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, {
      repo: profe({
        obtenerPreviasDelPlantel: async () => [{ id: 'pv-1', fecha: '2026-10-03', rival: 'Rival de Ejemplo', plantelId: 'p-1', partidoId: null, evaluada: false }],
        obtenerPartidosDelPlantel: async () => [
          { id: 'pt-1', fecha: '2026-10-03', rivalNombre: 'Rival A', puntosPropios: 60, puntosRival: 50 },
          { id: 'pt-2', fecha: '2026-10-03', rivalNombre: 'Rival B', puntosPropios: null, puntosRival: null },
        ],
      }),
      ruta: '/misiones/pv-1',
    });
    expect(await screen.findByText('¿De qué partido son estas misiones?')).toBeTruthy();
    expect(screen.getByText(/Hay más de un partido posible/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Rival A/ }));
    expect(await screen.findByText('60–50')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Cambiar partido' }));
    expect(screen.getByText('¿De qué partido son estas misiones?')).toBeTruthy();
  });

  it('una previa que no existe no rompe: dice que no hay misiones para evaluar', async () => {
    renderConDatos(rutas, { repo: profe({ obtenerPrevia: async () => null }), ruta: '/misiones/nada' });
    expect(await screen.findByText('No hay misiones para evaluar')).toBeTruthy();
  });
});
