import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { EjercicioDeLista, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  vi.restoreAllMocks();
});

// Todo inventado. El usuario de la sesión de prueba es 'u-1'.
const ej = (id: string, extra: Partial<EjercicioDeLista> = {}): EjercicioDeLista => ({
  id, titulo: id, tema: 'pase', descripcion: null, enlace: null, material: null, jugadores: null, categorias: null,
  creadoPor: 'u-1', creadoEn: '2026-10-01T10:00:00Z', tieneNotas: false, cantidadVariaciones: 0, ...extra,
});

const EJERCICIOS = [ej('Pase de pecho', { descripcion: 'Dos filas', material: 'conos', jugadores: '6 a 12' }), ej('Ajeno', { creadoPor: 'u-2' })];

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerEjercicios: async () => EJERCICIOS,
    obtenerEjercicio: async (_c, id) => ({ ...EJERCICIOS.find((x) => x.id === id)!, pizarra: null }),
    obtenerNotas: async () => [
      { id: 'n-1', texto: 'Mi nota', creadoPor: 'u-1', creadoEn: '2026-10-02T10:00:00Z' },
      { id: 'n-2', texto: 'Nota de otro', creadoPor: 'u-2', creadoEn: '2026-10-02T10:00:00Z' },
    ],
    obtenerVariaciones: async () => [
      { id: 'v-1', nivel: 1, eje: 'espacio', titulo: 'Más cerca', descripcion: null, creadoPor: 'u-1', creadoEn: '2026-10-01T10:00:00Z' },
      { id: 'v-2', nivel: 2, eje: null, titulo: 'Con defensor', descripcion: null, creadoPor: 'u-2', creadoEn: '2026-10-02T10:00:00Z' },
    ],
    ...piso,
  });
}

const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/recursos' });
const lista = () => screen.getByRole('region', { name: 'Lista' });
const esperarLista = async () => within(await screen.findByRole('region', { name: 'Lista' })).findByRole('button', { name: /Pase de pecho/ });
const hoja = () => screen.getByRole('dialog');

