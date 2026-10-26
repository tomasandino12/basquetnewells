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

test('título (≤ 60) y descripción (hasta 160) de la home, repetidos en Open Graph y Twitter', () => {
  const titulo = sinEntidades(pagina.match(/<title>([^<]*)<\/title>/)[1]);
  assert.ok(titulo.length <= 60, `el título mide ${titulo.length}`);
  assert.equal(titulo, "Básquet de Newell's en Rosario | Inferiores 2027");
  const descripcion = pagina.match(/<meta name="description" content="([^"]*)">/)[1];
  assert.ok(descripcion.length >= 120 && descripcion.length <= 160, `la descripción mide ${descripcion.length}: Google corta cerca de los 160`);
  assert.match(descripcion, /^15 veces campeón de la Asociación Rosarina\./);
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
  for (const frase of ['básquet infantil', 'básquet formativo', 'inferiores', "Newell's Old Boys", 'Rosario', 'Parque de la Independencia']) {
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
  assert.match(sumarte, /href="\/consultas">Anotarse para probar</);
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

test('la foto del hero (el LCP) se precarga: las mismas dos fuentes del <picture>, sin lazy', () => {
  const heroe = pagina.match(/<picture class="portal-heroe-foto">[\s\S]*?<\/picture>/)[0];
  const movil = heroe.match(/<source media="[^"]*" srcset="([^"\s]+)"/)[1];
  const compu = heroe.match(/<img src="([^"]+)"/)[1];
  assert.ok(pagina.includes(`<link rel="preload" as="image" href="${movil}" media="(max-width:47.99rem)" fetchpriority="high">`), 'falta el preload del celular');
  assert.ok(pagina.includes(`<link rel="preload" as="image" href="${compu}" media="(min-width:48rem)" fetchpriority="high">`), 'falta el preload de compu');
  assert.doesNotMatch(heroe, /loading="lazy"/);
  assert.match(heroe, /<img [^>]*width="\d+" height="\d+"[^>]*fetchpriority="high"/);
});

test('el club no tiene escuelita: la palabra no aparece en la página ni en sus comentarios', () => {
  assert.doesNotMatch(pagina, /escuelita|escuela de b[áa]squet/i);
});

test('el palmarés va en el cuerpo, con los años del Instagram del club', () => {
  assert.ok(textoDe(seccion('info-categorias')).includes('15 veces campeón de la Asociación Rosarina de Básquetbol (1943 al 54, 77, 78 y 83)'));
});

test('favicon: los tres links del head apuntan a archivos que existen, con el tamaño que dicen, y vercel.json los sirve desde la raíz', () => {
  const png = (ruta) => { const b = readFileSync(ruta); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.match(pagina, /<link rel="icon" href="\/favicon\.ico" sizes="48x48">/);
  assert.match(pagina, /<link rel="icon" type="image\/png" sizes="192x192" href="\/favicon-192\.png">/);
  assert.match(pagina, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
  assert.deepEqual(png('public/favicon-192.png'), [192, 192]);
  assert.deepEqual(png('public/favicon-48.png'), [48, 48]);
  assert.deepEqual(png('public/apple-touch-icon.png'), [180, 180]);
  // .ico: cabecera ICONDIR (reservado 0, tipo 1, cantidad) y un tamaño por entrada (0 significa 256).
  const ico = readFileSync('public/favicon.ico');
  assert.equal(ico.readUInt16LE(2), 1);
  const tamanios = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
  assert.deepEqual(tamanios, [16, 32, 48]);
  const reglas = JSON.parse(readFileSync('vercel.json', 'utf8')).rewrites;
  for (const f of ['favicon.ico', 'favicon-48.png', 'favicon-192.png', 'apple-touch-icon.png']) {
    assert.equal(reglas.find((r) => r.source === `/${f}`)?.destination, `/public/${f}`, f);
  }
  const robots = readFileSync('public/robots.txt', 'utf8');
  assert.doesNotMatch(robots, /^Disallow:\s*\S/m, 'robots.txt no bloquea nada: ni los íconos');
});
