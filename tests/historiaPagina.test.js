import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { titulos, datosPublicables, datosPendientes, epocas, momentos } from '../src/data/historia.js';
import { htmlLinea, htmlEstrellas, htmlFicha, htmlCifras } from '../src/ui/historia.js';

/**
 * La página pública /historia: lo que no cambia con los datos (la CSP no admite scripts en
 * línea, las rutas existen) y que lo que se pinta salga sólo de lo publicable.
 */

const pagina = readFileSync('public/historia.html', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));

test('historia.html no lleva scripts en línea y el 15 del encabezado coincide con los datos', () => {
  const enLinea = [...pagina.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)];
  assert.deepEqual(enLinea.map((m) => m[0]), []);
  assert.match(pagina, new RegExp(`id="hist-contador">${titulos().length}<`));
});

test('/historia tiene su rewrite, su no-store y su lugar en el sitemap', () => {
  assert.ok(vercel.rewrites.some((r) => r.source === '/historia' && r.destination === '/public/historia.html'));
  for (const ruta of ['/historia', '/public/historia.html']) {
    const h = vercel.headers.filter((x) => x.source === ruta).flatMap((x) => x.headers);
    assert.match(h.find((x) => x.key === 'Cache-Control')?.value ?? '', /no-store/, ruta);
  }
  assert.match(readFileSync('public/sitemap.xml', 'utf8'), /<loc>https:\/\/basquetnewells\.com\.ar\/historia<\/loc>/);
});

test('la vitrina deja el punto de enganche para la copa 3D y la leyenda obligatoria', () => {
  assert.match(pagina, /id="vitrina"/);
  assert.match(pagina, /id="vitrina-escenario"/);
  assert.match(pagina, /Recreación inspirada en la copa actual de la Asociación Rosarina/);
});

test('la línea histórica tiene un bloque por época (las solapadas van dentro) y nunca un dato pendiente', () => {
  const salida = String(htmlLinea());
  for (const e of epocas().filter((x) => !x.solapada)) assert.ok(salida.includes(`<section class="epoca" data-epoca="${e.id}"`), e.id);
  for (const p of datosPendientes()) assert.ok(!salida.includes(p.falta), p.id);
  // Todo hito con época se ve; los sin época (los 100 años de la Asociación) quedan afuera a propósito.
  for (const h of datosPublicables().filter((d) => d.texto && d.epoca)) assert.ok(salida.includes(h.texto), h.id);
  assert.ok(!salida.includes('Contexto'));
});

test('cada título es una tarjeta con su estrella, y los momentos no llevan estrella ni número de título', () => {
  const salida = String(htmlLinea());
  assert.equal((salida.match(/<article class="t-card/g) ?? []).length, titulos().length);
  assert.equal((salida.match(/class="t-estrella"/g) ?? []).length, titulos().length);
  assert.equal((salida.match(/<article class="momento"/g) ?? []).length, momentos().filter((m) => m.epoca).length);
  // Los 12 seguidos son una sola tira: el texto de la época se dice una vez, no en cada tarjeta.
  const intro = datosPublicables().find((d) => d.id === 'doce-seguidos').texto;
  assert.equal(salida.split(intro).length - 1, 1);
  // 1983 lleva su aclaración como etiqueta de la tarjeta.
  assert.match(salida, /class="t-torneo">Torneo regular</);
});

/** El texto visible de un fragmento: sin etiquetas y con los espacios normalizados. */
const textoVisible = (fragmento) => String(fragmento).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
/** Las cabeceras de un bloque: todo menos la prosa (.t-txt), el plantel y las fuentes, que cuentan lo que pasó y pueden nombrar el año. */
const sinProsa = (fragmento) => String(fragmento)
  .replace(/<p class="t-txt">[\s\S]*?<\/p>/g, '')
  .replace(/<details class="plantel">[\s\S]*?<\/details>/g, '')
  .replace(/<ul class="hito-fuentes">[\s\S]*?<\/ul>/g, '');
const aniosEn = (texto) => texto.match(/\b(?:19|20)\d{2}\b/g) ?? [];

test('un solo eje en la línea: ni bordes sueltos ni rieles por bloque, y cada título y hito tiene su nodo', () => {
  assert.equal((pagina.match(/class="hist-eje"/g) ?? []).length, 1);
  assert.match(pagina, /class="hist-eje-prog"/);
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Ninguna regla de la línea dibuja una raya vertical propia: eso es del eje.
  const rayas = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, sel, cuerpo]) => /(^|[\s,])\.(racha|epoca|momento|t-card|epoca-cab)\b/.test(sel) && /border-left\s*:/.test(cuerpo));
  assert.deepEqual(rayas.map((m) => m[1].trim()), []);
  assert.doesNotMatch(css, /\.racha(?:-item)?::before/);
  const salida = String(htmlLinea());
  const nodos = (salida.match(/class="nodo"/g) ?? []).length;
  assert.equal(nodos, titulos().length + momentos().filter((m) => m.epoca).length);
});

