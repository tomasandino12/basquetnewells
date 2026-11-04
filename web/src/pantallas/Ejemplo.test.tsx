import { describe, expect, it } from 'vitest';
import { titularEjemplo } from './Ejemplo';

describe('Ejemplo', () => {
  it('arma el titular con el nombre del club', () => {
    expect(titularEjemplo('Newell’s')).toBe('Hola, Newell’s');
  });
});
