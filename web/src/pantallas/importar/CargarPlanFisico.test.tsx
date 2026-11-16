import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../../datos/errores';
import { renderConDatos, repositorioInventado } from '../../datos/renderDePrueba';
import type { Repositorio } from '../../datos/repositorio';
import { rutas } from '../../rutas';

const lector = vi.hoisted(() => ({ plan: vi.fn() }));
vi.mock('@parser/parserFisico.js', () => ({ parsearPlanFisico: lector.plan }));
// crypto.subtle no está en el entorno de pruebas: el hash se inventa.
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
  lector.plan.mockReset();
});

// Todo inventado.
const linea = (nombre: string, orden: number) => ({
  nombreOriginal: nombre, nombreClave: nombre.toUpperCase(), orden, bloque: 'A', series: 3, reps: '8', cargaSugerida: null, pausa: null, notas: null,
});

const PLAN = {
  errores: [],
  advertencias: [{ mensaje: 'Una hoja no tiene sesiones' }],
  biblioteca: [],
  sesiones: [
    { fecha: '2026-10-05', ejercicios: [linea('Sentadilla', 1), linea('Press plano', 2)] },
    { fecha: '2026-10-12', ejercicios: [linea('Sentadilla', 1)] },
  ],
};

const BIBLIOTECA = [
  { id: 'f-1', clave: 'SENTADILLA', nombre: 'Sentadilla', bloque: null, link: 'https://video.test/sentadilla' },
  { id: 'f-2', clave: 'DOMINADAS', nombre: 'Dominadas', bloque: 'Tren superior', link: 'https://video.test/dominadas' },
];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerEjerciciosFuerza: async () => BIBLIOTECA,
    importarPlanFisico: async () => ({ sesiones: 2, ejercicios: 3, pendientes: 1 }),
    ...piso,
  });
}

function archivo(nombre = 'plan.xlsx') {
  const f = new File(['x'], nombre);
  Object.defineProperty(f, 'arrayBuffer', { value: async () => new ArrayBuffer(8) });
  return f;
}

async function subir(r: Repositorio) {
  const u = userEvent.setup();
  const pantalla = renderConDatos(rutas, { repo: r, ruta: '/fisico/cargar-plan' });
  await u.upload(await screen.findByLabelText('Plan de fuerza (.xlsx)'), archivo());
  return { u, ...pantalla };
}

const payloadDe = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls[0][0] as {
  clubId: string; plantelId: string; nombreArchivo: string; hashArchivo: string;
  ejerciciosNuevos: { nombre: string; link: string | null }[];
  sesiones: { ejercicios: { nombreOriginal: string; ejercicioFuerzaId: string | null; claveNueva: string | null }[] }[];
};