test('ningún bloque repite el año', () => {
  const salida = String(htmlLinea());
  const bloques = salida.split(/(?=<article class="(?:t-card|momento))/).slice(1).map((b) => b.split('</article>')[0]);
  assert.ok(bloques.length >= titulos().length);
  for (const b of bloques) {
    const anios = aniosEn(textoVisible(sinProsa(b)));
    assert.deepEqual(anios, [...new Set(anios)], `año repetido en: ${textoVisible(sinProsa(b)).slice(0, 80)}`);
  }
  // Una época de un solo año (1983, el Cubierto) dice el año en su tarjeta, no también en el encabezado.
  for (const e of epocas().filter((x) => !x.solapada && x.desde === x.hasta)) {
    const seccion = salida.split(`<section class="epoca" data-epoca="${e.id}"`)[1].split('</section>')[0];
    const anios = aniosEn(textoVisible(sinProsa(seccion)));
    assert.deepEqual(anios, [...new Set(anios)], e.id);
  }
});

test('los momentos llevan su etiqueta de categoría', () => {
  const salida = String(htmlLinea());
  assert.match(salida, /Orgullo mundial/);
  // El Cubierto, la tarjeta protagonista, lleva la suya: "El templo rojinegro".
  assert.match(salida, /class="momento-rotulo">El templo rojinegro</);
});

test('las fuentes no muestran la URL ni la fecha de consulta: sólo el medio, como link', () => {
  const salida = String(htmlLinea()) + String(htmlFicha(1946)) + String(htmlFicha(1950));
  const links = [...salida.matchAll(/<a class="fuente"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.ok(links.length > 10);
  for (const [, dentro] of links) {
    const visible = textoVisible(dentro);
    assert.doesNotMatch(visible, /https?:|www\.|\.com|\.org|consultada|Fuente:/i, visible);
  }
  assert.match(salida, /<a class="fuente" href="https:\/\/www\.olympedia\.org\/athletes\/5986"/);
  assert.match(salida, />\s*Olympedia\s*</);
});

/** La tarjeta del Cubierto, entera. */
const tarjetaCubierto = () => String(htmlLinea()).split('data-momento="cubierto-mundial-1990"')[1].split('</article>')[0];

test('el Cubierto no lleva año de inauguración ni superficie, ni que ahí se jugaron los títulos', () => {
  const c = momentos().find((m) => m.id === 'cubierto-mundial-1990');
  // Los datos tampoco lo dicen: ninguna fuente lo confirma (las finales de 1978 y 1983 fueron en Sportivo América).
  const datos = JSON.stringify({ nombre: c.nombre, texto: c.texto, sedes: c.sedes });
  // En la tarjeta se mira lo que se lee: el dibujo del sello (SVG) y la foto son otra cosa.
  const visible = tarjetaCubierto().replace(/<svg[\s\S]*?<\/svg>|<img[^>]*>/g, '');
  for (const t of [datos, visible]) {
    assert.doesNotMatch(t, /inaugur|m²|\bm2\b|metros|superficie|7\.?800|\bt[ií]tulos?\b|campeon|1978|1982|1983/i);
  }
  // Los únicos años de la tarjeta son los de las dos sedes mundiales, una vez cada uno.
  const anios = aniosEn(textoVisible(tarjetaCubierto().replace(/<img[^>]*>/g, '')));
  assert.deepEqual(anios, ['1990', '2018']);
  // Y las dos sedes salen de los datos, con el sello técnico en SVG.
  for (const sede of c.sedes) assert.ok(tarjetaCubierto().includes(sede), sede);
  assert.match(tarjetaCubierto(), /class="sello-techo"/);
  assert.match(tarjetaCubierto(), /class="t-sel"[^>]*>Estadio Cubierto Dr\. Claudio L\. Newell</);
  assert.match(tarjetaCubierto(), /data-tilt/);
  // El tilt se apaga en táctil y con movimiento reducido (lo decide el script, no el CSS).
  const js = readFileSync('src/ui/historia.js', 'utf8');
  assert.match(js, /hover:\s*hover\)\s*and\s*\(pointer:\s*fine/);
  assert.match(js, /pointermove/);
});

test('la foto del Cubierto tiene alt, width y height, y el piso azul no aparece', () => {
  const img = tarjetaCubierto().match(/<img[^>]*>/)[0];
  assert.match(img, /src="\/public\/img\/historia\/cubierto-interior\.webp"/);
  assert.match(img, /srcset="\/public\/img\/historia\/cubierto-interior-800\.webp 800w, /);
  assert.match(img, /alt="Interior del Estadio Cubierto Claudio Newell: parquet y tribunas rojinegras"/);
  assert.match(img, /width="1376"/);
  assert.match(img, /height="768"/);
  assert.match(img, /loading="lazy"/);
  for (const f of ['cubierto-interior.webp', 'cubierto-interior-800.webp']) assert.ok(existsSync(`public/img/historia/${f}`), f);
  // Sin rótulo de recreación (lo decidió Tomás) y sin mención al piso azul en ningún lado.
  assert.doesNotMatch(tarjetaCubierto(), /recreaci|\bIA\b|azul/i);
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.cubierto-capas\{[^}]*border:1px solid rgba\(255,255,255,\.08\)/);
  assert.match(css, /\.momento\[data-tilt\]:hover\{--esc:1\.03\}/);
});

test('el hero abre la página: sobretítulo, NUESTRA / HISTORIA, indicador para bajar, y el 15 abre la línea', () => {
  const hero = pagina.split('class="hist-heroe"')[1].split('</section>')[0];
  assert.match(hero, /Archivo histórico · Básquet/);
  assert.match(hero, /class="hh-nuestra">Nuestra</);
  assert.match(hero, /class="hh-historia">Historia</);
  assert.match(hero, /class="hist-bajar"/);
  assert.doesNotMatch(hero, /hist-contador/);
  const linea = pagina.split('id="hist-linea"')[1];
  assert.ok(linea.includes('id="hist-contador"') && linea.includes('id="hist-cifras"'));
});

test('con movimiento reducido la línea sale completa y la copa no es una caja', () => {
  const js = readFileSync('src/ui/historia.js', 'utf8');
  assert.match(js, /completa/);
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const vitrina = css.match(/\.hist-vitrina\{[^}]*\}/g).join('');
  assert.doesNotMatch(vitrina, /border:|border-top|overflow:hidden/);
  assert.match(css, /position:sticky;top:0;height:100(?:svh|vh)/);
  assert.doesNotMatch(pagina, /v-cono|polygon/);
});

test('cada tarjeta con dato publicado lleva su fuente como link', () => {
  const salida = String(htmlLinea());
  const tarjetas = salida.split(/<article class="(?:t-card con-historia|momento)/).slice(1);
  assert.ok(tarjetas.length >= 8);
  for (const t of tarjetas) assert.match(t.split('</article>')[0], /class="fuente"/);
});

test('el panel de cifras sale de los datos', () => {
  const salida = String(htmlCifras());
  assert.match(salida, /Títulos de Primera<\/dt><dd>15</);
  assert.match(salida, /<dd>12<small>1943–1954<\/small>/);
  assert.match(salida, /Primer título<\/dt><dd>1943</);
  // Tomás pidió sacar el último título (24/11).
  assert.doesNotMatch(salida, /Último título/);
});

test('el dorado queda sólo en las estrellas', () => {
  // Regla de Tomás (24/11): el dorado es de las estrellas (un título ganado). La vitrina ya no lleva filete.
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const permitidos = /^(\.t-estrella|\.estrella|\.estrellas)/;
  const conDorado = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => /--dorado|--pub-oro-fondo/.test(m[2]));
  assert.ok(conDorado.length > 0);
  for (const [, cabeza, cuerpo] of conDorado) {
    // En un @media de una sola regla el selector está adentro.
    const selectores = cabeza.trim().startsWith('@media') ? cuerpo.split('{')[0] : cabeza;
    for (const sel of selectores.split(',').map((x) => x.trim())) assert.match(sel, permitidos, `dorado fuera de las estrellas: ${sel}`);
  }
});

test('las 15 estrellas y la ficha de 1983 con su aclaración del torneo', () => {
  assert.equal((String(htmlEstrellas()).match(/class="estrella"/g) ?? []).length, 15);
  const ficha = String(htmlFicha(1983));
  assert.match(ficha, /Torneo regular/);
  assert.match(ficha, /Apertura/);
});

test('la ficha de un año sin dato propio usa el de su época y lo dice', () => {
  assert.match(String(htmlFicha(1944)), /Dato de la época/);
  assert.doesNotMatch(String(htmlFicha(1946)), /Dato de la época/);
});
