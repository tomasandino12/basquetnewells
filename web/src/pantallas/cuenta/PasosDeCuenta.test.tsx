import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VERSION_LEGAL } from '@datos/legal.js';
import { desmarcarSesionCerrada } from '../../datos/errores';
import { renderConDatos, repositorioInventado, sesionInventada } from '../../datos/renderDePrueba';
import type { Repositorio } from '../../datos/repositorio';
import { rutas } from '../../rutas';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
  sessionStorage.clear();
});

// Hoy abre con un saludo: es la señal de que la persona pasó la puerta de cuenta.
const SALUDO = /Buen día|Buenas tardes|Buenas noches/;
const irAHoy = () => screen.findByRole('heading', { level: 1, name: SALUDO });

/** Un profe con su categoría: lo que hace falta para que Hoy dibuje algo. */
const unProfe = (piso: Partial<Repositorio> = {}) =>
  repositorioInventado({
    obtenerMisRoles: async () => ({ esEntrenador: true, esCoordinador: false }),
    obtenerMisPlantelesAsignados: async () => new Set(['p-1']),
    ...piso,
  });

const usuario = (meta: Record<string, unknown> = { nombre: 'Ana Ejemplo' }) => ({ ...sesionInventada.user, user_metadata: meta });
const sinClub = { obtenerClubesDelEntrenador: async () => [] };

describe('Cuenta: nombre', () => {
  it('una cuenta de Google sin nombre lo pide, con el de Google escrito, y no pasa hasta guardarlo', async () => {
    const guardarMiNombre = vi.fn(async (nombre: string) => usuario({ nombre }));
    const repo = unProfe({
      obtenerMiUsuario: async () => usuario({ full_name: 'Ana de Google' }),
      guardarMiNombre,
    });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    const campo = (await screen.findByLabelText('Nombre y apellido')) as HTMLInputElement;
    expect(campo.value).toBe('Ana de Google');
    expect(guardarMiNombre).not.toHaveBeenCalled();
    await u.clear(campo);
    await u.type(campo, '  ana   ejemplo ');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(guardarMiNombre).toHaveBeenCalledWith('ana ejemplo');
    expect(await irAHoy()).toBeTruthy();
  });

  it('un nombre vacío no pega a la base', async () => {
    const guardarMiNombre = vi.fn(async (nombre: string) => usuario({ nombre }));
    const repo = unProfe({ obtenerMiUsuario: async () => usuario({}), guardarMiNombre });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    await u.click(await screen.findByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Escribí tu nombre y apellido.')).toBeTruthy();
    expect(guardarMiNombre).not.toHaveBeenCalled();
  });

  it('una cuenta anterior al nombre no lo pide', async () => {
    const repo = unProfe({ obtenerMiUsuario: async () => usuario({ cuenta_anterior_al_nombre: true }) });
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    expect(await irAHoy()).toBeTruthy();
    expect(screen.queryByLabelText('Nombre y apellido')).toBeNull();
  });
});

describe('Cuenta: aceptar la política', () => {
  const sinAceptar = (piso = {}) => unProfe({ yaAceptoLegal: async () => false, ...piso });

  it('sin aceptar la versión vigente no se pasa a la app, y pregunta por esa versión', async () => {
    const yaAceptoLegal = vi.fn(async () => false);
    renderConDatos(rutas, { repo: sinAceptar({ yaAceptoLegal }), ruta: '/hoy' });
    expect(await screen.findByRole('heading', { name: 'Antes de seguir' })).toBeTruthy();
    expect(yaAceptoLegal).toHaveBeenCalledWith(VERSION_LEGAL);
    expect(screen.queryByRole('heading', { level: 1, name: SALUDO })).toBeNull();
  });

  it('la casilla arranca destildada y sin tildar no se guarda', async () => {
    const aceptarLegal = vi.fn(async () => {});
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinAceptar({ aceptarLegal }), ruta: '/hoy' });
    expect(((await screen.findByRole('checkbox')) as HTMLInputElement).checked).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Tildá la casilla para seguir.')).toBeTruthy();
    expect(aceptarLegal).not.toHaveBeenCalled();
  });

  it('al aceptar deja constancia de la versión y sigue a la app', async () => {
    const aceptarLegal = vi.fn(async () => {});
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinAceptar({ aceptarLegal }), ruta: '/hoy' });
    await u.click(await screen.findByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(aceptarLegal).toHaveBeenCalledWith(VERSION_LEGAL);
    expect(await irAHoy()).toBeTruthy();
  });

  it('los dos documentos se pueden leer antes de aceptar', async () => {
    renderConDatos(rutas, { repo: sinAceptar(), ruta: '/hoy' });
    expect(((await screen.findByRole('link', { name: 'Política de privacidad' })) as HTMLAnchorElement).getAttribute('href')).toBe('/privacidad');
    expect((screen.getByRole('link', { name: 'Términos y condiciones' }) as HTMLAnchorElement).getAttribute('href')).toBe('/terminos');
  });

  it('primero el nombre y después los Términos', async () => {
    const repo = unProfe({ obtenerMiUsuario: async () => usuario({}), yaAceptoLegal: async () => false });
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    expect(await screen.findByLabelText('Nombre y apellido')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Antes de seguir' })).toBeNull();
  });
});

