import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  htmlFormularios, htmlContacto, htmlAvisoRespaldo, htmlJugar, htmlColaboradores, htmlLogos, htmlInscripcion,
  htmlComprobante, htmlAtajos, htmlCalendario, htmlCategorias, htmlSede, htmlFoto, diaInicial,
} from '../src/ui/portal.js';
import { eventoDesdeGoogle, eventosPorDia } from '../src/data/agenda.js';

/**
 * portal.html es HTML escrito a mano y no hay navegador en los tests: se lee
 * como texto, como en landing.test.js. Se atan las promesas del diseño "D"
 * (plan 2026-10-20-portal-rediseno) que se rompen sin que nada avise.
 */
const pagina = readFileSync('public/portal.html', 'utf8');
const portal = readFileSync('src/ui/portal.js', 'utf8');
const seccion = (id) => pagina.match(new RegExp(`<section [^>]*id="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';

test('arriba de todo, las dos tarjetas: inscribir y comprobante; después el resto, en orden', () => {
  const orden = ['acciones', 'jugar', 'calendario', 'categorias', 'formularios', 'club', 'sponsors', 'dudas', 'semillero'];
  const posiciones = orden.map((id) => pagina.search(new RegExp(`<section [^>]*id="${id}"`)));
  assert.ok(posiciones.every((p) => p > 0), `faltan secciones: ${posiciones}`);
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones, 'las secciones están desordenadas');
  assert.match(seccion('acciones'), /id="portal-inscripcion"[\s\S]*id="portal-comprobante"/);
});

test('las secciones que dependen de datos arrancan ocultas: nada vacío a la vista', () => {
  for (const id of ['jugar', 'calendario', 'categorias', 'formularios', 'club', 'sponsors', 'dudas']) {
    assert.match(seccion(id).split('>')[0], /\bhidden\b/, `#${id} tiene que arrancar oculta`);
  }
  assert.doesNotMatch(seccion('acciones').split('>')[0], /\bhidden\b/, 'las dos tarjetas se ven siempre');
});

test('ni la página ni su código dicen "Próximamente"', () => {
  assert.doesNotMatch(pagina, /Próximamente/i);
  assert.doesNotMatch(portal, /Próximamente/i);
});

test('el botón a Semillero lleva a /app e incluye cómo instalarla', () => {
  const sec = seccion('semillero');
  assert.match(sec, /<a class="btn sec" href="\/app">/);
  assert.match(sec, /Agregar a inicio/);
  assert.match(sec, /Instalar/);
});

const importMapDe = (html) => html.replace(/\r\n/g, '\n').match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];

