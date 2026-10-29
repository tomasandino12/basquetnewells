// Asistencia y lesiones: lógica pura (sin red ni DOM). Las listas cerradas viven
// también en 0064_asistencia.sql; tests/contratoAsistencia.test.js las compara.

export const ESTADOS = ['presente', 'ausente', 'justificada'];
export const ZONAS = [
  'tobillo', 'pie', 'rodilla', 'pantorrilla', 'muslo', 'cadera',
  'espalda', 'hombro', 'muneca_mano', 'cabeza', 'otra',
];
export const LADOS = ['izquierdo', 'derecho', 'no_aplica'];
export const TIPOS = ['torcedura', 'golpe', 'sobrecarga_dolor', 'otro'];

// Las claves no se pisan entre listas, así que alcanza un solo diccionario.
export const ETIQUETAS = {
  presente: 'Presente',
  ausente: 'Ausente',
  justificada: 'Justificada',
  tobillo: 'Tobillo',
  pie: 'Pie',
  rodilla: 'Rodilla',
  pantorrilla: 'Pantorrilla',
  muslo: 'Muslo',
  cadera: 'Cadera',
  espalda: 'Espalda',
  hombro: 'Hombro',
  muneca_mano: 'Muñeca o mano',
  cabeza: 'Cabeza',
  otra: 'Otra zona',
  izquierdo: 'Izquierdo',
  derecho: 'Derecho',
  no_aplica: 'No aplica',
  torcedura: 'Torcedura',
  golpe: 'Golpe',
  sobrecarga_dolor: 'Sobrecarga o dolor',
  otro: 'Otro',
};

/**
 * ¿Estaba lesionado ese día? `desde` es el primer día lesionado y `hasta` el día
 * del alta, que ya no cuenta: el profe da el alta en la toma de ese día y el
 * chico aparece como sano. Con `hasta` en null sigue lesionado. Las fechas son
 * ISO (YYYY-MM-DD), que se comparan bien como texto y evitan husos horarios.
 */
export function lesionadoEn(lesiones, fecha) {
  return (lesiones ?? []).some(
    (l) => l.desde <= fecha && (l.hasta == null || fecha < l.hasta),
  );
}

/**
 * El código de la planilla del área para un día de un chico. Sin fila ('' ) es
 * "no se tomó": no se disfraza de ausente.
 */
export function codigoDelDia({ hubo, estado, lesionado }) {
  if (hubo === false) return 'SE';
  if (estado === 'justificada') return 'J, A';
  if (estado === 'presente') return lesionado ? 'L, P' : 'P';
  if (estado === 'ausente') return lesionado ? 'L, A' : 'A';
  return '';
}

/**
 * Totales de una temporada de un chico. Un día cuenta en el total sólo si hubo
 * entrenamiento y se lo tomó; la justificada es falta, como en la planilla; un
 * lesionado que vino cuenta como asistido. Así el % nunca pasa de 100 (la
 * planilla a mano lo pasaba porque las fórmulas buscaban "LA" y se tipeaba "L, A").
 */
export function resumenDeAsistencia(dias) {
  let total = 0, asistidos = 0, sinEntrenamiento = 0, justificadas = 0, diasLesion = 0;
  for (const d of dias) {
    if (d.hubo === false) { sinEntrenamiento++; continue; }
    if (!d.estado) continue;
    total++;
    if (d.estado === 'presente') asistidos++;
    if (d.estado === 'justificada') justificadas++;
    if (d.lesionado) diasLesion++;
  }
  return {
    total,
    asistidos,
    sinEntrenamiento,
    justificadas,
    diasLesion,
    pctAsistencia: total ? (asistidos / total) * 100 : null,
    pctLesion: total ? (diasLesion / total) * 100 : null,
  };
}

export function semaforo(pct) {
  if (pct == null) return 'sin_datos';
  if (pct < 70) return 'alerta';
  if (pct < 85) return 'regular';
  return 'excelente';
}

