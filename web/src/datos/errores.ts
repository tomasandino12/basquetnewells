// Los textos de error son los de la app actual (src/ui/errores.js): un solo lugar para redactarlos.
import { SIN_CONEXION, desmarcarSesionCerrada, marcarSesionCerrada, mensajeAlGuardar, textoDeError } from '@ui/errores.js';

export { SIN_CONEXION, desmarcarSesionCerrada, marcarSesionCerrada };

/** El texto de un guardado que falló: red, reglas de la base de esa pantalla, permiso y, si nada calza, el genérico. */
export function mensajeDeGuardado(e: unknown, generico: string, reglas: [RegExp, string][] = []): string {
  // El JS infiere `reglas` como lista vacía; la forma real es [regex, texto].
  return mensajeAlGuardar(e, { reglas: reglas as unknown as never[], generico }) as string;
}

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
