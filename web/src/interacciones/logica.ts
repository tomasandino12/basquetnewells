// Reglas de las microinteracciones del laboratorio. Puras y chicas: si alguna pasa a producción,
// se mueve tal cual a su módulo (y su prueba la acompaña).

/** Frases para una carga que tarda. Cortas, en voseo, sin chistes que envejezcan. */
export const FRASES_DE_CARGA = [
  'Lustrando el parquet del Claudio Newell…',
  'Ajustando la mira de 3 puntos…',
  'Inflando las pelotas del canasto…',
  'Marcando la llave con tiza…',
  'Repasando la pizarra del segundo tiempo…',
  'Atando bien los cordones…',
] as const;

/** La frase que sigue, dando la vuelta. Con una lista vacía no hay frase. */
export function siguienteFrase(actual: number, total: number): number {
  if (total <= 0) return -1;
  return (actual + 1) % total;
}

/**
 * Cuántas sesiones seguidas, contando desde la última, mejoraron a la anterior. Un porcentaje que
 * falta (`null`: no se tiró o no se midió) corta la racha: no se sabe si mejoró, y no se inventa.
 */
export function sesionesEnAlza(porcentajes: (number | null)[]): number {
  let racha = 0;
  for (let i = porcentajes.length - 1; i > 0; i--) {
    const hoy = porcentajes[i];
    const antes = porcentajes[i - 1];
    if (hoy == null || antes == null || !(hoy > antes)) break;
    racha++;
  }
  return racha;
}

/** A partir de cuántas mejoras seguidas se muestra el reconocimiento. */
export const ALZA_MINIMA = 3;

/**
 * Entrenamientos seguidos con presente, desde el último hacia atrás. `null` es un día sin tomar
 * asistencia: no suma ni corta (el profe no la tomó, el chico no tiene la culpa).
 */
export function asistenciaSeguida(presencias: (boolean | null)[]): number {
  let racha = 0;
  for (let i = presencias.length - 1; i >= 0; i--) {
    const p = presencias[i];
    if (p == null) continue;
    if (!p) break;
    racha++;
  }
  return racha;
}

/** La racha más larga de presencias en la lista (con la misma regla: un día sin tomar no corta). */
export function mejorRacha(presencias: (boolean | null)[]): number {
  let mejor = 0;
  let actual = 0;
  for (const p of presencias) {
    if (p == null) continue;
    actual = p ? actual + 1 : 0;
    mejor = Math.max(mejor, actual);
  }
  return mejor;
}

/** Filas con algo escrito, sin contar el encabezado. Sólo se cuentan: el contenido no se mira. */
export function filasConDatos(filas: unknown[][]): number {
  const llenas = filas.filter((f) => f.some((c) => c != null && String(c).trim() !== ''));
  return Math.max(0, llenas.length - 1);
}

export const DIAS_DE_LA_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

/** Lunes = 0 … domingo = 6 (getDay() arranca en domingo). */
export const indiceDelDia = (fecha: Date): number => (fecha.getDay() + 6) % 7;
