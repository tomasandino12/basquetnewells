/*
 * Codificador de códigos QR, sin dependencias. Lo usa scripts/cartel-qr.mjs
 * para el cartel que se imprime; no forma parte de la app.
 *
 * Alcance a propósito acotado: QR modelo 2, modo byte (UTF-8), corrección de
 * errores nivel M (recupera ~15 % de daño, lo razonable para papel pegado en
 * una pared) y versiones 1 a 10 (hasta 213 bytes: de sobra para una URL).
 * Algoritmo de ISO/IEC 18004; las tablas de bloques de nivel M se comprueban
 * contra los totales de palabras de código de cada versión.
 * tests/qr.test.js lee la matriz de vuelta y verifica formato, Reed-Solomon y
 * texto, y compara contra un decodificador externo cuando hay uno.
 */

// Por versión: [palabras de corrección por bloque, [[cantidad de bloques, palabras de datos por bloque], ...]].
const BLOQUES_M = [
  null,
  [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]],
  [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]],
];
// Centros de los patrones de alineación (fila y columna), por versión.
const ALINEACION = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
// Bits sobrantes después de las palabras de código: 0 en la versión 1, 7 de la 2 a la 6, 0 de la 7 a la 10.
const BITS_SOBRANTES = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0];
const VERSION_MAXIMA = 10;

/* ---------- Campo de Galois GF(256), polinomio 0x11D ---------- */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const multiplicar = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** Polinomio generador de grado n, de mayor a menor potencia (el primero es 1). */
function generador(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const siguiente = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      siguiente[j] ^= g[j];
      siguiente[j + 1] ^= multiplicar(g[j], EXP[i]);
    }
    g = siguiente;
  }
  return g;
}

/** Resto de dividir (datos · x^n) por el generador: las n palabras de corrección. */
export function restoReedSolomon(datos, n) {
  const g = generador(n);
  const resto = new Array(n).fill(0);
  for (const d of datos) {
    const factor = d ^ resto[0];
    resto.shift();
    resto.push(0);
    if (factor) for (let i = 0; i < n; i++) resto[i] ^= multiplicar(g[i + 1], factor);
  }
  return resto;
}

/* ---------- Capacidad y codificación de los datos ---------- */

const totalDatos = (version) => BLOQUES_M[version][1].reduce((s, [n, d]) => s + n * d, 0);
const bitsDelConteo = (version) => (version <= 9 ? 8 : 16);

export function elegirVersion(largoBytes) {
  for (let v = 1; v <= VERSION_MAXIMA; v++) {
    if (4 + bitsDelConteo(v) + 8 * largoBytes <= 8 * totalDatos(v)) return v;
  }
  throw new Error(`El texto (${largoBytes} bytes) no entra en un QR de versión ${VERSION_MAXIMA}, nivel M.`);
}

