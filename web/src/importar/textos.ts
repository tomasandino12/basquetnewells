// Los textos de las importaciones de planillas: puros, para probarlos sin dibujar nada.

/** Las reglas de la base se cuentan con palabras de todos los días: [lo que dice la base, lo que se le dice a quien importa]. */
export const REGLAS_INSCRIPTOS: [RegExp, string][] = [
  [/JUGADOR_DE_OTRO_CLUB/, 'Una de las fichas no es de este club. Volvé a subir la planilla.'],
  [/JUGADOR_YA_EXISTE/, 'Ya hay un chico con ese nombre y esa fecha. Volvé a subir la planilla.'],
  [/FECHA_NACIMIENTO_REQUERIDA/, 'A uno de los chicos le falta la fecha de nacimiento.'],
];

export const REGLAS_EMERGENCIAS: [RegExp, string][] = [
  [/JUGADOR_FUERA_DEL_PLANTEL/, 'Alguno de los chicos ya no está en este plantel. Volvé a subir la planilla.'],
  [/violates check constraint/, 'Alguno de los datos no cumple la regla de la base. Revisá la planilla.'],
];

export const REGLAS_PARTIDO: [RegExp, string][] = [
  [/^IMPORTACION_DUPLICADA$/, 'Este partido ya fue importado.'],
  [/^JUGADOR_YA_EXISTE:/, 'Alguien más acaba de cargar a ese jugador. Revisá la lista actualizada y guardá de nuevo.'],
  [/^PERTENENCIA_YA_VIGENTE$/, 'Alguien más acaba de sumar a ese jugador a esta categoría. Revisá la lista actualizada y guardá de nuevo.'],
];

/** Un choque con otro profe: la lista del club quedó vieja y hay que volver a leerla antes de guardar de nuevo. */
export const esChoqueConOtroProfe = (e: unknown) => /^(JUGADOR_YA_EXISTE:|PERTENENCIA_YA_VIGENTE)/.test((e as { message?: string } | null)?.message ?? '');

/** El parser antepone un código entre corchetes ([FORMATO_INVALIDO]…): a quien importa no le sirve. */
export const sinCodigo = (texto: string) => texto.replace(/^\[[A-Z_]+\]\s*/, '');

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

export const textoSalteadas = (n: number) =>
  `${n} ${plural(n, 'fila no se muestra', 'filas no se muestran')}: son de otras categorías o de una que Semillero todavía no tiene.`;

export const textoInscriptosListo = (r: { creados: number; existentes: number }) =>
  `Listo: ${r.creados} ${plural(r.creados, 'nuevo', 'nuevos')}, ${r.existentes} ${plural(r.existentes, 'que ya estaba', 'que ya estaban')}.`;

export const textoEmergenciasListo = (r: { guardados: number }) =>
  `Listo: ${r.guardados} ${plural(r.guardados, 'chico', 'chicos')} con datos de emergencia.`;

export const textoDeMails = (n: number) => `${n} ${plural(n, 'mail', 'mails')}`;

export const textoDeAlertas = (n: number) => (n === 0 ? 'Sin alertas marcadas' : `${n} ${plural(n, 'alerta médica', 'alertas médicas')}`);

export const textoDeJugadoresNuevos = (n: number) => `${n} ${plural(n, 'jugador nuevo', 'jugadores nuevos')}`;

export const textoPartidoGuardado = (rival: string, nuevos: number) => `Partido vs. ${rival} guardado — ${textoDeJugadoresNuevos(nuevos)}.`;

export const textoDeAdvertencias = (n: number) => `${n} ${plural(n, 'advertencia', 'advertencias')} del archivo`;
