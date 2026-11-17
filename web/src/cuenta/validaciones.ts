import { normalizarNombre } from '@datos/cuenta.js';

/** Sólo para avisar temprano; el largo real lo exige Supabase. */
export const CLAVE_MINIMA = 8;

// Deliberadamente laxa: ataja el dedazo obvio. Si el mail existe lo decide el servidor de correo.
const PARECE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BorradorDeCuenta {
  nombre: string;
  email: string;
  clave: string;
  repetida: string;
}

export type ResultadoDeCuenta = { ok: true; nombre: string; email: string } | { ok: false; problema: string };

export function problemaDeClave(clave: string, repetida: string): string | null {
  if (clave.length < CLAVE_MINIMA) return `La contraseña tiene que tener al menos ${CLAVE_MINIMA} caracteres.`;
  if (clave !== repetida) return 'Las dos contraseñas no coinciden.';
  return null;
}

export function emailValido(email: string): boolean {
  return PARECE_EMAIL.test(email.trim());
}

export function validarCuenta(b: BorradorDeCuenta): ResultadoDeCuenta {
  const nombre = normalizarNombre(b.nombre) as string;
  if (!nombre) return { ok: false, problema: 'Escribí tu nombre y apellido.' };
  if (!emailValido(b.email)) return { ok: false, problema: 'Escribí un mail válido.' };
  const problema = problemaDeClave(b.clave, b.repetida);
  if (problema) return { ok: false, problema };
  return { ok: true, nombre, email: b.email.trim() };
}

/** Ni confirma ni desmiente que un mail ya tenga cuenta: filtrar el padrón no se negocia. */
export function mensajeDeCreacion(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (/already registered|already exists|user_already_exists/i.test(msg)) {
    return 'Si ese mail no tenía cuenta, ya te llegó el mail para confirmarla. Si ya tenía, entrá con tu contraseña.';
  }
  if (/password/i.test(msg)) return 'Esa contraseña no cumple los requisitos mínimos. Probá con una más larga.';
  return 'No se pudo crear la cuenta. Intentá de nuevo en un rato.';
}

/**
 * Un error de ingreso NUNCA distingue entre «ese mail no existe» y «la clave está mal»: esa diferencia
 * deja averiguar quién tiene cuenta. Sólo se separa «todavía no confirmó el mail», que le sirve a quien
 * se acaba de registrar y no revela nada que no sepa (quien no es dueño del mail no ve ese mensaje
 * sin la clave correcta: Supabase lo contesta recién con la clave bien).
 */
export function mensajeDeIngreso(e: unknown): string {
  if (/email not confirmed/i.test((e as { message?: string } | null)?.message ?? '')) {
    return 'Todavía no confirmaste tu mail. Buscá el mail de confirmación y abrí el link.';
  }
  return 'El mail o la contraseña no coinciden.';
}

/** El proveedor de Google se habilita en el panel de Supabase, no desde el código. */
export function mensajeDeGoogle(e: unknown): string {
  if (/provider is not enabled|unsupported provider|validation_failed/i.test((e as { message?: string } | null)?.message ?? '')) {
    return 'El ingreso con Google todavía no está habilitado. Entrá con mail y contraseña.';
  }
  return 'No se pudo abrir el ingreso con Google. Entrá con mail y contraseña.';
}
