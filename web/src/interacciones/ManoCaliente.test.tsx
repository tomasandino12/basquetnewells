import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ManoCaliente, rachaDeTiro } from './ManoCaliente';

afterEach(cleanup);

const p = (pct: number, muestraChica = false) => ({ valor: { pct, muestraChica } });

describe('mano caliente', () => {
  it('cuenta las prácticas seguidas en alza desde la última', () => {
    expect(rachaDeTiro([p(30), p(33), p(36), p(40)])).toBe(3);
    expect(rachaDeTiro([p(30), p(36), p(33)])).toBe(0);
  });

  it('una práctica con pocos intentos corta la racha: no se inventa una mejora', () => {
    expect(rachaDeTiro([p(30), p(33), p(50, true), p(40), p(44)])).toBe(1);
  });

  it('aparece desde 3 mejoras y antes no muestra nada', () => {
    const { rerender } = render(<ManoCaliente racha={2} que="tiro de tres" />);
    expect(screen.queryByText('Mano caliente')).toBeNull();
    rerender(<ManoCaliente racha={3} que="tiro de tres" />);
    expect(screen.getByText('3 prácticas en alza')).toBeTruthy();
    expect(screen.getByText('Tu tiro de tres mejoró 3 prácticas seguidas.')).toBeTruthy();
  });
});
