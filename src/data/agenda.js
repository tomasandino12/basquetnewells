/*
 * Lógica pura del calendario del portal: de los eventos de Google Calendar a
 * la grilla del mes con un color por tipo. Sin red ni DOM (el pedido a Google
 * está en repos/portal.js).
 *
 * Los calendarios son públicos: cualquiera con el ID ve todo. Por eso acá se
 * pide y se muestra sólo título, hora y lugar, nunca la descripción, que es
 * donde alguien podría escribir el nombre de un chico.
 */

export const ZONA = 'America/Argentina/Buenos_Aires';
// Argentina no tiene horario de verano desde 2009: un mes de Rosario va de
// las 00:00 -03:00 del 1 a las 00:00 -03:00 del 1 del mes siguiente.
const DESFASE = '-03:00';

/** Un calendario de Google por tipo: el tipo da el color (tokens --agenda-*) y el nombre de la leyenda. */
export const TIPOS_AGENDA = Object.freeze(['partido', 'evento', 'charla', 'entrenamiento']);

const API = 'https://www.googleapis.com/calendar/v3/calendars/';
const EMBED = 'https://calendar.google.com/calendar/embed';
// Un ID de Google Calendar tiene forma de mail. Estricto porque termina en una URL.
const ID_CALENDARIO = /^[A-Za-z0-9._%+-]{1,200}@[A-Za-z0-9.-]{1,200}$/;
// Las API keys de Google: "AIza" y 35 caracteres más.
const CLAVE = /^AIza[\w-]{35}$/;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dosCifras = (n) => String(n).padStart(2, '0');

/**
 * El ID del calendario. Acepta también la URL de embed entera, porque es lo
 * que Google ofrece para copiar en "Integrar el calendario"; de ella sólo se
 * rescata el ID. Cualquier otra cosa → null.
 */
export function idCalendario(valor) {
  if (typeof valor !== 'string') return null;
  let id = valor.trim();
  if (id.startsWith('https://')) {
    let u;
    try {
      u = new URL(id);
    } catch {
      return null;
    }
    if (`${u.origin}${u.pathname}` !== EMBED) return null;
    id = u.searchParams.get('src') ?? '';
  }
  return ID_CALENDARIO.test(id) ? id : null;
}

export function claveValida(valor) {
  return typeof valor === 'string' && CLAVE.test(valor);
}

/** Del 1 del mes (mes 1–12) al 1 del siguiente, en hora de Rosario, como los pide la API. */
export function rangoDelMes(anio, mes) {
  const sig = mesVecino(anio, mes, 1);
  return {
    desde: `${anio}-${dosCifras(mes)}-01T00:00:00${DESFASE}`,
    hasta: `${sig.anio}-${dosCifras(sig.mes)}-01T00:00:00${DESFASE}`,
  };
}

/**
 * URL de events.list de un calendario público. `fields` pide sólo lo que se
 * muestra: la descripción ni siquiera viaja. Con un ID o una clave inválidos → null.
 */
export function urlEventos(valorId, clave, { desde, hasta }) {
  const id = idCalendario(valorId);
  if (!id || !claveValida(clave)) return null;
  const q = new URLSearchParams({
    key: clave,
    timeMin: desde,
    timeMax: hasta,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    timeZone: ZONA,
    fields: 'items(id,status,summary,location,start,end)',
  });
  return `${API}${encodeURIComponent(id)}/events?${q}`;
}

