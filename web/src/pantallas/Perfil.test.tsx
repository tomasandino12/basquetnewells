import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado, sesionInventada } from '../datos/renderDePrueba';
import type { Repositorio, Sesion } from '../datos/repositorio';
import { rutas } from '../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
  delete document.documentElement.dataset.tema;
});

// Nombres y mails inventados: nunca datos de personas reales.
const conNombre = (nombre: string | undefined): Sesion => ({
  user: { ...sesionInventada.user, user_metadata: nombre ? { nombre } : {} },
});

function repo(piso: Partial<Repositorio> = {}) {
  return repositorioInventado({
    obtenerSesionActual: async () => conNombre('Profe de Ejemplo'),
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    ...piso,
  });
}

const abrir = (r: Repositorio = repo()) => renderConDatos(rutas, { repo: r, ruta: '/perfil' });
const nombreGrande = () => screen.findByRole('heading', { level: 1 });

describe('Mi perfil: la cuenta', () => {
  it('muestra el nombre, el mail, el rol, el club y las categorías a cargo', async () => {
    abrir();
    expect((await nombreGrande()).textContent).toBe('Profe de Ejemplo');
    expect(screen.getByText('profe@ejemplo.test')).toBeTruthy();
    expect(await screen.findByText('Club de Ejemplo')).toBeTruthy();
    expect(within(await screen.findByLabelText('Tus roles')).getByText('Entrenador')).toBeTruthy();
    expect(screen.getByText('Categorías a cargo')).toBeTruthy();
    expect(await screen.findByText('Sub 13')).toBeTruthy();
    // Sub 15 no es de este profe: no aparece.
    expect(screen.queryByText('Sub 15')).toBeNull();
  });

  it('con los dos roles muestra los dos', async () => {
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: true }) }));
    const roles = within(await screen.findByLabelText('Tus roles'));
    expect(await roles.findByText('Entrenador')).toBeTruthy();
    expect(roles.getByText('Coordinación')).toBeTruthy();
  });

  it('las iniciales del nombre están en la cabecera, que lleva a Mi perfil desde cualquier pantalla', async () => {
    renderConDatos(rutas, { repo: repo(), ruta: '/piezas' });
    const enlaces = await screen.findAllByRole('link', { name: /Mi perfil/ });
    expect(enlaces.length).toBeGreaterThan(0);
    expect(enlaces[0].getAttribute('href')).toBe('/perfil');
    expect(enlaces.some((e) => e.textContent?.includes('PE'))).toBe(true);
  });

  it('sin nombre cargado lo dice y ofrece cargarlo', async () => {
    abrir(repo({ obtenerSesionActual: async () => conNombre(undefined) }));
    expect((await nombreGrande()).textContent).toBe('Sin nombre cargado');
    expect(screen.getByText('Cargá tu nombre')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cargar' })).toBeTruthy();
  });

  it('un entrenador sin categorías asignadas sabe a quién pedírselas', async () => {
    abrir(repo({ obtenerMisPlantelesAsignados: async () => new Set<string>() }));
    expect(await screen.findByText(/Pedíselas al coordinador del club/)).toBeTruthy();
  });

  it('la coordinación sola no tiene categorías a cargo y no ve el interruptor de versión', async () => {
    abrir(repo({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: true }) }));
    expect(await screen.findByText(/Coordinación no tiene categorías a cargo/)).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Versión nueva de la app' })).toBeNull();
  });

  it('un jugador ve su categoría, de su ficha', async () => {
    abrir(repo({
      obtenerClubesDelEntrenador: async () => [],
      obtenerMiFicha: async () => ({
        jugadorId: 'j-1', clubId: 'c-1', clubNombre: 'Club de Ejemplo', nombre: 'Jugador de Ejemplo',
        planteles: [{ plantelId: 'p-1', categoriaCodigo: 'U13', categoria: 'Sub 13' }],
      }),
    }));
    expect(await screen.findByText('Tu categoría')).toBeTruthy();
    expect(await screen.findByText('Sub 13')).toBeTruthy();
    expect(within(screen.getByLabelText('Tus roles')).getByText('Jugador')).toBeTruthy();
    expect(screen.getByText('Club de Ejemplo')).toBeTruthy();
  });

  it('una familia ve a sus chicos', async () => {
    abrir(repo({
      obtenerClubesDelEntrenador: async () => [],
      obtenerMisChicos: async () => [{ vinculoId: 'v-1', nombre: 'Chico de Ejemplo', clubNombre: 'Club de Ejemplo', categorias: 'Sub 13' }],
    }));
    expect(await screen.findByText('Tus chicos')).toBeTruthy();
    expect(await screen.findByText('Chico de Ejemplo')).toBeTruthy();
    expect(within(screen.getByLabelText('Tus roles')).getByText('Familia')).toBeTruthy();
  });

  it('si los chicos no se pueden leer, la pantalla se dibuja igual con lo demás', async () => {
    abrir(repo({
      obtenerClubesDelEntrenador: async () => [],
      obtenerMisChicos: async () => { throw new TypeError('Failed to fetch'); },
    }));
    expect((await nombreGrande()).textContent).toBe('Profe de Ejemplo');
    expect(screen.getByText('profe@ejemplo.test')).toBeTruthy();
  });

  it('sin conexión al pedir las categorías lo dice y se puede reintentar', async () => {
    const u = userEvent.setup();
    let falla = true;
    abrir(repo({
      obtenerPlantelesDelClub: async () => {
        if (falla) throw new TypeError('Failed to fetch');
        return [{ id: 'p-1', categoria: 'Sub 13', categoriaCodigo: 'U13', codigoCabb: null, temporadaId: 't-1' }];
      },
    }));
    expect(await screen.findByText(/Sin conexión: no se pudieron cargar/)).toBeTruthy();
    // El resto de la pantalla sigue en pie.
    expect((await nombreGrande()).textContent).toBe('Profe de Ejemplo');
    falla = false;
    await u.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Sub 13')).toBeTruthy();
  });

  it('sin sesión manda a entrar', async () => {
    abrir(repo({ obtenerSesionActual: async () => null }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
  });
});

