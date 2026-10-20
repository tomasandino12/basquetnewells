import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  PORTAL, enlaceFormulario, enlaceContacto, sponsorsValidos, calendariosActivos, categoriasDelPortal, categoriasDelAnio,
  sedeValida, aliasValido, fotoValida,
} from '../src/data/portal.js';
import { TIPOS_AGENDA, idCalendario } from '../src/data/agenda.js';

/**
 * Lo que sale de acá termina en un <a href>, un <img src> o un pedido a Google
 * desde la página pública. Si algo pegado a mano en la configuración está mal,
 * esa parte de la página no se muestra: nunca un link a cualquier lado.
 */

const ID = 'abc123def@group.calendar.google.com';
const CLAVE = `AIza${'x'.repeat(35)}`;

test('calendariosActivos: sin clave, ninguno; con clave, sólo los de tipo conocido e ID válido', () => {
  const calendarios = [
    { tipo: 'partido', titulo: 'Partidos', id: ID },
    { tipo: 'evento', titulo: 'Eventos', id: null },
    { tipo: 'fiesta', titulo: 'Raro', id: ID },
    { tipo: 'charla', titulo: '', id: `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(ID)}` },
  ];
  assert.deepEqual(calendariosActivos({ clave: null, calendarios }), []);
  assert.deepEqual(calendariosActivos({ clave: CLAVE, calendarios }), [
    { tipo: 'partido', titulo: 'Partidos', id: ID },
    { tipo: 'charla', titulo: 'charla', id: ID },
  ]);
  assert.deepEqual(calendariosActivos(undefined), []);
});

test('la configuración de la agenda: tipos conocidos, IDs válidos o null', () => {
  for (const c of PORTAL.agenda.calendarios) {
    assert.ok(TIPOS_AGENDA.includes(c.tipo), `tipo desconocido: ${c.tipo}`);
    assert.ok(c.titulo);
    assert.ok(c.id === null || idCalendario(c.id), `ID inválido en "${c.titulo}"`);
  }
  assert.ok(PORTAL.contacto === null || enlaceContacto(PORTAL.contacto), 'contacto inválido');
  assert.ok(PORTAL.alias === null || aliasValido(PORTAL.alias), 'alias inválido');
  assert.ok(PORTAL.sede === null || sedeValida(PORTAL.sede), 'sede sin nombre');
});

test('categorías del portal: años de la temporada, nombre propio opcional, horario opcional', () => {
  const r = categoriasDelPortal([
    { grupo: 'ESCUELITA', rama: 'Mixto' },
    { grupo: 'U9', rama: 'Mixto', horario: ' Lun y Mié 18 h ' },
    { grupo: 'MAYORES', nombre: 'Primera', rama: 'Femenino' },
    { grupo: 'U10', rama: 'Mixto' },
    null,
  ], 2026);
  assert.deepEqual(r, [
    { nombre: 'Escuelita', rama: 'Mixto', anios: '2019 en adelante', horario: null },
    { nombre: 'U9', rama: 'Mixto', anios: '2017 y 2018', horario: 'Lun y Mié 18 h' },
    { nombre: 'Primera', rama: 'Femenino', anios: '2004 y antes', horario: null },
  ]);
  assert.deepEqual(categoriasDelPortal(PORTAL.categorias, 'no es año'), []);
});

test("Newell's no tiene Escuelita ni femeninos de inferiores: la única femenina es Primera", () => {
  const femeninas = PORTAL.categorias.filter((c) => c.rama === 'Femenino');
  assert.deepEqual(femeninas.map((c) => c.grupo), ['MAYORES']);
  assert.ok(!PORTAL.categorias.some((c) => c.grupo === 'ESCUELITA'));
});

test('categoriasDelAnio: la categoría (y su horario) de un año de nacimiento, con la regla de la lista', () => {
  const lista = PORTAL.categorias;
  const nombres = (anio) => categoriasDelAnio(lista, 2027, anio).map((c) => `${c.nombre} ${c.rama}`);
  assert.deepEqual(nombres(2014), ['U13 Mixto']);
  assert.deepEqual(nombres(2015), ['U13 Mixto']);
  assert.deepEqual(nombres(2012), ['U15 Masculino']);
  assert.deepEqual(nombres(1990), ['Primera Masculino', 'Primera Femenino']);
  assert.deepEqual(nombres(2021), [], 'más chico que la U9: no hay categoría');
  assert.equal(categoriasDelAnio(lista, 2027, 2014)[0].anios, '2014 y 2015');
  assert.match(categoriasDelAnio(lista, 2027, 2014)[0].horario, /Lun y Vie/);
  assert.deepEqual(categoriasDelAnio(lista, 2027, 'x'), []);
  assert.deepEqual(categoriasDelAnio(null, 2027, 2014), []);
});

