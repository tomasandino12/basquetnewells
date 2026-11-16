import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fechaLocal } from '@datos/escalones.js';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { LineaFisico, PasoFuerza, Repositorio, SesionFisico } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

const HOY = fechaLocal() as string;
const dia = (delta: number) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return fechaLocal(d) as string;
};

// Todo inventado: nombres, ejercicios y pesos. Nunca datos de chicos reales.
const JUGADORES = [
  { id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: null },
  { id: 'j-3', nombreClave: 'cabrera luis', nombreLimpio: 'Cabrera, Luis', fechaNacimiento: null },
  { id: 'j-2', nombreClave: 'benitez tomas', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: null },
];

const linea = (id: string, extra: Partial<LineaFisico> = {}): LineaFisico => ({
  id, orden: null, bloque: null, nombreOriginal: id, series: null, reps: null, cargaSugerida: null, pausa: null, notas: null, video: null, ...extra,
});

const LINEAS: LineaFisico[] = [
  linea('l-1', { orden: 1, bloque: 'Pierna', nombreOriginal: 'Sentadilla', series: 3, reps: '8 reps', cargaSugerida: 'Manc. 10kg (x2)', pausa: '60"', notas: 'Bajar despacio' }),
  linea('l-2', { orden: 2, bloque: 'Pierna', nombreOriginal: 'Zancada', series: 3, reps: '10 reps', cargaSugerida: 'PC', video: { nombre: 'Zancada', link: 'https://www.youtube.com/watch?v=abcdefghijk' } }),
  linea('l-3', { orden: 3, bloque: 'Core', nombreOriginal: 'Plancha', video: { nombre: 'Plancha', link: 'https://ejemplo.test/plancha' } }),
];

const SESIONES: SesionFisico[] = [
  { id: 's-1', fecha: dia(-7), lineas: [LINEAS[0]] },
  { id: 's-2', fecha: HOY, lineas: LINEAS },
  { id: 's-3', fecha: dia(7), lineas: [LINEAS[2]] },
];

const PLAN = { id: 'pl-1', nombreArchivo: 'Plan de ejemplo.xlsx', creadoEn: '2026-10-01T10:00:00Z', fechas: SESIONES.map((s) => s.fecha) };

const PASO_SENTADILLA: PasoFuerza = { id: 'pa-1', clave: 'SENTADILLA', nombre: 'Sentadilla', paso: 2.5 };

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    obtenerPlanesFisicos: async () => [PLAN],
    obtenerPlanFisico: async () => SESIONES,
    ...piso,
  });
}

const abrir = (r: Repositorio = repo(), ruta = '/fisico') => renderConDatos(rutas, { repo: r, ruta });
const RUTA_SESION = '/fisico/plan/pl-1/sesion/s-2';
const RUTA_SENTADILLA = `${RUTA_SESION}/ejercicio/l-1`;

