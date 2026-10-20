import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  idCalendario, claveValida, rangoDelMes, urlEventos, eventoDesdeGoogle, eventosPorDia,
  proximosEventos, semanasDelMes, mesVecino, hoyEnRosario, tituloMes, fechaLarga,
  TIPO_POR_COLOR, TIPOS_AGENDA, enlaceAgregarGoogle, textoIcs, enlacesSuscripcion,
} from '../src/data/agenda.js';

const ID = 'abc123@group.calendar.google.com';
const CLAVE = `AIza${'x'.repeat(35)}`;

test('ID del calendario: el ID solo o la URL de embed; nada más', () => {
  assert.equal(idCalendario(` ${ID} `), ID);
  assert.equal(idCalendario(`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(ID)}&ctz=America%2FArgentina%2FBuenos_Aires`), ID);
  assert.equal(idCalendario('https://otro.com/calendar/embed?src=a@b.c'), null);
  assert.equal(idCalendario('a"b@c.d'), null);
  assert.equal(idCalendario(null), null);
});

test('clave: sólo con forma de API key de Google', () => {
  assert.equal(claveValida(CLAVE), true);
  assert.equal(claveValida('AIza123'), false);
  assert.equal(claveValida(null), false);
});

test('rango del mes en hora de Rosario, diciembre pasa al año siguiente', () => {
  assert.deepEqual(rangoDelMes(2026, 10), { desde: '2026-10-01T00:00:00-03:00', hasta: '2026-11-01T00:00:00-03:00' });
  assert.deepEqual(rangoDelMes(2026, 12).hasta, '2027-01-01T00:00:00-03:00');
});

test('la URL de eventos pide sólo título, lugar y fechas (nunca la descripción)', () => {
  const url = new URL(urlEventos(ID, CLAVE, rangoDelMes(2026, 10)));
  assert.equal(url.origin, 'https://www.googleapis.com');
  assert.equal(url.pathname, `/calendar/v3/calendars/${encodeURIComponent(ID)}/events`);
  assert.equal(url.searchParams.get('singleEvents'), 'true');
  assert.equal(url.searchParams.get('timeMin'), '2026-10-01T00:00:00-03:00');
  assert.doesNotMatch(url.searchParams.get('fields'), /description|attendees|creator/);
  assert.equal(urlEventos('malo', CLAVE, rangoDelMes(2026, 10)), null);
  assert.equal(urlEventos(ID, 'mala', rangoDelMes(2026, 10)), null);
});

test('evento con hora: día y hora de Rosario aunque Google lo mande en UTC', () => {
  const e = eventoDesdeGoogle({ id: '1', summary: ' U15 vs. Náutico ', location: 'Microestadio', description: 'Juan Pérez', start: { dateTime: '2026-10-25T01:30:00Z' } }, 'partido');
  // Sin fin, dura una hora (lo que pone Google por defecto).
  assert.deepEqual(e, { id: '1', tipo: 'partido', titulo: 'U15 vs. Náutico', lugar: 'Microestadio', dia: '2026-10-24', hasta: '2026-10-24', hora: '22:30', horaFin: '23:30', diaFin: '2026-10-24' });
  assert.equal('descripcion' in e || 'description' in e, false);
});

test('evento de todo el día y de varios días: el fin de Google es exclusivo', () => {
  const uno = eventoDesdeGoogle({ id: '2', summary: 'Rifa', start: { date: '2026-10-11' }, end: { date: '2026-10-12' } }, 'evento');
  assert.deepEqual([uno.dia, uno.hasta, uno.hora], ['2026-10-11', '2026-10-11', null]);
  const torneo = eventoDesdeGoogle({ id: '3', summary: 'Torneo', start: { date: '2026-10-30' }, end: { date: '2026-11-02' } }, 'partido');
  assert.deepEqual([torneo.dia, torneo.hasta], ['2026-10-30', '2026-11-01']);
});

test('sin título dice "Evento"; cancelado, sin fecha o de un tipo desconocido no entra', () => {
  assert.equal(eventoDesdeGoogle({ id: '4', start: { date: '2026-10-01' } }, 'charla').titulo, 'Evento');
  assert.equal(eventoDesdeGoogle({ id: '5', status: 'cancelled', start: { date: '2026-10-01' } }, 'charla'), null);
  assert.equal(eventoDesdeGoogle({ id: '6', start: {} }, 'charla'), null);
  assert.equal(eventoDesdeGoogle({ id: '7', start: { date: '2026-10-01' } }, 'fiesta'), null);
  assert.equal(eventoDesdeGoogle(null, 'charla'), null);
});

test('por día: los de todo el día primero, después por hora; uno de varios días en cada día', () => {
  const ev = [
    eventoDesdeGoogle({ id: 'a', summary: 'Tarde', start: { dateTime: '2026-10-24T18:00:00-03:00' } }, 'partido'),
    eventoDesdeGoogle({ id: 'b', summary: 'Mañana', start: { dateTime: '2026-10-24T10:30:00-03:00' } }, 'partido'),
    eventoDesdeGoogle({ id: 'c', summary: 'Torneo', start: { date: '2026-10-24' }, end: { date: '2026-10-26' } }, 'evento'),
  ];
  const porDia = eventosPorDia(ev);
  assert.deepEqual(porDia.get('2026-10-24').map((e) => e.titulo), ['Torneo', 'Mañana', 'Tarde']);
  assert.deepEqual(porDia.get('2026-10-25').map((e) => e.titulo), ['Torneo']);
  assert.equal(porDia.has('2026-10-26'), false);
});

test('un evento de todo el día eterno no llena más de un mes', () => {
  const largo = eventoDesdeGoogle({ id: 'x', start: { date: '2026-01-01' }, end: { date: '2026-12-31' } }, 'evento');
  assert.equal(eventosPorDia([largo]).size, 31);
});

