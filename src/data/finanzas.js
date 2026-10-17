/*
 * Lógica pura de finanzas del básquet: leer montos tecleados, mostrarlos y
 * sumar el período. Sin red, sin DOM. Ver
 * docs/superpowers/specs/2026-10-16-finanzas-design.md.
 *
 * Todo en centavos enteros: 0,10 + 0,20 en coma flotante da
 * 0,30000000000000004, y con plata no hay redondeo que lo disimule. A la base
 * llega el texto "1234.50" armado desde el entero, nunca un float.
 */

/** Tope de numeric(12,2): 9.999.999.999,99. */
export const MONTO_MAX_CENTAVOS = 999999999999;

// Dos formas válidas, las que escribe la gente acá: con punto de miles
// ("1.234,50") o sin nada ("1234,50"). El punto sólo vale como separador de
// grupos de tres; "12.5" puede ser doce y medio o doce mil quinientos, así
// que se rechaza en vez de adivinar.
const CON_MILES = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
const SIN_MILES = /^(\d+)(?:,(\d{1,2}))?$/;
const DEMASIADOS_DECIMALES = /^[\d.]+,\d{3,}$/;

/**
 * Texto tecleado → { centavos } o { error: 'mensaje para mostrar' }.
 * El monto siempre es positivo: el signo lo da el tipo del rubro.
 */
export function montoDesdeTexto(texto) {
  const limpio = typeof texto === 'string' ? texto.trim().replace(/^\$\s*/, '') : '';
  if (limpio === '') return { error: 'Escribí un monto.' };
  if (/^[+-]/.test(limpio)) {
    return { error: 'El monto va sin signo: si es un gasto, elegí un rubro de egreso.' };
  }
  const partes = CON_MILES.exec(limpio) ?? SIN_MILES.exec(limpio);
  if (!partes) {
    if (DEMASIADOS_DECIMALES.test(limpio)) {
      return { error: 'Los centavos van con dos cifras como máximo.' };
    }
    if (/^[\d.,]+$/.test(limpio) && limpio.includes('.')) {
      return { error: 'Usá coma para los centavos y punto sólo para los miles (ej.: 1.234,50).' };
    }
    return { error: 'Escribí sólo números, con coma para los centavos (ej.: 1.234,50).' };
  }
  const enteros = partes[1].replaceAll('.', '').replace(/^0+(?=\d)/, '');
  // Se corta por largo antes de convertir: un entero de 20 cifras ya no entra
  // exacto en un Number.
  if (enteros.length > 10) return { error: 'El monto es demasiado grande (máximo $ 9.999.999.999,99).' };
  const centavos = Number(enteros) * 100 + Number((partes[2] ?? '').padEnd(2, '0'));
  if (centavos === 0) return { error: 'El monto tiene que ser mayor que cero.' };
  if (centavos > MONTO_MAX_CENTAVOS) {
    return { error: 'El monto es demasiado grande (máximo $ 9.999.999.999,99).' };
  }
  return { centavos };
}

/** Centavos → "1234.50", el texto que se le manda a la columna numeric. */
export function montoParaBase(centavos) {
  return `${Math.trunc(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

/**
 * Centavos → "$ 1.234,50". Con `signo`, los positivos llevan "+": ingreso y
 * egreso se distinguen por el texto, no sólo por el color. Los negativos
 * siempre llevan "−" (signo menos, no guion).
 */
export function formatearPesos(centavos, { signo = false } = {}) {
  const absoluto = Math.abs(centavos);
  const enteros = String(Math.trunc(absoluto / 100)).replace(/\B(?=(\d{3})+$)/g, '.');
  const texto = `$ ${enteros},${String(absoluto % 100).padStart(2, '0')}`;
  if (centavos < 0) return `− ${texto}`;
  if (signo && centavos > 0) return `+ ${texto}`;
  return texto;
}
