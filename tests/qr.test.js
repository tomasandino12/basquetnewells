import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearQr, elegirVersion, restoReedSolomon, bitsDeFormato, estructuraDeBloques, bitsSobrantes,
} from '../scripts/qr.mjs';

/**
 * El QR se imprime y se pega en una pared: no se puede probar con el
 * teléfono en cada cambio. Estas pruebas leen de vuelta la matriz que se
 * escribió, sin volver a usar el camino de escritura: formato, máscara,
 * Reed-Solomon de cada bloque y el texto. Lo que NO prueba (que un lector
 * real lo abra) se verifica una vez a mano con el cartel impreso o con un
 * decodificador externo.
 */

test('Reed-Solomon: el vector conocido de "HELLO WORLD", versión 1-M', () => {
  const datos = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(restoReedSolomon(datos, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('el formato de nivel M con la máscara 0 es el valor publicado (101010000010010)', () => {
  assert.equal(bitsDeFormato(0).toString(2).padStart(15, '0'), '101010000010010');
});

// Capacidad en bytes (modo byte, nivel M) y palabras de código totales de cada versión, de la norma.
const CAPACIDAD = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
const PALABRAS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

test('cada versión entra justo hasta su capacidad y la siguiente toma el relevo', () => {
  CAPACIDAD.forEach((capacidad, i) => {
    assert.equal(elegirVersion(capacidad), i + 1, `${capacidad} bytes`);
    if (i < CAPACIDAD.length - 1) assert.equal(elegirVersion(capacidad + 1), i + 2, `${capacidad + 1} bytes`);
  });
  assert.throws(() => elegirVersion(214), /no entra/);
});

test('los bloques de cada versión suman las palabras de código de la norma, y los módulos de datos cuadran', () => {
  CAPACIDAD.forEach((capacidad, i) => {
    const version = i + 1;
    const [ec, grupos] = estructuraDeBloques(version);
    const bloques = grupos.reduce((s, [n]) => s + n, 0);
    const datos = grupos.reduce((s, [n, d]) => s + n * d, 0);
    assert.equal(datos + bloques * ec, PALABRAS[i], `v${version}: palabras de código`);
    const qr = crearQr('x'.repeat(capacidad));
    assert.equal(qr.version, version);
    const libres = qr.funcionales.flat().filter((f) => !f).length;
    assert.equal(libres, PALABRAS[i] * 8 + bitsSobrantes(version), `v${version}: módulos libres`);
  });
});

/* ---------- Lectura de vuelta, escrita aparte del codificador ---------- */

// Las ocho máscaras tal como las define la norma, con (fila, columna).
const MASCARA = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

function leerFormato(m) {
  const n = m.length;
  const b = (fila, col) => (m[fila][col] ? 1 : 0);
  // Copia 1, alrededor del finder superior izquierdo, y copia 2, repartida entre los otros dos.
  const copia1 = [b(0, 8), b(1, 8), b(2, 8), b(3, 8), b(4, 8), b(5, 8), b(7, 8), b(8, 8), b(8, 7), b(8, 5), b(8, 4), b(8, 3), b(8, 2), b(8, 1), b(8, 0)];
  const copia2 = [b(8, n - 1), b(8, n - 2), b(8, n - 3), b(8, n - 4), b(8, n - 5), b(8, n - 6), b(8, n - 7), b(8, n - 8), b(n - 7, 8), b(n - 6, 8), b(n - 5, 8), b(n - 4, 8), b(n - 3, 8), b(n - 2, 8), b(n - 1, 8)];
  const valor = (bits) => bits.reduce((s, x, k) => s | (x << k), 0);
  return [valor(copia1), valor(copia2)];
}

function bchDeFormatoEsCero(valor) {
  let resto = valor ^ 0x5412;
  for (let i = 14; i >= 10; i--) if ((resto >>> i) & 1) resto ^= 0x537 << (i - 10);
  return resto === 0;
}

/** Los módulos de datos en el orden de lectura de la norma (zigzag), desenmascarados. */
function leerPalabras(qr, mascara) {
  const { tamano: n, modulos: m, funcionales: f } = qr;
  const bits = [];
  let sube = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let paso = 0; paso < n; paso++) {
      const fila = sube ? n - 1 - paso : paso;
      for (const c of [col, col - 1]) {
        if (f[fila][c]) continue;
        bits.push(m[fila][c] !== MASCARA[mascara](fila, c));
      }
    }
    sube = !sube;
  }
  const palabras = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) palabras.push(bits.slice(i, i + 8).reduce((s, x) => (s << 1) | (x ? 1 : 0), 0));
  return palabras;
}

function decodificar(qr) {
  const [copia1, copia2] = leerFormato(qr.modulos);
  assert.equal(copia1, copia2, 'las dos copias del formato tienen que coincidir');
  assert.ok(bchDeFormatoEsCero(copia1), 'el formato tiene que ser un código BCH válido');
  const formato = copia1 ^ 0x5412;
  assert.equal(formato >>> 13, 0, 'nivel de corrección M (00)');
  const mascara = (formato >>> 10) & 7;
  assert.equal(mascara, qr.mascara);

  const [ec, grupos] = estructuraDeBloques(qr.version);
  const largos = grupos.flatMap(([n, d]) => new Array(n).fill(d));
  const palabras = leerPalabras(qr, mascara);
  // Desentrelaza: primero los datos, columna a columna; después la corrección.
  const bloques = largos.map(() => ({ datos: [], ec: [] }));
  let k = 0;
  for (let i = 0; i < Math.max(...largos); i++) for (let b = 0; b < bloques.length; b++) if (i < largos[b]) bloques[b].datos.push(palabras[k++]);
  for (let i = 0; i < ec; i++) for (const b of bloques) b.ec.push(palabras[k++]);
  for (const [i, b] of bloques.entries()) assert.deepEqual(restoReedSolomon(b.datos, ec), b.ec, `bloque ${i}: la corrección no cuadra`);

  const datos = bloques.flatMap((b) => b.datos);
  const bits = datos.map((x) => x.toString(2).padStart(8, '0')).join('');
  assert.equal(bits.slice(0, 4), '0100', 'modo byte');
  const largoConteo = qr.version <= 9 ? 8 : 16;
  const largo = parseInt(bits.slice(4, 4 + largoConteo), 2);
  const bytes = [];
  for (let i = 0; i < largo; i++) bytes.push(parseInt(bits.slice(4 + largoConteo + 8 * i, 12 + largoConteo + 8 * i), 2));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

const TEXTOS = [
  'https://app-semillero.vercel.app/consultas',
  'a',
  'https://forms.gle/AbC123',
  'Básquet Newell\'s · ñandú ✓',
  'x'.repeat(100),
  `https://app-semillero.vercel.app/${'a'.repeat(150)}`,
  'x'.repeat(213),
];

for (const texto of TEXTOS) {
  test(`lee de vuelta el QR de "${texto.slice(0, 32)}${texto.length > 32 ? '…' : ''}" (${new TextEncoder().encode(texto).length} bytes)`, () => {
    const qr = crearQr(texto);
    assert.equal(qr.tamano, 17 + 4 * qr.version);
    assert.equal(decodificar(qr), texto);
  });
}

test('los patrones fijos están donde van: ubicación, sincronía, módulo oscuro y alineación', () => {
  const qr = crearQr('https://app-semillero.vercel.app/consultas');
  const { modulos: m, tamano: n } = qr;
  const finder = (f0, c0) => {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const borde = i === 0 || i === 6 || j === 0 || j === 6;
      const centro = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      assert.equal(m[f0 + i][c0 + j], borde || centro, `finder (${f0},${c0}) en (${i},${j})`);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { assert.equal(m[6][i], i % 2 === 0); assert.equal(m[i][6], i % 2 === 0); }
  assert.equal(m[n - 8][8], true, 'módulo oscuro fijo');
  if (qr.version >= 2) {
    const c = n - 7; // centro del patrón de alineación de las versiones 2 a 6
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) assert.equal(m[c + dy][c + dx], Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
});

test('es determinista: el mismo texto da la misma matriz', () => {
  assert.deepEqual(crearQr('https://x.test/a').modulos, crearQr('https://x.test/a').modulos);
});

test('un texto vacío o demasiado largo no se codifica en silencio', () => {
  assert.equal(decodificar(crearQr('')), '');
  assert.throws(() => crearQr('x'.repeat(214)), /no entra/);
});
