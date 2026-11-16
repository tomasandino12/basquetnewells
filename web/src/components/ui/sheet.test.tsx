import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Hoja } from './sheet';

afterEach(cleanup);

function abrir(props: { lateral?: boolean } = {}) {
  render(
    <Hoja abierta alCambiar={() => {}} titulo="Prueba" descripcion="Una hoja de prueba" {...props}>
      <p>Contenido</p>
    </Hoja>,
  );
  return screen.getByRole('dialog');
}

describe('Hoja lateral', () => {
  it('por defecto sigue siendo la hoja inferior de celular, sin clases de panel', () => {
    const clases = abrir().className;
    expect(clases).toContain('max-w-[24.375rem]');
    expect(clases).not.toContain('hoja-lateral');
  });

  it('con lateral, desde 768 px se pega a la derecha: 28 rem y, desde 1024 px, 32 rem', () => {
    const clases = abrir({ lateral: true }).className;
    expect(clases).toContain('hoja-lateral');
    expect(clases).toContain('md:right-0');
    expect(clases).toContain('md:max-w-[28rem]');
    expect(clases).toContain('lg:max-w-[32rem]');
    // el alto completo reemplaza al tope de 88 % del celular
    expect(clases).toContain('md:max-h-none');
  });

  it('en celular conserva el ancho y la subida desde abajo', () => {
    const clases = abrir({ lateral: true }).className;
    expect(clases).toContain('bottom-0');
    expect(clases).toContain('max-w-[24.375rem]');
  });
});
