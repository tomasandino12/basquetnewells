import { describe, expect, it } from 'vitest';
import { actual, crearHistorial, deshacer, empujar, haySinGuardar, marcarGuardado, puedeDeshacer, puedeRehacer, rehacer } from './historial';

describe('historial del editor', () => {
  it('arranca limpio y sin nada que deshacer', () => {
    const h = crearHistorial('a');
    expect(actual(h)).toBe('a');
    expect(haySinGuardar(h)).toBe(false);
    expect(puedeDeshacer(h)).toBe(false);
    expect(puedeRehacer(h)).toBe(false);
  });

  it('un cambio ensucia; deshacerlo vuelve a lo guardado y limpia', () => {
    let h = empujar(crearHistorial('a'), 'b');
    expect(haySinGuardar(h)).toBe(true);
    h = deshacer(h);
    expect(actual(h)).toBe('a');
    expect(haySinGuardar(h)).toBe(false);
    h = rehacer(h);
    expect(actual(h)).toBe('b');
  });

  it('guardar marca el punto; cambiar de nuevo ensucia', () => {
    let h = marcarGuardado(empujar(crearHistorial('a'), 'b'));
    expect(haySinGuardar(h)).toBe(false);
    h = empujar(h, 'c');
    expect(haySinGuardar(h)).toBe(true);
    expect(actual(deshacer(h))).toBe('b');
    expect(haySinGuardar(deshacer(h))).toBe(false);
  });

  it('un cambio después de deshacer descarta lo rehacible, y si lo guardado quedaba ahí, queda sucio para siempre', () => {
    let h = marcarGuardado(empujar(crearHistorial('a'), 'b'));
    h = empujar(deshacer(h), 'c');
    expect(puedeRehacer(h)).toBe(false);
    h = deshacer(h);
    expect(actual(h)).toBe('a');
    expect(haySinGuardar(h)).toBe(true);
  });

  it('con más de 50 cambios descarta los más viejos y sigue contando lo guardado', () => {
    let h = crearHistorial(0);
    for (let i = 1; i <= 60; i++) h = empujar(h, i);
    expect(h.pila).toHaveLength(50);
    expect(haySinGuardar(h)).toBe(true);
    h = marcarGuardado(h);
    h = empujar(h, 61);
    expect(haySinGuardar(deshacer(h))).toBe(false);
  });
});
