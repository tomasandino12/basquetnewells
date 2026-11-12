// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EjercicioDeLista, JugadaDelClub } from '../datos/repositorio';
import { filtrarEjercicios, filtrarJugadas, nombreDeCopia, normalizar, temasConEjercicios, textoDeVariaciones, tiposConJugadas } from './biblioteca';

const ej = (titulo: string, tema: string, extra: Partial<EjercicioDeLista> = {}): EjercicioDeLista => ({
  id: titulo, titulo, tema, descripcion: null, enlace: null, material: null, jugadores: null, categorias: null,
  creadoPor: null, creadoEn: '', tieneNotas: false, cantidadVariaciones: 0, ...extra,
});

describe('biblioteca de ejercicios', () => {
  const lista = [ej('Cierre de línea', 'defensa'), ej('Pase de pecho', 'pase', { material: 'Conos' }), ej('Salto vertical', 'fisico')];

  it('normaliza tildes y mayúsculas', () => {
    expect(normalizar('  TRANSICIÓN ')).toBe('transicion');
  });

  it('busca en el título, el material y el nombre del tema', () => {
    expect(filtrarEjercicios(lista, { texto: 'LINEA', tema: null }).map((e) => e.titulo)).toEqual(['Cierre de línea']);
    expect(filtrarEjercicios(lista, { texto: 'conos', tema: null })).toHaveLength(1);
    expect(filtrarEjercicios(lista, { texto: 'físico', tema: null }).map((e) => e.titulo)).toEqual(['Salto vertical']);
  });

  it('filtra por tema y combina con el texto', () => {
    expect(filtrarEjercicios(lista, { texto: '', tema: 'pase' })).toHaveLength(1);
    expect(filtrarEjercicios(lista, { texto: 'cierre', tema: 'pase' })).toHaveLength(0);
  });

  it('sólo ofrece los temas que tienen ejercicios', () => {
    expect(temasConEjercicios(lista).map((t) => t.id)).toEqual(['pase', 'defensa', 'fisico']);
  });

  it('cuenta variaciones sin inventar un cero', () => {
    expect(textoDeVariaciones(0)).toBeNull();
    expect(textoDeVariaciones(1)).toBe('1 variación');
    expect(textoDeVariaciones(3)).toBe('3 variaciones');
  });
});

describe('biblioteca de jugadas', () => {
  const j = (nombre: string, tipo: string) => ({ id: nombre, nombre, tipo }) as JugadaDelClub;
  const lista = [j('Zona 2-3', 'defensa'), j('Pick and roll', 'ataque')];

  it('filtra por tipo y por nombre', () => {
    expect(filtrarJugadas(lista, { texto: '', tipo: 'ataque' }).map((x) => x.nombre)).toEqual(['Pick and roll']);
    expect(filtrarJugadas(lista, { texto: 'ZONA', tipo: null })).toHaveLength(1);
  });

  it('sólo ofrece los tipos que tienen jugadas', () => {
    expect(tiposConJugadas(lista).map((t) => t.clave)).toEqual(['ataque', 'defensa']);
  });

  it('la copia respeta el largo máximo', () => {
    expect(nombreDeCopia('Zona', 150)).toBe('Copia de Zona');
    expect(nombreDeCopia('x'.repeat(200), 150)).toHaveLength(150);
  });
});

describe('Recursos en los dos temas', () => {
  const fuentes = ['../components/ui/pizarra.tsx', '../pantallas/Recursos.tsx'].map((r) => readFileSync(new URL(r, import.meta.url), 'utf8'));

  it('ningún color queda fijo: todo sale de los tokens (claro y oscuro)', () => {
    for (const f of fuentes) {
      expect(f.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
      expect(f).not.toMatch(/\b(?:bg|text|border|fill|stroke)-(?:black|white)\b/);
      expect(f).not.toMatch(/(?:fill|stroke)=["'](?:black|white)["']/);
    }
  });

  it('la pizarra pinta con el piso y las líneas del tema, nunca negra sobre claro', () => {
    // Un solo tono para la cancha y su banda de afuera (antes la banda era otro rectángulo y la cancha parecía flotar).
    expect(fuentes[0]).toContain('fill="var(--sup)"');
    expect(fuentes[0]).toContain('var(--borde-control)');
  });
});