describe('Mi perfil: editar el nombre', () => {
  const abrirEdicion = async (r: Repositorio) => {
    const u = userEvent.setup();
    abrir(r);
    await nombreGrande();
    await u.click(screen.getByRole('button', { name: 'Editar' }));
    return { u, campo: await screen.findByLabelText('Nombre y apellido') as HTMLInputElement };
  };

  it('arranca con el nombre de ahora, con tope de largo', async () => {
    const { campo } = await abrirEdicion(repo());
    expect(campo.value).toBe('Profe de Ejemplo');
    expect(campo.maxLength).toBe(80);
  });

  it('guarda el nombre sin espacios de más, lo muestra y lo confirma', async () => {
    const guardados: string[] = [];
    const { u, campo } = await abrirEdicion(repo({
      guardarMiNombre: async (n) => { guardados.push(n); return { ...sesionInventada.user, user_metadata: { nombre: n } }; },
    }));
    await u.clear(campo);
    await u.type(campo, '  Ana   Pérez ');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Listo: tu nombre quedó guardado.')).toBeTruthy();
    expect(guardados).toEqual(['Ana Pérez']);
    expect((await nombreGrande()).textContent).toBe('Ana Pérez');
    expect(screen.queryByLabelText('Nombre y apellido')).toBeNull();
  });

  it('Enter también guarda', async () => {
    const guardados: string[] = [];
    const { u, campo } = await abrirEdicion(repo({
      guardarMiNombre: async (n) => { guardados.push(n); return { ...sesionInventada.user }; },
    }));
    await u.clear(campo);
    await u.type(campo, 'Ana Pérez{Enter}');
    await waitFor(() => expect(guardados).toEqual(['Ana Pérez']));
  });

  it('un nombre vacío avisa y no guarda', async () => {
    const guardarMiNombre = vi.fn(async () => sesionInventada.user);
    const { u, campo } = await abrirEdicion(repo({ guardarMiNombre }));
    await u.clear(campo);
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Escribí tu nombre y apellido.')).toBeTruthy();
    expect(guardarMiNombre).not.toHaveBeenCalled();
  });

  it('si no se puede guardar lo cuenta y deja reintentar, con lo escrito todavía ahí', async () => {
    const { u, campo } = await abrirEdicion(repo({ guardarMiNombre: async () => { throw new Error('x'); } }));
    await u.clear(campo);
    await u.type(campo, 'Ana Pérez');
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('No se pudo guardar tu nombre.')).toBeTruthy();
    expect(campo.value).toBe('Ana Pérez');
    expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('sin conexión lo dice con las palabras de siempre', async () => {
    const { u } = await abrirEdicion(repo({ guardarMiNombre: async () => { throw new TypeError('Failed to fetch'); } }));
    await u.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Sin conexión/)).toBeTruthy();
  });

  it('Cancelar cierra sin guardar', async () => {
    const guardarMiNombre = vi.fn(async () => sesionInventada.user);
    const { u } = await abrirEdicion(repo({ guardarMiNombre }));
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByLabelText('Nombre y apellido')).toBeNull());
    expect(guardarMiNombre).not.toHaveBeenCalled();
  });
});

