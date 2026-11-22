import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderConDatos } from '../datos/renderDePrueba';
import { rutas } from '../rutas';

afterEach(cleanup);

const abrir = () => renderConDatos(rutas, { ruta: '/laboratorio/interacciones' });

describe('laboratorio de microinteracciones', () => {
  it('enviar un recurso pasa por «Enviando…» y queda confirmado, y se anuncia', async () => {
    const u = userEvent.setup();
    abrir();
    await u.click(await screen.findByRole('button', { name: 'Enviar recurso' }));
    expect(screen.getByRole('button', { name: 'Enviando…' }).getAttribute('aria-disabled')).toBe('true');
    expect(await screen.findByText('Recurso enviado: Recurso en cancha', {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recurso en cancha' })).toBeTruthy();
  });

  it('marcar la rutina llena el día de hoy en la constancia semanal, y se puede desmarcar', async () => {
    const u = userEvent.setup();
    abrir();
    const rutina = await screen.findByRole('checkbox', { name: 'Hice mi rutina de hoy' });
    const dias = screen.getByRole('list', { name: 'Días de esta semana con rutina' });
    const conRutina = () => [...dias.querySelectorAll('.sr-only')].filter((s) => s.textContent === 'con rutina').length;
    expect(conRutina()).toBe(3);
    await u.click(rutina);
    expect(rutina.getAttribute('aria-checked')).toBe('true');
    expect(conRutina()).toBe(4);
    await u.click(rutina);
    expect(conRutina()).toBe(3);
  });

  it('el importador muestra el resumen adentro de la zona, sin modal', async () => {
    const u = userEvent.setup();
    abrir();
    await u.click(await screen.findByRole('button', { name: 'Probar sin archivo' }));
    expect(await screen.findByText(/filas importadas/, {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la racha de tiro aparece con 3 mejoras seguidas y se va si se corta', async () => {
    const u = userEvent.setup();
    abrir();
    expect(await screen.findByText('3 sesiones en alza')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Tiro: se cortó' }));
    expect(screen.queryByText(/sesiones en alza/)).toBeNull();
  });
});
