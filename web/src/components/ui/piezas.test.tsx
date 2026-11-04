import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { Aviso } from './aviso';
import { Boton } from './button';
import { Campo } from './campo';
import { Cargando, Vacio } from './estados';
import { ListaPestanas, PanelPestana, Pestana, Pestanas } from './pestanas';

afterEach(cleanup);

describe('Boton', () => {
  it('es type="button" por defecto y no se aprieta apagado', async () => {
    const u = userEvent.setup();
    let toques = 0;
    render(<Boton disabled onClick={() => toques++}>Guardando…</Boton>);
    const b = screen.getByRole('button', { name: 'Guardando…' });
    expect(b.getAttribute('type')).toBe('button');
    await u.click(b);
    expect(toques).toBe(0);
  });
});

describe('Pestanas', () => {
  it('cambian con las flechas del teclado', async () => {
    const u = userEvent.setup();
    render(
      <Pestanas defaultValue="a">
        <ListaPestanas aria-label="Secciones">
          <Pestana value="a">Físico</Pestana>
          <Pestana value="b">Tiro</Pestana>
        </ListaPestanas>
        <PanelPestana value="a">Panel A</PanelPestana>
        <PanelPestana value="b">Panel B</PanelPestana>
      </Pestanas>,
    );
    await u.tab();
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Físico' }));
    await u.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Tiro' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Panel B')).toBeTruthy();
  });
});

describe('Campo', () => {
  it('enlaza etiqueta, ayuda y error, y marca el campo inválido', () => {
    render(<Campo etiqueta="Minutos" ayuda="Un número." error="Escribí un número." />);
    const c = screen.getByLabelText('Minutos');
    expect(c.getAttribute('aria-invalid')).toBe('true');
    const describe = c.getAttribute('aria-describedby') ?? '';
    expect(describe.split(' ')).toHaveLength(2);
    expect(document.getElementById(describe.split(' ')[0])?.textContent).toBe('Escribí un número.');
  });
});

describe('Aviso', () => {
  it('el error se anuncia como alerta y los demás como estado', () => {
    render(
      <>
        <Aviso tono="error" titulo="No se pudo guardar" />
        <Aviso tono="ok" titulo="Guardado" />
      </>,
    );
    expect(screen.getByRole('alert').textContent).toContain('No se pudo guardar');
    expect(screen.getByRole('status').textContent).toContain('Guardado');
  });
});

describe('estados', () => {
  it('el vacío dice qué falta y ofrece la acción', () => {
    render(
      <Vacio icono={Inbox} titulo="Sin partidos" accion={<Boton>Cargar</Boton>}>
        Cargá el primero.
      </Vacio>,
    );
    expect(screen.getByRole('heading', { name: 'Sin partidos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cargar' })).toBeTruthy();
  });

  it('la carga se anuncia con un solo «Cargando…»', () => {
    render(<Cargando filas={3} />);
    expect(screen.getAllByText('Cargando…')).toHaveLength(1);
    expect(screen.getByRole('status')).toBeTruthy();
  });
});
