import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import type { PayloadDePrevia, PreviaCompleta, Repositorio } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
});

// Nombres inventados: nunca datos de chicos reales.
const JUGADORES = [
  { id: 'j-2', nombreClave: 'benitez tomas', nombreLimpio: 'Benítez, Tomás', fechaNacimiento: null },
  { id: 'j-1', nombreClave: 'acosta bruno', nombreLimpio: 'Acosta, Bruno', fechaNacimiento: null },
];

const mision = (id: string, extra: Record<string, unknown> = {}) => ({
  id, metrica: null, valor: null, texto: 'Jugar como equipo', estado: null, comentario: null, jugadorId: null, ...extra,
});
const previa = (extra: Partial<PreviaCompleta> = {}): PreviaCompleta => ({
  id: 'pr-1',
  fecha: '2026-11-20',
  rival: 'Rival de Ejemplo',
  partidoId: null,
  misionesEquipo: [mision('me-1', { metrica: 'reb_tot', valor: 30, texto: null })],
  misionesJugador: [mision('mj-1', { jugadorId: 'j-1', texto: 'Defender fuerte' })],
  ...extra,
});

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    obtenerJugadoresDelPlantel: async () => JUGADORES,
    ...piso,
  });
}

const abrir = (r: Repositorio = repo(), ruta = '/misiones/armar') => renderConDatos(rutas, { repo: r, ruta });
const esperar = () => screen.findByRole('heading', { level: 1 });
const guardar = (u: ReturnType<typeof userEvent.setup>) => u.click(screen.getByRole('button', { name: 'Guardar misiones' }));

/** Abre la hoja de «Agregar», elige una métrica, teclea el número y agrega. */
async function agregarConNumero(u: ReturnType<typeof userEvent.setup>, abrirCon: string, metrica: string, cuantos: string) {
  await u.click(screen.getByRole('button', { name: abrirCon }));
  await u.click(await screen.findByRole('button', { name: metrica }));
  await u.type(screen.getByPlaceholderText('Cuántos'), cuantos);
  await u.click(screen.getByRole('button', { name: 'Agregar' }));
}