describe('Recursos: cargar un ejercicio', () => {
  it('pide título y tema, y manda los textos tal cual (el enlace recortado)', async () => {
    const crearEjercicio = vi.fn(async () => 'e-nuevo');
    const u = userEvent.setup();
    abrir(repo({ crearEjercicio }));
    await esperarLista();
    await u.click(screen.getByRole('button', { name: /Cargar un ejercicio/ }));
    await u.type(within(hoja()).getByLabelText('Título'), 'Pase con rebote ');
    // Sin tema todavía: no guarda.
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar' }));
    expect(within(hoja()).getByText('Elegí un título y un tema.')).toBeTruthy();
    expect(crearEjercicio).not.toHaveBeenCalled();
    await u.click(within(hoja()).getByRole('button', { name: 'Tiro' }));
    await u.type(within(hoja()).getByLabelText('Enlace'), '  https://ejemplo.test/v ');
    await u.type(within(hoja()).getByLabelText('Jugadores'), '6 a 12');
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(crearEjercicio).toHaveBeenCalledTimes(1));
    expect(crearEjercicio).toHaveBeenCalledWith({
      clubId: 'c-1', titulo: 'Pase con rebote ', tema: 'tiro', descripcion: '', enlace: 'https://ejemplo.test/v', material: '', jugadores: '6 a 12', categorias: '',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('un enlace que no es web no se guarda', async () => {
    const crearEjercicio = vi.fn(async () => 'e-nuevo');
    const u = userEvent.setup();
    abrir(repo({ crearEjercicio }));
    await esperarLista();
    await u.click(screen.getByRole('button', { name: /Cargar un ejercicio/ }));
    await u.type(within(hoja()).getByLabelText('Título'), 'Algo');
    await u.click(within(hoja()).getByRole('button', { name: 'Otro' }));
    await u.type(within(hoja()).getByLabelText('Enlace'), 'javascript:alert(1)');
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar' }));
    expect(within(hoja()).getByText(/tiene que empezar con http/)).toBeTruthy();
    expect(crearEjercicio).not.toHaveBeenCalled();
  });

  it('si la base falla, lo dice con la hoja abierta y lo escrito sigue ahí', async () => {
    const u = userEvent.setup();
    abrir(repo({ crearEjercicio: async () => { throw new Error('boom'); } }));
    await esperarLista();
    await u.click(screen.getByRole('button', { name: /Cargar un ejercicio/ }));
    await u.type(within(hoja()).getByLabelText('Título'), 'Algo');
    await u.click(within(hoja()).getByRole('button', { name: 'Otro' }));
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar' }));
    expect(await within(hoja()).findByText('No se pudo guardar el ejercicio.')).toBeTruthy();
    expect((within(hoja()).getByLabelText('Título') as HTMLInputElement).value).toBe('Algo');
  });
});

describe('Recursos: editar y borrar un ejercicio', () => {
  it('Editar y Borrar sólo aparecen en lo propio', async () => {
    const u = userEvent.setup();
    abrir();
    await esperarLista();
    const detalle = () => screen.getByRole('complementary', { name: 'Detalle' });
    expect(within(detalle()).getByRole('button', { name: /Editar/ })).toBeTruthy();
    await u.click(within(lista()).getByRole('button', { name: /Ajeno/ }));
    await waitFor(() => expect(within(detalle()).queryByRole('button', { name: /Editar/ })).toBeNull());
    expect(within(detalle()).queryByRole('button', { name: /Borrar/ })).toBeNull();
  });

  it('edita con los datos cargados y guarda los cambios', async () => {
    const actualizarEjercicio = vi.fn(async () => {});
    const u = userEvent.setup();
    abrir(repo({ actualizarEjercicio }));
    await esperarLista();
    await u.click(within(screen.getByRole('complementary', { name: 'Detalle' })).getByRole('button', { name: /Editar/ }));
    const titulo = within(hoja()).getByLabelText('Título') as HTMLInputElement;
    expect(titulo.value).toBe('Pase de pecho');
    expect((within(hoja()).getByLabelText('Material') as HTMLInputElement).value).toBe('conos');
    await u.clear(titulo);
    await u.type(titulo, 'Pase de pecho 2');
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar los cambios' }));
    await waitFor(() => expect(actualizarEjercicio).toHaveBeenCalledWith('c-1', 'Pase de pecho', expect.objectContaining({ titulo: 'Pase de pecho 2', tema: 'pase', material: 'conos', jugadores: '6 a 12' })));
  });

  it('si el ejercicio ya no es suyo, lo dice claro', async () => {
    const u = userEvent.setup();
    abrir(repo({ actualizarEjercicio: async () => { throw new Error('NO_ES_TUYO'); } }));
    await esperarLista();
    await u.click(within(screen.getByRole('complementary', { name: 'Detalle' })).getByRole('button', { name: /Editar/ }));
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar los cambios' }));
    expect(await within(hoja()).findByText('Este ejercicio ya no es tuyo: no se puede editar.')).toBeTruthy();
  });

  it('borrar pide confirmación y avisa que se llevan las notas de otros', async () => {
    const borrarEjercicio = vi.fn(async () => {});
    const u = userEvent.setup();
    abrir(repo({ borrarEjercicio }));
    await esperarLista();
    await u.click(within(screen.getByRole('complementary', { name: 'Detalle' })).getByRole('button', { name: /Borrar/ }));
    expect(borrarEjercicio).not.toHaveBeenCalled();
    expect(hoja().textContent).toContain('notas de uso');
    await u.click(within(hoja()).getByRole('button', { name: 'Cancelar' }));
    expect(borrarEjercicio).not.toHaveBeenCalled();
    await u.click(within(screen.getByRole('complementary', { name: 'Detalle' })).getByRole('button', { name: /Borrar/ }));
    await u.click(within(hoja()).getByRole('button', { name: 'Borrar de todos modos' }));
    await waitFor(() => expect(borrarEjercicio).toHaveBeenCalledWith('c-1', 'Pase de pecho'));
  });
});

describe('Recursos: notas y variaciones', () => {
  const detalle = () => screen.getByRole('complementary', { name: 'Detalle' });

  it('cualquiera agrega una nota; no se guarda vacía', async () => {
    const crearNota = vi.fn(async () => 'n-nueva');
    const u = userEvent.setup();
    abrir(repo({ crearNota }));
    await esperarLista();
    await u.click(await screen.findByRole('button', { name: /Agregar una nota/ }));
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar la nota' }));
    expect(within(hoja()).getByText('Escribí qué pasó al usarlo.')).toBeTruthy();
    await u.type(within(hoja()).getByLabelText('Qué pasó al usarlo'), 'Anduvo bien');
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar la nota' }));
    await waitFor(() => expect(crearNota).toHaveBeenCalledWith({ clubId: 'c-1', ejercicioId: 'Pase de pecho', texto: 'Anduvo bien' }));
  });

  it('sólo se borra la nota propia, con confirmación', async () => {
    const borrarNota = vi.fn(async () => {});
    const u = userEvent.setup();
    abrir(repo({ borrarNota }));
    await esperarLista();
    const notas = await screen.findByRole('region', { name: 'Notas de uso' });
    expect(within(notas).getAllByRole('button', { name: 'Borrar esta nota' })).toHaveLength(1);
    await u.click(within(notas).getByRole('button', { name: 'Borrar esta nota' }));
    await u.click(within(hoja()).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(borrarNota).toHaveBeenCalledWith('c-1', 'n-1'));
  });

  it('suma una variación con el nivel que sigue y la valida', async () => {
    const crearVariacion = vi.fn(async () => 'v-nueva');
    const u = userEvent.setup();
    abrir(repo({ crearVariacion }));
    await esperarLista();
    await u.click(await screen.findByRole('button', { name: /Sumar una variación/ }));
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar la variación' }));
    expect(within(hoja()).getByText('Poné un título para la variación.')).toBeTruthy();
    expect(within(within(hoja()).getByRole('group', { name: 'Nivel' })).getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe('true');
    await u.type(within(hoja()).getByLabelText('Qué cambia'), 'Con dos defensores');
    await u.click(within(hoja()).getByRole('button', { name: 'Número' }));
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar la variación' }));
    await waitFor(() => expect(crearVariacion).toHaveBeenCalledWith({ clubId: 'c-1', ejercicioId: 'Pase de pecho', titulo: 'Con dos defensores', nivel: 3, eje: 'numero', descripcion: '' }));
  });

  it('edita y borra sólo las variaciones propias', async () => {
    const actualizarVariacion = vi.fn(async () => {});
    const borrarVariacion = vi.fn(async () => {});
    const u = userEvent.setup();
    abrir(repo({ actualizarVariacion, borrarVariacion }));
    await esperarLista();
    const vars = await screen.findByRole('region', { name: 'Variaciones' });
    expect(within(vars).queryByRole('button', { name: /Editar la variación Con defensor/ })).toBeNull();
    await u.click(within(vars).getByRole('button', { name: 'Editar la variación Más cerca' }));
    const titulo = within(hoja()).getByLabelText('Qué cambia') as HTMLInputElement;
    expect(titulo.value).toBe('Más cerca');
    await u.clear(titulo);
    await u.type(titulo, 'Bien cerca');
    await u.click(within(hoja()).getByRole('button', { name: 'Guardar la variación' }));
    await waitFor(() => expect(actualizarVariacion).toHaveBeenCalledWith('c-1', 'v-1', { titulo: 'Bien cerca', nivel: 1, eje: 'espacio', descripcion: '' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await u.click(within(vars).getByRole('button', { name: 'Borrar la variación Más cerca' }));
    await u.click(within(hoja()).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(borrarVariacion).toHaveBeenCalledWith('c-1', 'v-1'));
  });
});
