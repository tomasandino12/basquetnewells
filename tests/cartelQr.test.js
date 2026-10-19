import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearQr } from '../scripts/qr.mjs';
import {
  URL_POR_DEFECTO, FRASE, INSTRUCCION, AVISO_BORRADOR, pngDelQr, leerPngRgba, pdfDelCartel, contenidoDelCartel, generarCartel, leerArgumentos,
} from '../scripts/cartel-qr.mjs';

/**
 * El cartel se imprime y se reparte: un QR que no abre, o que apunta a otra
 * dirección que la vigente, se descubre cuando ya está pegado en la pared.
 * Estas pruebas leen de vuelta los archivos que se guardan en docs/cartel-qr/.
 * Lo que NO prueban —que un teléfono lo abra— se verifica a mano escaneando
 * el PNG o el PDF una vez antes de imprimir.
 */

const raiz = path.resolve('.');
const qr = crearQr(URL_POR_DEFECTO);
const MARGEN = 4;
const MODULO = 24;

/** Lee un PNG de escala de grises de 8 bits sin filtro (el que escribe pngDelQr) → { lado, pixel(x, y) }. */
function leerGris(buf) {
  assert.equal(buf.toString('latin1', 1, 4), 'PNG');
  const lado = buf.readUInt32BE(16);
  assert.equal(buf.readUInt32BE(20), lado, 'cuadrado');
  assert.equal(buf[24], 8, '8 bits');
  assert.equal(buf[25], 0, 'escala de grises');
  const partes = [];
  for (let i = 8; i < buf.length;) {
    const largo = buf.readUInt32BE(i);
    if (buf.toString('latin1', i + 4, i + 8) === 'IDAT') partes.push(buf.subarray(i + 8, i + 8 + largo));
    i += 12 + largo;
  }
  const crudo = inflateSync(Buffer.concat(partes));
  assert.equal(crudo.length, (lado + 1) * lado);
  return { lado, pixel: (x, y) => crudo[y * (lado + 1) + 1 + x] };
}

/** La matriz de módulos que dibuja un PNG: muestrea el centro de cada módulo. */
function matrizDelPng(buf, tamano) {
  const { lado, pixel } = leerGris(buf);
  assert.equal(lado, (tamano + 2 * MARGEN) * MODULO);
  return Array.from({ length: tamano }, (_, my) => Array.from({ length: tamano }, (_, mx) => pixel((mx + MARGEN) * MODULO + MODULO / 2, (my + MARGEN) * MODULO + MODULO / 2) === 0));
}

test('el PNG dibuja exactamente la matriz del QR, con 4 módulos de zona de silencio en blanco', () => {
  const png = pngDelQr(qr);
  assert.deepEqual(matrizDelPng(png, qr.tamano), qr.modulos);
  const { lado, pixel } = leerGris(png);
  for (let i = 0; i < MARGEN * MODULO; i++) for (let j = 0; j < lado; j++) {
    for (const [x, y] of [[i, j], [j, i], [lado - 1 - i, j], [j, lado - 1 - i]]) assert.equal(pixel(x, y), 255, `zona de silencio (${x},${y})`);
  }
});

test('el PNG guardado en docs/cartel-qr es el del QR de la dirección vigente', () => {
  const guardado = readFileSync(path.join(raiz, 'docs', 'cartel-qr', 'qr-consultas.png'));
  assert.deepEqual(matrizDelPng(guardado, qr.tamano), qr.modulos,
    'el PNG guardado no es el de URL_POR_DEFECTO: correr npm run cartel-qr y commitear');
});

/* ---------- PDF ---------- */

const escudo = leerPngRgba(readFileSync(path.join(raiz, 'public', 'escudo.png')));
const pdf = pdfDelCartel(qr, URL_POR_DEFECTO, escudo);
const texto = pdf.toString('latin1');

test('el escudo se lee con su transparencia', () => {
  assert.equal(escudo.ancho, 512);
  assert.equal(escudo.alto, 512);
  assert.equal(escudo.alfa.length, 512 * 512);
  assert.ok(escudo.alfa.includes(0) && escudo.alfa.includes(255), 'tiene fondo transparente y partes opacas');
});