describe('Armar misiones: una previa nueva', () => {
  it('arranca con la fecha de hoy, sin misiones y con los chicos por orden alfabético', async () => {
    abrir();
    expect((await esperar()).textContent).toBe('Armar misiones');
    const hoy = new Date();
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    expect((screen.getByLabelText('Fecha del partido') as HTMLInputElement).value).toBe(iso);
    expect(screen.getByText('Todavía no hay objetivo de equipo.')).toBeTruthy();
    const nombres = within(screen.getByRole('list', { name: 'Jugadores del plantel' })).getAllByText(/,/).map((n) => n.textContent);
    expect(nombres).toEqual(['Acosta, Bruno', 'Benítez, Tomás']);
    // No hay una previa que evaluar todavía.
    expect(screen.queryByRole('link', { name: 'Evaluar el partido' })).toBeNull();
  });

  it('agrega un objetivo de equipo con número y lo guarda con ids que no cambian entre intentos', async () => {
    const u = userEvent.setup();
    const llamadas: PayloadDePrevia[] = [];
    let falla = true;
    abrir(repo({
      guardarPrevia: async (p) => {
        llamadas.push(p);
        if (falla) { falla = false; throw new TypeError('Failed to fetch'); }
        return {};
      },
    }));
    await esperar();
    await agregarConNumero(u, 'Agregar objetivo', 'Rebotes', '8');
    expect(await screen.findByText('Al menos 8 rebotes')).toBeTruthy();
    await guardar(u);
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
    await guardar(u);
    await waitFor(() => expect(llamadas).toHaveLength(2));
    expect(llamadas[0].previaId).toBe(llamadas[1].previaId);
    expect(llamadas[0].misionesEquipo).toEqual(llamadas[1].misionesEquipo);
    expect(llamadas[1]).toMatchObject({
      clubId: 'c-1',
      plantelId: 'p-1',
      rival: null,
      misionesEquipo: [{ orden: 1, metrica: 'reb_tot', valor: 8, texto: null }],
      misionesJugador: [],
    });
  });

  it('una misión escrita a mano para un chico va con texto y sin número', async () => {
    const u = userEvent.setup();
    const llamadas: PayloadDePrevia[] = [];
    abrir(repo({ guardarPrevia: async (p) => { llamadas.push(p); return {}; } }));
    await esperar();
    await u.click(screen.getByRole('button', { name: 'Agregar misión a Acosta, Bruno' }));
    await u.click(await screen.findByRole('button', { name: 'Escribir otra' }));
    await u.type(screen.getByLabelText('Qué tiene que hacer'), '  Defender al base de ellos ');
    await u.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Defender al base de ellos')).toBeTruthy();
    await guardar(u);
    await waitFor(() => expect(llamadas).toHaveLength(1));
    expect(llamadas[0].misionesJugador).toMatchObject([{ jugadorId: 'j-1', orden: 1, metrica: null, valor: null, texto: 'Defender al base de ellos' }]);
  });

  it('las métricas de equipo incluyen los puntos del rival; las de un chico no', async () => {
    const u = userEvent.setup();
    abrir();
    await esperar();
    await u.click(screen.getByRole('button', { name: 'Agregar objetivo' }));
    expect(await screen.findByRole('button', { name: 'Puntos del rival' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Puntos del rival' })).toBeNull());
    await u.click(screen.getByRole('button', { name: 'Agregar misión a Acosta, Bruno' }));
    expect(await screen.findByRole('button', { name: 'Pérdidas' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Puntos del rival' })).toBeNull();
  });

  it('sin elegir qué pedirle, «Agregar» está apagado; al elegir, el campo dice si es «al menos» o «como máximo»', async () => {
    const u = userEvent.setup();
    abrir();
    await esperar();
    await u.click(screen.getByRole('button', { name: 'Agregar misión a Acosta, Bruno' }));
    expect((await screen.findByRole('button', { name: 'Agregar' }) as HTMLButtonElement).disabled).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Pérdidas' }));
    expect(screen.getByLabelText('Como máximo · pérdidas')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Rebotes' }));
    expect(screen.getByLabelText('Al menos · rebotes')).toBeTruthy();
  });

  it('un número que no es entero avisa y no agrega', async () => {
    const u = userEvent.setup();
    abrir();
    await esperar();
    await u.click(screen.getByRole('button', { name: 'Agregar misión a Acosta, Bruno' }));
    await u.click(await screen.findByRole('button', { name: 'Robos' }));
    await u.type(screen.getByPlaceholderText('Cuántos'), '1e2');
    await u.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Escribí un número entero, de 0 para arriba.')).toBeTruthy();
    // La hoja sigue abierta y no se agregó nada.
    expect(screen.getByPlaceholderText('Cuántos')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Misiones de Acosta, Bruno' })).toBeNull();
  });

  it('una misión escrita a mano vacía avisa', async () => {
    const u = userEvent.setup();
    abrir();
    await esperar();
    await u.click(screen.getByRole('button', { name: 'Agregar misión a Acosta, Bruno' }));
    await u.click(await screen.findByRole('button', { name: 'Escribir otra' }));
    await u.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(await screen.findByText('Escribí qué tiene que hacer.')).toBeTruthy();
  });

  it('cada chico tiene como mucho 2 misiones y el equipo 3: después no hay botón para sumar', async () => {
    const u = userEvent.setup();
    abrir();
    await esperar();
    await agregarConNumero(u, 'Agregar misión a Acosta, Bruno', 'Robos', '2');
    await agregarConNumero(u, 'Agregar misión a Acosta, Bruno', 'Tapas', '1');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Agregar misión a Acosta, Bruno' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Agregar misión a Benítez, Tomás' })).toBeTruthy();
    await agregarConNumero(u, 'Agregar objetivo', 'Robos', '5');
    await agregarConNumero(u, 'Agregar objetivo', 'Tapas', '2');
    await agregarConNumero(u, 'Agregar objetivo', 'Asistencias', '9');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Agregar objetivo' })).toBeNull());
  });

  it('se puede quitar una misión antes de guardar', async () => {
    const u = userEvent.setup();
    abrir();
    await esperar();
    await agregarConNumero(u, 'Agregar objetivo', 'Rebotes', '8');
    await screen.findByText('Al menos 8 rebotes');
    await u.click(screen.getByRole('button', { name: 'Quitar misión: Al menos 8 rebotes' }));
    expect(screen.queryByText('Al menos 8 rebotes')).toBeNull();
    expect(screen.getByText('Todavía no hay objetivo de equipo.')).toBeTruthy();
  });

  it('sin fecha no guarda y lo dice', async () => {
    const u = userEvent.setup();
    const guardarPrevia = vi.fn(async () => ({}));
    abrir(repo({ guardarPrevia }));
    await esperar();
    fireEvent.change(screen.getByLabelText('Fecha del partido'), { target: { value: '' } });
    await guardar(u);
    expect(await screen.findByText(/Elegí la fecha del partido/)).toBeTruthy();
    expect(guardarPrevia).not.toHaveBeenCalled();
  });

  it('un rival se guarda sin espacios de más y con tope de largo', async () => {
    const u = userEvent.setup();
    const llamadas: PayloadDePrevia[] = [];
    abrir(repo({ guardarPrevia: async (p) => { llamadas.push(p); return {}; } }));
    await esperar();
    const rival = screen.getByLabelText('Rival (opcional)') as HTMLInputElement;
    expect(rival.maxLength).toBe(120);
    await u.type(rival, '  Rival de Ejemplo ');
    await guardar(u);
    await waitFor(() => expect(llamadas[0]?.rival).toBe('Rival de Ejemplo'));
  });

  it('cuenta con palabras lo que la base rechaza', async () => {
    const u = userEvent.setup();
    abrir(repo({ guardarPrevia: async () => { throw new Error('MISION_EVALUADA'); } }));
    await esperar();
    await guardar(u);
    expect(await screen.findByText('Alguna misión ya se evaluó y no se puede reemplazar.')).toBeTruthy();
    // El botón vuelve a estar disponible para reintentar.
    expect((screen.getByRole('button', { name: 'Guardar misiones' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('una categoría sin jugadores lo dice y lleva al plantel', async () => {
    abrir(repo({ obtenerJugadoresDelPlantel: async () => [] }));
    expect(await screen.findByText('Esta categoría no tiene jugadores')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir al plantel' }).getAttribute('href')).toBe('/plantel');
    // El objetivo de equipo se puede armar igual.
    expect(screen.getByRole('button', { name: 'Agregar objetivo' })).toBeTruthy();
  });

  it('sin conexión al abrir, lo dice y se puede reintentar', async () => {
    abrir(repo({ obtenerJugadoresDelPlantel: async () => { throw new TypeError('Failed to fetch'); } }));
    expect(await screen.findByText('Sin conexión')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('la coordinación sola no arma misiones', async () => {
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }) }));
    expect(await screen.findByText('Esto lo ve el cuerpo técnico')).toBeTruthy();
  });
});

describe('Armar misiones: corregir las que ya están', () => {
  const editar = (r: Repositorio) => abrir(r, '/misiones/pr-1/armar');

  it('carga la fecha, el rival y las misiones, y ofrece evaluar el partido', async () => {
    editar(repo({ obtenerPrevia: async () => previa() }));
    expect((await esperar()).textContent).toBe('Misiones del partido');
    expect((screen.getByLabelText('Fecha del partido') as HTMLInputElement).value).toBe('2026-11-20');
    expect((screen.getByLabelText('Rival (opcional)') as HTMLInputElement).value).toBe('Rival de Ejemplo');
    expect(screen.getByText('Al menos 30 rebotes')).toBeTruthy();
    expect(screen.getByText('Defender fuerte')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Evaluar el partido' }).getAttribute('href')).toBe('/misiones/pr-1');
  });

  it('guarda con el mismo id de la previa, así no se duplica', async () => {
    const u = userEvent.setup();
    const llamadas: PayloadDePrevia[] = [];
    editar(repo({ obtenerPrevia: async () => previa(), guardarPrevia: async (p) => { llamadas.push(p); return {}; } }));
    await esperar();
    await u.click(screen.getByRole('button', { name: 'Quitar misión: Defender fuerte' }));
    await guardar(u);
    await waitFor(() => expect(llamadas).toHaveLength(1));
    expect(llamadas[0].previaId).toBe('pr-1');
    expect(llamadas[0].misionesJugador).toEqual([]);
    expect(llamadas[0].misionesEquipo).toMatchObject([{ id: 'me-1', metrica: 'reb_tot', valor: 30 }]);
  });

  it('con una misión ya evaluada queda todo bloqueado y sólo se puede ver la evaluación', async () => {
    editar(repo({ obtenerPrevia: async () => previa({ misionesEquipo: [mision('me-1', { estado: 'logrado' })] }) }));
    await esperar();
    expect(screen.getByText('Este partido ya se evaluó')).toBeTruthy();
    expect((screen.getByLabelText('Fecha del partido') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Rival (opcional)') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Guardar misiones' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Quitar misión/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Agregar objetivo' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Agregar misión a/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver la evaluación' }).getAttribute('href')).toBe('/misiones/pr-1');
  });

  it('una previa que no existe lo dice y vuelve al plantel', async () => {
    editar(repo({ obtenerPrevia: async () => null }));
    expect(await screen.findByText('No encontramos esas misiones')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al plantel' }).getAttribute('href')).toBe('/plantel');
  });
});
