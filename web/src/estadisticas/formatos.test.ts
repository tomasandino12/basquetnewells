import { describe, expect, it } from 'vitest';
import { bloquesDePruebas, chicos, fechaConAnio, fechaDiaMes, lecturaDeReparto, minutosLegibles, signoDePorcentaje } from './formatos';

describe('formatos de Datos', () => {
  it('las fechas se parten a mano: nada de new Date, que se corre un día', () => {
    expect(fechaConAnio('2026-05-01')).toBe('01/05/26');
    expect(fechaDiaMes('2026-05-01')).toBe('01/05');
  });

  it('el reparto dice «El primero concentra» o «Los primeros N concentran», y calla si nadie concentra', () => {
    expect(lecturaDeReparto(1, 'los minutos')).toBe('El primero concentra más de la mitad de los minutos.');
    expect(lecturaDeReparto(3, 'los puntos')).toBe('Los primeros 3 jugadores concentran más de la mitad de los puntos.');
    expect(lecturaDeReparto(0, 'los puntos')).toBe('');
  });

  it('las cargas llevan el signo escrito', () => {
    expect(signoDePorcentaje(12.4)).toBe('+12%');
    expect(signoDePorcentaje(-3.2)).toBe('−3%');
    expect(signoDePorcentaje(0.2)).toBe('0%');
  });

  it('los minutos se redondean y los chicos concuerdan', () => {
    expect(minutosLegibles(1500)).toBe('25′');
    expect(chicos(1)).toBe('1 chico');
    expect(chicos(7)).toBe('7 chicos');
  });

  it('las pruebas: sólo las que el club cargó; el sprint, en segundos con coma; el salto, en cm', () => {
    const sprint = [
      { sesionId: 's1', fecha: '2026-10-01', jugadorId: 'a', distanciaM: 20, tiempoMs: 6500 },
      { sesionId: 's1', fecha: '2026-10-01', jugadorId: 'b', distanciaM: 20, tiempoMs: 7500 },
    ];
    const bloques = bloquesDePruebas(sprint, [], []);
    expect(bloques.map((b) => b.id)).toEqual(['sprint-20']);
    expect(bloques[0].titulo).toBe('Velocidad · 20 + 20 metros');
    // Un promedio de los chicos que midieron ese día: (6,5 + 7,5) / 2 = 7,0 s.
    expect(bloques[0].texto(bloques[0].serie[0].valor)).toBe('7,0 s');
    expect(bloques[0].serie[0].chicos).toBe(2);
    expect(bloquesDePruebas([], [], [])).toEqual([]);
  });

  it('un tiempo que no se pudo leer no entra al promedio: «no se sabe» no es 0', () => {
    const sprint = [
      { sesionId: 's1', fecha: '2026-10-01', jugadorId: 'a', distanciaM: 30, tiempoMs: null },
      { sesionId: 's1', fecha: '2026-10-01', jugadorId: 'b', distanciaM: 30, tiempoMs: 8000 },
    ];
    const [b] = bloquesDePruebas(sprint, [], []);
    expect(b.serie[0].chicos).toBe(1);
    expect(b.serie[0].valor).toBe(8000);
  });
});
