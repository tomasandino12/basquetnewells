/*
 * Lista declarada de las funciones que las migraciones de la cuenta de jugador
 * (0029, 0030 y 0068) otorgan con `grant execute ... to authenticated`. Sin lógica.
 *
 * El jugador comparte el rol `authenticated` con el cuerpo técnico, así que
 * todo lo que se otorga ahí lo puede ejecutar. Lo que lo frena no es el grant
 * sino el cuerpo de cada función (chequea mi_jugador() o el plantel de quien
 * llama). Por eso esta lista existe: tests/contratoAccesoJugador.test.js lee las
 * migraciones y falla si aparece un grant que no está acá, o si acá hay uno que
 * ninguna migración otorga. Sumar una función es sumarla en las dos partes, a
 * propósito.
 */

/**
 * Lo que lee el jugador: seis funciones y nada más. Ninguna tabla. Las cuatro
 * primeras son de 0030; `mis_practicas` y `mi_asistencia`, de 0068.
 */
export const LECTURA_DEL_JUGADOR = ['mi_ficha', 'mis_recursos', 'mi_plan', 'mi_progreso', 'mis_practicas', 'mi_asistencia'];

/**
 * Lo único que escribe el jugador (0068): marcar que hoy practicó un recurso. La
 * fecha la pone el servidor. Como `registrar_apertura` (0034), que va aparte.
 */
export const ESCRITURA_DEL_JUGADOR = ['marcar_practica'];

/** Las que usa quien todavía no tiene club, para pedir acceso. */
export const ALTA_DEL_JUGADOR = ['clubes_para_solicitar', 'crear_solicitud_jugador', 'mi_solicitud_jugador'];

/**
 * Las del entrenador del plantel: ver, aprobar, rechazar y revocar, y (0068)
 * cuántos del plantel practicaron cada recurso, nunca quiénes.
 */
export const DEL_CUERPO_TECNICO = [
  'solicitudes_del_plantel',
  'aprobar_solicitud_jugador',
  'rechazar_solicitud_jugador',
  'revocar_cuenta_jugador',
  'practicas_del_plantel',
];

export const FUNCIONES_OTORGADAS = [
  ...LECTURA_DEL_JUGADOR,
  ...ESCRITURA_DEL_JUGADOR,
  ...ALTA_DEL_JUGADOR,
  ...DEL_CUERPO_TECNICO,
];
