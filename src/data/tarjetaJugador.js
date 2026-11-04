/**
 * Lo que muestra la tarjeta de un jugador en la lista del plantel y el encabezado
 * de su ficha. Funciones puras: sin red, sin DOM.
 *
 * Sólo datos de básquet. Lo que falta (sin medir, sin asistencia tomada) queda
 * en null y la pantalla no lo dibuja: al profe no le sirve un cartel de "sin
 * dato", y NULL nunca se vuelve un cero.
 */

/**
 * `medicion` es el vigente por campo (antropometria.vigentePorCampo) y
 * `asistencia` lo que devuelve asistencia.asistenciaDelJugador; cualquiera de
 * los dos puede faltar.
 */
export function datosDeTarjeta({ medicion = null, asistencia = null } = {}) {
  const pct = asistencia?.resumen?.pctAsistencia;
  return {
    alturaCm: medicion?.alturaCm?.valor ?? null,
    pesoKg: medicion?.pesoKg?.valor ?? null,
    pctAsistencia: pct == null ? null : Math.round(pct),
    nivelAsistencia: pct == null ? null : asistencia.nivel,
    lesionado: asistencia?.lesionAbierta != null,
  };
}

const NIVELES = { excelente: 'sube', regular: 'baja', alerta: 'alerta' };

/** Clase de color del chip de asistencia; sin nivel no hay chip. */
export function claseDeNivel(nivel) {
  return NIVELES[nivel] ?? null;
}
