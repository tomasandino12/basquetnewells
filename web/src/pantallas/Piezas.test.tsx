import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Piezas } from './Piezas';

afterEach(cleanup);

describe('Piezas', () => {
  it('muestra la asistencia de ejemplo y cuenta los presentes al tocar una fila', async () => {
    const u = userEvent.setup();
    render(<Piezas />);
    expect(screen.getByText(/Presentes: 0 de 5/)).toBeTruthy();
    await u.click(screen.getByRole('button', { name: /Bruno Acosta/ }));
    expect(screen.getByText(/Presentes: 1 de 5/)).toBeTruthy();
  });

});
