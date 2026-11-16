import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { MaterialDelClub, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
});

const fila = (id: string, extra: Partial<MaterialDelClub>): MaterialDelClub => ({
  id, tipo: 'cono', pesoKg: null, detalle: '', cantidad: 1, actualizadoPor: 'u-2', actualizadoEn: '2026-09-18T15:00:00Z', ...extra,
});

// Todo inventado.
const FILAS = [
  fila('m-1', { tipo: 'disco', pesoKg: 10, cantidad: 4 }),
  fila('m-2', { tipo: 'disco', pesoKg: 5, cantidad: 6 }),
  fila('m-3', { tipo: 'cono', cantidad: 20 }),
  fila('m-4', { tipo: 'otro', detalle: 'Chaleco', cantidad: 12 }),
];

function repo(piso: Partial<Repositorio> = {}, coordina = true) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: !coordina, esCoordinador: coordina }),
    obtenerMaterial: async () => FILAS,
    obtenerPerfilesDelClub: async () => ({ 'u-2': 'Marta' }),
    ...piso,
  });
}

const coord = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/coordinacion/inventario' });
const lectura = (r: Repositorio = repo({}, false)) => renderConDatos(rutas, { repo: r, ruta: '/fisico/inventario' });

describe('Inventario: la lista', () => {
  it('agrupa en Con peso / Sin peso / Otros, ordena por peso y dice quién cambió último', async () => {
    coord();
    const conPeso = within(await screen.findByRole('region', { name: 'Con peso' }));
    const textos = conPeso.getAllByRole('listitem').map((li) => li.textContent);
    expect(textos).toEqual(['5 kg6 unid.', '10 kg4 unid.']);
    expect(within(screen.getByRole('region', { name: 'Sin peso' })).getByText('20 unid.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Otros' })).getByText('Chaleco')).toBeTruthy();
    expect(screen.getByText('Último cambio: Marta, 18/09')).toBeTruthy();
  });

  it('en lectura (el profe) no hay ningún botón para cambiar nada', async () => {
    lectura();
    await screen.findByRole('region', { name: 'Con peso' });
    expect(screen.queryByRole('button', { name: 'Agregar material' })).toBeNull();
    expect(screen.queryByRole('button', { name: /10 kg/ })).toBeNull();
  });

  it('vacío: coordinación recibe la invitación a cargar, el profe sabe que lo carga coordinación', async () => {
    coord(repo({ obtenerMaterial: async () => [] }));
    expect(await screen.findByText(/Agregá lo que tiene el club/)).toBeTruthy();
    cleanup();
    lectura(repo({ obtenerMaterial: async () => [] }, false));
    expect(await screen.findByText('Todavía no hay nada en el inventario. Lo carga coordinación.')).toBeTruthy();
  });

  it('si no carga, lo dice', async () => {
    lectura(repo({ obtenerMaterial: async () => { throw new Error('x'); } }, false));
    expect(await screen.findByText('No se pudo cargar el inventario.')).toBeTruthy();
  });

  it('sin el nombre de quien cambió (falla esa consulta) igual se ve la fecha', async () => {
    coord(repo({ obtenerPerfilesDelClub: async () => { throw new Error('x'); } }));
    expect(await screen.findByText('Último cambio: 18/09')).toBeTruthy();
  });
});

