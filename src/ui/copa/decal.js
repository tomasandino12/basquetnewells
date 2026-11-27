/**
 * Un decal sobre una malla: la imagen se proyecta en línea recta (como el DecalGeometry de three) sobre los
 * triángulos que mira el proyector, recortándolos contra una caja. El resultado es una geometría nueva que
 * calza con la superficie real de la malla (con sus curvas) y se separa de ella `separacion` a lo largo de la
 * normal, para que no pelee en profundidad. UV = posición dentro de la caja, así la imagen sale con su forma
 * y sus colores, sin estirarse.
 *
 * Es la misma idea que three/examples/jsm/geometries/DecalGeometry.js, pero sin traer ese archivo (no está en el
 * build vendorizado de three) y simplificada a lo que la copa necesita: el proyector mira siempre a lo largo de -z,
 * desde el frente, y las coordenadas son las de la malla (sin matrices).
 */

const PLANOS = [
  // [eje, signo]: dentro cuando signo * (coordenada - centro) <= semiancho
  [0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1],
];

/** Recorta un polígono (lista de { p: [x,y,z], n: [x,y,z] }) contra un semiespacio; interpola posición y normal. */
function recortar(poligono, eje, signo, limite) {
  const dentro = (v) => signo * v.p[eje] <= limite;
  const salida = [];
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i];
    const b = poligono[(i + 1) % poligono.length];
    const da = dentro(a);
    const db = dentro(b);
    if (da) salida.push(a);
    if (da !== db) {
      const t = (limite - signo * a.p[eje]) / (signo * (b.p[eje] - a.p[eje]));
      salida.push({
        p: a.p.map((x, k) => x + (b.p[k] - x) * t),
        n: a.n.map((x, k) => x + (b.n[k] - x) * t),
      });
    }
  }
  return salida;
}

/**
 * @param {typeof import('three')} THREE
 * @param {THREE.BufferGeometry} geometria  indexada, con normales
 * @param {{ centro: [number, number, number], ancho: number, alto: number, profundidad: number, separacion?: number }} caja
 *   `centro` es el medio de la caja de proyección; el decal cubre ancho × alto (x, y) y las superficies a menos de
 *   profundidad / 2 del centro en z que miran hacia +z.
 */
export function crearDecal(THREE, geometria, { centro, ancho, alto, profundidad, separacion = 0.01 }) {
  const pos = geometria.attributes.position;
  const nor = geometria.attributes.normal;
  const idx = geometria.index.array;
  const semi = [ancho / 2, alto / 2, profundidad / 2];
  const posiciones = [];
  const normales = [];
  const uvs = [];
  for (let t = 0; t < idx.length; t += 3) {
    let poligono = [0, 1, 2].map((k) => {
      const i = idx[t + k];
      return {
        p: [pos.getX(i) - centro[0], pos.getY(i) - centro[1], pos.getZ(i) - centro[2]],
        n: [nor.getX(i), nor.getY(i), nor.getZ(i)],
      };
    });
    // Sólo las caras que miran al proyector (la pared de adentro del cáliz mira para el otro lado).
    const [a, b, c] = poligono.map((v) => v.p);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    if (e1[0] * e2[1] - e1[1] * e2[0] <= 0) continue; // la z del producto cruz: > 0 mira a +z
    for (const [eje, signo] of PLANOS) {
      poligono = recortar(poligono, eje, signo, semi[eje]);
      if (poligono.length < 3) break;
    }
    if (poligono.length < 3) continue;
    for (let k = 1; k < poligono.length - 1; k++) {
      for (const v of [poligono[0], poligono[k], poligono[k + 1]]) {
        const l = Math.hypot(...v.n) || 1;
        const n = v.n.map((x) => x / l);
        posiciones.push(
          v.p[0] + centro[0] + n[0] * separacion,
          v.p[1] + centro[1] + n[1] * separacion,
          v.p[2] + centro[2] + n[2] * separacion,
        );
        normales.push(n[0], n[1], n[2]);
        uvs.push(v.p[0] / ancho + 0.5, v.p[1] / alto + 0.5);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return g;
}
