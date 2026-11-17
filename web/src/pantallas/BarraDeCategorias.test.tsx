import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BarraDeCategorias, CLAVE_CANTIDAD } from './BarraDeCategorias';

const estado = vi.hoisted(() => ({
  activo: null as null | { plantelId: string; categoria: string; visibles: { id: string; categoria: string }[]; elegir: () => void },
  carga: { isPending: true, isError: false, error: undefined as unknown, refetch: () => {} },
}));

vi.mock('../plantel/activo', () => ({
  usePlantelActivo: () => estado.activo,
  useCargaDeCategoria: () => estado.carga,
}));

const DOS = [{ id: 'a', categoria: 'U17M' }, { id: 'b', categoria: 'U21M' }];

describe('BarraDeCategorias: el lugar de los chips no se abre de golpe', () => {
  beforeEach(() => {
    localStorage.clear();
    estado.activo = null;
    estado.carga = { isPending: true, isError: false, error: undefined, refetch: () => {} };
  });

  it('mientras se averigua la categoría reserva dos chips (la primera vez) con el mismo contenedor y alto', () => {
    const { container } = render(<BarraDeCategorias />);
    const reserva = container.querySelector('[data-reserva-categorias]');
    expect(reserva).not.toBeNull();
    expect(reserva?.getAttribute('aria-hidden')).toBe('true');
    expect(reserva?.querySelectorAll('.esqueleto')).toHaveLength(2);
    expect(reserva?.querySelector('.min-h-11')).not.toBeNull();
    expect(reserva?.className).toContain('pt-4');
  });

  it('reserva tantos chips como categorías vio la última vez', () => {
    localStorage.setItem(CLAVE_CANTIDAD, '3');
    const { container } = render(<BarraDeCategorias />);
    expect(container.querySelectorAll('[data-reserva-categorias] .esqueleto')).toHaveLength(3);
  });

  it('un valor guardado roto no rompe: reserva dos', () => {
    localStorage.setItem(CLAVE_CANTIDAD, 'cualquiera');
    const { container } = render(<BarraDeCategorias />);
    expect(container.querySelectorAll('[data-reserva-categorias] .esqueleto')).toHaveLength(2);
  });

  it('al llegar las categorías los chips reemplazan la reserva, con fundido, y se recuerda la cantidad', () => {
    estado.carga = { ...estado.carga, isPending: false };
    estado.activo = { plantelId: 'a', categoria: 'U17M', visibles: DOS, elegir: () => {} };
    const { container } = render(<BarraDeCategorias />);
    expect(container.querySelector('[data-reserva-categorias]')).toBeNull();
    expect(screen.getByRole('button', { name: 'U17M' }).getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('nav')?.className).toContain('entra');
    expect(localStorage.getItem(CLAVE_CANTIDAD)).toBe('2');
  });

  it('con una sola categoría no muestra nada y se acuerda de que había una', () => {
    estado.carga = { ...estado.carga, isPending: false };
    estado.activo = { plantelId: 'a', categoria: 'U17M', visibles: [DOS[0]], elegir: () => {} };
    const { container } = render(<BarraDeCategorias />);
    expect(container.firstChild).toBeNull();
    expect(localStorage.getItem(CLAVE_CANTIDAD)).toBe('1');
  });

  it('si falla la carga no deja un hueco: no muestra nada', () => {
    estado.carga = { isPending: false, isError: true, error: new Error('x'), refetch: () => {} };
    const { container } = render(<BarraDeCategorias />);
    expect(container.firstChild).toBeNull();
  });
});