const PARTES = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Un instante → { dia: 'aaaa-mm-dd', hora: 'hh:mm' } en Rosario. */
function enRosario(fecha) {
  const p = Object.fromEntries(PARTES.formatToParts(fecha).map(({ type, value }) => [type, value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** 'aaaa-mm-dd' + n días (UTC puro: sólo calendario, sin horas). */
function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Un evento de la API → { id, tipo, titulo, lugar, dia, hasta, hora }.
 * Los de todo el día traen hora null y pueden durar varios (un torneo):
 * `hasta` es su último día (Google da el fin exclusivo). Cancelados o sin
 * fecha → null.
 */
export function eventoDesdeGoogle(item, tipo) {
  if (!item || item.status === 'cancelled' || !TIPOS_AGENDA.includes(tipo)) return null;
  const base = { id: String(item.id ?? ''), tipo, titulo: texto(item.summary, 120) || 'Evento', lugar: texto(item.location, 160) || null };
  if (typeof item.start?.date === 'string' && FECHA.test(item.start.date)) {
    const fin = typeof item.end?.date === 'string' && FECHA.test(item.end.date) ? sumarDias(item.end.date, -1) : item.start.date;
    return { ...base, dia: item.start.date, hasta: fin > item.start.date ? fin : item.start.date, hora: null };
  }
  const inicio = new Date(item.start?.dateTime ?? NaN);
  if (Number.isNaN(inicio.getTime())) return null;
  const { dia, hora } = enRosario(inicio);
  return { ...base, dia, hasta: dia, hora };
}

// Un evento de todo el día mal cargado (de enero a diciembre) no tiene que
// llenar el año entero de puntitos.
const MAX_DIAS_EVENTO = 31;

/** Primero los de todo el día, después por hora y por título. */
function compararEventos(a, b) {
  if ((a.hora == null) !== (b.hora == null)) return a.hora == null ? -1 : 1;
  return (a.hora ?? '').localeCompare(b.hora ?? '') || a.titulo.localeCompare(b.titulo, 'es');
}

/** Eventos → Map 'aaaa-mm-dd' → eventos de ese día, ordenados. Uno de varios días aparece en cada uno. */
export function eventosPorDia(eventos) {
  const porDia = new Map();
  for (const e of eventos ?? []) {
    if (!e) continue;
    let d = e.dia;
    for (let i = 0; i < MAX_DIAS_EVENTO && d <= e.hasta; i += 1, d = sumarDias(d, 1)) {
      if (!porDia.has(d)) porDia.set(d, []);
      porDia.get(d).push(e);
    }
  }
  for (const lista of porDia.values()) lista.sort(compararEventos);
  return porDia;
}

/** Los próximos `n` desde `desde` (inclusive), con su día: { fecha, evento }. */
export function proximosEventos(porDia, desde, n = 3) {
  const fechas = [...porDia.keys()].filter((f) => f >= desde).sort();
  const r = [];
  const vistos = new Set();
  for (const fecha of fechas) {
    for (const evento of porDia.get(fecha)) {
      // Un torneo de tres días cuenta una vez, el primer día que queda por delante.
      const clave = `${evento.tipo}|${evento.id}|${evento.dia}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      r.push({ fecha, evento });
      if (r.length >= n) return r;
    }
  }
  return r;
}

/** Semanas de lunes a domingo que cubren el mes: [[{ fecha, dia, delMes }, ×7], …]. */
export function semanasDelMes(anio, mes) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const corrimiento = (primero.getUTCDay() + 6) % 7; // lunes = 0
  let fecha = sumarDias(primero.toISOString().slice(0, 10), -corrimiento);
  const prefijo = `${anio}-${dosCifras(mes)}`;
  const semanas = [];
  do {
    const semana = [];
    for (let i = 0; i < 7; i += 1, fecha = sumarDias(fecha, 1)) {
      semana.push({ fecha, dia: Number(fecha.slice(8)), delMes: fecha.startsWith(prefijo) });
    }
    semanas.push(semana);
  } while (fecha.startsWith(prefijo));
  return semanas;
}

/** El mes `delta` meses antes o después: { anio, mes }. */
export function mesVecino(anio, mes, delta) {
  const total = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/** Hoy en Rosario, 'aaaa-mm-dd'. */
export function hoyEnRosario(ahora = new Date()) {
  return enRosario(ahora).dia;
}

/** 2026, 10 → "Octubre 2026". */
export function tituloMes(anio, mes) {
  return `${mayuscula(MESES[mes - 1])} ${anio}`;
}

/** '2026-10-24' → "Sábado 24 de octubre". */
export function fechaLarga(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`);
  return `${mayuscula(DIAS[d.getUTCDay()])} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}
