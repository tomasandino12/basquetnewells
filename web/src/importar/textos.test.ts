import { describe, expect, it } from 'vitest';
import {
  REGLAS_EMERGENCIAS, REGLAS_INSCRIPTOS, REGLAS_PARTIDO, esChoqueConOtroProfe, sinCodigo, textoDeAlertas, textoDeMails,
  textoEmergenciasListo, textoInscriptosListo, textoPartidoGuardado, textoSalteadas,
} from './textos';

const regla = (reglas: [RegExp, string][], mensaje: string) => reglas.find(([r]) => r.test(mensaje))?.[1];

describe('textos de las importaciones', () => {
  it('el código entre corchetes del lector no le llega a quien importa', () => {
    expect(sinCodigo('[FORMATO_INVALIDO] Falta la hoja de inscriptos')).toBe('Falta la hoja de inscriptos');
    expect(sinCodigo('Sin código')).toBe('Sin código');
  });

  it('inscriptos: el éxito va en singular y en plural', () => {
    expect(textoInscriptosListo({ creados: 1, existentes: 1 })).toBe('Listo: 1 nuevo, 1 que ya estaba.');
    expect(textoInscriptosListo({ creados: 3, existentes: 0 })).toBe('Listo: 3 nuevos, 0 que ya estaban.');
  });

  it('inscriptos: las filas salteadas y los mails también concuerdan', () => {
    expect(textoSalteadas(1)).toContain('1 fila no se muestra');
    expect(textoSalteadas(4)).toContain('4 filas no se muestran');
    expect(textoDeMails(1)).toBe('1 mail');
    expect(textoDeMails(0)).toBe('0 mails');
  });

  it('inscriptos: tres reglas de la base se cuentan con palabras de todos los días', () => {
    expect(regla(REGLAS_INSCRIPTOS, 'JUGADOR_DE_OTRO_CLUB')).toContain('no es de este club');
    expect(regla(REGLAS_INSCRIPTOS, 'JUGADOR_YA_EXISTE: x')).toContain('Ya hay un chico');
    expect(regla(REGLAS_INSCRIPTOS, 'FECHA_NACIMIENTO_REQUERIDA')).toContain('fecha de nacimiento');
  });

  it('emergencias: éxito y alertas en singular y plural, y las dos reglas', () => {
    expect(textoEmergenciasListo({ guardados: 1 })).toBe('Listo: 1 chico con datos de emergencia.');
    expect(textoEmergenciasListo({ guardados: 5 })).toBe('Listo: 5 chicos con datos de emergencia.');
    expect(textoDeAlertas(0)).toBe('Sin alertas marcadas');
    expect(textoDeAlertas(1)).toBe('1 alerta médica');
    expect(textoDeAlertas(2)).toBe('2 alertas médicas');
    expect(regla(REGLAS_EMERGENCIAS, 'JUGADOR_FUERA_DEL_PLANTEL')).toContain('ya no está en este plantel');
    expect(regla(REGLAS_EMERGENCIAS, 'new row violates check constraint "x"')).toContain('no cumple la regla');
  });

  it('partido: el resumen cuenta los jugadores nuevos y las reglas explican los choques', () => {
    expect(textoPartidoGuardado('Rival', 1)).toBe('Partido vs. Rival guardado — 1 jugador nuevo.');
    expect(textoPartidoGuardado('Rival', 0)).toBe('Partido vs. Rival guardado — 0 jugadores nuevos.');
    expect(regla(REGLAS_PARTIDO, 'IMPORTACION_DUPLICADA')).toBe('Este partido ya fue importado.');
    expect(regla(REGLAS_PARTIDO, 'JUGADOR_YA_EXISTE: acosta')).toContain('Alguien más acaba de cargar');
    expect(regla(REGLAS_PARTIDO, 'PERTENENCIA_YA_VIGENTE')).toContain('Alguien más acaba de sumar');
  });

  it('un choque con otro profe obliga a releer la lista del club; otro error, no', () => {
    expect(esChoqueConOtroProfe(new Error('JUGADOR_YA_EXISTE: acosta bruno'))).toBe(true);
    expect(esChoqueConOtroProfe(new Error('PERTENENCIA_YA_VIGENTE'))).toBe(true);
    expect(esChoqueConOtroProfe(new Error('IMPORTACION_DUPLICADA'))).toBe(false);
    expect(esChoqueConOtroProfe(null)).toBe(false);
  });
});
