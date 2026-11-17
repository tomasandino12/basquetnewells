import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Que el portal cargue sin saltos (pedido de Tomás, 17/11/2026). Medido con un observador de
 * layout-shift en el navegador: antes saltaba 0,085 al cargar (título del hero por la tipografía
 * y cinta que empujaba la página al aparecer); ahora 0. Acá se atan, leyendo texto, las piezas
 * que lo logran: si una se saca, el salto vuelve sin que nada falle a la vista.
 */
const html = readFileSync('public/portal.html', 'utf8');
const tokens = readFileSync('public/css/tokens.css', 'utf8');
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const css = sinComentarios(readFileSync('public/css/publico.css', 'utf8'));
const anim = readFileSync('public/js/anim.js', 'utf8');
const portal = readFileSync('src/ui/portal.js', 'utf8');

test('los pesos de la primera pantalla se precargan y los archivos existen', () => {
  for (const archivo of ['barlow-condensed-latin-600-normal', 'barlow-condensed-latin-700-normal', 'inter-latin-400-normal', 'inter-latin-600-normal']) {
    assert.match(html, new RegExp(`<link rel="preload" href="/public/fonts/${archivo}\\.woff2" as="font" type="font/woff2" crossorigin>`), archivo);
    assert.ok(existsSync(`public/fonts/${archivo}.woff2`), archivo);
  }
});

test('cada tipografía propia tiene una de respaldo con sus medidas, y va segunda en la pila', () => {
  assert.match(tokens, /--ff-titulo:'Barlow Condensed','Barlow Condensed Respaldo',/);
  assert.match(tokens, /--ff-cuerpo:'Inter','Inter Respaldo',/);
  for (const familia of ['Barlow Condensed Respaldo', 'Inter Respaldo']) {
    const caras = tokens.match(new RegExp(`@font-face\\{font-family:'${familia}'[^}]*\\}`, 'g')) ?? [];
    assert.ok(caras.length >= 2, `${familia}: una cara por grupo de pesos`);
    for (const cara of caras) {
      for (const dato of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) {
        assert.match(cara, new RegExp(dato), `${familia} sin ${dato}`);
      }
      assert.match(cara, /src:local\(/, `${familia}: parte de una letra del sistema, no baja nada`);
    }
  }
  // Los pesos reales que usa el CSS de la página tienen su cara de respaldo (no la inventa el navegador).
  const pesosBarlow = [...tokens.matchAll(/font-family:'Barlow Condensed';font-weight:(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(pesosBarlow.includes(600) && pesosBarlow.includes(700));
  assert.match(tokens, /'Barlow Condensed Respaldo';font-weight:600;/);
  assert.match(tokens, /'Barlow Condensed Respaldo';font-weight:700;/);
  assert.match(tokens, /'Inter Respaldo';font-weight:600 700;/);
});

test('la marca de la barra no se parte en renglones mientras llega la letra', () => {
  assert.match(css, /\.portal-barra \.t\{[^}]*white-space:nowrap/);
});

test('la entrada del hero espera a las tipografías y anim.js avisa cuándo llegaron', () => {
  assert.match(css, /\.js-anim:not\(\.fuentes\) \.entra,\.js-anim:not\(\.fuentes\) \.portal-heroe \.linea > span\{animation-play-state:paused\}/);
  assert.match(anim, /classList\.add\('fuentes'\)/);
  assert.match(anim, /document\.fonts\.load\('700 1em "Barlow Condensed"'\)/);
  assert.match(anim, /setTimeout\(fuentesListas, 1200\)/, 'si las fuentes tardan, se sigue igual');
  // Los avisos de las fuentes no dependen de que haya animaciones: van antes del `return` del movimiento reducido.
  assert.ok(anim.indexOf("classList.add('fuentes')") < anim.indexOf('if (sinMovimiento'));
});

test('la cinta nace en su lugar: esqueleto del mismo alto, sin hidden, y se reemplaza al llegar el calendario', () => {
  const seccion = html.match(/<section class="portal-cinta"[^>]*>/)[0];
  assert.doesNotMatch(seccion, /\shidden/, 'con hidden aparecía de golpe y empujaba la página');
  assert.match(seccion, /aria-busy="true"/);
  assert.match(html, /<div id="portal-cinta"><div class="portal-cinta-banda cinta-esqueleto" aria-hidden="true">/);
  assert.match(css, /\.cinta-esqueleto\{[^}]*height:3\.0625rem/, 'los 49 px de la banda armada');
  assert.match(css, /html:not\(\.js\) #cinta\{display:none\}/, 'sin JS no queda un esqueleto que nadie reemplaza');
  assert.match(css, /\.js \.portal-cinta-banda:not\(\.cinta-esqueleto\)\{animation:aparecer /);
  assert.match(portal, /\$\('cinta'\)\.removeAttribute\('aria-busy'\)/);
  assert.match(anim, /getAttribute\('aria-busy'\) === 'true'\) cinta\.hidden = true/, 'tope de espera: nunca un esqueleto eterno');
});

test('el botón del hero mientras carga dice lo mismo que abierto: no cambia de alto al llegar la base', () => {
  const funcion = portal.slice(portal.indexOf('function accion('), portal.indexOf('export function htmlAcciones'));
  assert.match(funcion, /url \|\| cargando \? detalle : cerrado/);
  assert.match(css, /\.js \.portal-accion\[aria-busy="true"\] small\{animation:espera /);
  // Los brillos de espera son finitos: el portal sigue con sus tres animaciones infinitas (estilosTokens.test.js).
  assert.doesNotMatch(css.slice(css.indexOf('.cinta-esqueleto')), /\.cinta-esqueleto[^}]*infinite/);
  assert.doesNotMatch(css, /animation:espera [^}]*infinite/);
});
