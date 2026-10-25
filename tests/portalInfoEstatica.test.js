import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORTAL, categoriasDelPortal, turnosDeHorario } from '../src/data/portal.js';

/**
 * El HTML estático de portal.html (categorías y horarios, sede, cómo sumarte,
 * preguntas) existe para que Google lo vea sin ejecutar JS; los mismos datos
 * se cargan dinámicamente desde src/data/portal.js. Como se mantiene a mano,
 * este test es lo que avisa cuando uno cambia y el otro no. También cuida el
 * título, la descripción, el h1 y el JSON-LD de la home.
 */
const pagina = readFileSync('public/portal.html', 'utf8');
const sinEntidades = (t) => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const seccion = (id) => pagina.match(new RegExp(`<section [^>]*id="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';
const textoDe = (html) => sinEntidades(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
const TARJETA = '<li class="portal-info-cat">';

test('título (≤ 60) y descripción (150 a 155) de la home, repetidos en Open Graph y Twitter', () => {
  const titulo = sinEntidades(pagina.match(/<title>([^<]*)<\/title>/)[1]);
  assert.ok(titulo.length <= 60, `el título mide ${titulo.length}`);
  assert.match(titulo, /^Básquet de Newell's en Rosario/);
  const descripcion = pagina.match(/<meta name="description" content="([^"]*)">/)[1];
  assert.ok(descripcion.length >= 150 && descripcion.length <= 155, `la descripción mide ${descripcion.length}`);
  for (const [atributo, nombre, valor] of [['property', 'og:title', titulo], ['name', 'twitter:title', titulo], ['property', 'og:description', descripcion], ['name', 'twitter:description', descripcion]]) {
    assert.equal(pagina.match(new RegExp(`<meta ${atributo}="${nombre}" content="([^"]*)">`))?.[1], valor, nombre);
  }
});

test('tarjetas de Twitter e imagen social completas, de 1200x630', () => {
  assert.match(pagina, /<meta name="twitter:card" content="summary_large_image">/);
  const imagen = pagina.match(/<meta property="og:image" content="([^"]*)">/)[1];
  assert.equal(pagina.match(/<meta name="twitter:image" content="([^"]*)">/)?.[1], imagen);
  assert.match(pagina, /<meta property="og:image:width" content="1200">/);
  assert.match(pagina, /<meta property="og:image:height" content="630">/);
  assert.match(pagina, /<meta name="twitter:image:alt" content="[^"]+">/);
  assert.match(pagina, /<meta property="og:image:alt" content="[^"]+">/);
});

test('un solo h1, con básquet, Newell\'s y Rosario a la vista', () => {
  assert.equal((pagina.match(/<h1[ >]/g) ?? []).length, 1);
  const h1 = textoDe(pagina.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]);
  for (const palabra of ['básquet', "Newell's", 'Rosario', 'Lepra']) assert.match(h1, new RegExp(palabra, 'i'), palabra);
});

test('todas las imágenes del portal tienen alt descriptivo', () => {
  for (const img of pagina.match(/<img [^>]*>/g)) assert.match(img, /\balt="[^"]{3,}"/, img);
});

test('las categorías estáticas coinciden con PORTAL: nombre, rama, años, días, horas y lugares', () => {
  const bloque = seccion('info-categorias');
  assert.match(textoDe(bloque), new RegExp(`Categorías y horarios ${PORTAL.temporada}`));
  const tarjetas = bloque.split(TARJETA).slice(1).map(textoDe);
  assert.equal(tarjetas.length, PORTAL.categorias.length, 'sobra o falta una categoría');
  for (const c of categoriasDelPortal(PORTAL.categorias, PORTAL.temporada)) {
    const tarjeta = tarjetas.find((t) => t.startsWith(`${c.nombre} ${c.rama} · nacidos ${c.anios}`));
    assert.ok(tarjeta, `falta la tarjeta de ${c.nombre} ${c.rama} (nacidos ${c.anios})`);
    const turnos = turnosDeHorario(c.horario);
    for (const { cuando, lugar } of turnos) assert.ok(tarjeta.includes(`${cuando} · ${lugar}`), `${c.nombre}: falta "${cuando} · ${lugar}"`);
    // Sin horario publicado: la tarjeta no inventa ninguno.
    if (!turnos.length) assert.doesNotMatch(tarjeta, /\d+ a \d+ h/, `${c.nombre} ${c.rama} no tiene horario`);
  }
});

