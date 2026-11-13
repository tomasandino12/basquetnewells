/**
 * Lo que el club cambia cada temporada y no es lógica: los horarios de cada
 * categoría y la fecha en que abre la inscripción. Sólo datos (la página no
 * tiene build, así que es un módulo JS y no un .json). Para cambiar un horario
 * se toca esta línea y nada más; tests/portalInfoEstatica.test.js verifica que
 * el resumen sin JS de public/portal.html siga igual.
 */

// Clave: `GRUPO|Rama` (la misma pareja identifica una categoría del portal).
// null = el club todavía no pasó el horario. Temporada 2027: iguales a 2026.
export const HORARIOS = Object.freeze({
  'U9|Mixto': 'Mar 18 a 19 h (Estadio Cubierto) · Jue 18 a 19 h (Playón Deportivo)',
  'U11|Mixto': 'Mar 19 a 20 h (Estadio Cubierto) · Jue 19 a 20 h (Playón Deportivo)',
  'U13|Mixto': 'Lun y Vie 18 a 19 h (Estadio Cubierto) · Mié 18 a 19 h (Microestadio)',
  'U15|Masculino': 'Lun y Vie 18 a 19 h (Estadio Cubierto) · Mié 18 a 19 h (Microestadio)',
  'U17|Masculino': 'Lun y Vie 19 a 20 h (Estadio Cubierto) · Mié 19 a 20 h (Microestadio)',
  'U21|Masculino': 'Lun y Vie 20 a 21 h (Estadio Cubierto) · Mié 20 a 21 h (Microestadio)',
  'MAYORES|Masculino': null,
  'MAYORES|Femenino': null,
});

/**
 * Fecha en que abre la inscripción, 'AAAA-MM-DD', o null si todavía no se sabe
 * (hoy la gente entra por la prueba). Es sólo un aviso: NUNCA abre un
 * formulario que la coordinación no haya dejado activo en la base.
 */
export const INSCRIPCION_ABRE = null;

/** El horario de una categoría, o null si no hay. */
export function horarioDe(grupo, rama) {
  return HORARIOS[`${grupo}|${rama}`] ?? null;
}

/**
 * "Abre el 02/02" si la fecha es válida y todavía no llegó; null si no hay
 * fecha, está mal escrita o ya pasó (desde ahí manda la base).
 */
export function textoApertura(abre, hoy = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(abre ?? ''));
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  const hoyUtc = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (fecha.getTime() <= hoyUtc) return null;
  return `Abre el ${m[3]}/${m[2]}`;
}
