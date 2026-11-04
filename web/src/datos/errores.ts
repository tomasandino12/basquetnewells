// Los textos de error son los de la app actual (src/ui/errores.js): un solo lugar para redactarlos.
import { SIN_CONEXION, desmarcarSesionCerrada, marcarSesionCerrada, textoDeError } from '@ui/errores.js';

export { SIN_CONEXION, desmarcarSesionCerrada, marcarSesionCerrada };

export function mensajeDeError(e: unknown, generico: string): string {
  return textoDeError(e, generico) as string;
}

export function esSinConexion(e: unknown): boolean {
  return mensajeDeError(e, '') === SIN_CONEXION;
}

/** Un error de permiso no se arregla reintentando: se muestra una vez. Un corte de red sí merece un segundo intento. */
export function reintentar(cantidad: number, e: unknown): boolean {
  return cantidad < 1 && esSinConexion(e);
}
