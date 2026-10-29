import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Las pantallas piden el ROL de un color (--texto, --sup, --borde...) y no el
 * de paleta (--tinta, --blanco, --linea...): el tema oscuro redefine sólo los
 * roles. Estos tests leen el CSS como texto y cuidan que nadie vuelva a la
 * paleta en una pantalla y la deje clara en el tema oscuro.
 */
const leer = (n) => readFileSync(`public/css/${n}.css`, 'utf8');
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = leer('tokens');

const ROLES = [
  'fondo-app', 'sup', 'sup-hundida', 'texto', 'texto-2', 'borde', 'pista', 'fondo-chip-t',
  'graf-texto', 'graf-eje', 'graf-rejilla', 'graf-cancha', 'marca-texto', 'marca-texto-tinte',
  'btn-sec-fondo', 'btn-sec-borde',
];

/** Los pares selector { cuerpo } del CSS, también los de dentro de un @media. */
function reglas(texto) {
  return [...sinComentarios(texto).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), cuerpo: m[2] }));
}

// Los tokens declarados en los bloques de :root (el de la paleta y el de los roles), y los que
// redefine el tema oscuro.
const declarados = (cuerpos) => new Set(cuerpos.flatMap((c) => [...c.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])));
const bloques = reglas(tokens);
const enRaiz = declarados(bloques.filter((b) => /(^|,)\s*:root\s*(,|$)/.test(b.selector)).map((b) => b.cuerpo));
const enOscuro = declarados(bloques.filter((b) => b.selector.includes('data-tema="oscuro"')).map((b) => b.cuerpo));

test('cada token de rol está definido en :root', () => {
  assert.deepEqual(ROLES.filter((r) => !enRaiz.has(`--${r}`)), []);
});

test('cada token redefinido en [data-tema=oscuro] existe en :root', () => {
  assert.ok(enOscuro.size > 0, 'el tema oscuro redefine algo');
  assert.deepEqual([...enOscuro].filter((t) => !enRaiz.has(t)), []);
});

test('cada rol tiene su valor oscuro', () => {
  assert.deepEqual(ROLES.filter((r) => !enOscuro.has(`--${r}`)), []);
});

// Lo que es siempre igual, con cualquier tema: la pizarra (un "papel"), la hoja
// de impresión, la barra de navegación (negra) y lo que lleva su propio color
// de fondo fijo.
const EXCEPCIONES = [
  /^(svg\.pz|\.pz)/, // pizarra
  /^\.nav\b/, // barra de abajo: negra
  /\.jugada-impresion|\.ji-/, // impresión
  /^\.test-fila\.hecho \.ic$/, // texto blanco sobre el verde
  /^\.rec-filo-sello$/, // sello negro con letras blancas
  /^\.crono-aviso$/, // texto oscuro sobre el amarillo de aviso
  /^\.cabecera\b/, /^\.toast\b/, /\.publico\b/,
];
const PALETA = /var\(--(papel|blanco|tinta|gris|linea)\)/;

test('las pantallas no usan --papel/--blanco/--tinta/--gris(-cl)/--linea fuera de las excepciones', () => {
  const malos = [];
  for (const archivo of ['base', 'layout', 'componentes']) {
    for (const { selector, cuerpo } of reglas(leer(archivo))) {
      if (!PALETA.test(cuerpo)) continue;
      // Con varios selectores separados por coma, todos tienen que ser excepción.
      const partes = selector.split(',').map((s) => s.trim());
      if (partes.every((p) => EXCEPCIONES.some((e) => e.test(p)))) continue;
      malos.push(`${archivo}.css: ${selector} → ${cuerpo.match(PALETA)[0]}`);
    }
  }
  assert.deepEqual(malos, []);
});

// public/tema.js corre antes del importmap y no puede importar src/data/tema.js: repite la regla.
// Si una cambia y la otra no, la app arranca clara o con la barra del color equivocado.
test('public/tema.js usa la misma clave y el mismo color de barra que src/data/tema.js', async () => {
  const { CLAVE_TEMA, COLOR_BARRA_OSCURO } = await import('../src/data/tema.js');
  const arranque = readFileSync('public/tema.js', 'utf8');
  assert.ok(arranque.includes(`getItem('${CLAVE_TEMA}')`), 'la clave de localStorage');
  assert.ok(arranque.includes(`'${COLOR_BARRA_OSCURO}'`), 'el color de la barra en oscuro');
  assert.match(arranque, /!== 'oscuro'/, 'sólo "oscuro" prende el tema');
});

test('el HTML de la app carga tema.js en el <head> y sin defer ni async (si no, pinta claro un instante)', () => {
  const pagina = readFileSync('public/index.html', 'utf8');
  const cabeza = pagina.slice(0, pagina.indexOf('</head>'));
  assert.match(cabeza, /<script src="\/public\/tema\.js"><\/script>/);
  assert.doesNotMatch(pagina, /<script[^>]*tema\.js[^>]*(defer|async)/);
});