test('el PDF tiene la estructura de un PDF: cabecera, tabla xref con offsets reales y cierre', () => {
  assert.match(texto, /^%PDF-1\.4\n/);
  assert.match(texto, /%%EOF\n$/);
  const inicio = Number(texto.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(texto.slice(inicio, inicio + 4), 'xref', 'startxref apunta a la tabla');
  const filas = [...texto.slice(inicio).matchAll(/^(\d{10}) \d{5} ([nf]) $/gm)];
  assert.equal(filas.length, 9, '8 objetos y la entrada libre');
  filas.slice(1).forEach((f, i) => assert.equal(texto.slice(Number(f[1])).startsWith(`${i + 1} 0 obj\n`), true, `objeto ${i + 1}`));
  assert.match(texto, /\/MediaBox \[0 0 595 842\]/);
  assert.match(texto, /\/Count 1/);
});

test('el cartel dice la frase, la instrucción y la dirección escritas', () => {
  const contenido = contenidoDelCartel(qr, URL_POR_DEFECTO);
  for (const linea of [...FRASE, INSTRUCCION, URL_POR_DEFECTO]) assert.ok(contenido.includes(`(${linea})`), linea);
  assert.deepEqual(FRASE, ['Escaneá y venite', 'a jugar al básquet']);
  assert.match(texto, /\/BaseFont \/Helvetica-Bold \/Encoding \/WinAnsiEncoding/);
});

test('el QR vectorial del PDF tiene un rectángulo por cada módulo oscuro, y en negro puro', () => {
  const contenido = contenidoDelCartel(qr, URL_POR_DEFECTO);
  const desde = contenido.indexOf('0 0 0 rg\n');
  const hasta = contenido.indexOf('f\n', desde);
  const rectangulos = contenido.slice(desde, hasta).match(/ re$/gm) ?? [];
  const oscuros = qr.modulos.flat().filter(Boolean).length;
  assert.equal(rectangulos.length, oscuros);
});

test('el escudo del PDF lleva su máscara de transparencia', () => {
  assert.match(texto, /\/Subtype \/Image \/Width 512 \/Height 512 \/ColorSpace \/DeviceRGB[^>]*\/SMask 8 0 R/);
  assert.match(texto, /\/ColorSpace \/DeviceGray/);
});

test('todos los caracteres del cartel tienen ancho propio: sin ellos el texto no queda centrado', () => {
  const fuente = readFileSync(path.join(raiz, 'scripts', 'cartel-qr.mjs'), 'utf8');
  const tabla = (nombre) => JSON.parse(fuente.match(new RegExp(`const ${nombre} = (\\{.*?\\});`))[1]);
  const reg = tabla('ANCHO_REG'); const neg = tabla('ANCHO_NEG');
  for (const ch of new Set([...FRASE.join(''), ...URL_POR_DEFECTO, ...'BÁSQUET · NEWELL\'S OLD BOYS'])) assert.ok(ch in neg, `Helvetica-Bold sin "${ch}"`);
  for (const ch of new Set([...INSTRUCCION, ...'Inferiores · Newell\'s Old Boys'])) assert.ok(ch in reg, `Helvetica sin "${ch}"`);
});

test('el PDF guardado es el cartel de la dirección vigente (misma dirección, mismos módulos)', () => {
  const guardado = readFileSync(path.join(raiz, 'docs', 'cartel-qr', 'cartel-consultas-A4.pdf')).toString('latin1');
  assert.match(guardado, /^%PDF-1\.4/);
  const lado = 330; const modulo = lado / (qr.tamano + 2 * MARGEN);
  assert.ok(guardado.includes(`(${URL_POR_DEFECTO})`), 'la dirección escrita no es la vigente');
  const esperado = contenidoDelCartel(qr, URL_POR_DEFECTO);
  // El contenido va sin comprimir: tiene que estar entero en el archivo guardado.
  assert.ok(guardado.includes(esperado), `el PDF guardado no coincide (módulo de ${modulo.toFixed(2)} pt): correr npm run cartel-qr y commitear`);
});

test('generarCartel escribe los dos archivos y rechaza direcciones que no son https', () => {
  const carpeta = mkdtempSync(path.join(tmpdir(), 'cartel-'));
  generarCartel('https://example.test/consultas', carpeta, raiz);
  assert.deepEqual(readdirSync(carpeta).sort(), ['cartel-consultas-A4.pdf', 'qr-consultas.png']);
  for (const mala of ['http://example.test/x', 'example.test/x', 'javascript:alert(1)', 'https://a b.test']) {
    assert.throws(() => generarCartel(mala, carpeta, raiz), /https/, mala);
  }
});

test('por defecto el cartel es un BORRADOR con franja roja; con final, no', () => {
  assert.ok(contenidoDelCartel(qr, URL_POR_DEFECTO).includes(`(${AVISO_BORRADOR})`));
  assert.ok(contenidoDelCartel(qr, URL_POR_DEFECTO, { borrador: true }).includes('0 818 595 24 re f'));
  assert.ok(!contenidoDelCartel(qr, URL_POR_DEFECTO, { borrador: false }).includes(AVISO_BORRADOR));
  assert.match(AVISO_BORRADOR, /NO IMPRIMIR/);
});

test('el PDF guardado en docs/cartel-qr sigue siendo borrador hasta que se defina el dominio', () => {
  const guardado = readFileSync(path.join(raiz, 'docs', 'cartel-qr', 'cartel-consultas-A4.pdf')).toString('latin1');
  assert.ok(guardado.includes(`(${AVISO_BORRADOR})`), 'cuando el dominio sea el definitivo: npm run cartel-qr -- --final y actualizar este test');
});

test('leerArgumentos: sin --final es borrador; url y carpeta son opcionales', () => {
  const r = leerArgumentos([], raiz);
  assert.equal(r.url, URL_POR_DEFECTO);
  assert.equal(r.borrador, true);
  assert.equal(r.carpeta, path.join(raiz, 'docs', 'cartel-qr'));
  assert.equal(leerArgumentos(['--final'], raiz).borrador, false);
  const otro = leerArgumentos(['https://otro.test/consultas', 'salida', '--final'], raiz);
  assert.deepEqual([otro.url, otro.carpeta, otro.borrador], ['https://otro.test/consultas', path.resolve('salida'), false]);
});
