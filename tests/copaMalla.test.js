import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MALLA } from '../src/data/copaMalla.js';
import { COPA } from '../src/data/copaMedidas.js';
import { partirGlb } from '../src/ui/copa/glb.js';
import { crearDecal } from '../src/ui/copa/decal.js';
import { leerRgbe } from '../src/ui/copa/rgbe.js';

/**
 * La malla de la copa (public/img/historia/copa-arbb.glb), lo que se midió de ella (src/data/copaMalla.js) y los
 * tres lectores que la usan. Los archivos los deja scripts/copa-arbb/{malla,texturas,hdri}.py: si alguno se
 * regenera y se pasa de peso, de triángulos o de medidas, falla acá.
 */

const buffer = (ruta) => {
  const b = readFileSync(ruta);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const TIPOS = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const COMP = { SCALAR: 1, VEC2: 2, VEC3: 3 };
function accessor(glb, i) {
  const a = glb.json.accessors[i];
  const v = glb.json.bufferViews[a.bufferView];
  const T = TIPOS[a.componentType];
  const desde = glb.binario.ini + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new T(glb.binario.buffer.slice(desde, desde + a.count * COMP[a.type] * T.BYTES_PER_ELEMENT));
}

const glb = partirGlb(buffer('public/img/historia/copa-arbb.glb'));
const prims = Object.fromEntries(glb.json.meshes[0].primitives.map((p) => [glb.json.materials[p.material].name, p]));

test('la malla trae tres piezas, menos de 30.000 triángulos y sin textura horneada', () => {
  assert.deepEqual(Object.keys(prims), ['cromo', 'bronce', 'madera']);
  assert.equal(glb.json.images, undefined, 'la textura del muestrario no va');
  assert.equal(glb.json.textures, undefined);
  const tris = Object.values(prims).reduce((n, p) => n + glb.json.accessors[p.indices].count / 3, 0);
  assert.equal(tris, MALLA.triangulos);
  assert.ok(tris >= 25000 && tris < 30000, `${tris} triángulos`);
  assert.ok(readFileSync('public/img/historia/copa-arbb.glb').length < 700 * 1024);
  // Normales en todas; UV sólo donde hay textura (la madera y el grano del bronce), el cromo no.
  for (const p of Object.values(prims)) assert.ok(p.attributes.NORMAL !== undefined);
  assert.equal(prims.cromo.attributes.TEXCOORD_0, undefined);
  assert.ok(prims.madera.attributes.TEXCOORD_0 !== undefined && prims.bronce.attributes.TEXCOORD_0 !== undefined);
});

test('la malla está en las unidades de la foto: boca en 9,26, fondo de la base en -0,23, eje en el origen', () => {
  const pos = Object.values(prims).map((p) => accessor(glb, p.attributes.POSITION));
  let ymin = Infinity;
  let ymax = -Infinity;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (const a of pos) {
    for (let i = 0; i < a.length; i += 3) {
      xmin = Math.min(xmin, a[i]);
      xmax = Math.max(xmax, a[i]);
      ymin = Math.min(ymin, a[i + 1]);
      ymax = Math.max(ymax, a[i + 1]);
    }
  }
  assert.ok(Math.abs(ymax - COPA.metal[0][1]) < 0.01, `boca en ${ymax}`);
  assert.ok(Math.abs(ymin - -0.23) < 0.01, `fondo en ${ymin}`);
  assert.equal(MALLA.alto, 9.49);
  assert.ok(Math.abs(xmax + xmin) < 0.05, 'las asas quedan simétricas respecto del eje');
  assert.ok(Math.abs(xmax - xmin - MALLA.anchoAsas) < 0.01);
});

test('el tambor medido es el de la malla: un cilindro liso donde caben las 16 placas', () => {
  const pos = accessor(glb, prims.madera.attributes.POSITION);
  const radios = [];
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1];
    if (y > MALLA.tambor.abajo + 0.05 && y < MALLA.tambor.arriba - 0.05) radios.push(Math.hypot(pos[i], pos[i + 2]));
  }
  assert.ok(radios.length > 300, 'el tambor tiene vértices');
  radios.sort((a, b) => a - b);
  // Liso: sin la chapita del dorso que esculpió el generador (si no, las placas flotarían sobre un bulto).
  assert.ok(radios[radios.length - 1] - radios[0] < 0.06, `relieve de ${radios[radios.length - 1] - radios[0]}`);
  assert.ok(Math.abs(radios[radios.length >> 1] - MALLA.tambor.radio) < 0.03);
  const alto = MALLA.tambor.arriba - MALLA.tambor.abajo;
  assert.ok(alto > 1.1 && alto < 1.6, `el tambor mide ${alto} de alto`);
  // El escudo va donde estaba el esculpido: en el cáliz, por encima del tambor y de la base.
  assert.ok(MALLA.escudo.abajo > MALLA.tambor.arriba + 3 && MALLA.escudo.arriba < COPA.metal[0][1]);
});

