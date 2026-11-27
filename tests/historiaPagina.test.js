import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { titulos, datosPublicables, datosPendientes, epocas, momentos } from '../src/data/historia.js';
import { COPA } from '../src/data/copaMedidas.js';
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

test('la vitrina deja el punto de enganche para la copa y la leyenda obligatoria', () => {
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
  // En la tarjeta se mira lo que se lee: la foto es otra cosa.
  const visible = tarjetaCubierto().replace(/<svg[\s\S]*?<\/svg>|<img[^>]*>/g, '');
  for (const t of [datos, visible]) {
    assert.doesNotMatch(t, /inaugur|m²|\bm2\b|metros|superficie|7\.?800|\bt[ií]tulos?\b|campeon|1978|1982|1983/i);
  }
  // Los únicos años de la tarjeta son los de las dos sedes mundiales, una vez cada uno.
  const anios = aniosEn(textoVisible(tarjetaCubierto().replace(/<img[^>]*>/g, '')));
  assert.deepEqual(anios, ['1990', '2018']);
  // Y las dos sedes salen de los datos, como chips tipográficos; el sello SVG ya no está.
  for (const sede of c.sedes) assert.ok(tarjetaCubierto().includes(`<li class="chip-sede">${sede}</li>`), sede);
  assert.equal((tarjetaCubierto().match(/class="chip-sede"/g) ?? []).length, c.sedes.length);
  assert.doesNotMatch(tarjetaCubierto(), /sello-techo|capa-sello|<svg/);
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
  // El zoom de hover va sólo en la <img>, dentro de un marco que recorta.
  assert.match(css, /\.momento\[data-tilt\]:hover \.capa-foto\{transform:scale\(1\.04\)\}/);
  assert.match(css, /\.cubierto-marco\{[^}]*overflow:hidden/);
});

test('el texto del Cubierto queda nítido: sin will-change, sin escala ni transform en el contenedor del texto', () => {
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /will-change/);
  const reglas = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, cuerpo]) => [sel.trim(), cuerpo]);
  // Ningún ancestro del texto se transforma ni se escala (el reducido sólo lo apaga: `none`).
  for (const [sel, cuerpo] of reglas.filter(([sel]) => !/cubierto-marco|capa-foto/.test(sel) && /(^|[\s,])\.(cubierto-capas|capa-texto|momento\[data-tilt\])(?![-\w])/.test(sel))) {
    assert.doesNotMatch(cuerpo, /(^|;)\s*(transform|scale|perspective|will-change)\s*:(?!\s*none)/, sel);
  }
  // Y la inclinación del marco no pasa de 3°: el puntero va de -.5 a .5 y el factor es 6° por unidad.
  const inclinacion = reglas.find(([sel]) => /inclinando \.cubierto-marco/.test(sel))[1];
  const grados = [...inclinacion.matchAll(/\* (-?\d+(?:\.\d+)?)deg/g)].map((m) => Math.abs(Number(m[1])) * 0.5);
  assert.ok(grados.length === 2 && grados.every((g) => g <= 3), inclinacion);
  // Al salir el marco vuelve a `none` (la regla de reposo no lleva transform) y el script suelta la clase.
  assert.doesNotMatch(reglas.find(([sel]) => sel === '.cubierto-marco')[1], /transform\s*:/);
  const js = readFileSync('src/ui/historia.js', 'utf8');
  assert.match(js, /pointerleave[\s\S]*?classList\.remove\('inclinando'\)/);
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

