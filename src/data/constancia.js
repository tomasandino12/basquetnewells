// Constancia del jugador: rachas de asistencia. Lógica pura, sin red ni DOM.
// Vienen del laboratorio de interacciones (web/src/interacciones) y se usan tal cual.

/**
 * Entrenamientos seguidos con presente, desde el último hacia atrás. `null` es un día sin tomar
 * asistencia: no suma ni corta (el profe no la tomó, el chico no tiene la culpa).
 * @param {(boolean | null)[]} presencias
 * @returns {number}
 */
export function asistenciaSeguida(presencias) {
  let racha = 0;
  for (let i = presencias.length - 1; i >= 0; i--) {
    const p = presencias[i];
    if (p == null) continue;
    if (!p) break;
    racha++;
  }
  return racha;
}

/**
 * La racha más larga de presencias en la lista (con la misma regla: un día sin tomar no corta).
 * @param {(boolean | null)[]} presencias
 * @returns {number}
 */
export function mejorRacha(presencias) {
  let mejor = 0;
  let actual = 0;
  for (const p of presencias) {
    if (p == null) continue;
    actual = p ? actual + 1 : 0;
    mejor = Math.max(mejor, actual);
  }
  return mejor;
}