test('portal.html no tiene más script inline que el import map ni enlaza el manifest', () => {
  const inline = [...pagina.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter((m) => !/type="importmap"/.test(m[1]));
  assert.deepEqual(inline.map((m) => m[0]), []);
  assert.doesNotMatch(pagina, /rel="manifest"/);
  assert.doesNotMatch(pagina, /serviceWorker/);
  assert.doesNotMatch(pagina, /<iframe/);
});

test('el import map del portal es idéntico, letra por letra, al de la app: el mismo hash de la CSP', () => {
  const app = readFileSync('public/index.html', 'utf8');
  assert.ok(importMapDe(pagina), 'el portal no tiene import map');
  assert.equal(importMapDe(pagina), importMapDe(app));
  assert.match(pagina, /<script src="\/public\/config\.js"><\/script>/);
  assert.ok(pagina.indexOf('importmap') < pagina.indexOf('type="module"'), 'el import map tiene que ir antes de los módulos');
});

test('el portal es mobile', () => {
  assert.match(pagina, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
});

test('portal.js sólo pide datos por el repositorio: ni repos/, ni cliente, ni Supabase, ni fetch', () => {
  for (const archivo of ['src/ui/portal.js', 'src/ui/portalArranque.js', 'src/ui/portalEntrada.js']) {
    const codigo = readFileSync(archivo, 'utf8');
    const imports = [...codigo.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(imports.filter((i) => /repos\/|cliente|supabase/.test(i)), [], archivo);
    assert.doesNotMatch(codigo, /\bfetch\s*\(/, archivo);
  }
  assert.match(portal, /from '\.\.\/data\/repositorio\.js'/);
  assert.doesNotMatch(readFileSync('src/ui/portalEntrada.js', 'utf8'), /repositorio/);
});

test('el portal no consulta nada si la URL es la vuelta de un login: esos links van a /app', () => {
  // El cliente de Supabase canjearía el ?code= o el #access_token en esta página.
  assert.match(portal, /destinoDeAuth\(window\.location\.search, window\.location\.hash\)/);
  const guarda = portal.indexOf('destinoDeAuth(');
  assert.ok(guarda > 0 && guarda < portal.indexOf('resolverFormularios('), 'la guarda tiene que ir antes de leer la base');
  assert.ok(guarda < portal.lastIndexOf('iniciarCalendario(calendarios)'), 'y antes de pedir el calendario');
});

// ---- Las dos tarjetas de arriba (destinos inscripcion y comprobante, 0062) ----

const FORM = (texto, enlace = 'https://forms.gle/Abc1') => ({ titulo: 'x', texto, enlace });

test('inscripción abierta: la línea de la coordinación, escapada, y un botón a Google en otra pestaña', () => {
  const out = htmlInscripcion(FORM('Tené a mano el DNI <b>')).toString();
  assert.match(out, /Inscripción abierta/);
  assert.match(out, /Tené a mano el DNI &lt;b&gt;/);
  assert.match(out, /<a class="btn" href="https:\/\/forms\.gle\/Abc1" target="_blank" rel="noopener">Abrir la inscripción/);
  assert.doesNotMatch(out, /<b>/);
});

test('inscripción cerrada: dice que abre con la temporada y no tiene ningún botón a Google', () => {
  for (const f of [null, FORM('x', 'https://evil.com/forms/x')]) {
    const out = htmlInscripcion(f, { temporada: 2027 }).toString();
    assert.match(out, /Abre con la temporada/);
    assert.match(out, /La inscripción 2027 todavía no abrió/);
    assert.doesNotMatch(out, /<a /);
  }
  const conJugar = htmlInscripcion(null, { hayConsultas: true }).toString();
  assert.match(conJugar, /<a class="btn sec" href="#jugar">/);
  assert.match(conJugar, /La inscripción todavía no abrió/);
});

test('comprobante: abierto con botón; con alias, el alias escapado y un botón para copiarlo', () => {
  const out = htmlComprobante(FORM('Subí la foto'), { alias: 'NOB.BASQUET', titular: 'Club <x>' }).toString();
  assert.match(out, /<a class="btn portal-btn-claro" href="https:\/\/forms\.gle\/Abc1"/);
  assert.match(out, /<b>NOB\.BASQUET<\/b>/);
  assert.match(out, /data-copiar="NOB\.BASQUET"/);
  assert.match(out, /Club &lt;x&gt;/);
  const cerrado = htmlComprobante(null, { alias: 'mal alias' }).toString();
  assert.doesNotMatch(cerrado, /<a |data-copiar/);
  assert.match(cerrado, /acá vas a subir la foto del comprobante/);
});

test('atajos: con menos de dos no hay fila; el de ayuda abre afuera', () => {
  assert.equal(htmlAtajos([{ clave: 'jugar', texto: 'Quiero jugar', href: '#jugar' }]).toString(), '');
  const out = htmlAtajos([
    { clave: 'jugar', texto: 'Quiero jugar', href: '#jugar' },
    { clave: 'ayuda', texto: 'Ayuda', href: 'https://wa.me/5493410000000', externo: true },
  ]).toString();
  assert.match(out, /<a href="#jugar"><i><svg/);
  assert.match(out, /<a href="https:\/\/wa\.me\/5493410000000" target="_blank" rel="noopener">/);
});

// ---- Calendario propio ----

const CALS = [{ tipo: 'partido', titulo: 'Partidos', id: 'p@x.y' }, { tipo: 'evento', titulo: 'Eventos', id: 'e@x.y' }];
const ev = (id, tipo, extra) => eventoDesdeGoogle({ id, ...extra }, tipo);
const porDia = eventosPorDia([
  ev('1', 'partido', { summary: 'U15 vs. <Náutico>', location: 'Microestadio', start: { dateTime: '2026-10-24T10:30:00-03:00' } }),
  ev('2', 'evento', { summary: 'Hamburgueseada', start: { date: '2026-10-24' } }),
  ev('3', 'partido', { summary: 'U17 visitante', start: { dateTime: '2026-10-31T16:00:00-03:00' } }),
]);
const estado = (extra) => ({ anio: 2026, mes: 10, elegido: '2026-10-24', hoy: '2026-10-20', porDia, fallidos: 0, cargando: false, ...extra });

test('calendario: grilla del mes con un puntito por evento y el día elegido marcado', () => {
  const out = htmlCalendario(estado(), CALS).toString();
  assert.match(out, /Octubre 2026/);
  assert.equal((out.match(/data-dia="/g) ?? []).length, 35);
  const dia24 = out.match(/<button [^>]*data-dia="2026-10-24"[\s\S]*?<\/button>/)[0];
  assert.match(dia24, /aria-pressed="true"/);
  assert.match(dia24, /aria-label="Sábado 24 de octubre, 2 eventos"/);
  assert.equal((dia24.match(/<i class="tipo-/g) ?? []).length, 2);
  assert.match(out, /class="portal-dia hoy" data-dia="2026-10-20"/);
  assert.match(out, /<li class="tipo-partido">Partidos<\/li><li class="tipo-evento">Eventos<\/li>/);
});

test('calendario: lo del día elegido, escapado, los de todo el día primero', () => {
  const out = htmlCalendario(estado(), CALS).toString();
  const dia = out.slice(out.indexOf('portal-cal-dia'));
  assert.ok(dia.indexOf('Hamburgueseada') < dia.indexOf('U15'), 'todo el día va primero');
  assert.match(dia, /Partidos · 10:30/);
  assert.match(dia, /Eventos · Todo el día/);
  assert.match(dia, /U15 vs\. &lt;Náutico&gt;/);
  assert.doesNotMatch(out, /<Náutico>/);
});

test('calendario: un día sin nada muestra lo que viene; si falló un calendario, lo avisa', () => {
  const out = htmlCalendario(estado({ elegido: '2026-10-21', fallidos: 1 }), CALS).toString();
  assert.match(out, /No hay nada cargado para este día/);
  assert.match(out, /Lo que viene/);
  assert.match(out, /U17 visitante/);
  assert.match(out, /No pudimos traer una parte del calendario/);
});

test('día inicial: hoy si es del mes; si no, el primero con algo, o el 1', () => {
  assert.equal(diaInicial(2026, 10, '2026-10-20', porDia), '2026-10-20');
  assert.equal(diaInicial(2026, 10, '2026-09-30', porDia), '2026-10-24');
  assert.equal(diaInicial(2026, 11, '2026-10-20', porDia), '2026-11-01');
});

// ---- Categorías, sede, foto, contacto: sin datos, nada ----

test('sin datos, cada parte no devuelve nada (la sección queda oculta)', () => {
  assert.equal(htmlCategorias([]).toString(), '');
  assert.equal(htmlSede(null).toString(), '');
  assert.equal(htmlFoto(null).toString(), '');
  assert.equal(htmlContacto(null).toString(), '');
  assert.equal(htmlContacto('javascript:alert(1)').toString(), '');
  assert.equal(htmlColaboradores(null).toString(), '');
  assert.equal(htmlFormularios([]).toString(), '');
});

test('categorías: nombre, rama, años y horario, escapados', () => {
  const out = htmlCategorias([{ nombre: 'U9', rama: 'Mixto', anios: '2017 y 2018', horario: 'Lun <18 h>' }]).toString();
  assert.match(out, /<b>U9<\/b><span>Mixto<\/span>/);
  assert.match(out, /2017 y 2018/);
  assert.match(out, /Lun &lt;18 h&gt;/);
});

test('sede con "Cómo llegar" sólo si el mapa es de Google Maps; foto con su alt', () => {
  assert.match(htmlSede({ nombre: 'Microestadio', mapa: 'https://maps.app.goo.gl/abc' }).toString(), /href="https:\/\/maps\.app\.goo\.gl\/abc"[^>]*>Cómo llegar/);
  assert.doesNotMatch(htmlSede({ nombre: 'Microestadio', mapa: 'https://evil.com' }).toString(), /<a /);
  assert.match(htmlFoto({ src: '/public/portal/club.jpg', alt: 'La cancha' }).toString(), /<img src="\/public\/portal\/club\.jpg" alt="La cancha" loading="lazy">/);
});

test('el contacto con WhatsApp o mail es un enlace', () => {
  assert.match(htmlContacto('https://wa.me/5493410000000').toString(), /<a [^>]*href="https:\/\/wa\.me\/5493410000000"/);
  assert.match(htmlContacto('mailto:coord@club.com').toString(), /<a [^>]*href="mailto:coord@club\.com"/);
});

// ---- Otros formularios ----

test('cada formulario muestra su línea de ayuda y abre en otra pestaña; uno con enlace inválido no aparece', () => {
  const out = htmlFormularios([
    { titulo: 'Rifa <b>', texto: 'Subí el comprobante <i>acá</i>', enlace: 'https://forms.gle/AbC123' },
    { titulo: 'Malo', texto: 'y', enlace: 'https://evil.com/forms/x' },
  ]).toString();
  assert.match(out, /Subí el comprobante &lt;i&gt;acá&lt;\/i&gt;/);
  assert.match(out, /<a [^>]*href="https:\/\/forms\.gle\/AbC123" target="_blank" rel="noopener"/);
  assert.doesNotMatch(out, /<b>|<i>|Malo|evil/);
  assert.match(htmlAvisoRespaldo().toString(), /no pudimos actualizar/i);
});

// ---- "Quiero jugar en Newell's" (destino consultas, 0061) ----

test('htmlJugar muestra la línea de ayuda de la coordinación, tres pasos y el botón al formulario', () => {
  const out = htmlJugar({ titulo: 'x', texto: 'Para chicos de 8 a 12 <años>.', enlace: 'https://forms.gle/Jug1' }).toString();
  assert.match(out, /<div class="t">Quiero jugar en Newell's<\/div>/);
  assert.match(out, /Para chicos de 8 a 12 &lt;años&gt;\./);
  assert.equal((out.match(/<li>/g) ?? []).length, 3, 'paso a paso: tres pasos');
  assert.match(out, /<a class="btn" href="https:\/\/forms\.gle\/Jug1" target="_blank" rel="noopener">/);
});

test('htmlJugar no muestra nada si no hay formulario o su enlace no es de Google Forms', () => {
  assert.equal(htmlJugar(null).toString(), '');
  assert.equal(htmlJugar({ texto: 'x', enlace: 'https://evil.com/forms/x' }).toString(), '');
});

test('el portal aparta de la lista los formularios con lugar propio: no aparecen dos veces', () => {
  assert.match(portal, /const \{ inscripcion, comprobante, consultas, colaboradores, comunes \} = separarFormularios\(formularios\);/);
  assert.match(portal, /htmlInscripcion\(inscripcion,/);
  assert.match(portal, /htmlComprobante\(comprobante,/);
  assert.match(portal, /htmlJugar\(consultas\)/);
  assert.match(portal, /htmlColaboradores\(colaboradores\)/);
  assert.match(portal, /htmlFormularios\(comunes\)/);
});

// ---- "Sumate como sponsor o colaborador" (destino colaboradores, 0061) ----

test('htmlColaboradores: la línea de la coordinación, tres pasos y el botón al formulario', () => {
  const out = htmlColaboradores({ titulo: 'x', texto: 'Si tenés un comercio <o empresa>.', enlace: 'https://forms.gle/Col1' }).toString();
  assert.match(out, /Si tenés un comercio &lt;o empresa&gt;\./);
  assert.equal((out.match(/<li>/g) ?? []).length, 3, 'paso a paso: tres pasos');
  assert.match(out, /<a class="btn" href="https:\/\/forms\.gle\/Col1" target="_blank" rel="noopener">Quiero colaborar<\/a>/);
});

test('htmlLogos: sin sponsors no muestra nada; con sponsors, una imagen con su nombre, escapado', () => {
  assert.equal(htmlLogos([]).toString(), '');
  const out = htmlLogos([
    { nombre: 'Ferretería <Sur>', logo: '/public/sponsors/ferreteria-sur.png', enlace: 'https://ferreteriasur.example/' },
    { nombre: 'Panadería', logo: '/public/sponsors/panaderia.svg' },
    { nombre: 'Ajeno', logo: 'https://cdn.evil.com/x.png' },
  ]).toString();
  assert.match(out, /<img src="\/public\/sponsors\/ferreteria-sur\.png" alt="Ferretería &lt;Sur&gt;" loading="lazy">/);
  assert.match(out, /<a href="https:\/\/ferreteriasur\.example\/" target="_blank" rel="noopener"><img /);
  assert.match(out, /<li><img src="\/public\/sponsors\/panaderia\.svg" alt="Panadería" loading="lazy"><\/li>/);
  assert.equal((out.match(/<img /g) ?? []).length, 2);
});