test('hay Primera masculino y Primera femenino', () => {
  const primeras = PORTAL.categorias.filter((c) => c.grupo === 'MAYORES').map((c) => `${c.nombre} ${c.rama}`);
  assert.deepEqual(primeras, ['Primera Masculino', 'Primera Femenino']);
});

test('cada categoría configurada es un grupo que existe', () => {
  assert.equal(categoriasDelPortal(PORTAL.categorias, PORTAL.temporada).length, PORTAL.categorias.length);
});

test('sede: con nombre; el mapa sólo si es de Google Maps', () => {
  assert.equal(sedeValida(null), null);
  assert.equal(sedeValida({ nombre: '  ' }), null);
  assert.deepEqual(sedeValida({ nombre: 'Microestadio', direccion: 'Parque', mapa: 'https://maps.app.goo.gl/abc' }),
    { nombre: 'Microestadio', direccion: 'Parque', mapa: 'https://maps.app.goo.gl/abc' });
  assert.equal(sedeValida({ nombre: 'X', mapa: 'https://evil.com/maps' }).mapa, null);
  assert.equal(sedeValida({ nombre: 'X', mapa: 'javascript:alert(1)' }).mapa, null);
});

test('alias: de 6 a 20 letras, números, puntos o guiones', () => {
  assert.deepEqual(aliasValido({ alias: ' NOB.BASQUET ', titular: 'Club' }), { alias: 'NOB.BASQUET', titular: 'Club' });
  for (const malo of [null, {}, { alias: 'corto' }, { alias: 'a'.repeat(21) }, { alias: 'con espacio' }, { alias: 'x<y>zzzz' }]) {
    assert.equal(aliasValido(malo), null, JSON.stringify(malo));
  }
});

test('foto: sólo un archivo propio de public/portal y con texto alternativo', () => {
  assert.deepEqual(fotoValida({ src: '/public/portal/club.jpg', alt: 'El microestadio' }), { src: '/public/portal/club.jpg', alt: 'El microestadio', epigrafe: null });
  for (const mala of [null, { src: '/public/portal/club.jpg' }, { src: 'https://cdn.x/club.jpg', alt: 'x' },
    { src: '/public/portal/../escudo.png', alt: 'x' }, { src: '/public/portal/club.png', alt: 'x' }]) {
    assert.equal(fotoValida(mala), null, JSON.stringify(mala));
  }
  assert.ok(PORTAL.foto === null || (fotoValida(PORTAL.foto) && existsSync(PORTAL.foto.src.slice(1))), 'foto inválida o que no existe');
});

test('el respaldo de formularios no manda al formulario viejo de 2026', () => {
  for (const f of PORTAL.formularios) {
    assert.ok(f.titulo && f.texto, 'falta título o línea de ayuda');
    assert.ok(enlaceFormulario(f.enlace), `enlace inválido en "${f.titulo}"`);
    assert.doesNotMatch(f.enlace, /1FAIpQLSfXI11Sruothw4K67u6deMbRgfK0uZO00sfE-DBgsqam3peBQ/);
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

test('enlaceContacto acepta WhatsApp y mail; rechaza el resto', () => {
  assert.equal(enlaceContacto('https://wa.me/5493410000000'), 'https://wa.me/5493410000000');
  assert.equal(enlaceContacto('mailto:coordinacion@club.com'), 'mailto:coordinacion@club.com');
  for (const malo of [null, '', 'http://wa.me/5493410000000', 'javascript:alert(1)', 'https://evil.com/wa.me/1', 'mailto:', 'mailto:a b@club.com', 'mailto:ab@clubXcom', 'mailto:a@b.com?cc=otro@x.com', 'tel:+5493410000000']) {
    assert.equal(enlaceContacto(malo), null, String(malo));
  }
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
