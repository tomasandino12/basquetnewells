/**
 * Lector mínimo de .glb para la copa: un mallado con primitivas (una por material) con POSITION, NORMAL, UV opcional
 * e índices. No es un GLTFLoader (three no trae los loaders en el build vendorizado y la copa sólo necesita esto):
 * lo escribe scripts/copa-arbb/malla.py y lo lee este archivo, sin texturas, cámaras ni animaciones.
 */

const COMPONENTES = { SCALAR: 1, VEC2: 2, VEC3: 3 };
const TIPOS = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

/** Parte un .glb ya descargado en su JSON y su trozo binario. */
export function partirGlb(buffer) {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('No es un .glb');
  const largo = dv.getUint32(8, true);
  let off = 12;
  let json = null;
  let binario = null;
  while (off < largo) {
    const n = dv.getUint32(off, true);
    const tipo = dv.getUint32(off + 4, true);
    const ini = off + 8;
    if (tipo === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, ini, n)));
    else if (tipo === 0x004e4942) binario = { buffer, ini, largo: n };
    off = ini + n;
  }
  if (!json || !binario) throw new Error('.glb incompleto');
  return { json, binario };
}

/** Los datos de un accessor como TypedArray (una copia: la vista original no está alineada para todos los tipos). */
function leerAccessor({ json, binario }, i) {
  const a = json.accessors[i];
  const vista = json.bufferViews[a.bufferView];
  const Tipo = TIPOS[a.componentType];
  const n = a.count * COMPONENTES[a.type];
  const desde = binario.ini + (vista.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new Tipo(binario.buffer.slice(desde, desde + n * Tipo.BYTES_PER_ELEMENT));
}

/**
 * Baja el .glb y devuelve { [nombre del material]: BufferGeometry } con las normales ya calculadas por el script
 * (suaves y con la malla soldada: lo que haría computeVertexNormals, pero sin partir el sombreado en las costuras de
 * UV). Si el archivo no trae normales, las calcula three.
 */
export async function cargarGlb(THREE, url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No se pudo bajar ${url}`);
  const glb = partirGlb(await resp.arrayBuffer());
  const geometrias = {};
  for (const prim of glb.json.meshes[0].primitives) {
    const g = new THREE.BufferGeometry();
    const at = prim.attributes;
    g.setAttribute('position', new THREE.BufferAttribute(leerAccessor(glb, at.POSITION), 3));
    if (at.NORMAL !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(leerAccessor(glb, at.NORMAL), 3));
    if (at.TEXCOORD_0 !== undefined) g.setAttribute('uv', new THREE.BufferAttribute(leerAccessor(glb, at.TEXCOORD_0), 2));
    g.setIndex(new THREE.BufferAttribute(leerAccessor(glb, prim.indices), 1));
    if (at.NORMAL === undefined) g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    geometrias[glb.json.materials[prim.material].name] = g;
  }
  return geometrias;
}
