import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { plantelDemo } from '../mocks/plantelDemo';
import { Plantel } from './Plantel';

// jsdom no trae matchMedia: se simula compu (true) o celular (false).
function simular(escritorio: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: escritorio,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tarjetas = () => within(screen.getByRole('list', { name: 'Jugadores del plantel' })).getAllByRole('button');

describe('Plantel: tarjetas', () => {
  it('muestra una tarjeta por jugador y todas con la misma medida', () => {
    simular(true);
    render(<Plantel />);
    const lista = tarjetas();
    expect(lista).toHaveLength(plantelDemo.length);
    // El alto fijo viene de la misma clase: un apellido largo o un dato que falta no la cambia.
    const clases = new Set(lista.map((t) => [...t.classList].filter((c) => /^(h|w|min-h|max-h)-/.test(c)).join(' ')));
    expect(clases.size).toBe(1);
    expect([...clases][0]).toContain('h-[10.5rem]');
  });

  it('el apellido largo se corta con puntos suspensivos en vez de estirar la tarjeta', () => {
    simular(true);
    render(<Plantel />);
    const larga = screen.getByRole('button', { name: /Echeverría Montenegro/ });
    expect(larga.querySelector('.truncate')?.textContent).toBe('Echeverría Montenegro');
  });

  it('un jugador sin partidos ni número muestra rayas, no ceros', () => {
    simular(true);
    render(<Plantel />);
    const sinDatos = screen.getByRole('button', { name: /Noah Molina/ });
    expect(sinDatos.textContent).toContain('Sin partidos');
    expect(sinDatos.textContent).toContain('—');
    expect(sinDatos.textContent).not.toMatch(/\b0\b/);
  });

  it('no muestra el estado de pago ni de apto', () => {
    simular(true);
    const { container } = render(<Plantel />);
    expect(container.textContent).not.toMatch(/al día|apto|pagó|deuda/i);
  });
});

describe('Plantel: filtros', () => {
  it('la búsqueda y el filtro de posición achican la grilla', async () => {
    simular(true);
    const u = userEvent.setup();
    render(<Plantel />);
    await u.click(screen.getByRole('button', { name: 'Pívot' }));
    expect(tarjetas()).toHaveLength(2);
    await u.type(screen.getByRole('searchbox'), 'gael');
    expect(tarjetas()).toHaveLength(1);
    await u.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Ningún jugador coincide con la búsqueda.')).toBeTruthy();
  });
});

describe('Plantel: compu', () => {
  it('abre con la ficha del primero en el panel y la cambia al tocar otra tarjeta', async () => {
    simular(true);
    const u = userEvent.setup();
    render(<Plantel />);
    expect(screen.getByRole('article', { name: 'Ficha de Bruno Acosta' })).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Tomás Benítez/ }));
    expect(screen.getByRole('article', { name: 'Ficha de Tomás Benítez' })).toBeTruthy();
    expect(screen.queryByRole('article', { name: 'Ficha de Bruno Acosta' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /Tomás Benítez/ }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Plantel: celular', () => {
  it('arranca sin ficha, la abre en una hoja y se cierra con Escape', async () => {
    simular(false);
    const u = userEvent.setup();
    render(<Plantel />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(screen.getByRole('button', { name: /Mateo Fernández/ }));
    const hoja = screen.getByRole('dialog');
    expect(within(hoja).getByRole('article', { name: 'Ficha de Mateo Fernández' })).toBeTruthy();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la ficha de un jugador sin datos muestra rayas y avisa que no hay partidos', async () => {
    simular(false);
    const u = userEvent.setup();
    render(<Plantel />);
    await u.click(screen.getByRole('button', { name: /Noah Molina/ }));
    const hoja = screen.getByRole('dialog');
    expect(within(hoja).getByText('Todavía no hay partidos cargados.')).toBeTruthy();
    expect(within(hoja).getAllByText('Sin anotar todavía.')).toHaveLength(2);
  });
});