test('el HDRI de estudio se lee entero: 1024 × 512, con luces fuertes, sin pozos negros y la fila de abajo primero', () => {
  const { ancho, alto, datos } = leerRgbe(buffer('public/img/historia/estudio.hdr'));
  assert.equal(ancho, 1024);
  assert.equal(alto, 512);
  assert.equal(datos.length, 1024 * 512 * 4);
  let pico = 0;
  for (let i = 0; i < datos.length; i += 4) pico = Math.max(pico, datos[i]);
  assert.ok(pico > 100, 'las luces del estudio pasan de 1');
  assert.ok(readFileSync('public/img/historia/estudio.hdr').length < 1500 * 1024);
  // Ningún ángulo refleja negro puro (las vetas finas entre paneles son gris oscuro, no #000): el cromo es un espejo y un pozo negro se ve como un manchón.
  let oscuro = Infinity;
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) oscuro = Math.min(oscuro, datos[(y * ancho + x) * 4 + 1]);
  assert.ok(oscuro > 0.03, `el punto más oscuro del estudio vale ${oscuro}`);
  const media = (desde, hasta) => {
    let s = 0;
    for (let y = desde; y < hasta; y++) for (let x = 0; x < ancho; x++) s += datos[(y * ancho + x) * 4 + 1];
    return s / ((hasta - desde) * ancho);
  };
  // El piso del estudio es gris claro y el cielo, negro: con la fila de abajo primero, el piso queda en las filas bajas.
  assert.ok(media(0, 80) > media(alto - 80, alto) * 1.5, 'el piso está en las primeras filas');
});

// Un THREE de mentira: el decal sólo necesita crear una geometría con tres atributos.
const THREE_FALSO = {
  BufferGeometry: class {
    constructor() { this.attributes = {}; }
    setAttribute(n, a) { this.attributes[n] = a; }
  },
  Float32BufferAttribute: class {
    constructor(arr, n) { this.array = new Float32Array(arr); this.itemSize = n; }
  },
};
function geometria(posiciones, indices, normal) {
  const attr = (arr, n) => ({
    array: arr,
    getX: (i) => arr[i * n], getY: (i) => arr[i * n + 1], getZ: (i) => arr[i * n + 2],
  });
  const normales = [];
  for (let i = 0; i < posiciones.length / 3; i++) normales.push(...normal);
  return { attributes: { position: attr(posiciones, 3), normal: attr(normales, 3) }, index: { array: indices } };
}
const area = (g) => {
  const p = g.attributes.position.array;
  let total = 0;
  for (let i = 0; i < p.length; i += 9) {
    const [ax, ay] = [p[i + 3] - p[i], p[i + 4] - p[i + 1]];
    const [bx, by] = [p[i + 6] - p[i], p[i + 7] - p[i + 1]];
    total += Math.abs(ax * by - ay * bx) / 2;
  }
  return total;
};

test('el decal recorta la pared que mira al frente contra la caja y saca las UV de la posición', () => {
  // Una pared de 4 × 4 a z = 1 que mira a +z (antihorario visto desde +z).
  const pared = geometria([-2, -2, 1, 2, -2, 1, 2, 2, 1, -2, 2, 1], new Uint16Array([0, 1, 2, 0, 2, 3]), [0, 0, 1]);
  const d = crearDecal(THREE_FALSO, pared, { centro: [0, 0, 1], ancho: 2, alto: 2, profundidad: 0.8, separacion: 0.01 });
  assert.ok(Math.abs(area(d) - 4) < 1e-6, 'cubre justo la caja de 2 × 2');
  const uv = d.attributes.uv.array;
  assert.ok(uv.every((v) => v >= -1e-9 && v <= 1 + 1e-9), 'las UV quedan en 0..1');
  assert.ok(Math.min(...uv) < 1e-6 && Math.max(...uv) > 1 - 1e-6, 'la imagen entera, de borde a borde');
  const z = d.attributes.position.array.filter((_, i) => i % 3 === 2);
  assert.ok(z.every((v) => Math.abs(v - 1.01) < 1e-6), 'separada 0,01 sobre la pared');

  // La pared de atrás (mira a -z, mismo lugar en x e y) y lo que queda fuera de la caja en z no entran.
  const dorso = geometria([-2, -2, 1, -2, 2, 1, 2, 2, 1], new Uint16Array([0, 1, 2]), [0, 0, -1]);
  assert.equal(crearDecal(THREE_FALSO, dorso, { centro: [0, 0, 1], ancho: 2, alto: 2, profundidad: 0.8 }).attributes.position.array.length, 0);
  const lejos = geometria([-2, -2, 3, 2, -2, 3, 2, 2, 3], new Uint16Array([0, 1, 2]), [0, 0, 1]);
  assert.equal(crearDecal(THREE_FALSO, lejos, { centro: [0, 0, 1], ancho: 2, alto: 2, profundidad: 0.8 }).attributes.position.array.length, 0);
});