describe('Físico: la lista de planes', () => {
  it('muestra el plan que contiene hoy, con rango, estado, cantidad de sesiones y la próxima', async () => {
    abrir();
    expect(await screen.findByRole('heading', { name: 'Plan de ejemplo.xlsx' })).toBeTruthy();
    const plan = screen.getByRole('region', { name: 'Plan elegido' });
    expect(plan.textContent).toContain('3 sesiones');
    expect(plan.textContent).toContain('En curso');
    expect(within(screen.getByRole('region', { name: 'Próxima sesión' })).getByRole('link').textContent).toContain('Hoy ·');
    expect(screen.getByRole('progressbar', { name: 'Sesiones que ya pasaron' }).getAttribute('aria-valuenow')).toBe('1');
  });

  it('cada sesión dice su día, cuántos ejercicios y qué bloques', async () => {
    abrir();
    const sesiones = within(await screen.findByRole('region', { name: 'Sesiones' }));
    const items = sesiones.getAllByRole('link');
    expect(items).toHaveLength(3);
    expect(items[1].textContent).toContain('3 ejercicios · Pierna, Core');
    expect(items[0].textContent).toContain('1 ejercicio');
  });

  it('tocar una sesión abre la sesión', async () => {
    const u = userEvent.setup();
    const { router } = abrir();
    const sesiones = within(await screen.findByRole('region', { name: 'Sesiones' }));
    await u.click(sesiones.getAllByRole('link')[1]);
    await waitFor(() => expect(router.state.location.pathname).toBe(RUTA_SESION));
  });

  it('«Otros planes»: el que se toca pasa a ser el visible; el otro queda en la lista', async () => {
    const u = userEvent.setup();
    const viejo = { id: 'pl-0', nombreArchivo: 'Plan viejo.xlsx', creadoEn: '2026-01-01T10:00:00Z', fechas: [dia(-100), dia(-90)] };
    abrir(repo({ obtenerPlanesFisicos: async () => [PLAN, viejo] }));
    const otros = within(await screen.findByRole('region', { name: 'Otros planes' }));
    expect(otros.getByRole('link').textContent).toContain('Terminó el');
    await u.click(otros.getByRole('link'));
    expect(await screen.findByRole('heading', { name: 'Plan viejo.xlsx' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Otros planes' })).getByRole('link').textContent).toContain('Plan de ejemplo.xlsx');
  });

  it('sin plan: lo dice, y «Cargar plan de fuerza» e «Inventario del club» siguen a mano', async () => {
    abrir(repo({ obtenerPlanesFisicos: async () => [] }));
    expect(await screen.findByText('Plan de fuerza', { selector: 'h3' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cargar plan de fuerza' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Inventario del club' })).toBeTruthy();
  });

  it('sin plan, el vacío ocupa todo el ancho y buena parte del alto, como la pantalla con datos', async () => {
    abrir(repo({ obtenerPlanesFisicos: async () => [] }));
    const caja = (await screen.findByText('Plan de fuerza', { selector: 'h3' })).parentElement!;
    expect(caja.className).toContain('w-full');
    expect(caja.className).toContain('min-h-[60svh]');
  });

  it('con plan, los dos enlaces también están, y «Cargar plan de fuerza» ya es de esta app', async () => {
    abrir();
    await screen.findByRole('heading', { name: 'Plan de ejemplo.xlsx' });
    expect(screen.getByRole('link', { name: 'Cargar plan de fuerza' }).getAttribute('href')).toBe('/fisico/cargar-plan');
    expect(screen.getByRole('link', { name: 'Inventario del club' })).toBeTruthy();
  });

  it('un plan que empieza después dice cuándo', async () => {
    abrir(repo({ obtenerPlanesFisicos: async () => [{ ...PLAN, fechas: [dia(10), dia(17)] }] }));
    expect((await screen.findByRole('region', { name: 'Plan elegido' })).textContent).toContain('Empieza el');
  });

  it('carga, y si falla ofrece reintentar', async () => {
    const u = userEvent.setup();
    const obtenerPlanesFisicos = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue([PLAN]);
    abrir(repo({ obtenerPlanesFisicos }));
    expect(screen.getByRole('status')).toBeTruthy();
    await u.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Plan de ejemplo.xlsx' })).toBeTruthy();
  });

  it('sin conexión lo dice', async () => {
    abrir(repo({ obtenerPlanesFisicos: async () => { throw new TypeError('Failed to fetch'); } }));
    expect(await screen.findByText('Sin conexión')).toBeTruthy();
  });

  it('la coordinación sola no entra', async () => {
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }) }));
    expect(await screen.findByText('Esto lo ve el cuerpo técnico')).toBeTruthy();
  });

  it('se llega desde el plantel', async () => {
    const u = userEvent.setup();
    const { router } = abrir(repo(), '/plantel');
    await u.click(await screen.findByRole('link', { name: 'Plan de fuerza' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/fisico'));
  });
});

describe('Físico: la sesión', () => {
  it('agrupa por bloque en el orden del archivo, con orden, nombre, carga, detalle y notas', async () => {
    abrir(repo({ obtenerPasos: async () => [PASO_SENTADILLA] }), RUTA_SESION);
    expect(await screen.findByRole('heading', { level: 2, name: 'Pierna' })).toBeTruthy();
    const pierna = within(screen.getByRole('region', { name: 'Pierna' }));
    const filas = pierna.getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('1 · Sentadilla');
    expect(filas[0].textContent).toContain('10 kg');
    expect(filas[0].textContent).toContain('3 series · 8 reps · pausa 60"');
    expect(filas[0].textContent).toContain('Manc. 10kg (x2)');
    expect(filas[0].textContent).toContain('Bajar despacio');
    expect(within(screen.getByRole('region', { name: 'Core' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('dice «Escalón N kg», «Sin escalón» o «peso corporal» según el ejercicio', async () => {
    abrir(repo({ obtenerPasos: async () => [PASO_SENTADILLA] }), RUTA_SESION);
    const pierna = within(await screen.findByRole('region', { name: 'Pierna' }));
    const [sentadilla, zancada] = pierna.getAllByRole('listitem');
    expect(sentadilla.textContent).toContain('Escalón 2,5 kg');
    expect(zancada.textContent).toContain('peso corporal');
    expect(zancada.textContent).toContain('PC');
    expect(within(screen.getByRole('region', { name: 'Core' })).getByRole('listitem').textContent).toContain('Sin escalón');
  });

  it('«Ver video»: YouTube se ve embebido en una hoja; otro link web se abre aparte; sin video no hay botón', async () => {
    const u = userEvent.setup();
    abrir(repo(), RUTA_SESION);
    const pierna = within(await screen.findByRole('region', { name: 'Pierna' }));
    const [sentadilla, zancada] = pierna.getAllByRole('listitem');
    expect(within(sentadilla).queryByText('Ver video')).toBeNull();
    await u.click(within(zancada).getByRole('button', { name: 'Ver video' }));
    const marco = (await screen.findByTitle('Video: Zancada')) as HTMLIFrameElement;
    expect(marco.src).toContain('youtube-nocookie.com/embed/abcdefghijk');
    expect(screen.getByRole('link', { name: 'Abrir en YouTube' }).getAttribute('href')).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    await u.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTitle('Video: Zancada')).toBeNull());
    const externo = within(screen.getByRole('region', { name: 'Core' })).getByRole('link', { name: 'Ver video' });
    expect(externo.getAttribute('href')).toBe('https://ejemplo.test/plancha');
    expect(externo.getAttribute('target')).toBe('_blank');
  });

  it('«Ver video» no abre los escalones; tocar el ejercicio sí', async () => {
    const u = userEvent.setup();
    const { router } = abrir(repo(), RUTA_SESION);
    const pierna = within(await screen.findByRole('region', { name: 'Pierna' }));
    await u.click(within(pierna.getAllByRole('listitem')[1]).getByRole('button', { name: 'Ver video' }));
    expect(router.state.location.pathname).toBe(RUTA_SESION);
    await u.keyboard('{Escape}');
    await u.click(within(pierna.getAllByRole('listitem')[0]).getAllByRole('link')[0]);
    await waitFor(() => expect(router.state.location.pathname).toBe(RUTA_SENTADILLA));
  });

  it('una sesión que no existe lo dice', async () => {
    abrir(repo(), '/fisico/plan/pl-1/sesion/zzz');
    expect(await screen.findByText('No encontramos esa sesión')).toBeTruthy();
  });

  it('si fallan los escalones, los ejercicios se ven igual', async () => {
    abrir(repo({ obtenerPasos: async () => { throw new Error('boom'); } }), RUTA_SESION);
    expect(await screen.findByText(/No se pudieron leer los escalones/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Pierna' })).toBeTruthy();
  });

  it('se relee al volver: un escalón recién definido aparece', async () => {
    const u = userEvent.setup();
    let pasos: PasoFuerza[] = [];
    const { router } = abrir(repo({
      obtenerPasos: async () => pasos,
      crearPaso: async ({ clave, nombre, paso }) => {
        pasos = [{ id: 'pa-1', clave, nombre, paso }];
        return pasos[0];
      },
    }), RUTA_SENTADILLA);
    await u.click(await screen.findByRole('button', { name: 'Definir escalón' }));
    await u.type(screen.getByLabelText('Escalón (kg)'), '5');
    await u.click(screen.getByRole('button', { name: 'Guardar escalón' }));
    await waitFor(() => expect(screen.queryByLabelText('Escalón (kg)')).toBeNull());
    await u.click(screen.getByRole('link', { name: 'Sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(RUTA_SESION));
    const pierna = within(await screen.findByRole('region', { name: 'Pierna' }));
    await waitFor(() => expect(pierna.getAllByRole('listitem')[0].textContent).toContain('Escalón 5 kg'));
  });
});

describe('Físico: escalones y pesos', () => {
  const conPesos = (extra: Partial<Repositorio> = {}) => repo({
    obtenerPasos: async () => [PASO_SENTADILLA],
    obtenerEscalonesActuales: async () => [
      { jugadorId: 'j-1', kg: 20, desde: '2026-11-02T12:00:00Z' },
      { jugadorId: 'j-2', kg: 2.5, desde: '2026-11-03T12:00:00Z' },
    ],
    ...extra,
  });
  const filaDe = async (nombre: string) => {
    const lista = within(await screen.findByRole('list', { name: 'Pesos de los jugadores' }));
    return within(lista.getAllByRole('listitem').find((f) => f.textContent?.startsWith(nombre))!);
  };

  it('arriba, el ejercicio en grande, su avance en la sesión y el escalón', async () => {
    abrir(conPesos(), RUTA_SENTADILLA);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sentadilla' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: /Avance/ }).getAttribute('aria-valuetext')).toBe('Ejercicio 1 de 3');
    expect(screen.getByText('En esta sesión: 3 series · 8 reps · pausa 60" · Manc. 10kg (x2)')).toBeTruthy();
    expect(await screen.findByText('2,5 kg cada vez que subís o bajás. Es el mismo para todo el club.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar escalón' })).toBeTruthy();
  });

  it('una fila por jugador, por apellido; con peso y desde cuándo, o «sin peso» con «Poner peso»', async () => {
    abrir(conPesos(), RUTA_SENTADILLA);
    const lista = within(await screen.findByRole('list', { name: 'Pesos de los jugadores' }));
    const filas = lista.getAllByRole('listitem');
    expect(filas.map((f) => f.querySelector('p')!.textContent)).toEqual(['Acosta, B.', 'Benítez, T.', 'Cabrera, L.']);
    expect(filas[0].textContent).toContain('20');
    expect(filas[0].textContent).toMatch(/desde el \d\d\/11/);
    expect(filas[2].textContent).toContain('sin peso');
    expect(within(filas[2]).getByRole('button', { name: /Poner peso/ })).toBeTruthy();
    expect(screen.getByText('Sub 13 · 3 jugadores')).toBeTruthy();
  });

  it('+ y − suman y restan el escalón y guardan al instante los kg de destino', async () => {
    const u = userEvent.setup();
    const moverEscalon = vi.fn(async ({ jugadorId, kg }: { jugadorId: string; kg: number }) => ({ jugadorId, kg, desde: new Date().toISOString() }));
    abrir(conPesos({ moverEscalon }), RUTA_SENTADILLA);
    const acosta = await filaDe('Acosta');
    await u.click(acosta.getByRole('button', { name: /Subir un escalón/ }));
    await waitFor(() => expect(moverEscalon).toHaveBeenCalledWith({ clubId: 'c-1', jugadorId: 'j-1', pasoId: 'pa-1', kg: 22.5 }));
    await u.click(acosta.getByRole('button', { name: /Bajar un escalón/ }));
    await waitFor(() => expect(moverEscalon).toHaveBeenCalledWith({ clubId: 'c-1', jugadorId: 'j-1', pasoId: 'pa-1', kg: 17.5 }));
  });

  it('− se apaga cuando restar dejaría el peso en cero', async () => {
    abrir(conPesos(), RUTA_SENTADILLA);
    const benitez = await filaDe('Benítez');
    expect((benitez.getByRole('button', { name: /Bajar un escalón/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((benitez.getByRole('button', { name: /Subir un escalón/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('sin escalón no hay + ni −, pero el peso se puede tocar y corregir', async () => {
    const u = userEvent.setup();
    const moverEscalon = vi.fn(async ({ jugadorId, kg }: { jugadorId: string; kg: number }) => ({ jugadorId, kg, desde: new Date().toISOString() }));
    abrir(conPesos({ obtenerPasos: async () => [{ ...PASO_SENTADILLA, paso: null }], moverEscalon }), RUTA_SENTADILLA);
    const acosta = await filaDe('Acosta');
    expect(acosta.queryByRole('button', { name: /Subir un escalón/ })).toBeNull();
    expect(acosta.queryByRole('button', { name: /Bajar un escalón/ })).toBeNull();
    expect(screen.getByText('Todavía no tiene escalón. Podés anotar el peso de cada chico igual.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Definir escalón' })).toBeTruthy();
    await u.click(acosta.getByRole('button', { name: /Cambiar el peso/ }));
    const campo = await screen.findByLabelText('Peso (kg)');
    expect((campo as HTMLInputElement).value).toBe('20');
    await u.clear(campo);
    await u.type(campo, '22,5{Enter}');
    await waitFor(() => expect(moverEscalon).toHaveBeenCalledWith(expect.objectContaining({ jugadorId: 'j-1', kg: 22.5 })));
  });

  it('«Poner peso» arranca con el de la carga de la línea, y se guarda recién al confirmar', async () => {
    const u = userEvent.setup();
    const moverEscalon = vi.fn(async ({ jugadorId, kg }: { jugadorId: string; kg: number }) => ({ jugadorId, kg, desde: new Date().toISOString() }));
    abrir(conPesos({ moverEscalon }), RUTA_SENTADILLA);
    const cabrera = await filaDe('Cabrera');
    await u.click(cabrera.getByRole('button', { name: /Poner peso/ }));
    expect((await screen.findByLabelText('Peso (kg)') as HTMLInputElement).value).toBe('10');
    expect(moverEscalon).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Guardar peso' }));
    await waitFor(() => expect(moverEscalon).toHaveBeenCalledWith({ clubId: 'c-1', jugadorId: 'j-3', pasoId: 'pa-1', kg: 10 }));
  });

  it('un ejercicio de peso corporal arranca el campo vacío', async () => {
    const u = userEvent.setup();
    abrir(conPesos({ obtenerEscalonesActuales: async () => [] }), `${RUTA_SESION}/ejercicio/l-2`);
    const acosta = await filaDe('Acosta');
    await u.click(acosta.getByRole('button', { name: /Poner peso/ }));
    expect((await screen.findByLabelText('Peso (kg)') as HTMLInputElement).value).toBe('');
  });

  it('un peso que no es un número no se guarda y lo explica', async () => {
    const u = userEvent.setup();
    const moverEscalon = vi.fn();
    abrir(conPesos({ moverEscalon }), RUTA_SENTADILLA);
    const cabrera = await filaDe('Cabrera');
    await u.click(cabrera.getByRole('button', { name: /Poner peso/ }));
    const campo = await screen.findByLabelText('Peso (kg)');
    await u.clear(campo);
    await u.type(campo, '1e2{Enter}');
    expect(await screen.findByText(/"1e2" no es un número en kg/)).toBeTruthy();
    await u.clear(campo);
    await u.type(campo, '0{Enter}');
    expect(await screen.findByText('Tiene que ser mayor que cero.')).toBeTruthy();
    expect(moverEscalon).not.toHaveBeenCalled();
  });

  it('mientras guarda, la fila no responde; si falla, avisa y queda el peso de antes', async () => {
    const u = userEvent.setup();
    let falla!: (e: Error) => void;
    const moverEscalon = vi.fn(() => new Promise<never>((_, rechazar) => { falla = rechazar; }));
    abrir(conPesos({ moverEscalon }), RUTA_SENTADILLA);
    const acosta = await filaDe('Acosta');
    await u.click(acosta.getByRole('button', { name: /Subir un escalón/ }));
    await waitFor(() => expect((acosta.getByRole('button', { name: /Subir un escalón/ }) as HTMLButtonElement).disabled).toBe(true));
    expect((acosta.getByRole('button', { name: /Bajar un escalón/ }) as HTMLButtonElement).disabled).toBe(true);
    falla(new Error('boom'));
    expect(await screen.findByText('No se pudo guardar el peso. Intentá de nuevo.')).toBeTruthy();
    expect(acosta.getByRole('button', { name: /Cambiar el peso/ }).textContent).toContain('20');
    expect((acosta.getByRole('button', { name: /Subir un escalón/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('sin conexión al guardar un peso lo dice', async () => {
    const u = userEvent.setup();
    abrir(conPesos({ moverEscalon: async () => { throw new TypeError('Failed to fetch'); } }), RUTA_SENTADILLA);
    const acosta = await filaDe('Acosta');
    await u.click(acosta.getByRole('button', { name: /Subir un escalón/ }));
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
  });

  it('el primer peso de un ejercicio sin fila propia la crea sin escalón y guarda', async () => {
    const u = userEvent.setup();
    const crearPaso = vi.fn(async ({ clave, nombre, paso }: { clave: string; nombre: string; paso: number | null }) => ({ id: 'pa-9', clave, nombre, paso }));
    const moverEscalon = vi.fn(async ({ jugadorId, kg }: { jugadorId: string; kg: number }) => ({ jugadorId, kg, desde: new Date().toISOString() }));
    abrir(repo({ crearPaso, moverEscalon }), RUTA_SENTADILLA);
    const acosta = await filaDe('Acosta');
    await u.click(acosta.getByRole('button', { name: /Poner peso/ }));
    const campo = await screen.findByLabelText('Peso (kg)');
    await u.clear(campo);
    await u.type(campo, '15{Enter}');
    await waitFor(() => expect(moverEscalon).toHaveBeenCalledWith({ clubId: 'c-1', jugadorId: 'j-1', pasoId: 'pa-9', kg: 15 }));
    expect(crearPaso).toHaveBeenCalledWith({ clubId: 'c-1', clave: 'SENTADILLA', nombre: 'Sentadilla', paso: null });
  });

  it('si otra pestaña creó la fila en el medio (23505), usa esa y guarda igual', async () => {
    const u = userEvent.setup();
    const duplicada = Object.assign(new Error('duplicate'), { code: '23505' });
    const obtenerPasos = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'pa-7', clave: 'SENTADILLA', nombre: 'Sentadilla', paso: 5 }]);
    const moverEscalon = vi.fn(async ({ jugadorId, kg }: { jugadorId: string; kg: number }) => ({ jugadorId, kg, desde: new Date().toISOString() }));
    abrir(repo({ obtenerPasos, crearPaso: async () => { throw duplicada; }, moverEscalon }), RUTA_SENTADILLA);
    const acosta = await filaDe('Acosta');
    await u.click(acosta.getByRole('button', { name: /Poner peso/ }));
    const campo = await screen.findByLabelText('Peso (kg)');
    await u.clear(campo);
    await u.type(campo, '15{Enter}');
    await waitFor(() => expect(moverEscalon).toHaveBeenCalledWith({ clubId: 'c-1', jugadorId: 'j-1', pasoId: 'pa-7', kg: 15 }));
  });

  it('definir el escalón crea la fila; editarlo cambia la que hay', async () => {
    const u = userEvent.setup();
    const editarPaso = vi.fn(async (id: string, paso: number) => ({ id, clave: 'SENTADILLA', nombre: 'Sentadilla', paso }));
    abrir(conPesos({ editarPaso }), RUTA_SENTADILLA);
    await u.click(await screen.findByRole('button', { name: 'Editar escalón' }));
    const campo = screen.getByLabelText('Escalón (kg)') as HTMLInputElement;
    expect(campo.value).toBe('2,5');
    await u.clear(campo);
    await u.type(campo, '5');
    await u.click(screen.getByRole('button', { name: 'Guardar escalón' }));
    await waitFor(() => expect(editarPaso).toHaveBeenCalledWith('pa-1', 5));
  });

  it('el escalón se valida y, si la base dice que ya existe, lo cuenta con palabras del profe', async () => {
    const u = userEvent.setup();
    abrir(repo({ crearPaso: async () => { throw Object.assign(new Error('x'), { code: '23505' }); } }), RUTA_SENTADILLA);
    await u.click(await screen.findByRole('button', { name: 'Definir escalón' }));
    await u.click(screen.getByRole('button', { name: 'Guardar escalón' }));
    expect(await screen.findByText('Escribí un número.')).toBeTruthy();
    await u.type(screen.getByLabelText('Escalón (kg)'), '2,5');
    await u.click(screen.getByRole('button', { name: 'Guardar escalón' }));
    expect(await screen.findByText('Alguien definió este escalón recién. Cerrá y volvé a abrir el ejercicio.')).toBeTruthy();
  });

  it('un ausente de hoy lo dice con todas las letras', async () => {
    abrir(conPesos({
      obtenerEntrenamientos: async () => [{ id: 'e-1', fecha: HOY, hubo: true, filas: [{ jugadorId: 'j-1', estado: 'ausente' }, { jugadorId: 'j-2', estado: 'presente' }] }],
    }), RUTA_SENTADILLA);
    const acosta = await filaDe('Acosta');
    await waitFor(() => expect(acosta.getByText('ausente')).toBeTruthy());
    expect((await filaDe('Benítez')).queryByText('ausente')).toBeNull();
  });

  it('se recorre de a un ejercicio: anterior y siguiente dentro de la sesión', async () => {
    const u = userEvent.setup();
    const { router } = abrir(conPesos(), RUTA_SENTADILLA);
    await screen.findByRole('heading', { level: 1, name: 'Sentadilla' });
    expect(screen.queryByRole('link', { name: 'Ejercicio anterior' })).toBeNull();
    await u.click(screen.getByRole('link', { name: 'Ejercicio siguiente' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${RUTA_SESION}/ejercicio/l-2`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Zancada' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: /Avance/ }).getAttribute('aria-valuenow')).toBe('2');
  });

  it('categoría sin jugadores, error con reintento y ejercicio inexistente', async () => {
    const u = userEvent.setup();
    abrir(conPesos({ obtenerJugadoresDelPlantel: async () => [] }), RUTA_SENTADILLA);
    expect(await screen.findByText('Esta categoría todavía no tiene jugadores.')).toBeTruthy();
    cleanup();
    const obtenerPasos = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue([PASO_SENTADILLA]);
    abrir(conPesos({ obtenerPasos }), RUTA_SENTADILLA);
    await u.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('list', { name: 'Pesos de los jugadores' })).toBeTruthy();
    cleanup();
    abrir(conPesos(), `${RUTA_SESION}/ejercicio/zzz`);
    expect(await screen.findByText('No encontramos ese ejercicio')).toBeTruthy();
  });
});