test('la vitrina muestra sólo la copa: sin selector de pieza ni cambio automático', () => {
  const js = readFileSync('src/ui/historia.js', 'utf8');
  const copa = readFileSync('src/ui/copa3d.js', 'utf8');
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(js, /historia:pieza|htmlSelectorPieza|elegirPieza|pasarAMedalla|vitrina-selector/);
  assert.doesNotMatch(css, /vitrina-selector|vitrina-pieza/);
  assert.doesNotMatch(pagina, /Medalla oficial|Trofeo ARBB|historia:pieza/);
  // La copa no sabe nada de la medalla ni de la UI, y frena su bucle cuando sale de pantalla o se queda quieta.
  assert.doesNotMatch(copa, /medalla|from '\.\/(?!\.|copa\/)/);
  assert.match(copa, /new IntersectionObserver\(\(\[e\]\) => \{\s*visible = e\.isIntersecting;[\s\S]*?cancelAnimationFrame\(idRaf\)/);
  assert.match(copa, /if \(!quieta \|\| placas \|\| arrastrando\) idRaf = requestAnimationFrame\(cuadro\)/);
});

test('la copa 3D es la malla limpia con materiales de verdad; la foto queda de respaldo', () => {
  // Los recortes de la foto: WebP con alfa (VP8X) y livianos. El escudo HD y la caoba salen de la foto de referencia.
  for (const [nombre, max, alfa] of [['copa-arbb', 120, true], ['escudo-arbb-hd', 60, true], ['caoba-real', 20, false]]) {
    const b = readFileSync(`public/img/historia/${nombre}.webp`);
    if (alfa) {
      assert.equal(b.toString('latin1', 8, 16), 'WEBPVP8X', nombre);
      assert.ok(b[20] & 0x10, `${nombre}: sin canal alfa`);
    }
    assert.ok(b.length < max * 1024, `${nombre}: ${b.length} bytes`);
  }
  // Sin WebGL se ve la foto; el estado arranca en "foto".
  assert.match(pagina, /<figure class="hist-vitrina" id="vitrina" data-estado="foto">/);
  assert.match(pagina, /<img class="vitrina-foto" src="\/public\/img\/historia\/copa-arbb\.webp" width="862" height="1105"[^>]*alt="[^"]{40,}"/);
  // Lo que queda de la foto en COPA es la cámara (y el perfil con que se la recortó).
  assert.deepEqual(Object.keys(COPA.camara), ['y', 'z', 'miraY']);
  const copa = readFileSync('src/ui/copa3d.js', 'utf8');
  // La forma es la malla, no un torno inventado; el escudo y la caoba son de la foto; el entorno, un HDRI de estudio.
  assert.match(copa, /cargarGlb\(THREE, '\/public\/img\/historia\/copa-arbb\.glb'\)/);
  assert.match(copa, /\/public\/img\/historia\/escudo-arbb-hd\.webp/);
  assert.match(copa, /\/public\/img\/historia\/caoba-real\.webp/);
  assert.match(copa, /\/public\/img\/historia\/estudio\.hdr/);
  assert.match(copa, /const CAMARA = COPA\.camara;/);
  assert.doesNotMatch(copa, /LatheGeometry|ExtrudeGeometry|baseColorTexture/);
  // Los tres materiales PBR con los valores pedidos: cromo espejo, bronce satinado y caoba con laca.
  assert.match(copa, /new THREE\.MeshStandardMaterial\(\{ color: 0xffffff, metalness: 1, roughness: 0\.045, envMapIntensity: 1\.35 \}\)/);
  assert.match(copa, /color: 0xc6a664, metalness: 0\.9, roughness: 0\.25, envMapIntensity: 1\.25, bumpMap: grano/);
  assert.match(copa, /new THREE\.MeshPhysicalMaterial\(\{ map: texCaoba, color: 0x6e4238, roughness: 0\.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0\.08, envMapIntensity: 0\.65/);
  // El escudo es un decal sobre el cáliz con polygonOffset; un solo renderer, tonemapping ACES y pixelRatio <= 1,5.
  assert.match(copa, /crearDecal\(THREE, geos\.cromo,/);
  assert.match(copa, /polygonOffset: true/);
  assert.equal((copa.match(/new THREE\.WebGLRenderer\(/g) ?? []).length, 1);
  assert.match(copa, /renderer\.toneMapping = THREE\.ACESFilmicToneMapping;\s*renderer\.toneMappingExposure = 1\.02;/);
  assert.match(copa, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
});

test('las placas son una grilla de 8 × 2 cada 45° y la encendida es plata bruñida, nunca roja', () => {
  const copa = readFileSync('src/ui/copa3d.js', 'utf8');
  assert.match(copa, /const PASO = \(Math\.PI \* 2\) \/ COLUMNAS_COPA;/);
  assert.match(copa, /m\.rotation\.y = p\.columna \* PASO;/);
  // Apagada: plata ahumada y año gris carbón; encendida: platino y año negro.
  for (const color of ["'#A6ACB5'", "'#858B94'", "'#1E2024'", "'#FFFFFF'", "'#E6E9EF'", "'#C8CDD6'", "'#09090B'"]) assert.ok(copa.includes(color), color);
  // Se busca en el código, no en los comentarios (el que explica por qué no es roja nombra el rojo).
  const codigo = copa.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  assert.doesNotMatch(codigo, /e30613|d9122e|ROJO|'red'|#f00\b/i);
  // Las texturas se dibujan una sola vez (dos atlas), no por cuadro.
  assert.equal((copa.match(/atlasDePlacas\(placas, (?:true|false)\)/g) ?? []).length, 2);
});

test('"Volver al frente" va debajo de la copa y sólo aparece con la copa girada lejos del frente', () => {
  const copa = readFileSync('src/ui/copa3d.js', 'utf8');
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(copa, /const UMBRAL_FRENTE = 0\.15;/);
  assert.match(copa, /Math\.abs\(envolver\(giro\)\) > UMBRAL_FRENTE/);
  assert.match(copa, /frente\.classList\.toggle\('visible', lejos\)/);
  // Va en la figura, entre el escenario y la leyenda (no flotando arriba a la derecha sobre el canvas).
  assert.match(copa, /raiz\.insertBefore\(frente, raiz\.querySelector\('figcaption'\)\)/);
  assert.doesNotMatch(css, /\.vitrina-frente\{[^}]*position:absolute/);
  // Apagado no se ve ni se puede tocar ni enfocar, pero ocupa su lugar; encendido, en fundido.
  assert.match(css, /\.vitrina-frente\{[^}]*opacity:0;visibility:hidden;pointer-events:none/);
  assert.match(css, /\.vitrina-frente\.visible\{opacity:1;visibility:visible;pointer-events:auto/);
});

test('toda la copa gira junta: con el arrastre, hasta el año que se lee y de vuelta al frente', () => {
  const js = readFileSync('src/ui/historia.js', 'utf8');
  const copa = readFileSync('src/ui/copa3d.js', 'utf8');
  assert.match(js, /await import\('\.\/copa3d\.js'\)/);
  assert.match(js, /new CustomEvent\('historia:foco', \{ detail: \{ anio: Number\(en\.target\.dataset\.anio\) \} \}\)/);
  for (const ev of ["'historia:seleccion'", "'historia:foco'", "'historia:elegir'"]) assert.ok(copa.includes(ev), ev);
  // Un solo grupo: lo que gira es copa.grupo; la meta deja la columna de frente por el camino corto.
  assert.match(copa, /copa\.grupo\.rotation\.y = giro;/);
  assert.match(copa, /const a = -columna \* PASO;\s*return a \+ Math\.PI \* 2 \* Math\.round\(\(meta - a\) \/ \(Math\.PI \* 2\)\);/);
  assert.match(copa, /frente\.textContent = 'Volver al frente'/);
  assert.match(copa, /meta = Math\.PI \* 2 \* Math\.round\(meta \/ \(Math\.PI \* 2\)\);/);
  // Rendimiento: pixelRatio hasta 1,5 y el dedo vertical sigue siendo scroll.
  assert.match(copa, /renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)\)/);
  const css = readFileSync('public/css/historia.css', 'utf8');
  assert.match(css, /\.vitrina-canvas\{[^}]*touch-action:pan-y/);
});

test('la medalla va en una sección de cierre propia, con su leyenda, sus dos caras y su botón', () => {
  assert.match(pagina, /<section class="[^"]*hist-medalla-sec"[^>]*aria-labelledby="t-medalla"/);
  assert.match(pagina, /id="medalla-escenario"/);
  assert.match(pagina, /<figcaption>Recreación inspirada en la medalla actual de la Asociación Rosarina<\/figcaption>/);
  // Va después de "Las 15 estrellas" y no adentro de la vitrina de la copa.
  assert.ok(pagina.indexOf('id="t-medalla"') > pagina.indexOf('id="t-estrellas"'));
  assert.ok(pagina.indexOf('id="t-medalla"') > pagina.indexOf('</figure>'));
  // Las dos caras llevan texto alternativo; el canto son 7 capas (de 6 a 8) y no se anuncian.
  for (const cara of ['frente', 'dorso']) {
    assert.match(pagina, new RegExp(`<img src="/public/img/historia/medalla-${cara}-full\.webp"[^>]*alt="[^"]{20,}"`));
  }
  assert.equal((pagina.match(/<span class="medal-canto"[^>]*aria-hidden="true"><\/span>/g) ?? []).length, 7);
  const css = readFileSync('public/css/historia.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Flota libre: sin caja gris ni borde, con perspectiva y 3D preservado.
  assert.doesNotMatch(css, /\.medalla-escenario\{[^}]*(background:|border:)/);
  assert.match(css, /\.medalla-escenario\{[^}]*perspective:1200px/);
  assert.match(css, /\.medalla-escenario\{[^}]*touch-action:pan-y/);
  assert.match(css, /\.medal-3d\{[^}]*transform-style:preserve-3d/);
  assert.match(css, /\.medal-cara\{[^}]*backface-visibility:hidden/);
  assert.match(css, /\.medal-dorso\{transform:rotateY\(180deg\) translateZ\(/);
  assert.match(css, /\.medal-canto\{[^}]*filter:brightness\(\.45\)/);
  assert.match(css, /\.medal-brillo\{[^}]*mix-blend-mode:soft-light/);
  assert.match(css, /\.medal-frente \.medal-brillo\{[^}]*mask-image:url\(\/public\/img\/historia\/medalla-frente-full\.webp\)/);
  assert.match(css, /\.medal-dorso \.medal-brillo\{[^}]*mask-image:url\(\/public\/img\/historia\/medalla-dorso-full\.webp\)/);
});

test('la medalla no usa WebGL: el único canvas de la página es el de la copa', () => {
  const js = readFileSync('src/ui/historia.js', 'utf8');
  assert.doesNotMatch(js, /medalla3d|vitrina3d/);
  for (const f of ['src/ui/medalla3d.js', 'src/ui/vitrina3d.js', 'src/ui/copa.js']) assert.ok(!existsSync(f), f);
  const usos = readdirSync('src/ui', { recursive: true })
    .filter((f) => String(f).endsWith('.js'))
    .filter((f) => /new THREE\.WebGLRenderer/.test(readFileSync(join('src/ui', String(f)), 'utf8')));
  assert.deepEqual(usos.map(String), ['copa3d.js']);
  assert.doesNotMatch(readFileSync('src/ui/medalla.js', 'utf8'), /from '[^']*three|WebGLRenderer|getContext\(/);
  // Los dos recortes nuevos existen, son WebP con pérdida y alfa (VP8X), de 512×704, y pesan menos de 80 KB.
  for (const cara of ['frente', 'dorso']) {
    const ruta = `public/img/historia/medalla-${cara}-full.webp`;
    assert.ok(existsSync(ruta), ruta);
    const b = readFileSync(ruta);
    assert.equal(b.toString('latin1', 8, 12), 'WEBP');
    assert.equal(b.toString('latin1', 12, 16), 'VP8X');
    assert.ok(b[20] & 0x10, `${cara}: sin canal alfa`);
    assert.equal(1 + b.readUIntLE(24, 3), 512, cara);
    assert.equal(1 + b.readUIntLE(27, 3), 704, cara);
    assert.ok(b.length < 80 * 1024, `${cara}: ${b.length} bytes`);
  }
  // Las fotos viejas, sin dueño, ya no están.
  for (const cara of ['frente', 'dorso']) assert.ok(!existsSync(`public/img/historia/medalla-${cara}.webp`));
});

test('la medalla gira por arrastre con inercia, péndulo, botón y sin movimiento si se pide reducido', () => {
  const js = readFileSync('src/ui/historia.js', 'utf8');
  const medalla = readFileSync('src/ui/medalla.js', 'utf8');
  assert.match(js, /^import \{ montarMedalla \} from '\.\/medalla\.js';/m);
  assert.doesNotMatch(medalla, /^import /m);
  // Pointer events con captura y rotateY libre.
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'setPointerCapture']) assert.ok(medalla.includes(ev), ev);
  assert.match(medalla, /rotateY\(\$\{giro\.toFixed\(2\)\}deg\)/);
  assert.match(medalla, /rotateX\(\$\{tilt\.toFixed\(2\)\}deg\)/);
  // El bucle se corta de verdad fuera de pantalla y sólo sigue mientras algo se mueve.
  assert.match(medalla, /new IntersectionObserver\(\(\[e\]\) => \{\s*visible = e\.isIntersecting;[\s\S]*?cancelAnimationFrame\(idRaf\)/);
  assert.match(medalla, /if \(!quieta\) idRaf = requestAnimationFrame\(cuadro\)/);
  // Con movimiento reducido: sin inercia ni péndulo, el botón da vuelta sin animación.
  assert.match(medalla, /if \(reducido\) \{\s*giro = meta;\s*tilt = tiltV = 0;/);
  assert.match(medalla, /if \(!reducido && performance\.now\(\) - ultimoMov < 80\) meta \+=/);
  assert.match(medalla, /boton\.textContent = 'Ver frente \/ dorso'/);
  assert.match(medalla, /meta = \(Math\.round\(meta \/ 180\) \+ 1\) \* 180/);
});

test('el portal enlaza a la historia', () => {
  const portal = readFileSync('public/portal.html', 'utf8');
  // La tarjeta entera y la línea del palmarés: dos links a /historia.
  assert.match(portal, /<a class="portal-historia-card" href="\/historia" data-vista-copa>/);
  assert.match(portal, /<p class="intro portal-info-palmares"><a href="\/historia" data-vista-copa>/);
  // La foto de la tarjeta existe, y la de las metas para compartir es una de la carpeta de la historia, con URL absoluta.
  assert.ok(existsSync(portal.match(/class="ph-foto" src="\/([^"]+)"/)[1]));
  const og = pagina.match(/<meta property="og:image" content="(https:\/\/basquetnewells\.com\.ar\/public\/img\/historia\/[^"]+)"/);
  assert.ok(og, 'historia.html debe tener og:image con URL absoluta');
  assert.ok(existsSync(og[1].replace('https://basquetnewells.com.ar/', '')));
  for (const meta of ['og:title', 'og:description', 'og:url']) assert.match(pagina, new RegExp(`property="${meta}"`));
  assert.match(pagina, /name="twitter:card" content="summary_large_image"/);
  assert.match(pagina, /<meta name="description"/);
  // Y se vuelve: encabezado y pie de la historia llevan al portal.
  assert.equal((pagina.match(/href="\/"/g) ?? []).length >= 2, true);
});
