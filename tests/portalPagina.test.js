import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { htmlFormularios, htmlCalendarios, htmlContacto, htmlSinFormularios, htmlAvisoRespaldo, htmlJugar, htmlColaboradores, htmlLogos } from '../src/ui/portal.js';

/**
 * portal.html es HTML escrito a mano y no hay navegador en los tests: se lee
 * como texto, como en landing.test.js. Se atan las promesas de la spec v2 que
 * se rompen sin que nada avise.
 */
const pagina = readFileSync('public/portal.html', 'utf8');
const ids = [...pagina.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]);

test('el portal trae las secciones en orden', () => {
  const orden = ['que-hacer', 'formularios', 'calendario', 'informacion', 'sponsors', 'semillero', 'dudas'];
  const posiciones = orden.map((id) => pagina.indexOf(`<section class="portal-sec" id="${id}"`));
  assert.ok(posiciones.every((p) => p > 0), `faltan secciones: ${posiciones}`);
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones, 'las secciones están desordenadas');
});

test('los 4 pasos de "¿Qué tengo que hacer?" enlazan a anclas que existen', () => {
  const pasos = pagina.match(/<ol class="portal-pasos">([\s\S]*?)<\/ol>/)?.[1] ?? '';
  const items = [...pasos.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(items.length, 4);
  for (const item of items) {
    const ancla = item.match(/href="#([\w-]+)"/)?.[1];
    assert.ok(ancla && ids.includes(ancla), `paso sin ancla válida: ${item.slice(0, 60)}`);
  }
});

test('el botón a Semillero lleva a /app e incluye cómo instalarla', () => {
  const sec = pagina.match(/<section class="portal-sec" id="semillero"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(sec, /<a class="btn" href="\/app">/);
  assert.match(sec, /Agregar a inicio/);
  assert.match(sec, /Instalar/);
});

const importMapDe = (html) => html.replace(/\r\n/g, '\n').match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];

test('portal.html no tiene más script inline que el import map ni enlaza el manifest', () => {
  const inline = [...pagina.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter((m) => !/type="importmap"/.test(m[1]));
  assert.deepEqual(inline.map((m) => m[0]), []);
  assert.doesNotMatch(pagina, /rel="manifest"/);
  assert.doesNotMatch(pagina, /serviceWorker/);
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
  const portal = readFileSync('src/ui/portal.js', 'utf8');
  assert.match(portal, /from '\.\.\/data\/repositorio\.js'/);
  assert.doesNotMatch(readFileSync('src/ui/portalEntrada.js', 'utf8'), /repositorio/);
});

test('el portal no consulta nada si la URL es la vuelta de un login: esos links van a /app', () => {
  // El cliente de Supabase canjearía el ?code= o el #access_token en esta página.
  const portal = readFileSync('src/ui/portal.js', 'utf8');
  assert.match(portal, /destinoDeAuth\(window\.location\.search, window\.location\.hash\)/);
  const guarda = portal.indexOf('destinoDeAuth(');
  assert.ok(guarda > 0 && guarda < portal.indexOf('resolverFormularios('), 'la guarda tiene que ir antes de leer la base');
});

test('con la lista vacía el portal dice que no hay formularios abiertos; con la base caída, avisa que es una copia', () => {
  assert.match(htmlSinFormularios().toString(), /no hay formularios abiertos/i);
  assert.match(htmlSinFormularios().toString(), /coordinador/i);
  assert.doesNotMatch(htmlSinFormularios().toString(), /<a /);
  assert.match(htmlAvisoRespaldo().toString(), /no pudimos actualizar/i);
});

test('cada formulario muestra su línea de ayuda y abre en otra pestaña con rel=noopener', () => {
  const out = htmlFormularios([
    { titulo: 'Rifa <b>', texto: 'Subí el comprobante <i>acá</i>', enlace: 'https://forms.gle/AbC123' },
  ]).toString();
  assert.match(out, /Subí el comprobante &lt;i&gt;acá&lt;\/i&gt;/);
  assert.match(out, /<a [^>]*href="https:\/\/forms\.gle\/AbC123"/);
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener"/);
  assert.doesNotMatch(out, /<b>|<i>/);
});

test('un formulario con enlace inválido o sin lista dice Próximamente y no tiene <a>', () => {
  const malo = htmlFormularios([{ titulo: 'X', texto: 'y', enlace: 'https://evil.com/forms/x' }]).toString();
  assert.match(malo, /Próximamente/);
  assert.doesNotMatch(malo, /<a /);
  assert.match(htmlFormularios([]).toString(), /Próximamente/);
});

test('sin ID cada calendario dice Próximamente y no hay iframe', () => {
  const out = htmlCalendarios([{ titulo: 'Partidos', id: null }, { titulo: 'Eventos', id: 'roto' }]).toString();
  assert.equal(out.match(/Próximamente/g)?.length, 2);
  assert.doesNotMatch(out, /<iframe/);
});

test('con ID el calendario es un iframe perezoso, con título y en sandbox sin navegar la página', () => {
  const out = htmlCalendarios([{ titulo: 'Partidos <b>', id: 'abc@group.calendar.google.com' }]).toString();
  const iframe = out.match(/<iframe[^>]*>/)?.[0] ?? '';
  assert.match(iframe, /src="https:\/\/calendar\.google\.com\/calendar\/embed\?/);
  assert.match(iframe, /loading="lazy"/);
  assert.match(iframe, /title="Calendario: Partidos &lt;b&gt;"/);
  assert.match(iframe, /sandbox="[^"]*allow-scripts/);
  assert.doesNotMatch(iframe, /allow-top-navigation/);
  assert.doesNotMatch(out, /<b>/);
});

test('el contacto sin configurar dice Próximamente; con WhatsApp o mail es un enlace', () => {
  assert.match(htmlContacto(null).toString(), /Próximamente/);
  assert.match(htmlContacto('javascript:alert(1)').toString(), /Próximamente/);
  assert.match(htmlContacto('https://wa.me/5493410000000').toString(), /<a [^>]*href="https:\/\/wa\.me\/5493410000000"/);
  assert.match(htmlContacto('mailto:coord@club.com').toString(), /<a [^>]*href="mailto:coord@club\.com"/);
});

// ---- "Quiero jugar en Newell's": el acceso destacado (destino consultas, 0061) ----

test('el acceso "Quiero jugar" va arriba de todo, antes de los pasos, y arranca oculto', () => {
  const jugar = pagina.indexOf('<section class="portal-sec portal-jugar" id="jugar"');
  assert.ok(jugar > 0, 'falta la sección jugar');
  assert.ok(jugar > pagina.indexOf('class="hero"'), 'va después de la presentación');
  assert.ok(jugar < pagina.indexOf('id="que-hacer"'), 'y antes de los pasos');
  assert.match(pagina.slice(jugar, jugar + 200), /\bhidden\b/, 'arranca oculta: sin formulario no hay nada que mostrar');
  assert.match(pagina, /id="portal-jugar"/);
});

test('htmlJugar muestra la línea de ayuda de la coordinación, tres pasos y el botón al formulario', () => {
  const out = htmlJugar({ titulo: 'x', texto: 'Para chicos de 8 a 12 <años>.', enlace: 'https://forms.gle/Jug1' }).toString();
  assert.match(out, /<div class="t">Quiero jugar en Newell's<\/div>/);
  assert.match(out, /Para chicos de 8 a 12 &lt;años&gt;\./);
  assert.equal((out.match(/<li>/g) ?? []).length, 3, 'paso a paso: tres pasos');
  assert.match(out, /<a class="btn" href="https:\/\/forms\.gle\/Jug1" target="_blank" rel="noopener">/);
  assert.doesNotMatch(out, /<años>/);
});

test('htmlJugar no muestra nada si no hay formulario o su enlace no es de Google Forms', () => {
  assert.equal(htmlJugar(null).toString(), '');
  assert.equal(htmlJugar(undefined).toString(), '');
  assert.equal(htmlJugar({ texto: 'x', enlace: 'https://evil.com/forms/x' }).toString(), '');
});

test('con otros destinos presentes, la lista dice "otros" y no promete que no hay formularios', () => {
  assert.match(htmlSinFormularios({ hayOtros: true }).toString(), /no hay otros formularios abiertos/i);
  assert.match(htmlSinFormularios().toString(), /no hay formularios abiertos/i);
});

test('el portal aparta el formulario de consultas de la lista: no aparece dos veces', () => {
  const portal = readFileSync('src/ui/portal.js', 'utf8');
  assert.match(portal, /separarFormularios\(formularios\)/);
  assert.match(portal, /htmlJugar\(consultas\)/);
  assert.match(portal, /\$\('jugar'\)\.hidden = !/);
});

// ---- "Sumate como sponsor o colaborador" (destino colaboradores, 0061) ----

test('la sección de sponsors tiene su texto y su franja de logos, que arranca oculta', () => {
  const sec = pagina.match(/<section class="portal-sec" id="sponsors"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(sec, /Sumate como sponsor o colaborador/);
  assert.match(sec, /id="portal-colaboradores"/);
  assert.match(sec, /<div class="portal-logos" id="portal-logos" hidden>/);
});

test('htmlColaboradores: la línea de la coordinación, tres pasos y el botón al formulario', () => {
  const out = htmlColaboradores({ titulo: 'x', texto: 'Si tenés un comercio <o empresa>.', enlace: 'https://forms.gle/Col1' }).toString();
  assert.match(out, /Si tenés un comercio &lt;o empresa&gt;\./);
  assert.equal((out.match(/<li>/g) ?? []).length, 3, 'paso a paso: tres pasos');
  assert.match(out, /<a class="btn" href="https:\/\/forms\.gle\/Col1" target="_blank" rel="noopener">Quiero colaborar<\/a>/);
  assert.doesNotMatch(out, /<o empresa>/);
});

test('htmlColaboradores sin formulario o con un enlace que no es de Google Forms dice Próximamente y no tiene <a>', () => {
  for (const f of [null, undefined, { texto: 'x', enlace: 'https://evil.com/forms/x' }]) {
    const out = htmlColaboradores(f).toString();
    assert.match(out, /Próximamente/);
    assert.doesNotMatch(out, /<a /);
  }
});

test('htmlLogos: sin sponsors no muestra nada; con sponsors, una imagen con su nombre, escapado', () => {
  assert.equal(htmlLogos([]).toString(), '');
  assert.equal(htmlLogos(undefined).toString(), '');
  const out = htmlLogos([
    { nombre: 'Ferretería <Sur>', logo: '/public/sponsors/ferreteria-sur.png', enlace: 'https://ferreteriasur.example/' },
    { nombre: 'Panadería', logo: '/public/sponsors/panaderia.svg' },
  ]).toString();
  assert.match(out, /<img src="\/public\/sponsors\/ferreteria-sur\.png" alt="Ferretería &lt;Sur&gt;" loading="lazy">/);
  assert.match(out, /<a href="https:\/\/ferreteriasur\.example\/" target="_blank" rel="noopener"><img /);
  assert.match(out, /<li><img src="\/public\/sponsors\/panaderia\.svg" alt="Panadería" loading="lazy"><\/li>/);
  assert.doesNotMatch(out, /<Sur>/);
});

test('htmlLogos descarta lo que no es un logo propio: otro sitio, rutas raras, sin nombre', () => {
  const out = htmlLogos([
    { nombre: 'Ajeno', logo: 'https://cdn.evil.com/x.png' },
    { nombre: 'Subida', logo: '/public/sponsors/../escudo.png' },
    { nombre: '', logo: '/public/sponsors/sin-nombre.png' },
    { nombre: 'Script', logo: '/public/sponsors/x.html' },
    { nombre: 'Bueno', logo: '/public/sponsors/bueno.webp' },
  ]).toString();
  assert.equal((out.match(/<img /g) ?? []).length, 1);
  assert.match(out, /alt="Bueno"/);
});

test('el portal aparta también el formulario de colaboradores de la lista y muestra los logos sólo si hay', () => {
  const portal = readFileSync('src/ui/portal.js', 'utf8');
  assert.match(portal, /const \{ consultas, colaboradores, comunes \} = separarFormularios\(formularios\);/);
  assert.match(portal, /htmlColaboradores\(colaboradores\)/);
  assert.match(portal, /\$\('portal-logos'\)\.hidden = !/);
  assert.doesNotMatch(portal, /formularios\.filter\(\(f\) => f !== consultas\)/);
});
