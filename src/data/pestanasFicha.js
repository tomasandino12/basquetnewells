/**
 * Las pestañas de la ficha del jugador. La ficha apilaba diez secciones y el
 * scroll se hacía larguísimo: cada pestaña contesta una pregunta del profe en
 * la cancha (¿cómo está físicamente?, ¿cómo tira?, ¿cómo juega?, ¿de dónde
 * viene?). La cabecera (nombre, edad, cuenta del chico) queda arriba, fuera
 * de las pestañas.
 *
 * Una sección nueva de la ficha va en SECCIONES_FICHA con su pestaña: el test
 * falla si queda una sección sin pestaña o una pestaña vacía.
 */

export const PESTANAS_FICHA = Object.freeze([
  { id: 'fisico', titulo: 'Físico' },
  { id: 'tiro', titulo: 'Tiro' },
  { id: 'partidos', titulo: 'Partidos' },
  { id: 'historia', titulo: 'Historia' },
]);

/** Sección de la ficha → pestaña donde se muestra. */
export const SECCIONES_FICHA = Object.freeze({
  corporal: 'fisico',
  salto: 'fisico',
  sprint: 'fisico',
  yoyo: 'fisico',
  estimaciones: 'fisico',
  cargas: 'fisico',
  bateria: 'tiro',
  triples: 'tiro',
  libres: 'tiro',
  partidos: 'partidos',
  misiones: 'partidos',
  temporadas: 'historia',
  recursos: 'historia',
});

/** La primera que se abre: Físico (decisión de Tomás, 18/10). */
export const PESTANA_INICIAL = 'fisico';

/**
 * La que se abre al entrar a una ficha: la última que se usó en esta sesión,
 * así revisar el salto de un chico tras otro no obliga a volver a elegirla.
 * Algo que no es una pestaña cae en la inicial.
 */
export function pestanaAlEntrar(ultima) {
  return PESTANAS_FICHA.some((p) => p.id === ultima) ? ultima : PESTANA_INICIAL;
}

/** Con las flechas del teclado: la siguiente o la anterior, dando la vuelta. */
export function pestanaVecina(actual, paso) {
  const i = PESTANAS_FICHA.findIndex((p) => p.id === actual);
  const n = PESTANAS_FICHA.length;
  return PESTANAS_FICHA[((i < 0 ? 0 : i) + paso + n) % n].id;
}
