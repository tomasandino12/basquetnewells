import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { desmarcarSesionCerrada } from '../datos/errores';
import { renderConDatos, repositorioInventado } from '../datos/renderDePrueba';
import { rutas } from '../rutas';
import { reiniciarFallaDeLaVuelta, registrarFallaDeLaVuelta } from '../cuenta/vuelta';
import { VERSION_LEGAL } from '@datos/legal.js';

afterEach(() => {
  cleanup();
  desmarcarSesionCerrada();
  localStorage.clear();
  sessionStorage.clear();
  reiniciarFallaDeLaVuelta();
  window.history.replaceState(null, '', '/');
});

const sinSesion = (piso = {}) => repositorioInventado({ obtenerSesionActual: async () => null, ...piso });

describe('Entrar: cuenta', () => {
  it('crear cuenta manda el nombre normalizado y avisa del mail de confirmación', async () => {
    const crearCuenta = vi.fn(async () => ({ sesion: null, usuario: {} }));
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion({ crearCuenta }), ruta: '/entrar' });
    await u.click(await screen.findByRole('button', { name: 'No tengo cuenta' }));
    await u.type(screen.getByLabelText('Nombre y apellido'), '  ana   ejemplo ');
    await u.type(screen.getByLabelText('Email'), 'ana@ejemplo.test');
    await u.type(screen.getByLabelText('Clave'), 'clave-larga');
    await u.type(screen.getByLabelText('Repetí la clave'), 'clave-larga');
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText(/Te mandamos un mail a ana@ejemplo.test/)).toBeTruthy();
    expect(crearCuenta).toHaveBeenCalledWith('ana@ejemplo.test', 'clave-larga', expect.any(String), { esJugador: true });
  });

  it('crear cuenta con claves distintas no pega a la base', async () => {
    const crearCuenta = vi.fn(async () => ({ sesion: null, usuario: {} }));
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion({ crearCuenta }), ruta: '/entrar' });
    await u.click(await screen.findByRole('button', { name: 'No tengo cuenta' }));
    await u.type(screen.getByLabelText('Nombre y apellido'), 'Ana Ejemplo');
    await u.type(screen.getByLabelText('Email'), 'ana@ejemplo.test');
    await u.type(screen.getByLabelText('Clave'), 'clave-larga');
    await u.type(screen.getByLabelText('Repetí la clave'), 'otra-clave-x');
    await u.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Las dos contraseñas no coinciden.')).toBeTruthy();
    expect(crearCuenta).not.toHaveBeenCalled();
  });

  it('un mail ya registrado no confirma ni desmiente que exista', async () => {
    const crearCuenta = async () => {
      throw new Error('User already registered');
    };
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion({ crearCuenta }), ruta: '/entrar' });
    await u.click(await screen.findByRole('button', { name: 'No tengo cuenta' }));
    await u.type(screen.getByLabelText('Nombre y apellido'), 'Ana Ejemplo');
    await u.type(screen.getByLabelText('Email'), 'ana@ejemplo.test');
    await u.type(screen.getByLabelText('Clave'), 'clave-larga');
    await u.type(screen.getByLabelText('Repetí la clave'), 'clave-larga');
    await u.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText(/Si ese mail no tenía cuenta/)).toBeTruthy();
  });

  it('recuperar la clave responde lo mismo exista o no el mail', async () => {
    const enviarRecuperacionDeClave = vi.fn(async () => {
      throw new Error('user not found');
    });
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion({ enviarRecuperacionDeClave }), ruta: '/entrar' });
    await u.click(await screen.findByRole('button', { name: 'Olvidé la clave' }));
    await u.type(screen.getByLabelText('Email'), 'nadie@ejemplo.test');
    await u.click(screen.getByRole('button', { name: 'Mandar el link' }));
    expect(await screen.findByText(/Si ese mail tiene una cuenta/)).toBeTruthy();
    expect(enviarRecuperacionDeClave).toHaveBeenCalledWith('nadie@ejemplo.test');
  });

  it('Google anota «soy jugador» en la pestaña antes de salir', async () => {
    const entrarConGoogle = vi.fn(async () => {});
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion({ entrarConGoogle }), ruta: '/entrar' });
    await u.click(await screen.findByRole('button', { name: 'No tengo cuenta' }));
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Crear con Google' }));
    expect(entrarConGoogle).toHaveBeenCalled();
    expect(sessionStorage.getItem('alta.jugador-por-google')).toBe('1');
  });

  it('Google sin habilitar avisa y deja entrar con mail', async () => {
    const entrarConGoogle = async () => {
      throw new Error('provider is not enabled');
    };
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion({ entrarConGoogle }), ruta: '/entrar' });
    await u.click(await screen.findByRole('button', { name: 'Entrar con Google' }));
    expect(await screen.findByText(/todavía no está habilitado/)).toBeTruthy();
  });

  it('sin sesión, cualquier pantalla con datos lleva a Entrar (no a la app de siempre)', async () => {
    const { router } = renderConDatos(rutas, { repo: sinSesion(), ruta: '/hoy' });
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/entrar');
  });

  it('crear cuenta avisa que hay que aceptar la política y de qué versión', async () => {
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion(), ruta: '/entrar' });
    await u.click(await screen.findByRole('button', { name: 'No tengo cuenta' }));
    const [ano, mes, dia] = VERSION_LEGAL.split('-');
    expect(screen.getByText(new RegExp(`versión del ${dia}/${mes}/${ano}`))).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Política de privacidad' }).getAttribute('href')).toBe('/privacidad');
  });

  it('volver de un link vencido lo cuenta en vez de dejar un Entrar mudo', async () => {
    window.history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired');
    registrarFallaDeLaVuelta();
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion(), ruta: '/entrar' });
    expect(await screen.findByText(/El link venció o ya se usó/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Olvidé la clave' }));
    expect(screen.queryByText(/El link venció o ya se usó/)).toBeNull();
  });

  it('un mail sin confirmar no deja entrar y lo dice', async () => {
    const iniciarSesion = async () => {
      throw new Error('Email not confirmed');
    };
    const u = userEvent.setup();
    renderConDatos(rutas, { repo: sinSesion({ iniciarSesion }), ruta: '/entrar' });
    await u.type(await screen.findByLabelText('Email'), 'ana@ejemplo.test');
    await u.type(screen.getByLabelText('Clave'), 'clave-larga');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/Todavía no confirmaste tu mail/)).toBeTruthy();
  });
});
