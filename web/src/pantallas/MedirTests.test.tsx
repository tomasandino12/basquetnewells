import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { PayloadDeMedicion, Repositorio } from '../datos/repositorio';
import { claveBorrador, leerBorrador } from '../medir/sesiones';
import { rutas } from '../rutas';
import { guardarBorrador } from '../../../src/ui/borradorMedicion.js';
import { normalizarSprint } from './MedirSprint';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
  vi.restoreAllMocks();
});

const JUGADORES = [
  { id: 'j-2', nombreClave: 'b', nombreLimpio: 'Zapata, Bruno', fechaNacimiento: null },
  { id: 'j-1', nombreClave: 'a', nombreLimpio: 'Alvarez, Ana', fechaNacimiento: null },
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    obtenerSesionesDeMedicion: async () => [],
    ...piso,
  });
}

/** Un repositorio que anota lo que se manda a guardar. */
function conGuardado(falla?: Error) {
  const enviados: PayloadDeMedicion[] = [];
  const r = repo({
    guardarSesionMedicion: async (p) => {
      enviados.push(p);
      if (falla) throw falla;
      return {};
    },
  });
  return { r, enviados };
}

const clave = (tipo: 'tiro' | 'salto' | 'sprint' | 'yoyo') => claveBorrador('u-1', 'c-1', 'p-1', tipo);

