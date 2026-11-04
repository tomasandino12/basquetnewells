import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FilaJugador, type Aviso } from './fila-jugador';

afterEach(cleanup);

function Prueba({ inicial = false }: { inicial?: boolean }) {
  const [presente, setPresente] = useState(inicial);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [lesion, setLesion] = useState(false);
  return (
    <ul>
      <FilaJugador
        nombre="Bruno Acosta"
        posicion="Base"
        numero={4}
        presente={presente}
        aviso={aviso}
        lesion={lesion}
        alPresente={setPresente}
        alAviso={setAviso}
        alLesion={setLesion}
      />
    </ul>
  );
}

describe('FilaJugador', () => {
  it('tocar la fila entera alterna presente y ausente', async () => {
    const u = userEvent.setup();
    render(<Prueba />);
    const fila = screen.getByRole('button', { name: /Bruno Acosta/ });
    expect(fila.getAttribute('aria-pressed')).toBe('false');
    await u.click(fila);
    expect(fila.getAttribute('aria-pressed')).toBe('true');
    await u.click(fila);
    expect(fila.getAttribute('aria-pressed')).toBe('false');
  });

  it('al ausente le deja marcar si avisó y la lesión; al presente no se lo pregunta', async () => {
    const u = userEvent.setup();
    render(<Prueba />);
    await u.click(screen.getByRole('radio', { name: 'No avisó' }));
    expect(screen.getByRole('radio', { name: 'No avisó' }).getAttribute('aria-checked')).toBe('true');
    await u.click(screen.getByRole('radio', { name: 'Avisó' }));
    expect(screen.getByRole('radio', { name: 'Avisó' }).getAttribute('aria-checked')).toBe('true');

    const lesion = screen.getByRole('button', { name: 'Lesión' });
    expect(lesion.getAttribute('aria-pressed')).toBe('false');
    await u.click(lesion);
    expect(lesion.getAttribute('aria-pressed')).toBe('true');

    await u.click(screen.getByRole('button', { name: /Bruno Acosta/ }));
    expect(screen.queryByRole('radio', { name: 'Avisó' })).toBeNull();
    expect(screen.getByLabelText('Con lesión')).toBeTruthy();
  });

  it('se alcanza y se marca con el teclado', async () => {
    const u = userEvent.setup();
    render(<Prueba />);
    await u.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Bruno Acosta/ }));
    await u.keyboard(' ');
    expect(screen.getByRole('button', { name: /Bruno Acosta/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('no muestra nada de coordinación (cuota, apto médico)', () => {
    render(<Prueba />);
    expect(screen.queryByText(/cuota|apto/i)).toBeNull();
  });
});
