import { describe, expect, it } from 'vitest';
import { asistenciaSeguida, filasConDatos, indiceDelDia, sesionesEnAlza, siguienteFrase } from './logica';

describe('lógica del laboratorio de interacciones', () => {
  it('las frases de carga dan la vuelta y una lista vacía no tiene frase', () => {
    expect(siguienteFrase(0, 3)).toBe(1);
    expect(siguienteFrase(2, 3)).toBe(0);
    expect(siguienteFrase(0, 0)).toBe(-1);
  });

  it('la racha en alza cuenta mejoras seguidas desde la última sesión', () => {
    expect(sesionesEnAlza([30, 34, 38, 41])).toBe(3);
    expect(sesionesEnAlza([40, 34, 38, 41])).toBe(2);
    // Empatar no es mejorar.
    expect(sesionesEnAlza([30, 34, 34])).toBe(0);
    expect(sesionesEnAlza([42])).toBe(0);
  });

  it('un porcentaje que falta corta la racha: no se inventa una mejora', () => {
    expect(sesionesEnAlza([30, null, 38, 41])).toBe(1);
    expect(sesionesEnAlza([30, 34, null])).toBe(0);
  });

  it('la asistencia seguida salta los días sin tomar y se corta con un ausente', () => {
    expect(asistenciaSeguida([true, false, true, true, null, true])).toBe(3);
    expect(asistenciaSeguida([true, true, false])).toBe(0);
    expect(asistenciaSeguida([null, null])).toBe(0);
  });

  it('cuenta las filas con datos sin el encabezado ni las vacías', () => {
    expect(filasConDatos([['Nombre', 'PTS'], ['a', 3], [null, ''], ['b', 0]])).toBe(2);
    expect(filasConDatos([])).toBe(0);
  });

  it('la semana arranca el lunes', () => {
    expect(indiceDelDia(new Date(2026, 10, 23))).toBe(0); // lunes
    expect(indiceDelDia(new Date(2026, 10, 22))).toBe(6); // domingo
  });
});
