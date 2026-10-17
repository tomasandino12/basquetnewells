/*
 * Lógica pura de finanzas del básquet: leer montos tecleados, mostrarlos y
 * sumar el período. Sin red, sin DOM. Ver
 * docs/superpowers/specs/2026-10-16-finanzas-design.md.
 *
 * Todo en centavos enteros: 0,10 + 0,20 en coma flotante da
 * 0,30000000000000004, y con plata no hay redondeo que lo disimule. A la base
 * llega el texto "1234.50" armado desde el entero, nunca un float.
 */

/** Los mismos que el check de rubro.tipo (0054); tests/contratoFinanzas.test.js los compara. */
export const TIPOS_RUBRO = ['ingreso', 'egreso'];

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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const dosCifras = (n) => String(n).padStart(2, '0');

/** Mes (1–12) → fechas ISO para filtrar `fecha >= desde and fecha < hasta`. */
export function rangoDelMes(anio, mes) {
  const siguiente = mesVecino(anio, mes, 1);
  return {
    desde: `${anio}-${dosCifras(mes)}-01`,
    hasta: `${siguiente.anio}-${dosCifras(siguiente.mes)}-01`,
  };
}

/** El mes anterior (paso -1) o el siguiente (paso 1). */
export function mesVecino(anio, mes, paso) {
  const indice = anio * 12 + (mes - 1) + paso;
  return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

export function nombreDelMes(anio, mes) {
  return `${MESES[mes - 1]} ${anio}`;
}

/**
 * Movimientos del mes → totales en centavos. Los borrados no suman: siguen en
 * la base con su rastro, pero no son plata que entró o salió.
 *
 * `porRubro` sólo trae rubros con movimientos en el período (activos o no:
 * desactivar un rubro no borra lo que pasó), ingresos primero y cada grupo de
 * mayor a menor.
 */
export function resumenDelPeriodo(movimientos, rubros) {
  const rubroPorId = new Map(rubros.map((r) => [r.id, r]));
  const porRubro = new Map();
  let ingresos = 0;
  let egresos = 0;
  for (const m of movimientos) {
    if (m.borradoEn) continue;
    const rubro = rubroPorId.get(m.rubroId);
    // Sin el rubro no se sabe el signo: mejor romper que sumar del lado equivocado.
    if (!rubro) throw new Error('RUBRO_DESCONOCIDO');
    if (rubro.tipo === 'ingreso') ingresos += m.centavos;
    else egresos += m.centavos;
    const linea = porRubro.get(rubro.id)
      ?? { rubroId: rubro.id, nombre: rubro.nombre, tipo: rubro.tipo, total: 0, cantidad: 0 };
    linea.total += m.centavos;
    linea.cantidad += 1;
    porRubro.set(rubro.id, linea);
  }
  const orden = (a, b) => (a.tipo === b.tipo ? b.total - a.total : a.tipo === 'ingreso' ? -1 : 1);
  return { ingresos, egresos, resultado: ingresos - egresos, porRubro: [...porRubro.values()].sort(orden) };
}