describe('Cuenta: todavía sin acceso', () => {
  it('una cuenta nueva sin club ve «falta el acceso» con su mail para pasarle al coordinador', async () => {
    renderConDatos(rutas, { repo: unProfe(sinClub), ruta: '/hoy' });
    expect(await screen.findByRole('heading', { name: 'Tu cuenta está lista, falta el acceso' })).toBeTruthy();
    expect(screen.getByText('profe@ejemplo.test')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: SALUDO })).toBeNull();
  });

  it('un profe dado de baja (club sin ningún rol) tampoco entra', async () => {
    const repo = unProfe({ obtenerMisRoles: async () => ({ esEntrenador: false, esCoordinador: false }) });
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    expect(await screen.findByRole('heading', { name: 'Tu cuenta está lista, falta el acceso' })).toBeTruthy();
  });

  it('un jugador con ficha no ve «falta el acceso»: va a lo suyo', async () => {
    const repo = unProfe({
      ...sinClub,
      obtenerMiFicha: async () => ({ clubId: 'c-1', clubNombre: 'Club de Ejemplo', planteles: [] }) as never,
    });
    renderConDatos(rutas, { repo, ruta: '/jugador/fisico' });
    await screen.findByRole('navigation', { name: 'Menú del jugador' });
    expect(screen.queryByRole('heading', { name: 'Tu cuenta está lista, falta el acceso' })).toBeNull();
  });

  it('«Soy jugador» pide club, categoría y fecha de nacimiento y manda el pedido', async () => {
    const crearSolicitudJugador = vi.fn(async () => {});
    const repo = unProfe({
      ...sinClub,
      obtenerClubesParaSolicitar: async () => [
        { clubId: 'c-1', clubNombre: 'Club de Ejemplo', plantelId: 'p-13', categoriaCodigo: 'U13', categoriaNombre: 'Sub 13' },
        { clubId: 'c-1', clubNombre: 'Club de Ejemplo', plantelId: 'p-15', categoriaCodigo: 'U15', categoriaNombre: 'Sub 15' },
      ],
      crearSolicitudJugador,
    });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    await u.click(await screen.findByRole('button', { name: 'Soy jugador de un club' }));
    await u.selectOptions(await screen.findByLabelText('Categoría'), 'p-15');
    await u.click(screen.getByRole('button', { name: 'Pedir acceso' }));
    expect(await screen.findByText('Ingresá tu fecha de nacimiento.')).toBeTruthy();
    expect(crearSolicitudJugador).not.toHaveBeenCalled();
    await u.type(screen.getByLabelText('Fecha de nacimiento'), '2011-05-20');
    await u.click(screen.getByRole('button', { name: 'Pedir acceso' }));
    expect(crearSolicitudJugador).toHaveBeenCalledWith({ clubId: 'c-1', plantelId: 'p-15', fechaNacimiento: '2011-05-20' });
  });

  it('una cuenta creada como jugador cae directo en el pedido de acceso', async () => {
    const repo = unProfe({
      ...sinClub,
      obtenerMiUsuario: async () => usuario({ nombre: 'Ana Ejemplo', quiere_ser_jugador: true }),
      obtenerClubesParaSolicitar: async () => [{ clubId: 'c-1', clubNombre: 'Club de Ejemplo', plantelId: 'p-13', categoriaCodigo: 'U13', categoriaNombre: 'Sub 13' }],
    });
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    expect(await screen.findByRole('heading', { name: 'Soy jugador de un club' })).toBeTruthy();
  });

  it('quien eligió «soy jugador» antes de ir a Google cae en el pedido, y la marca se usa una sola vez', async () => {
    sessionStorage.setItem('alta.jugador-por-google', '1');
    const repo = unProfe({
      ...sinClub,
      obtenerClubesParaSolicitar: async () => [{ clubId: 'c-1', clubNombre: 'Club de Ejemplo', plantelId: 'p-13', categoriaCodigo: 'U13', categoriaNombre: 'Sub 13' }],
    });
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    expect(await screen.findByRole('heading', { name: 'Soy jugador de un club' })).toBeTruthy();
    expect(sessionStorage.getItem('alta.jugador-por-google')).toBeNull();
  });

  it('con un pedido pendiente lo cuenta, con su código, y el botón pasa a «Ver mi solicitud»', async () => {
    const repo = unProfe({
      ...sinClub,
      obtenerMiSolicitud: async () => ({ id: 's-1', estado: 'pendiente', clubNombre: 'Club de Ejemplo', categoriaNombre: 'Sub 13', creadoEn: '2026-11-10T12:00:00Z', codigo: 'K7M2QX' }),
    });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    expect(await screen.findByText(/Tu solicitud a Club de Ejemplo · Sub 13 está pendiente desde el 10\/11/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Ver mi solicitud' }));
    expect(await screen.findByText('K7M2QX')).toBeTruthy();
  });

  it('si coordinación rechazó la cuenta lo dice y deja pedirlo de nuevo', async () => {
    const volverAPedirAcceso = vi.fn(async () => {});
    const repo = unProfe({ ...sinClub, miPedidoDescartado: async () => true, volverAPedirAcceso });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    expect(await screen.findByText(/Coordinación no habilitó esta cuenta/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Fue un error, pedir acceso de nuevo' }));
    expect(volverAPedirAcceso).toHaveBeenCalledOnce();
  });

  it('«Ya me dieron el acceso, reintentar» vuelve a preguntar y entra cuando ya hay club', async () => {
    let habilitada = false;
    const repo = unProfe({
      obtenerClubesDelEntrenador: async () => (habilitada ? [{ id: 'c-1', nombre: 'Club de Ejemplo', apodos: [] }] : []),
    });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo, ruta: '/hoy' });
    await screen.findByRole('heading', { name: 'Tu cuenta está lista, falta el acceso' });
    habilitada = true;
    await u.click(screen.getByRole('button', { name: 'Ya me dieron el acceso, reintentar' }));
    expect(await irAHoy()).toBeTruthy();
  });

  it('se puede salir de la cuenta desde ahí', async () => {
    const cerrarSesion = vi.fn(async () => {});
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: unProfe({ ...sinClub, cerrarSesion }), ruta: '/hoy' });
    await u.click(await screen.findByRole('button', { name: 'Salir de esta cuenta' }));
    expect(cerrarSesion).toHaveBeenCalledOnce();
  });

  it('el cuerpo técnico entra directo, sin pantallas de más', async () => {
    renderConDatos(rutas, { repo: unProfe(), ruta: '/hoy' });
    expect(await irAHoy()).toBeTruthy();
  });
});