describe('Mi perfil: los interruptores del teléfono', () => {
  it('el tema oscuro se prende y se apaga, se recuerda y cambia también el botón del marco', async () => {
    const u = userEvent.setup();
    abrir();
    const tema = await screen.findByRole('switch', { name: 'Tema oscuro' });
    expect(tema.getAttribute('aria-checked')).toBe('false');
    await u.click(tema);
    expect(tema.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.dataset.tema).toBe('oscuro');
    expect(localStorage.getItem('semillero.tema')).toBe('oscuro');
    expect(screen.getAllByRole('button', { name: 'Pasar al tema claro' }).length).toBeGreaterThan(0);
    await u.click(tema);
    expect(tema.getAttribute('aria-checked')).toBe('false');
    expect(document.documentElement.dataset.tema).toBe('claro');
  });

  it('el botón del marco también mueve el interruptor', async () => {
    const u = userEvent.setup();
    abrir();
    const tema = await screen.findByRole('switch', { name: 'Tema oscuro' });
    await u.click(screen.getAllByRole('button', { name: 'Pasar al tema oscuro' })[0]);
    expect(tema.getAttribute('aria-checked')).toBe('true');
  });

  it('si el teléfono no deja guardar el tema, lo dice y el cambio vale igual por ahora', async () => {
    const u = userEvent.setup();
    abrir();
    const tema = await screen.findByRole('switch', { name: 'Tema oscuro' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('modo privado'); });
    await u.click(tema);
    expect(await screen.findByText('No se pudo recordar en este teléfono.')).toBeTruthy();
    expect(document.documentElement.dataset.tema).toBe('oscuro');
    vi.restoreAllMocks();
  });

  it('el entrenador ve la versión nueva prendida; apagarla la guarda para este teléfono', async () => {
    const u = userEvent.setup();
    abrir();
    const version = await screen.findByRole('switch', { name: 'Versión nueva de la app' });
    expect(version.getAttribute('aria-checked')).toBe('true');
    await u.click(version);
    expect(localStorage.getItem('semillero.nueva')).toBe('no');
    expect(version.getAttribute('aria-checked')).toBe('false');
    expect(await screen.findByText(/la próxima vez que abras la app se abre la de siempre/)).toBeTruthy();
  });

  it('si el teléfono no deja guardar, el interruptor queda como estaba', async () => {
    const u = userEvent.setup();
    abrir();
    const version = await screen.findByRole('switch', { name: 'Versión nueva de la app' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('modo privado'); });
    await u.click(version);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(version.getAttribute('aria-checked')).toBe('true');
    vi.restoreAllMocks();
  });
});

describe('Mi perfil: salir y lo legal', () => {
  it('«Cerrar sesión» cierra la sesión', async () => {
    const u = userEvent.setup();
    const cerrarSesion = vi.fn(async () => {});
    abrir(repo({ cerrarSesion }));
    await nombreGrande();
    await u.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(cerrarSesion).toHaveBeenCalled());
  });

  it('enlaza a la política de privacidad y a los términos', async () => {
    abrir();
    await nombreGrande();
    expect(screen.getByRole('link', { name: 'Política de privacidad' }).getAttribute('href')).toBe('/privacidad');
    expect(screen.getByRole('link', { name: 'Términos y condiciones' }).getAttribute('href')).toBe('/terminos');
  });
});