describe('Cargar plan de fuerza', () => {
  it('pide el .xlsx, lo lee en el dispositivo y se llega desde Físico', async () => {
    renderConDatos(rutas, { repo: repo(), ruta: '/fisico/cargar-plan' });
    const campo = (await screen.findByLabelText('Plan de fuerza (.xlsx)')) as HTMLInputElement;
    expect(campo.accept).toBe('.xlsx');
    expect(screen.getByRole('link', { name: 'Volver a Físico' }).getAttribute('href')).toBe('/fisico');
  });

  it('un archivo con errores los cuenta uno por uno y no consulta nada más', async () => {
    lector.plan.mockReturnValue({ errores: [{ mensaje: '[FORMATO_INVALIDO] No es un plan de fuerza' }, { mensaje: 'Falta la hoja de sesiones' }], advertencias: [], sesiones: [] });
    const obtenerEjerciciosFuerza = vi.fn(async () => BIBLIOTECA);
    await subir(repo({ obtenerEjerciciosFuerza }));
    expect(await screen.findByText('No es un plan de fuerza')).toBeTruthy();
    expect(screen.getByText('Falta la hoja de sesiones')).toBeTruthy();
    expect(obtenerEjerciciosFuerza).not.toHaveBeenCalled();
  });

  it('un plan sin sesiones se frena antes del resumen', async () => {
    lector.plan.mockReturnValue({ ...PLAN, sesiones: [] });
    await subir(repo());
    expect(await screen.findByText(/Este archivo no se puede importar/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Guardar en/ })).toBeNull();
  });

  it('el resumen dice dónde se guarda y qué trae: lo que ya tiene video y lo que no', async () => {
    lector.plan.mockReturnValue(PLAN);
    await subir(repo());
    await screen.findByRole('button', { name: 'Guardar en Sub 13' });
    expect(screen.getByText(/El plan se guarda en Sub 13/)).toBeTruthy();
    const valor = (k: string) => screen.getByText(k).nextElementSibling?.textContent;
    expect(valor('Archivo')).toBe('plan.xlsx');
    expect(valor('Sesiones')).toBe('2, del 05/10 al 12/10');
    expect(valor('Ejercicios')).toBe('3');
    expect(valor('Con video')).toBe('2');
    expect(valor('Sin video')).toBe('1');
    expect(screen.getByText('1 advertencia del archivo')).toBeTruthy();
  });

  it('guarda todo junto, sin videos nuevos, y deja volver a Físico', async () => {
    lector.plan.mockReturnValue(PLAN);
    const importarPlanFisico = vi.fn(async () => ({ sesiones: 2, ejercicios: 3, pendientes: 1 }));
    const { u } = await subir(repo({ importarPlanFisico }));
    await u.click(await screen.findByRole('button', { name: 'Guardar en Sub 13' }));
    expect(await screen.findByText('Se guardaron 2 sesiones y 3 ejercicios en Sub 13, 2 con video.')).toBeTruthy();
    expect(importarPlanFisico).toHaveBeenCalledTimes(1);
    const p = payloadDe(importarPlanFisico);
    expect(p).toMatchObject({ clubId: 'c-1', plantelId: 'p-1', nombreArchivo: 'plan.xlsx', hashArchivo: 'hash-de-prueba' });
    expect(p.sesiones).toHaveLength(2);
    // «Sentadilla» ya está en la biblioteca del club: se reconoce sola. «Press plano» queda sin video, y se guarda igual.
    expect(p.sesiones[0].ejercicios.map((e) => e.ejercicioFuerzaId)).toEqual(['f-1', null]);
    expect(screen.getAllByRole('link', { name: 'Volver a Físico' }).every((l) => l.getAttribute('href') === '/fisico')).toBe(true);
  });

  it('un video elegido de la biblioteca viaja con el ejercicio', async () => {
    lector.plan.mockReturnValue(PLAN);
    const importarPlanFisico = vi.fn(async () => ({ sesiones: 2, ejercicios: 3, pendientes: 0 }));
    const { u } = await subir(repo({ importarPlanFisico }));
    await u.click(await screen.findByRole('button', { name: 'Agregar videos' }));
    expect(screen.getByText('1 ejercicio sin video.')).toBeTruthy();
    await u.selectOptions(screen.getByLabelText('Elegir video para Press plano'), 'DOMINADAS');
    expect(screen.getByText(/1 vez en el plan · video de Dominadas/)).toBeTruthy();
    expect(screen.getByText('Todos los ejercicios de esta lista tienen video.')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Guardar en Sub 13' }));
    await screen.findByText(/Se guardaron/);
    expect(payloadDe(importarPlanFisico).sesiones[0].ejercicios.map((e) => e.ejercicioFuerzaId)).toEqual(['f-1', 'f-2']);
  });

  it('un link cargado a mano da de alta el ejercicio nuevo; un nombre repetido o un link raro se rechazan', async () => {
    lector.plan.mockReturnValue(PLAN);
    const importarPlanFisico = vi.fn(async () => ({ sesiones: 2, ejercicios: 3, pendientes: 0 }));
    const { u } = await subir(repo({ importarPlanFisico }));
    await u.click(await screen.findByRole('button', { name: 'Agregar videos' }));
    await u.click(screen.getByRole('button', { name: 'Cargar link' }));

    await u.click(screen.getByRole('button', { name: 'Usar este' }));
    expect(screen.getByText('Poné el link del video.')).toBeTruthy();

    await u.type(screen.getByLabelText('Link al video'), 'ftp://raro');
    await u.click(screen.getByRole('button', { name: 'Usar este' }));
    expect(screen.getByText('El link tiene que empezar con http:// o https://.')).toBeTruthy();

    await u.clear(screen.getByLabelText('Nombre'));
    await u.type(screen.getByLabelText('Nombre'), 'Sentadilla');
    await u.clear(screen.getByLabelText('Link al video'));
    await u.type(screen.getByLabelText('Link al video'), 'https://video.test/otra');
    await u.click(screen.getByRole('button', { name: 'Usar este' }));
    expect(screen.getByText(/"Sentadilla" ya está en la biblioteca/)).toBeTruthy();

    await u.clear(screen.getByLabelText('Nombre'));
    await u.type(screen.getByLabelText('Nombre'), 'Press plano con barra');
    await u.click(screen.getByRole('button', { name: 'Usar este' }));
    expect(screen.getByText(/video de Press plano con barra/)).toBeTruthy();

    await u.click(screen.getByRole('button', { name: 'Guardar en Sub 13' }));
    await screen.findByText(/Se guardaron/);
    const p = payloadDe(importarPlanFisico);
    expect(p.ejerciciosNuevos).toEqual([expect.objectContaining({ nombre: 'Press plano con barra', link: 'https://video.test/otra' })]);
    expect(p.sesiones[0].ejercicios[1].claveNueva).toBeTruthy();
  });

  it('un video elegido se puede quitar', async () => {
    lector.plan.mockReturnValue(PLAN);
    const { u } = await subir(repo());
    await u.click(await screen.findByRole('button', { name: 'Agregar videos' }));
    await u.selectOptions(screen.getByLabelText('Elegir video para Press plano'), 'DOMINADAS');
    await u.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.getByText('1 ejercicio sin video.')).toBeTruthy();
  });

  it('un plan ya cargado lo dice con la categoría y deja reintentar', async () => {
    lector.plan.mockReturnValue(PLAN);
    const importarPlanFisico = vi.fn(async () => { throw new Error('PLAN_DUPLICADO'); });
    const { u } = await subir(repo({ importarPlanFisico }));
    await u.click(await screen.findByRole('button', { name: 'Guardar en Sub 13' }));
    expect(await screen.findByText('Este plan ya está cargado en Sub 13.')).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Guardar en Sub 13' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('un ejercicio que otro profe cargó mientras tanto pide abrir el archivo de nuevo', async () => {
    lector.plan.mockReturnValue(PLAN);
    const importarPlanFisico = vi.fn(async () => { throw new Error('EJERCICIO_DUPLICADO: PRESS PLANO'); });
    const { u } = await subir(repo({ importarPlanFisico }));
    await u.click(await screen.findByRole('button', { name: 'Guardar en Sub 13' }));
    expect(await screen.findByText(/"PRESS PLANO" ya está en la biblioteca/)).toBeTruthy();
  });

  it('un error cualquiera no pierde lo leído', async () => {
    lector.plan.mockReturnValue(PLAN);
    const importarPlanFisico = vi.fn(async () => { throw new Error('boom'); });
    const { u } = await subir(repo({ importarPlanFisico }));
    await u.click(await screen.findByRole('button', { name: 'Guardar en Sub 13' }));
    expect(await screen.findByText('No se pudo guardar. Intentá de nuevo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar en Sub 13' })).toBeTruthy();
  });
});
