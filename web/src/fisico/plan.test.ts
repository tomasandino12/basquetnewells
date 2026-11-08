import { describe, expect, it } from 'vitest';
import type { LineaFisico, SesionFisico } from '../datos/repositorio';
import {
  avanceDelPlan, cargaCorta, detalleChico, diaDeSesion, esPesoCorporal, fechaCorta, proximaSesion,
  nombreCorto, rangoDePlan, resumenDeSesion, textoDeEscalon, textoDeEstado, tituloDeSesion, vecinos,
} from './plan';

const linea = (extra: Partial<LineaFisico> = {}): LineaFisico => ({
  id: 'l-1', orden: 1, bloque: null, nombreOriginal: 'Sentadilla', series: 3, reps: '8 reps',
  cargaSugerida: null, pausa: null, notas: null, video: null, ...extra,
});

describe('fechas y estados del plan', () => {
  it('fechaCorta y rango: una fecha sola o de tal al cual', () => {
    expect(fechaCorta('2026-11-09')).toBe('09/11');
    expect(rangoDePlan({ desde: '2026-11-09', hasta: '2026-11-09' })).toBe('09/11');
    expect(rangoDePlan({ desde: '2026-11-09', hasta: '2026-12-14' })).toBe('09/11 al 14/12');
  });

  it('dice si está en curso, empieza o terminó', () => {
    const plan = { desde: '2026-11-09', hasta: '2026-12-14' };
    expect(textoDeEstado(plan, '2026-11-20')).toBe('En curso');
    expect(textoDeEstado(plan, '2026-11-01')).toBe('Empieza el 09/11');
    expect(textoDeEstado(plan, '2027-01-01')).toBe('Terminó el 14/12');
  });

  it('la sesión de hoy lo dice; el día de la semana no se corre por la zona horaria', () => {
    expect(diaDeSesion('2026-11-09', '2026-11-09')).toBe('Hoy · Lun 09/11');
    expect(diaDeSesion('2026-11-11', '2026-11-09')).toBe('Mié 11/11');
    expect(tituloDeSesion('2026-11-09')).toBe('Lunes 09/11');
  });

  it('próxima sesión: hoy o la que sigue; ninguna si ya pasaron todas', () => {
    const s = [{ fecha: '2026-11-02' }, { fecha: '2026-11-09' }, { fecha: '2026-11-16' }];
    expect(proximaSesion(s, '2026-11-09')).toBe(s[1]);
    expect(proximaSesion(s, '2026-11-10')).toBe(s[2]);
    expect(proximaSesion(s, '2026-12-01')).toBeNull();
  });

  it('avance: cuenta las sesiones anteriores a hoy', () => {
    const s = [{ fecha: '2026-11-02' }, { fecha: '2026-11-09' }, { fecha: '2026-11-16' }];
    expect(avanceDelPlan(s, '2026-11-09')).toEqual({ hechas: 1, total: 3 });
  });

  it('resumen de una sesión: cantidad y bloques en el orden del archivo', () => {
    const s: SesionFisico = { id: 's', fecha: '2026-11-09', lineas: [linea({ bloque: 'Pierna' }), linea({ id: 'l-2', bloque: 'Core' }), linea({ id: 'l-3', bloque: 'Pierna' })] };
    expect(resumenDeSesion(s)).toBe('3 ejercicios · Pierna, Core');
    expect(resumenDeSesion({ ...s, lineas: [linea()] })).toBe('1 ejercicio');
  });
});

describe('carga y escalón de un ejercicio', () => {
  it('la carga es siempre kg o «PC»', () => {
    expect(cargaCorta('Manc. 10kg (x2)')).toBe('10 kg');
    expect(cargaCorta('Barra Ol + 12,5 kg')).toBe('12,5 kg');
    expect(cargaCorta('PC')).toBe('PC');
    expect(cargaCorta('pc + 5kg')).toBe('PC');
    expect(cargaCorta('Fallo')).toBe('Fallo');
    expect(cargaCorta(null)).toBeNull();
    expect(cargaCorta('  ')).toBeNull();
  });

  it('los de peso corporal dicen «peso corporal»; el resto, su escalón o «Sin escalón»', () => {
    expect(esPesoCorporal('PC')).toBe(true);
    expect(esPesoCorporal('PCR')).toBe(false);
    expect(textoDeEscalon(linea({ cargaSugerida: 'PC' }), 2.5)).toBe('peso corporal');
    expect(textoDeEscalon(linea({ cargaSugerida: '20kg' }), 2.5)).toBe('Escalón 2,5 kg');
    expect(textoDeEscalon(linea({ cargaSugerida: '20kg' }), null)).toBe('Sin escalón');
  });

  it('series y reps van abajo; la carga del archivo sólo si dice más que «10 kg»', () => {
    expect(detalleChico(linea({ series: 4, reps: '6 reps', pausa: '90"', cargaSugerida: '20kg' }))).toBe('4 series · 6 reps · pausa 90"');
    expect(detalleChico(linea({ series: 1, reps: null, cargaSugerida: 'Manc. 10kg (x2)' }))).toBe('1 serie · Manc. 10kg (x2)');
    expect(detalleChico(linea({ series: null, reps: null, cargaSugerida: 'PC' }))).toBe('');
  });

  it('nombre corto: apellido e inicial', () => {
    expect(nombreCorto('Acosta, Bruno')).toBe('Acosta, B.');
    expect(nombreCorto('Acosta')).toBe('Acosta');
    expect(nombreCorto('Acosta, ')).toBe('Acosta');
  });

  it('vecinos: el anterior y el siguiente dentro de la sesión', () => {
    const ls = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(vecinos(ls, 'a')).toEqual({ indice: 0, anterior: null, siguiente: ls[1] });
    expect(vecinos(ls, 'c')).toEqual({ indice: 2, anterior: ls[1], siguiente: null });
    expect(vecinos(ls, 'zzz').indice).toBe(-1);
  });
});