test('próximos: desde hoy, en orden, un torneo de varios días cuenta una vez', () => {
  const ev = [
    eventoDesdeGoogle({ id: 'v', summary: 'Viejo', start: { date: '2026-10-01' } }, 'partido'),
    eventoDesdeGoogle({ id: 't', summary: 'Torneo', start: { date: '2026-10-20' }, end: { date: '2026-10-23' } }, 'partido'),
    eventoDesdeGoogle({ id: 'c', summary: 'Charla', start: { dateTime: '2026-10-22T19:00:00-03:00' } }, 'charla'),
  ];
  const r = proximosEventos(eventosPorDia(ev), '2026-10-21', 5);
  assert.deepEqual(r.map(({ fecha, evento }) => `${fecha} ${evento.titulo}`), ['2026-10-21 Torneo', '2026-10-22 Charla']);
});

test('semanas de lunes a domingo: octubre 2026 arranca jueves y tiene 5 semanas', () => {
  const s = semanasDelMes(2026, 10);
  assert.equal(s.length, 5);
  assert.deepEqual(s[0].map((c) => c.dia), [28, 29, 30, 1, 2, 3, 4]);
  assert.deepEqual(s[0].map((c) => c.delMes), [false, false, false, true, true, true, true]);
  assert.equal(s.at(-1).at(-1).fecha, '2026-11-01');
});

test('un mes que empieza en domingo ocupa 6 semanas; uno que empieza en lunes arranca el 1', () => {
  assert.equal(semanasDelMes(2026, 3).length, 6); // marzo 2026 arranca domingo
  assert.equal(semanasDelMes(2026, 6)[0][0].fecha, '2026-06-01'); // junio 2026 arranca lunes
});

test('mes vecino, hoy en Rosario y textos', () => {
  assert.deepEqual(mesVecino(2026, 12, 1), { anio: 2027, mes: 1 });
  assert.deepEqual(mesVecino(2026, 1, -1), { anio: 2025, mes: 12 });
  assert.equal(hoyEnRosario(new Date('2026-10-21T02:00:00Z')), '2026-10-20');
  assert.equal(tituloMes(2026, 10), 'Octubre 2026');
  assert.equal(fechaLarga('2026-10-24'), 'Sábado 24 de octubre');
});

// ---- Un solo calendario: el tipo lo da el color del evento ----

test('el color del evento decide el tipo; sin color (o con otro) queda el del calendario', () => {
  const con = (colorId) => eventoDesdeGoogle({ id: 'c', colorId, start: { date: '2026-10-24' } }, 'evento')?.tipo;
  assert.equal(con('11'), 'partido'); // Tomate
  assert.equal(con('5'), 'evento'); // Banana
  assert.equal(con('7'), 'charla'); // Pavo real
  assert.equal(con('10'), 'entrenamiento'); // Albahaca
  assert.equal(con(undefined), 'evento');
  assert.equal(con('3'), 'evento');
  for (const tipo of Object.values(TIPO_POR_COLOR)) assert.ok(TIPOS_AGENDA.includes(tipo));
  assert.match(new URL(urlEventos(ID, CLAVE, rangoDelMes(2026, 10))).searchParams.get('fields'), /colorId/);
});

// ---- Agregar a mi calendario ----

const partido = eventoDesdeGoogle({ id: 'p1', summary: 'U15, vs; Náutico', location: 'Microestadio', start: { dateTime: '2026-10-24T10:30:00-03:00' }, end: { dateTime: '2026-10-24T12:00:00-03:00' } }, 'partido');
const torneo = eventoDesdeGoogle({ id: 't1', summary: 'Torneo', start: { date: '2026-10-30' }, end: { date: '2026-11-02' } }, 'partido');

test('link a Google Calendar con el evento armado, en hora de Rosario', () => {
  const u = new URL(enlaceAgregarGoogle(partido));
  assert.equal(`${u.origin}${u.pathname}`, 'https://calendar.google.com/calendar/render');
  assert.equal(u.searchParams.get('action'), 'TEMPLATE');
  assert.equal(u.searchParams.get('text'), 'U15, vs; Náutico');
  assert.equal(u.searchParams.get('dates'), '20261024T103000/20261024T120000');
  assert.equal(u.searchParams.get('ctz'), 'America/Argentina/Buenos_Aires');
  assert.equal(u.searchParams.get('location'), 'Microestadio');
  // Todo el día: fin exclusivo, como lo pide Google.
  assert.equal(new URL(enlaceAgregarGoogle(torneo)).searchParams.get('dates'), '20261030/20261102');
});

test('archivo .ics para el iPhone: horas en UTC, texto escapado', () => {
  const ics = textoIcs(partido, new Date('2026-10-20T00:00:00Z'));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /\r\nDTSTART:20261024T133000Z\r\nDTEND:20261024T150000Z\r\n/);
  assert.ok(ics.includes('\r\nSUMMARY:U15\\, vs\\; Náutico\r\n'), 'coma y punto y coma escapados');
  assert.match(ics, /\r\nLOCATION:Microestadio\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  const todoElDia = textoIcs(torneo);
  assert.match(todoElDia, /DTSTART;VALUE=DATE:20261030\r\nDTEND;VALUE=DATE:20261102/);
  assert.doesNotMatch(todoElDia, /LOCATION/);
});

test('seguir el calendario entero: Google y webcal; con un ID inválido, nada', () => {
  const s = enlacesSuscripcion(ID);
  assert.equal(s.google, `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(ID)}`);
  assert.equal(s.ical, `webcal://calendar.google.com/calendar/ical/${encodeURIComponent(ID)}/public/basic.ics`);
  assert.equal(enlacesSuscripcion('roto'), null);
});