function palabrasDeDatos(bytes, version) {
  const bits = [];
  const poner = (valor, cantidad) => { for (let i = cantidad - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
  poner(0b0100, 4); // modo byte
  poner(bytes.length, bitsDelConteo(version));
  for (const b of bytes) poner(b, 8);
  const capacidad = totalDatos(version) * 8;
  poner(0, Math.min(4, capacidad - bits.length)); // terminador
  while (bits.length % 8) bits.push(0);
  for (let relleno = 0xec; bits.length < capacidad; relleno = relleno === 0xec ? 0x11 : 0xec) poner(relleno, 8);
  const palabras = [];
  for (let i = 0; i < bits.length; i += 8) palabras.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  return palabras;
}

/** Parte los datos en bloques, calcula la corrección de cada uno y los entrelaza. */
function palabrasDeCodigo(datos, version) {
  const [ecPorBloque, grupos] = BLOQUES_M[version];
  const bloques = [];
  let desde = 0;
  for (const [cantidad, tamano] of grupos) {
    for (let i = 0; i < cantidad; i++) {
      const parte = datos.slice(desde, desde + tamano);
      desde += tamano;
      bloques.push({ datos: parte, ec: restoReedSolomon(parte, ecPorBloque) });
    }
  }
  const salida = [];
  const mayor = Math.max(...bloques.map((b) => b.datos.length));
  for (let i = 0; i < mayor; i++) for (const b of bloques) if (i < b.datos.length) salida.push(b.datos[i]);
  for (let i = 0; i < ecPorBloque; i++) for (const b of bloques) salida.push(b.ec[i]);
  return salida;
}

/* ---------- La matriz ---------- */

const bit = (valor, i) => ((valor >>> i) & 1) !== 0;

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0,
  (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
];

/** Los 15 bits de formato (nivel M = 00) más la máscara, con su BCH y el XOR 0x5412. */
export function bitsDeFormato(mascara) {
  const datos = (0b00 << 3) | mascara;
  let resto = datos;
  for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  return ((datos << 10) | resto) ^ 0x5412;
}

/**
 * Arma los módulos del QR. Devuelve { version, tamano, modulos, funcionales },
 * donde modulos[y][x] es true si el módulo es oscuro y funcionales[y][x] marca
 * los que no llevan datos (patrones de ubicación, sincronía, formato...).
 */
export function crearQr(texto) {
  const bytes = [...new TextEncoder().encode(texto)];
  const version = elegirVersion(bytes.length);
  const tamano = 17 + 4 * version;
  const modulos = Array.from({ length: tamano }, () => new Array(tamano).fill(false));
  const funcionales = Array.from({ length: tamano }, () => new Array(tamano).fill(false));
  const fijar = (x, y, oscuro) => { modulos[y][x] = oscuro; funcionales[y][x] = true; };

  // Sincronía, ubicación (con su separador) y alineación.
  for (let i = 0; i < tamano; i++) { fijar(6, i, i % 2 === 0); fijar(i, 6, i % 2 === 0); }
  const ubicacion = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distancia = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx; const y = cy + dy;
        if (x >= 0 && x < tamano && y >= 0 && y < tamano) fijar(x, y, distancia !== 2 && distancia !== 4);
      }
    }
  };
  ubicacion(3, 3); ubicacion(tamano - 4, 3); ubicacion(3, tamano - 4);
  const centros = ALINEACION[version];
  for (let i = 0; i < centros.length; i++) {
    for (let j = 0; j < centros.length; j++) {
      const esquina = (i === 0 && j === 0) || (i === 0 && j === centros.length - 1) || (i === centros.length - 1 && j === 0);
      if (esquina) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fijar(centros[i] + dx, centros[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  const dibujarFormato = (mascara) => {
    const bits = bitsDeFormato(mascara);
    for (let i = 0; i <= 5; i++) fijar(8, i, bit(bits, i));
    fijar(8, 7, bit(bits, 6)); fijar(8, 8, bit(bits, 7)); fijar(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) fijar(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) fijar(tamano - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) fijar(8, tamano - 15 + i, bit(bits, i));
    fijar(8, tamano - 8, true); // el módulo oscuro fijo
  };
  dibujarFormato(0); // reserva el lugar; se vuelve a dibujar con la máscara elegida

  if (version >= 7) {
    let resto = version;
    for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
    const bits = (version << 12) | resto;
    for (let i = 0; i < 18; i++) {
      const a = tamano - 11 + (i % 3); const b = Math.floor(i / 3);
      fijar(a, b, bit(bits, i)); fijar(b, a, bit(bits, i));
    }
  }

  // Palabras de código, en zigzag de a dos columnas desde abajo a la derecha.
  const codigo = palabrasDeCodigo(palabrasDeDatos(bytes, version), version);
  let i = 0;
  for (let derecha = tamano - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5;
    for (let vertical = 0; vertical < tamano; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = derecha - j;
        const haciaArriba = ((derecha + 1) & 2) === 0;
        const y = haciaArriba ? tamano - 1 - vertical : vertical;
        if (!funcionales[y][x] && i < codigo.length * 8 + BITS_SOBRANTES[version]) {
          modulos[y][x] = i < codigo.length * 8 ? bit(codigo[i >>> 3], 7 - (i & 7)) : false;
          i++;
        }
      }
    }
  }

  // Elige la máscara de menor penalidad.
  const aplicar = (mascara) => {
    for (let y = 0; y < tamano; y++) for (let x = 0; x < tamano; x++) if (!funcionales[y][x] && MASCARAS[mascara](x, y)) modulos[y][x] = !modulos[y][x];
  };
  let mejor = 0; let menor = Infinity;
  for (let m = 0; m < 8; m++) {
    aplicar(m); dibujarFormato(m);
    const penalidad = penalidadDe(modulos);
    if (penalidad < menor) { menor = penalidad; mejor = m; }
    aplicar(m); // deshace
  }
  aplicar(mejor); dibujarFormato(mejor);
  return { version, tamano, modulos, funcionales, mascara: mejor };
}

/** Penalidad de ISO/IEC 18004 §7.8.3: rachas, bloques de 2x2, falsos patrones de ubicación y balance. */
function penalidadDe(m) {
  const n = m.length;
  let total = 0;
  for (const esFila of [true, false]) {
    for (let a = 0; a < n; a++) {
      let racha = 1;
      const valor = (b) => (esFila ? m[a][b] : m[b][a]);
      for (let b = 1; b < n; b++) {
        if (valor(b) === valor(b - 1)) { racha++; if (racha === 5) total += 3; else if (racha > 5) total += 1; } else racha = 1;
      }
      for (let b = 0; b + 11 <= n; b++) {
        const ventana = Array.from({ length: 11 }, (_, k) => (valor(b + k) ? 1 : 0)).join('');
        if (ventana === '10111010000' || ventana === '00001011101') total += 40;
      }
    }
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) total += 3;
  const oscuros = m.reduce((s, fila) => s + fila.filter(Boolean).length, 0);
  total += (Math.ceil(Math.abs(oscuros * 20 - n * n * 10) / (n * n)) - 1) * 10;
  return total;
}

/** [palabras de corrección por bloque, [[bloques, palabras de datos por bloque], ...]] de una versión, nivel M. */
export const estructuraDeBloques = (version) => BLOQUES_M[version];
/** Bits sobrantes después de las palabras de código de una versión. */
export const bitsSobrantes = (version) => BITS_SOBRANTES[version];