describe('Inventario: agregar', () => {
  it('guarda lo validado: tipo con peso, peso en kg y cantidad entera', async () => {
    const u = userEvent.setup();
    const agregar = vi.fn(async (d: Parameters<Repositorio['agregarMaterial']>[0]) => fila('m-9', { tipo: d.tipo, pesoKg: d.pesoKg, cantidad: d.cantidad }));
    coord(repo({ agregarMaterial: agregar }));
    await u.click(await screen.findByRole('button', { name: 'Agregar material' }));
    await u.click(screen.getByRole('button', { name: 'Mancuerna' }));
    await u.type(screen.getByLabelText('Peso de cada unidad (kg)'), '7,5');
    await u.click(screen.getByRole('button', { name: 'Una más' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(agregar).toHaveBeenCalledTimes(1));
    expect(agregar.mock.calls[0][0]).toMatchObject({ clubId: 'c-1', tipo: 'mancuerna', pesoKg: 7.5, cantidad: 2 });
    expect(await screen.findByText('Listo.')).toBeTruthy();
  });

  it('un peso con notación científica no pasa (decimalEstricto) y no se guarda', async () => {
    const u = userEvent.setup();
    const agregar = vi.fn();
    coord(repo({ agregarMaterial: agregar }));
    await u.click(await screen.findByRole('button', { name: 'Agregar material' }));
    await u.click(screen.getByRole('button', { name: 'Disco' }));
    await u.type(screen.getByLabelText('Peso de cada unidad (kg)'), '1e2');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(agregar).not.toHaveBeenCalled();
  });

  it('«Otro» pide el nombre', async () => {
    const u = userEvent.setup();
    const agregar = vi.fn();
    coord(repo({ agregarMaterial: agregar }));
    await u.click(await screen.findByRole('button', { name: 'Agregar material' }));
    await u.click(screen.getByRole('button', { name: 'Otro' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Escribí qué es.')).toBeTruthy();
    expect(agregar).not.toHaveBeenCalled();
  });

  it('una variante que ya existe no se duplica: ofrece editar esa fila', async () => {
    const u = userEvent.setup();
    const agregar = vi.fn();
    coord(repo({ agregarMaterial: agregar }));
    await u.click(await screen.findByRole('button', { name: 'Agregar material' }));
    await u.click(screen.getByRole('button', { name: 'Disco' }));
    await u.type(screen.getByLabelText('Peso de cada unidad (kg)'), '10');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Ya está en el inventario: Discos · 10 kg \(4 unid\.\)/)).toBeTruthy();
    expect(agregar).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: 'Editar esa fila' }));
    expect(await screen.findByText(/Modificado: Marta, 18\/09/)).toBeTruthy();
  });

  it('si otro coordinador la cargó antes (el índice único responde 23505), lo dice sin romper', async () => {
    const u = userEvent.setup();
    coord(repo({ agregarMaterial: async () => { throw Object.assign(new Error('dup'), { code: '23505' }); } }));
    await u.click(await screen.findByRole('button', { name: 'Agregar material' }));
    await u.click(screen.getByRole('button', { name: 'Soga' }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ya hay otra fila igual. Editá esa, o quitá esta.')).toBeTruthy();
  });
});

describe('Inventario: editar y quitar', () => {
  it('edita la cantidad con el − que no baja de 1', async () => {
    const u = userEvent.setup();
    const editar = vi.fn(async (id: string, d: Parameters<Repositorio['editarMaterial']>[1]) => fila(id, { ...d }));
    coord(repo({ editarMaterial: editar }));
    await u.click(await screen.findByRole('button', { name: /Chaleco/ }));
    for (let i = 0; i < 20; i++) await u.click(screen.getByRole('button', { name: 'Una menos' }));
    expect((screen.getByLabelText('Cantidad (unidades sueltas)') as HTMLInputElement).value).toBe('1');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(editar).toHaveBeenCalledWith('m-4', { pesoKg: null, detalle: 'Chaleco', cantidad: 1 }));
  });

  it('quitar pide confirmación y recién ahí borra', async () => {
    const u = userEvent.setup();
    const quitar = vi.fn(async () => {});
    coord(repo({ quitarMaterial: quitar }));
    await u.click(await screen.findByRole('button', { name: /Chaleco/ }));
    await u.click(screen.getByRole('button', { name: 'Quitar del inventario' }));
    expect(quitar).not.toHaveBeenCalled();
    await u.click(await screen.findByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(quitar).toHaveBeenCalledWith('m-4'));
    expect(await screen.findByText('Listo: quitado del inventario.')).toBeTruthy();
  });

  it('si la base no deja (sin permiso), lo cuenta y no cierra', async () => {
    const u = userEvent.setup();
    coord(repo({ quitarMaterial: async () => { throw new Error('NO_SE_PUDO_QUITAR'); } }));
    await u.click(await screen.findByRole('button', { name: /Chaleco/ }));
    await u.click(screen.getByRole('button', { name: 'Quitar del inventario' }));
    await u.click(await screen.findByRole('button', { name: 'Quitar' }));
    expect(await screen.findByText('No tenés permiso para cambiar el inventario.')).toBeTruthy();
  });
});