describe('Medir: batería de tiro', () => {
  it('va de a un chico por orden alfabético; cada toque queda en el celular y volver a tocar lo borra', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: repo(), ruta: '/medir/tiro' });
    expect(await screen.findByRole('heading', { name: 'Alvarez, Ana' })).toBeTruthy();
    const grupos = screen.getAllByRole('group', { name: /anotados/ });
    // 5 posiciones de la cancha y los libres.
    expect(grupos).toHaveLength(6);
    await u.click(within(grupos[0]).getByRole('button', { name: '7' }));
    expect(Object.values(leerBorrador(clave('tiro'))?.valores?.['j-1'] ?? {})).toEqual([7]);
    await u.click(within(grupos[0]).getByRole('button', { name: '7' }));
    expect(Object.keys(leerBorrador(clave('tiro'))?.valores?.['j-1'] ?? {})).toEqual([]);
  });

  it('marcar ausente pasa al siguiente y lo dice; desmarcar no avanza', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: repo(), ruta: '/medir/tiro' });
    await u.click(await screen.findByRole('button', { name: 'Marcar ausente' }));
    expect(await screen.findByRole('heading', { name: 'Zapata, Bruno' })).toBeTruthy();
    expect(leerBorrador(clave('tiro'))?.valores?.['j-1']).toEqual({ ausente: true });
    await u.click(screen.getByRole('button', { name: /Alvarez, Ana: ausente/ }));
    await u.click(screen.getByRole('button', { name: 'Estuvo presente' }));
    expect(screen.getByRole('heading', { name: 'Alvarez, Ana' })).toBeTruthy();
  });

  it('guardar manda la batería, borra el borrador y vuelve a Medir con el aviso', async () => {
    const u = userEvent.setup();
    const { r, enviados } = conGuardado();
    const { router } = renderConDatos(rutas, { repo: r, ruta: '/medir/tiro' });
    const grupos = await screen.findAllByRole('group', { name: /anotados/ });
    await u.click(within(grupos[0]).getByRole('button', { name: '0' }));
    await u.click(screen.getByRole('button', { name: 'Cerrar y guardar la sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/medir'));
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ clubId: 'c-1', plantelId: 'p-1', tipo: 'tiro' });
    // 0 de 10 es un dato real: viaja.
    expect(enviados[0].mediciones).toEqual([expect.objectContaining({ jugadorId: 'j-1', anotados: 0, intentos: 10 })]);
    expect(leerBorrador(clave('tiro'))).toBeNull();
    expect(await screen.findByText('Sesión guardada')).toBeTruthy();
  });

  it('sin nada cargado no manda nada y lo dice', async () => {
    const u = userEvent.setup();
    const { r, enviados } = conGuardado();
    renderConDatos(rutas, { repo: r, ruta: '/medir/tiro' });
    await u.click(await screen.findByRole('button', { name: 'Cerrar y guardar la sesión' }));
    expect(await screen.findByText('Todavía no cargaste ninguna medición.')).toBeTruthy();
    expect(enviados).toHaveLength(0);
  });

  it('si no hay señal el borrador queda y reintentar usa la misma sesión', async () => {
    const u = userEvent.setup();
    const { r, enviados } = conGuardado(new TypeError('Failed to fetch'));
    renderConDatos(rutas, { repo: r, ruta: '/medir/tiro' });
    const grupos = await screen.findAllByRole('group', { name: /anotados/ });
    await u.click(within(grupos[1]).getByRole('button', { name: '4' }));
    await u.click(screen.getByRole('button', { name: 'Cerrar y guardar la sesión' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(leerBorrador(clave('tiro'))).not.toBeNull();
    await u.click(screen.getByRole('button', { name: 'Cerrar y guardar la sesión' }));
    await waitFor(() => expect(enviados).toHaveLength(2));
    expect(enviados[1].sesionId).toBe(enviados[0].sesionId);
  });

  it('retoma lo que dejó la app de siempre, con su sesión', async () => {
    guardarBorrador(clave('tiro'), { fecha: '2026-11-05', valores: { 'j-2': { ausente: true } }, sesionId: 'ses-vieja' });
    const { r, enviados } = conGuardado();
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: r, ruta: '/medir/tiro' });
    expect(await screen.findByText(/05\/11\/26/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Cerrar y guardar la sesión' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({ fecha: '2026-11-05', sesionId: 'ses-vieja' });
  });
});

describe('Medir: salto', () => {
  it('ausente y el test elegido viajan en el guardado', async () => {
    const u = userEvent.setup();
    const { r, enviados } = conGuardado();
    renderConDatos(rutas, { repo: r, ruta: '/medir/salto' });
    await u.selectOptions(await screen.findByRole('combobox'), 'abalakov');
    await u.click(screen.getByRole('button', { name: 'Ausente Alvarez, Ana' }));
    expect(screen.getByRole('button', { name: 'Alvarez, Ana: cargar el salto 1' })).toHaveProperty('disabled', true);
    await u.click(screen.getByRole('button', { name: 'Guardar la sesión' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({ tipo: 'salto', testSalto: 'abalakov', mediciones: [{ jugadorId: 'j-1', intento: 1 }] });
  });

  it('muestra en centímetros los saltos que ya estaban marcados', async () => {
    guardarBorrador(clave('salto'), { fecha: '2026-11-05', valores: { 'j-1': { intentos: [{ tiempoVueloMs: 500, fpsCaptura: 240 }] } }, testSalto: 'cmj' });
    renderConDatos(rutas, { repo: repo(), ruta: '/medir/salto' });
    // h = g·t²/8 = 9,81 · 0,25 / 8 = 30,7 cm
    expect(await screen.findByRole('button', { name: /salto 1: 30,7 cm/ })).toBeTruthy();
  });
});

describe('Medir: sprint', () => {
  it('teclear un intento lo valida, lo guarda con la distancia elegida y marca el mejor', async () => {
    const u = userEvent.setup();
    const { r, enviados } = conGuardado();
    renderConDatos(rutas, { repo: r, ruta: '/medir/sprint' });
    await u.click(await screen.findByRole('button', { name: '20 m' }));
    const tarjeta = within(screen.getAllByText('Alvarez, Ana')[0].closest('li')!);
    await u.click(tarjeta.getByRole('button', { name: 'Teclear tiempo' }));
    await u.type(await screen.findByLabelText(/Ida/), '4,6');
    await u.type(screen.getByLabelText(/Total/), '10,2');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await tarjeta.findByRole('button', { name: /Intento 1: 10,2/ })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Guardar la sesión' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({ tipo: 'sprint', distanciaSprintM: 20, mediciones: [{ jugadorId: 'j-1', intento: 1, parcialMs: 4600, tiempoMs: 10200 }] });
  });

  it('un tiempo imposible no se acepta', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: repo(), ruta: '/medir/sprint' });
    const tarjeta = within((await screen.findAllByText('Alvarez, Ana'))[0].closest('li')!);
    await u.click(tarjeta.getByRole('button', { name: 'Teclear tiempo' }));
    await u.type(await screen.findByLabelText(/Ida/), '1');
    await u.type(screen.getByLabelText(/Total/), '1');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(leerBorrador(clave('sprint'))).toBeNull();
  });

  it('un borrador viejo (sólo el total) se lee como intento sin ida', () => {
    expect(normalizarSprint({ a: { intentos: [9800 as unknown as null] } })).toEqual({ a: { intentos: [{ parcialMs: null, tiempoMs: 9800 }] } });
  });
});

describe('Medir: Yo-Yo', () => {
  it('sin audio no arranca y lo dice', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: repo(), ruta: '/medir/yoyo' });
    expect(await screen.findByText('2 de 2')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Zapata, Bruno/ }));
    expect(screen.getByText('1 de 2')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(await screen.findByText(/no puede reproducir los pitidos/)).toBeTruthy();
  });

  it('una prueba terminada sin guardar se retoma en el resumen; se corrige y se guarda', async () => {
    guardarBorrador(clave('yoyo'), { fecha: '2026-11-05', valores: { 'j-1': { idas: 40 }, 'j-2': { ausente: true } }, sesionId: 's-y' });
    const u = userEvent.setup();
    const { r, enviados } = conGuardado();
    renderConDatos(rutas, { repo: r, ruta: '/medir/yoyo' });
    expect(await screen.findByText('Resumen')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Corregir Zapata, Bruno' }));
    await u.type(await screen.findByLabelText('Idas completas'), '12');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await u.click(await screen.findByRole('button', { name: 'Guardar la sesión' }));
    await waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({ tipo: 'yoyo', sesionId: 's-y' });
    expect(enviados[0].mediciones).toEqual(expect.arrayContaining([{ jugadorId: 'j-1', idas: 40 }, { jugadorId: 'j-2', idas: 12 }]));
  });

  it('con pitidos: tocar dos veces saca al chico con sus idas y terminar arma el resumen', async () => {
    let ahora = -2;
    // El tiempo de la prueba lo maneja la prueba: tiempoActual = currentTime - cero, y cero = 5 s.
    class AudioFalso {
      state = 'running';
      destination = {};
      get currentTime() { return ahora + 5; }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      addEventListener() {}
      createOscillator() { return { frequency: {}, connect: (x: unknown) => x, start() {}, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect: (x: unknown) => x }; }
    }
    vi.stubGlobal('AudioContext', AudioFalso);
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: repo(), ruta: '/medir/yoyo' });
    await u.click(await screen.findByRole('button', { name: 'Empezar' }));
    expect(await screen.findByText(/Empieza en/)).toBeTruthy();
    ahora = 100;
    await screen.findByText(/Nivel \d+ · Ida \d+/);
    await u.click(screen.getByRole('button', { name: /Alvarez, Ana/ }));
    expect(await screen.findByText('1º aviso')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Alvarez, Ana/ }));
    expect(await screen.findByText(/Afuera ·/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Terminar test' }));
    await u.click(await screen.findByRole('button', { name: 'Terminar' }));
    expect(await screen.findByText('Resumen')).toBeTruthy();
    const valores = leerBorrador(clave('yoyo'))?.valores as Record<string, { idas: number }>;
    expect(valores['j-1'].idas).toBeLessThanOrEqual(valores['j-2'].idas);
    vi.unstubAllGlobals();
  });
});
