/**
 * Estado de papeles y pagos de cada chico, tal como lo manda el script de
 * Google del club (0060, spec 2026-10-19-panel-docs-pagos). Sin red ni DOM.
 *
 * Las reglas de abajo viven también en la migración, que es la que las hace
 * cumplir: tests/contratoEstadoInscripcion.test.js compara las dos.
 */

export const LIMITES_ESTADO = Object.freeze({
  nombre: 80,
  categoria: 80,
  encabezado: 60,
  encabezados: 25,
  filas: 1500,
  fila: 5000,
  bytes: 1048576,
});

export const ESTADOS_PAGO = Object.freeze(['falta', 'subido', 'verificado']);

export const EMPAREJAMIENTOS = Object.freeze(['ok', 'homonimo', 'sin_ficha', 'sin_tablero']);
