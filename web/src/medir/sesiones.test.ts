import { afterEach, describe, expect, it } from 'vitest';
import { claveBorrador as claveDeLaVieja, guardarBorrador } from '../../../src/ui/borradorMedicion.js';
import {
  borrarBorrador, claveBorrador, cuantosCargados, formatearFecha, leerBorrador, masNuevasPrimero, ultimaPorTipo,
} from './sesiones';

afterEach(() => localStorage.clear());

describe('medir: sesiones', () => {
  it('la fecha va como DD/MM/YY sin pasar por la zona horaria', () => {
    expect(formatearFecha('2026-11-05')).toBe('05/11/26');
  });

  it('la última sesión de cada test es la de fecha más nueva, sin importar el orden', () => {
    const u = ultimaPorTipo([
      { id: 'a', tipo: 'tiro', fecha: '2026-10-01' },
      { id: 'b', tipo: 'tiro', fecha: '2026-10-20' },
      { id: 'c', tipo: 'tiro', fecha: '2026-10-10' },
      { id: 'd', tipo: 'salto', fecha: '2026-09-01' },
    ]);
    expect(u.tiro?.id).toBe('b');
    expect(u.salto?.id).toBe('d');
    expect(u.sprint).toBeUndefined();
  });

  it('ordena las sesiones de la más nueva a la más vieja sin tocar la lista original', () => {
    const original = [{ id: 'a', tipo: 'tiro', fecha: '2026-10-01' }, { id: 'b', tipo: 'yoyo', fecha: '2026-10-05' }];
    expect(masNuevasPrimero(original).map((s) => s.id)).toEqual(['b', 'a']);
    expect(original[0].id).toBe('a');
  });
});

describe('medir: borradores', () => {
  it('la clave es la misma que arma la app de siempre', () => {
    expect(claveBorrador('u-1', 'c-1', 'p-1', 'salto')).toBe(claveDeLaVieja('u-1', 'c-1', 'p-1', 'salto'));
    expect(claveBorrador(undefined, 'c-1', 'p-1', 'tiro')).toBe(claveDeLaVieja(undefined, 'c-1', 'p-1', 'tiro'));
  });

  it('lee lo que guarda la app de siempre y descarta el de otra versión o roto', () => {
    const clave = claveBorrador('u-1', 'c-1', 'p-1', 'tiro');
    expect(leerBorrador(clave)).toBeNull();
    guardarBorrador(clave, { fecha: '2026-11-05', valores: { j1: { anotados: 4 } } });
    expect(leerBorrador(clave)?.fecha).toBe('2026-11-05');
    localStorage.setItem(clave, JSON.stringify({ fecha: '2026-11-05', version: 99 }));
    expect(leerBorrador(clave)).toBeNull();
    localStorage.setItem(clave, '{no es json');
    expect(leerBorrador(clave)).toBeNull();
  });

  it('descartar borra sólo ese borrador', () => {
    const a = claveBorrador('u-1', 'c-1', 'p-1', 'tiro');
    const b = claveBorrador('u-1', 'c-1', 'p-1', 'salto');
    guardarBorrador(a, { fecha: '2026-11-05' });
    guardarBorrador(b, { fecha: '2026-11-05' });
    borrarBorrador(a);
    expect(leerBorrador(a)).toBeNull();
    expect(leerBorrador(b)).not.toBeNull();
  });

  it('cuenta a los que tienen un valor o una ausencia, no a los tocados sin cargar', () => {
    expect(cuantosCargados(null)).toBe(0);
    expect(
      cuantosCargados({
        fecha: '2026-11-05',
        valores: { a: { anotados: 0 }, b: { ausente: true }, c: { anotados: null }, d: {}, e: undefined },
      }),
    ).toBe(2);
  });
});