test('el párrafo natural nombra lo que la gente busca', () => {
  const intro = textoDe(seccion('info-categorias').match(/<p class="intro">([\s\S]*?)<\/p>/)[1]);
  for (const frase of ['escuelita de básquet', 'básquet infantil', 'básquet formativo', "Newell's Old Boys", 'Rosario', 'Parque de la Independencia']) {
    assert.ok(intro.includes(frase), `falta "${frase}"`);
  }
});

test('"Dónde se entrena": los tres lugares, la dirección y el mismo "Cómo llegar" que el portal dinámico', () => {
  const donde = seccion('info-donde');
  assert.match(donde, /<h2 id="t-info-donde">Dónde se entrena<\/h2>/);
  const texto = textoDe(donde);
  for (const lugar of PORTAL.sede.lugares) assert.ok(texto.includes(lugar), lugar);
  assert.ok(texto.includes('Av. Int. Morcillo 2675, S2000 Rosario, Santa Fe'));
  assert.ok(sinEntidades(donde).includes(`href="${PORTAL.sede.mapa}"`), 'el "Cómo llegar" no es el de PORTAL.sede.mapa');
});

test('"Cómo sumarte": el formulario y el WhatsApp del club con el texto prellenado', () => {
  const sumarte = sinEntidades(seccion('info-sumarte'));
  assert.match(sumarte, /<h2 id="t-info-sumarte">Cómo sumarte<\/h2>/);
  assert.match(sumarte, /href="\/consultas">Quiero que juegue</);
  const url = new URL(sumarte.match(/href="(https:\/\/wa\.me\/[^"]+)"/)[1]);
  assert.equal(`${url.origin}${url.pathname}`, PORTAL.contacto);
  assert.equal(url.searchParams.get('text'), "Hola! Quiero consultar por el básquet de Newell's");
});

test('preguntas frecuentes en <details>, sin precios inventados', () => {
  const faq = seccion('info-faq');
  const preguntas = [...faq.matchAll(/<details class="portal-faq"><summary>([^<]+)<\/summary>/g)].map((m) => m[1]);
  assert.deepEqual(preguntas, ['¿Desde qué edad pueden jugar?', '¿Dónde se entrena?', '¿Cómo me inscribo?', '¿Cuánto cuesta?']);
  assert.doesNotMatch(faq, /\$\s?\d/, 'ninguna respuesta puede traer un precio que no esté en el sitio');
});

test('JSON-LD: SportsClub y WebSite, sin coordenadas ni horarios, con el contacto de PORTAL', () => {
  const crudo = pagina.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(crudo, 'falta el JSON-LD');
  const datos = JSON.parse(crudo);
  const club = datos['@graph'].find((n) => n['@type'] === 'SportsClub');
  const sitio = datos['@graph'].find((n) => n['@type'] === 'WebSite');
  assert.ok(club && sitio);
  assert.equal(club.name, "Básquet Newell's Old Boys");
  assert.equal(club.url, 'https://basquetnewells.com.ar/');
  assert.equal(club.telephone, `+${PORTAL.contacto.match(/wa\.me\/(\d+)/)[1]}`);
  assert.deepEqual(club.address, { '@type': 'PostalAddress', streetAddress: 'Av. Int. Morcillo 2675', postalCode: 'S2000', addressLocality: 'Rosario', addressRegion: 'Santa Fe', addressCountry: 'AR' });
  assert.equal(club.areaServed, 'Rosario');
  assert.deepEqual(club.sameAs, ['https://www.instagram.com/basquetnewells']);
  assert.equal(sitio.url, club.url);
  for (const prohibida of ['geo', 'openingHours', 'openingHoursSpecification']) assert.ok(!(prohibida in club), `${prohibida}: no se publica nada que no esté verificado`);
});
