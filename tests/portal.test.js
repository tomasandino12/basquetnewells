import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PORTAL, HOSTS_EMBEBIDOS, urlEmbedCalendario, enlaceFormulario, enlaceContacto, sponsorsValidos } from '../src/data/portal.js';

/**
 * Lo que sale de acá termina en un <iframe src> o en un <a href> de la página
 * pública. Si una URL pegada a mano en la configuración está mal, la tarjeta
 * tiene que caer a "Próximamente", nunca a un iframe o un link a cualquier lado.
 */

const ID = 'abc123def@group.calendar.google.com';

test('urlEmbedCalendario arma la URL de agenda con el ID codificado', () => {
  const u = new URL(urlEmbedCalendario(ID));
  assert.equal(u.origin, 'https://calendar.google.com');
  assert.equal(u.pathname, '/calendar/embed');
  assert.equal(u.searchParams.get('src'), ID);
  assert.equal(u.searchParams.get('mode'), 'AGENDA');
  assert.equal(u.searchParams.get('ctz'), 'America/Argentina/Buenos_Aires');
  assert.ok(urlEmbedCalendario(ID).includes('%40'), 'la @ del ID tiene que ir codificada');
});

test('urlEmbedCalendario también acepta la URL de embed que copia Google', () => {
  const pegada = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(ID)}&ctz=Europe%2FMadrid`;
  const u = new URL(urlEmbedCalendario(pegada));
  assert.equal(u.searchParams.get('src'), ID);
  assert.equal(u.searchParams.get('ctz'), 'America/Argentina/Buenos_Aires');
});

test('urlEmbedCalendario sin ID o con un ID raro devuelve null', () => {
  for (const malo of [null, undefined, '', '   ', 42, 'sin-arroba', 'a@b"><script>', 'javascript:alert(1)',
    'https://evil.com/calendar/embed?src=' + encodeURIComponent(ID)]) {
    assert.equal(urlEmbedCalendario(malo), null, String(malo));
  }
});

test('enlaceFormulario acepta forms.gle y docs.google.com/forms', () => {
  assert.equal(enlaceFormulario('https://forms.gle/AbC123'), 'https://forms.gle/AbC123');
  const largo = 'https://docs.google.com/forms/d/e/1FAIpQ/viewform';
  assert.equal(enlaceFormulario(largo), largo);
});

test('enlaceFormulario rechaza http, javascript y hosts no permitidos', () => {
  for (const malo of [null, '', 'http://forms.gle/AbC123', 'javascript:alert(1)', 'https://forms.gle.evil.com/x',
    'https://docs.google.com/document/d/1', 'https://evil.com/forms/x', '//forms.gle/x']) {
    assert.equal(enlaceFormulario(malo), null, String(malo));
  }
});

test('la configuración tiene los dos calendarios y lo que falta va en null', () => {
  assert.equal(PORTAL.calendarios.length, 2);
  for (const c of PORTAL.calendarios) {
    assert.ok(c.titulo);
    assert.ok(c.id === null || urlEmbedCalendario(c.id), `ID inválido en "${c.titulo}"`);
  }
  assert.ok(PORTAL.contacto === null || enlaceContacto(PORTAL.contacto), 'contacto inválido');
});

test('cada formulario de respaldo trae título, línea de ayuda y un enlace válido', () => {
  assert.ok(PORTAL.formularios.length >= 1);
  for (const f of PORTAL.formularios) {
    assert.ok(f.titulo && f.texto, 'falta título o línea de ayuda');
    assert.ok(enlaceFormulario(f.enlace), `enlace inválido en "${f.titulo}"`);
  }
});

test('enlaceContacto acepta WhatsApp y mail; rechaza el resto', () => {
  assert.equal(enlaceContacto('https://wa.me/5493410000000'), 'https://wa.me/5493410000000');
  assert.equal(enlaceContacto('mailto:coordinacion@club.com'), 'mailto:coordinacion@club.com');
  for (const malo of [null, '', 'http://wa.me/5493410000000', 'javascript:alert(1)', 'https://evil.com/wa.me/1', 'mailto:', 'mailto:a b@club.com', 'mailto:ab@clubXcom', 'mailto:a@b.com?cc=otro@x.com', 'tel:+5493410000000']) {
    assert.equal(enlaceContacto(malo), null, String(malo));
  }
});

test('cada URL de embed sale de un host declarado en HOSTS_EMBEBIDOS', () => {
  assert.ok(HOSTS_EMBEBIDOS.includes(new URL(urlEmbedCalendario(ID)).hostname));
});

test('clubId es el de Newell\'s de la semilla 0004, y es un uuid', () => {
  assert.match(PORTAL.clubId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  const semilla = readFileSync('supabase/migrations/0004_seed_piloto.sql', 'utf8');
  assert.ok(semilla.includes(`('${PORTAL.clubId}', 'Newell''s Old Boys')`), 'el clubId no coincide con la semilla de Newell\'s');
});

// ---- Logos de sponsors: un arreglo en este archivo y PNG en public/sponsors/ ----

test('sponsorsValidos acepta logos propios de public/sponsors y descarta el resto', () => {
  const buenos = [
    { nombre: 'A', logo: '/public/sponsors/a.png' },
    { nombre: 'B', logo: '/public/sponsors/b-2.svg', enlace: 'https://b.example/' },
    { nombre: 'C', logo: '/public/sponsors/c_3.jpeg' },
    { nombre: 'D', logo: '/public/sponsors/d.webp' },
  ];
  assert.deepEqual(sponsorsValidos(buenos), buenos);
  const malos = [
    { nombre: 'x', logo: 'https://cdn.example/x.png' }, { nombre: 'x', logo: '//cdn.example/x.png' },
    { nombre: 'x', logo: '/public/sponsors/../escudo.png' }, { nombre: 'x', logo: '/public/sponsors/x.html' },
    { nombre: 'x', logo: '/public/otra/x.png' }, { nombre: '   ', logo: '/public/sponsors/x.png' },
    { nombre: 'x', logo: '/public/sponsors/x.png', enlace: 'javascript:alert(1)' },
    { nombre: 'x', logo: '/public/sponsors/x.png', enlace: 'http://inseguro.example' },
    null, {}, { nombre: 7, logo: '/public/sponsors/x.png' },
  ];
  assert.deepEqual(sponsorsValidos(malos), []);
  assert.deepEqual(sponsorsValidos(undefined), []);
});

test('PORTAL.sponsors es una lista (hoy vacía) y cada logo cargado existe en public/sponsors', () => {
  assert.ok(Array.isArray(PORTAL.sponsors));
  for (const s of PORTAL.sponsors) {
    assert.equal(sponsorsValidos([s]).length, 1, `sponsor inválido: ${s.nombre}`);
    assert.ok(existsSync(s.logo.slice(1)), `falta el archivo ${s.logo}`);
  }
});