const diaMes = (iso) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/** "Lesionado desde el 12/10 · tobillo derecho"; sin zona, sólo la primera parte. */
export function textoDeLesion({ desde, zona, lado }) {
  const base = `Lesionado desde el ${diaMes(desde)}`;
  if (!zona) return base;
  const partes = [ETIQUETAS[zona].toLowerCase()];
  if (lado === 'izquierdo' || lado === 'derecho') partes.push(lado);
  return `${base} · ${partes.join(' ')}`;
}

/** Un día de práctica con lo tomado: `asistencia` es el embed de PostgREST. */
export function entrenamientoDesdeFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    hubo: f.hubo,
    filas: (f.asistencia ?? []).map((a) => ({ jugadorId: a.jugador_id, estado: a.estado })),
  };
}

export function lesionDesdeFila(f) {
  return {
    id: f.id,
    jugadorId: f.jugador_id,
    desde: f.desde,
    hasta: f.hasta,
    zona: f.zona,
    lado: f.lado,
    tipo: f.tipo,
  };
}

/**
 * Cómo arranca la toma de un día: una tarjeta por chico. Sin fila queda en
 * null ("sin tomar"), nunca en ausente: nadie dijo que faltó. `lesionado` sale
 * de las lesiones a esa fecha, así el día de una corrección vieja marca a quien
 * estaba lesionado entonces y no a quien lo está hoy.
 */
export function estadoInicial(jugadores, filas, lesiones, fecha) {
  const estados = new Map((filas ?? []).map((f) => [f.jugadorId, f.estado]));
  const lesionesDe = new Map();
  for (const l of lesiones ?? []) {
    lesionesDe.set(l.jugadorId, [...(lesionesDe.get(l.jugadorId) ?? []), l]);
  }
  return jugadores.map((j) => ({
    jugadorId: j.id,
    estado: estados.get(j.id) ?? null,
    lesionado: lesionadoEn(lesionesDe.get(j.id), fecha),
  }));
}

/** Un toque: de presente pasa a ausente; de cualquier otro (incluido sin tomar) a presente. */
export function alternar(estado) {
  return estado === 'presente' ? 'ausente' : 'presente';
}

export function contarEstados(tarjetas) {
  const presentes = tarjetas.filter((t) => t.estado === 'presente').length;
  const sinTomar = tarjetas.filter((t) => t.estado == null).length;
  return { total: tarjetas.length, presentes, sinTomar };
}

/** Lo que se manda a guardar: los chicos sin tomar no llevan fila. */
export function filasParaGuardar(tarjetas) {
  return tarjetas.filter((t) => t.estado != null).map((t) => ({ jugadorId: t.jugadorId, estado: t.estado }));
}

/** ¿Hay algo marcado distinto de lo que se cargó? Para avisar antes de perderlo. */
export function huboCambios(inicial, actual) {
  const antes = new Map(inicial.map((t) => [t.jugadorId, t.estado]));
  return actual.some((t) => (antes.get(t.jugadorId) ?? null) !== t.estado);
}

/**
 * Qué ofrece el menú de la tarjeta de un chico en la toma de `fecha`.
 * - justificada: mientras no lo esté ya.
 * - lesionar: sólo sin ninguna lesión abierta (a lo sumo una por jugador, lo
 *   exige la base) y sin estar lesionado ese día por un período ya cerrado.
 * - altaDe: el id de la lesión abierta a la que se le puede dar el alta ese
 *   día; null si no hay o si empezó después de `fecha` (se corrige un día
 *   viejo y el alta no puede ser anterior al comienzo).
 */
export function accionesDeTarjeta({ estado, lesiones, fecha }) {
  const abierta = (lesiones ?? []).find((l) => l.hasta == null) ?? null;
  return {
    justificada: estado !== 'justificada',
    lesionar: !abierta && !lesionadoEn(lesiones, fecha),
    altaDe: abierta && abierta.desde <= fecha ? abierta.id : null,
  };
}
