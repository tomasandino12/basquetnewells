import { TEMAS } from '@datos/temas.js';
import { TIPOS_JUGADA } from '@datos/jugadas.js';
import type { EjercicioDeLista, JugadaDelClub } from '../datos/repositorio';

/** Sin tildes ni mayúsculas: «defensa» encuentra «Defensa» y «transicion» encuentra «Transición». */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export const nombreDeTema = (id: string): string => (TEMAS as { id: string; nombre: string }[]).find((t) => t.id === id)?.nombre ?? id;

/** Sólo los temas que tienen ejercicios: nunca se muestra un filtro vacío. */
export function temasConEjercicios(ejercicios: EjercicioDeLista[]): { id: string; nombre: string }[] {
  const presentes = new Set(ejercicios.map((e) => e.tema));
  return (TEMAS as { id: string; nombre: string }[]).filter((t) => presentes.has(t.id));
}

/** Sólo los tipos que tienen jugadas. */
export function tiposConJugadas(jugadas: JugadaDelClub[]): { clave: string; etiqueta: string }[] {
  const presentes = new Set(jugadas.map((j) => j.tipo));
  return (TIPOS_JUGADA as { clave: string; etiqueta: string }[]).filter((t) => presentes.has(t.clave));
}

/** Busca en el título, la descripción, el material y el nombre del tema. `tema` null = todos. */
export function filtrarEjercicios(lista: EjercicioDeLista[], { texto, tema }: { texto: string; tema: string | null }): EjercicioDeLista[] {
  const q = normalizar(texto);
  return lista.filter((e) => {
    if (tema !== null && e.tema !== tema) return false;
    if (q === '') return true;
    return normalizar([e.titulo, e.descripcion ?? '', e.material ?? '', nombreDeTema(e.tema)].join(' ')).includes(q);
  });
}

export function filtrarJugadas(lista: JugadaDelClub[], { texto, tipo }: { texto: string; tipo: string | null }): JugadaDelClub[] {
  const q = normalizar(texto);
  return lista.filter((j) => (tipo === null || j.tipo === tipo) && (q === '' || normalizar(j.nombre).includes(q)));
}

/** Cuánto se puede progresar un ejercicio. Sin variaciones no dice nada: no es un «0». */
export function textoDeVariaciones(n: number): string | null {
  if (!n) return null;
  return n === 1 ? '1 variación' : `${n} variaciones`;
}

/** El nombre de la copia de una jugada, dentro del largo permitido. */
export function nombreDeCopia(nombre: string, maximo: number): string {
  return `Copia de ${nombre}`.slice(0, maximo);
}
