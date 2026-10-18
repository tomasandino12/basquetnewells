/*
 * Lista declarada de las funciones que 0057 (cuentas de familia) otorga con
 * `grant execute ... to authenticated`. Sin lógica.
 *
 * La familia comparte el rol `authenticated` con todos: lo que la frena es el
 * cuerpo de cada función, no el grant. tests/contratoAccesoFamilia.test.js lee
 * la migración y falla si aparece un grant que no está acá (o al revés).
 * Sumar una función a lo que ve una familia es sumarla en los dos lados, a
 * propósito: así se revisa (spec 2026-10-18 §6.3).
 */

/** Lo que usa la familia: vincularse al entrar y ver a sus chicos. Ninguna tabla. */
export const DE_LA_FAMILIA = ['vincular_por_mail', 'mis_chicos'];

/** El entrenador importa la planilla de inscriptos a su plantel. */
export const DEL_CUERPO_TECNICO = ['importar_inscriptos'];

/** Control posterior del coordinador: ver los vínculos y dar de baja. */
export const DE_COORDINACION = ['vinculos_familia_del_club', 'cerrar_vinculo_familia'];

export const FUNCIONES_OTORGADAS = [...DE_LA_FAMILIA, ...DEL_CUERPO_TECNICO, ...DE_COORDINACION];
