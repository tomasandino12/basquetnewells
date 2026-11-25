import * as THREE from '/public/vendor/three/three.module.min.js';
import { OrbitControls } from '/public/vendor/three/OrbitControls.js';
import { RoomEnvironment } from '/public/vendor/three/RoomEnvironment.js';

/**
 * La medalla oficial de la Asociación Rosarina en 3D, en su propio visor (sección de cierre de
 * "Nuestra historia"). Tiene renderer, escena y bucle propios, porque va en un lugar distinto de la
 * página que la copa; src/ui/historia.js la trae con `import()` recién cuando la sección se acerca.
 * No importa nada de la UI ni de vitrina3d.js.
 *
 * Es una pieza de peltre o plata envejecida con los bajorrelieves oscurecidos:
 *  - Cuerpo: un disco con bisel perimetral y una ojuela de arriba, trapezoidal con las esquinas
 *    redondeadas, FUNDIDA en la misma silueta (una sola extrusión), con un hueco oblongo. Es de peltre
 *    liso (#9E9B93) con un grano fino: el canto, la ojuela y el aro comparten ese color.
 *  - Cada cara lleva encima un disco con la foto de la medalla (public/img/historia/medalla-frente.webp
 *    y medalla-dorso.webp, 1024×1024, recortadas del disco sin ojuela ni cinta). Del mismo archivo salen el
 *    `bumpMap` (la luminancia) y el `roughnessMap` (invertido: la pátina oscura es más rugosa y el relieve
 *    claro, más pulido), así la luz reacciona sobre cada letra, espiga y poro de la pelota.
 *  - Los dos discos son planos: el dorso es bajorrelieve igual que el frente, sin domo.
 *  - Cinta roja y azul oscuro, de trama fina (grosgrain), en lazo: pasa por el hueco y sube por delante
 *    y por detrás de la ojuela.
 *
 * Interacción: arrastrar gira 360° en horizontal (OrbitControls con la altura fija y el azimut sin
 * límites), y al tocarla la medalla se balancea como un péndulo colgado de la cinta. Con
 * `prefers-reduced-motion` no hay balanceo. `touch-action: pan-y`: el dedo vertical sigue siendo scroll.
 * El renderer sólo dibuja mientras el visor está en pantalla (y sólo mientras algo se mueve).
 */

const TAU = Math.PI * 2;
const grados = (g) => (g * Math.PI) / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// ---------------------------------------------------------------------------
// Medidas del modelo (unidades de la escena; el disco mide 3 de diámetro, centrado en el origen)
// ---------------------------------------------------------------------------
const R = 1.5; // radio del disco (con el bisel)
const GROSOR = 0.07; // de cara a cara, sin los biseles
const BISEL = 0.03; // cuánto sobresale y cuánto redondea el canto
const TAB = { base: 0.76, tope: 0.64, y: 1.99, esquina: 0.07 }; // la ojuela: medio ancho en la base y arriba, altura y radio de las esquinas
const HUECO = { y: 1.67, hx: 0.53, hy: 0.15, r: 0.04 }; // el hueco oblongo para la cinta
const Y_MIN = -R;
const Y_MAX = TAB.y;
const R_CARA = R - BISEL; // el radio de la parte plana de cada cara: ahí va el disco con la foto
const Z_CARA = GROSOR / 2 + BISEL; // a qué altura queda esa parte plana
const PELTRE = 0x9e9b93; // plata vieja, un peltre cálido: el color del cuerpo, el aro y la ojuela
const BUMP_FOTO = 0.035; // el relieve de las fotos
const FOTOS = { frente: '/public/img/historia/medalla-frente.webp', dorso: '/public/img/historia/medalla-dorso.webp' };
const N = 1024; // lado de los mapas derivados de las fotos
const Y_PIVOTE = HUECO.y + 4.4; // de dónde cuelga todo
const ANCHO_CINTA = 0.96;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** ¿Hay WebGL? Se prueba con un canvas descartable, sin montar nada. */
export function hayWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const lienzo = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
};

/** Azar repetible: la pátina se ve igual en cada carga. */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function aTextura(canvas, { color = false, aniso = 4, repetir = null } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repetir) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repetir);
  }
  return t;
}

const cederPaso = () => new Promise((ok) => requestAnimationFrame(() => ok()));

// ---------------------------------------------------------------------------
// Texturas: la foto de cada cara (color) y lo que sale de ella (relieve y rugosidad)
// ---------------------------------------------------------------------------

/**
 * De la foto de una cara salen los otros dos mapas, en escala de grises: el relieve es la luminancia
 * (lo claro sobresale) y la rugosidad, su inversa: el fondo oscuro con pátina es rugoso (0,65 con el
 * multiplicador del material) y el relieve claro, más pulido (0,25).
 */
function mapasDeLaFoto(imagen) {
  const [, g] = lienzo(N, N);
  g.drawImage(imagen, 0, 0, N, N);
  const px = g.getImageData(0, 0, N, N).data;
  const [relieve, gr] = lienzo(N, N);
  const [rugosidad, gg] = lienzo(N, N);
  const bump = gr.createImageData(N, N);
  const rug = gg.createImageData(N, N);
  for (let i = 0; i < px.length; i += 4) {
    const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    const claro = clamp((lum - 0.16) / 0.6, 0, 1); // se estira el rango útil de la foto
    const v = 255 * (1 - 0.615 * claro); // 1 donde es oscuro → 0,65; 0,385 donde es claro → 0,25
    bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = lum * 255;
    rug.data[i] = rug.data[i + 1] = rug.data[i + 2] = v;
    bump.data[i + 3] = rug.data[i + 3] = 255;
  }
  gr.putImageData(bump, 0, 0);
  gg.putImageData(rug, 0, 0);
  return { relieve, rugosidad };
}

/** El grano del cuerpo liso: ruido fino y manchas suaves, que repite sin costuras (cada mancha se dibuja envuelta). */
function texturaGrano() {
  const S = 256;
  const [cv, g] = lienzo(S, S);
  const r = azar(7);
  const img = g.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 128 + (r() - 0.5) * 60;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 70; k++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 6 + r() * 26;
    const oscura = r() < 0.55;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        grad.addColorStop(0, oscura ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.14)');
        grad.addColorStop(1, 'rgba(128,128,128,0)');
        g.fillStyle = grad;
        g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      }
    }
  }
  return cv;
}

/** El canto: grano parejo, con un estriado fino. */
function texturaCanto() {
  const W = 256;
  const [cv, g] = lienzo(W, 64);
  const r = azar(3);
  const img = g.createImageData(W, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < W; x++) {
      const v = 172 * (x % 6 < 2 ? 0.78 : 1) + (r() - 0.5) * 34;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/** La cinta: roja y azul oscuro, partida al medio, de trama fina como un grosgrain (rayitas cruzadas y hilos a lo largo). */
function texturasCinta() {
  const W = 128;
  const [color, c] = lienzo(W, W);
  const [relieve, b] = lienzo(W, W);
  const r = azar(41);
  const img = c.createImageData(W, W);
  const bump = b.createImageData(W, W);
  const ROJO = [184, 29, 36]; // #B81D24
  const AZUL = [27, 42, 74]; // #1B2A4A
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const rojo = u < 0.58;
      const col = rojo ? ROJO : AZUL;
      const canal = 0.5 + 0.5 * Math.sin((y / 3) * TAU); // la trama: rayitas horizontales muy juntas, una cresta cada 3 px
      const hilo = (x % 3 === 0 ? 0.06 : 0) + (r() - 0.5) * 0.1; // los hilos de la urdimbre, a lo largo
      const costura = Math.abs(u - 0.58) < 0.012 ? 0.62 : 1; // el cambio de color
      const k = (0.8 + canal * 0.28 + hilo) * costura;
      const i = (y * W + x) * 4;
      img.data[i] = col[0] * k;
      img.data[i + 1] = col[1] * k;
      img.data[i + 2] = col[2] * k;
      img.data[i + 3] = 255;
      const alt = 118 + canal * 70 + hilo * 160;
      bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = alt;
      bump.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  b.putImageData(bump, 0, 0);
  return { color, relieve };
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

/**
 * La silueta de la medalla: el disco y la ojuela en UN solo contorno (así queda fundida, con sus filetes
 * cóncavos en la unión). `inset` la achica parejo: la extrusión suma el bisel por afuera, y el contorno
 * ya achicado deja el tamaño final en R.
 */
function silueta(inset = 0) {
  const r = R - inset;
  const wb = TAB.base - inset;
  const wt = TAB.tope - inset;
  const yt = TAB.y - inset;
  const rc = TAB.esquina;
  const yj = Math.sqrt(r * r - wb * wb); // donde el lado de la ojuela toca el círculo
  const xEn = (y) => wb + ((wt - wb) * (y - yj)) / (yt - yj);
  const yA = yj + 0.22;
  const thB = Math.atan2(yj, wb) - 0.21;
  const Bx = r * Math.cos(thB);
  const By = r * Math.sin(thB);
  const s = new THREE.Shape();
  s.moveTo(Bx, By);
  s.quadraticCurveTo(wb, yj, xEn(yA), yA);
  s.lineTo(wt, yt - rc);
  s.quadraticCurveTo(wt, yt, wt - rc, yt);
  s.lineTo(-wt + rc, yt);
  s.quadraticCurveTo(-wt, yt, -wt, yt - rc);
  s.lineTo(-xEn(yA), yA);
  s.quadraticCurveTo(-wb, yj, -Bx, By);
  s.absarc(0, 0, r, Math.PI - thB, thB + TAU, false);
  return s;
}

/** Un rectángulo de esquinas redondeadas (el hueco para la cinta). */
function huecoRedondeado(g) {
  const p = new THREE.Path();
  const { y, hx, hy, r } = { ...HUECO, hx: HUECO.hx + BISEL * 0.8, hy: HUECO.hy + BISEL * 0.8 };
  p.moveTo(-hx + r, y - hy);
  p.lineTo(hx - r, y - hy);
  p.absarc(hx - r, y - hy + r, r, -Math.PI / 2, 0, false);
  p.lineTo(hx, y + hy - r);
  p.absarc(hx - r, y + hy - r, r, 0, Math.PI / 2, false);
  p.lineTo(-hx + r, y + hy);
  p.absarc(-hx + r, y + hy - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(-hx, y - hy + r);
  p.absarc(-hx + r, y - hy + r, r, Math.PI, Math.PI * 1.5, false);
  g.holes.push(p);
}

/**
 * El cuerpo: una extrusión con el canto redondeado, partida en tres grupos de caras (frente, dorso
 * y canto/biseles) para darle a cada uno su material. Las UV de las caras salen de la posición (x, y)
 * y sólo sirven al grano del metal liso; las fotos van en discos aparte (ver `crearVisorMedalla`).
 */
function geometriaCuerpo() {
  const forma = silueta(BISEL);
  huecoRedondeado(forma);
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: GROSOR, bevelEnabled: true, bevelThickness: BISEL, bevelSize: BISEL, bevelSegments: 5, curveSegments: 40, steps: 1,
  });
  geo.translate(0, 0, -GROSOR / 2);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uvOrig = geo.attributes.uv;
  const [caras, lados] = [geo.groups.find((g) => g.materialIndex === 0), geo.groups.find((g) => g.materialIndex === 1)];
  const delanteras = [];
  const traseras = [];
  for (let i = caras.start; i < caras.start + caras.count; i += 3) (pos.getZ(i) > 0 ? delanteras : traseras).push(i);
  const total = delanteras.length * 3 + traseras.length * 3 + lados.count;
  const P = new Float32Array(total * 3);
  const Nn = new Float32Array(total * 3);
  const U = new Float32Array(total * 2);
  let k = 0;
  const copiar = (i, espejo) => {
    P[k * 3] = pos.getX(i);
    P[k * 3 + 1] = pos.getY(i);
    P[k * 3 + 2] = pos.getZ(i);
    Nn[k * 3] = nor.getX(i);
    Nn[k * 3 + 1] = nor.getY(i);
    Nn[k * 3 + 2] = nor.getZ(i);
    if (espejo === undefined) { U[k * 2] = uvOrig.getX(i); U[k * 2 + 1] = uvOrig.getY(i); } else {
      const u = (pos.getX(i) + R) / (2 * R);
      U[k * 2] = espejo ? 1 - u : u;
      U[k * 2 + 1] = (pos.getY(i) - Y_MIN) / (Y_MAX - Y_MIN);
    }
    k++;
  };
  const grupos = [];
  for (const [lista, espejo] of [[delanteras, false], [traseras, true]]) {
    const inicio = k;
    for (const i of lista) for (let j = 0; j < 3; j++) copiar(i + j, espejo);
    grupos.push([inicio, k - inicio]);
  }
  const inicioLados = k;
  for (let i = lados.start; i < lados.start + lados.count; i++) copiar(i, undefined);
  grupos.push([inicioLados, k - inicioLados]);
  const salida = new THREE.BufferGeometry();
  salida.setAttribute('position', new THREE.BufferAttribute(P, 3));
  salida.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  salida.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  grupos.forEach(([start, count], i) => salida.addGroup(start, count, i));
  geo.dispose();
  return salida;
}

/**
 * La cinta en lazo: baja por delante de la ojuela, da la vuelta por el hueco (apoyada en el borde de arriba
 * del hueco) y sube por detrás. Es una tira rígida, que se mueve con el péndulo. Las UV van a lo largo
 * (para el acanalado) y el dorso espeja el reparto de colores, como en la foto (el rojo queda a la izquierda).
 */
function geometriaCinta() {
  const ancho = ANCHO_CINTA / 2;
  const zf = 0.082; // a qué distancia de la cara va cada tramo
  const yTope = Y_PIVOTE;
  const yGiro = HUECO.y + HUECO.hy - 0.04; // el centro de la vuelta
  // El recorrido en (y, z): baja por delante, da media vuelta, sube por detrás.
  const recorrido = [];
  const TRAMO = 36;
  for (let i = 0; i <= TRAMO; i++) recorrido.push([yTope + ((yGiro - yTope) * i) / TRAMO, zf]);
  const VUELTA = 14;
  for (let i = 1; i < VUELTA; i++) {
    const a = (i / VUELTA) * Math.PI;
    recorrido.push([yGiro - Math.sin(a) * zf, Math.cos(a) * zf]);
  }
  for (let i = 0; i <= TRAMO; i++) recorrido.push([yGiro + ((yTope - yGiro) * i) / TRAMO, -zf]);
  const filas = recorrido.length;
  const pos = new Float32Array(filas * 2 * 3);
  const uv = new Float32Array(filas * 2 * 2);
  const idx = [];
  let largo = 0;
  recorrido.forEach(([y, z], i) => {
    if (i) largo += Math.hypot(y - recorrido[i - 1][0], z - recorrido[i - 1][1]);
    const atras = i > TRAMO + VUELTA - 1;
    for (let j = 0; j < 2; j++) {
      const n = i * 2 + j;
      pos.set([(j ? 1 : -1) * ancho, y, z], n * 3);
      uv.set([atras ? 1 - j : j, largo / ANCHO_CINTA], n * 2);
    }
    if (i < filas - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, largo };
}

// ---------------------------------------------------------------------------
// El visor
// ---------------------------------------------------------------------------

/**
 * Monta el visor de la medalla en `contenedor` (que tiene que tener alto) y devuelve su API una vez
 * dibujado el primer cuadro. Las texturas se arman en pasos, cediendo el hilo entre uno y otro.
 *
 * @param {HTMLElement} contenedor  donde van el canvas y el botón
 * @returns {Promise<{ canvas: HTMLCanvasElement, verOtraCara: () => void, destruir: () => void }>}
 */
export async function crearVisorMedalla(contenedor) {
  const mqReducido = matchMedia('(prefers-reduced-motion: reduce)');
  let reducido = mqReducido.matches;
  const alCambiarReducido = () => { reducido = mqReducido.matches; if (reducido) { theta = omega = 0; aplicarPendulo(); } pedirCuadro(); };
  mqReducido.addEventListener?.('change', alCambiarReducido);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0a0a0c, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  const canvas = renderer.domElement;
  canvas.className = 'medalla-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'La medalla de la Asociación Rosarina en 3D, colgando de su cinta roja y azul. Arrastrala para girarla; el botón alterna el frente y el dorso.');
  canvas.tabIndex = 0;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sala = new RoomEnvironment();
  const entorno = pmrem.fromScene(sala, 0.03);
  scene.environment = entorno.texture;
  scene.environmentIntensity = 0.62;

  const camara = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  scene.add(camara);
  // Las luces cuelgan de la cámara: miren de frente o de dorso, el relieve se ve con la misma luz.
  const luzClave = new THREE.DirectionalLight(0xfff1e0, 1.5);
  luzClave.position.set(-2.6, 3.2, 4.2);
  const luzRelleno = new THREE.DirectionalLight(0x9fb4ff, 0.45);
  luzRelleno.position.set(3.4, -1.2, 3.2);
  camara.add(luzClave, luzClave.target, luzRelleno, luzRelleno.target);
  luzClave.target.position.set(0, 0, -6);
  luzRelleno.target.position.set(0, 0, -6);

  // --- Las fotos de las dos caras; de cada una salen el relieve y la rugosidad. ---
  const cargador = new THREE.TextureLoader();
  const [fotoFrente, fotoDorso] = await Promise.all([cargador.loadAsync(FOTOS.frente), cargador.loadAsync(FOTOS.dorso)]);
  await cederPaso();
  const metalFoto = (foto) => {
    foto.colorSpace = THREE.SRGBColorSpace;
    foto.anisotropy = aniso;
    const { relieve, rugosidad } = mapasDeLaFoto(foto.image);
    return new THREE.MeshStandardMaterial({
      map: foto,
      bumpMap: aTextura(relieve, { aniso }),
      bumpScale: BUMP_FOTO,
      roughnessMap: aTextura(rugosidad, { aniso }),
      roughness: 0.65,
      metalness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  };
  const matFrente = metalFoto(fotoFrente);
  const matDorso = metalFoto(fotoDorso);

  // El cuerpo liso: aro, ojuela, canto y la base de las caras, todo del mismo peltre.
  const grano = aTextura(texturaGrano(), { aniso, repetir: [5, 5 * ((Y_MAX - Y_MIN) / (2 * R))] });
  const matCuerpo = new THREE.MeshStandardMaterial({ color: PELTRE, bumpMap: grano, bumpScale: 0.6, roughness: 0.46, metalness: 0.85 });
  const cantoTex = aTextura(texturaCanto(), { aniso, repetir: [8, 1] });
  const matCanto = new THREE.MeshStandardMaterial({ color: PELTRE, bumpMap: cantoTex, bumpScale: 1.2, roughness: 0.5, metalness: 0.85 });

  // --- La medalla y su cinta, colgadas de un pivote arriba (el péndulo gira alrededor de él). ---
  const pendulo = new THREE.Group();
  pendulo.position.set(0, Y_PIVOTE, 0);
  const colgante = new THREE.Group();
  colgante.position.set(0, -Y_PIVOTE, 0);
  pendulo.add(colgante);
  scene.add(pendulo);

  const cuerpo = new THREE.Mesh(geometriaCuerpo(), [matCuerpo, matCuerpo, matCanto]);
  // Cada foto, en un disco plano sobre la parte plana de su cara. El del dorso mira hacia atrás (girado en Y),
  // así que desde atrás se lee derecho, sin espejar.
  const geoDisco = new THREE.CircleGeometry(R_CARA, 128);
  const discoFrente = new THREE.Mesh(geoDisco, matFrente);
  discoFrente.position.z = Z_CARA + 0.0004;
  const discoDorso = new THREE.Mesh(geoDisco, matDorso);
  discoDorso.rotation.y = Math.PI;
  discoDorso.position.z = -Z_CARA - 0.0004;
  colgante.add(cuerpo, discoFrente, discoDorso);

  const { geo: geoCinta } = geometriaCinta();
  const tc = texturasCinta();
  const cinta = new THREE.Mesh(geoCinta, new THREE.MeshPhysicalMaterial({
    map: aTextura(tc.color, { color: true, aniso, repetir: [1, 1.2] }),
    bumpMap: aTextura(tc.relieve, { aniso, repetir: [1, 1.2] }),
    bumpScale: 1.6,
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.05,
    envMapIntensity: 0.4,
    sheen: 0.1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0x8a2a34),
    side: THREE.DoubleSide,
  }));
  colgante.add(cinta);

  contenedor.append(canvas);

  // --- Controles: azimut libre de 360°, altura fija, sin zoom ni pan. ---
  const controles = new OrbitControls(camara, canvas);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.enableZoom = false;
  controles.rotateSpeed = 0.9;
  controles.minAzimuthAngle = -Infinity;
  controles.maxAzimuthAngle = Infinity;
  controles.minPolarAngle = controles.maxPolarAngle = Math.PI / 2;
  const Y_CENTRO = 1.15; // la altura que mira la cámara: medalla y un tramo de cinta
  controles.target.set(0, Y_CENTRO, 0);
  // OrbitControls pone touch-action:none al conectarse, y eso trabaría el scroll del dedo sobre la medalla.
  canvas.style.touchAction = 'pan-y';
  controles.touches = { ONE: THREE.TOUCH.ROTATE, TWO: -1 };

  // --- Encuadre: la distancia sale de las medidas y del aspecto del canvas. ---
  let ancho = 0;
  let alto = 0;
  let dist = 12;
  const aimut = () => Math.atan2(camara.position.x - controles.target.x, camara.position.z - controles.target.z);
  const colocarCamara = (az) => {
    camara.position.set(controles.target.x + Math.sin(az) * dist, controles.target.y, controles.target.z + Math.cos(az) * dist);
    camara.lookAt(controles.target);
  };
  const medir = () => {
    const w = contenedor.clientWidth;
    const h = contenedor.clientHeight;
    if (!w || !h || (w === ancho && h === alto)) return;
    ancho = w;
    alto = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    const tanV = Math.tan(grados(camara.fov) / 2);
    dist = Math.max(5.7 / 2 / tanV, 3.5 / 2 / (tanV * (w / h)));
    colocarCamara(aimut());
    controles.update();
    pedirCuadro();
  };
  colocarCamara(0);

  // --- Péndulo: balanceo de lado a lado (visto desde la cámara) que se amortigua. ---
  let theta = 0;
  let omega = 0;
  const ejeVista = new THREE.Vector3();
  const aplicarPendulo = () => {
    ejeVista.set(controles.target.x - camara.position.x, 0, controles.target.z - camara.position.z).normalize();
    pendulo.quaternion.setFromAxisAngle(ejeVista, theta);
  };
  const W0 = 2.1;
  const ZETA = 0.28;
  const empujar = (v) => { if (!reducido) omega = clamp(omega + v, -0.7, 0.7); };
  const animarPendulo = (dt) => {
    if (reducido) {
      const hubo = theta !== 0;
      theta = omega = 0;
      if (hubo) aplicarPendulo();
      return false;
    }
    if (Math.abs(theta) < 1e-4 && Math.abs(omega) < 1e-3) {
      if (theta || omega) { theta = omega = 0; aplicarPendulo(); }
      return false;
    }
    omega += (-W0 * W0 * theta - 2 * ZETA * W0 * omega) * dt;
    theta = clamp(theta + omega * dt, -0.22, 0.22);
    aplicarPendulo();
    return true;
  };

  // --- "Ver frente / dorso" (y las flechas del teclado): un giro suave a la otra cara. ---
  let vuelo = null;
  const irA = (azDestino) => {
    const desde = aimut();
    const destino = desde + Math.atan2(Math.sin(azDestino - desde), Math.cos(azDestino - desde));
    if (reducido) { colocarCamara(destino); controles.update(); pedirCuadro(); return; }
    vuelo = { desde, hasta: destino, t0: performance.now(), dur: 950 };
    pedirCuadro();
  };
  const verOtraCara = () => {
    const az = aimut();
    const k = Math.round(az / Math.PI);
    irA((k + (az >= k * Math.PI ? 1 : -1)) * Math.PI);
  };
  const avanzarVuelo = (ahora) => {
    if (!vuelo) return false;
    const p = clamp((ahora - vuelo.t0) / vuelo.dur, 0, 1);
    colocarCamara(vuelo.desde + (vuelo.hasta - vuelo.desde) * suave(p));
    if (p >= 1) vuelo = null;
    return true;
  };
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'medalla-giro';
  boton.textContent = 'Ver frente / dorso';
  boton.addEventListener('click', verOtraCara);
  contenedor.after(boton); // debajo del visor, para no tapar la medalla
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    irA(aimut() + (ev.key === 'ArrowRight' ? -1 : 1) * grados(45));
  });

  // --- Interacción: al tocarla o arrastrarla, además de girar, se balancea. ---
  let abajo = null;
  let arrastrando = false;
  canvas.addEventListener('pointerdown', (ev) => { abajo = { x: ev.clientX }; arrastrando = true; vuelo = null; });
  canvas.addEventListener('pointermove', (ev) => {
    if (!abajo) return;
    empujar(((ev.clientX - abajo.x) / Math.max(1, ancho)) * -0.9); // arrastrar a la derecha: la medalla se va hacia la derecha
    abajo.x = ev.clientX;
    pedirCuadro();
  });
  const soltar = () => { abajo = null; arrastrando = false; pedirCuadro(); };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
  controles.addEventListener('change', () => pedirCuadro());
  controles.addEventListener('start', () => { vuelo = null; pedirCuadro(); });

  // --- Bucle: sólo corre si el visor se ve, y sólo mientras algo se mueve. ---
  let visible = true;
  let idRaf = 0;
  let ultimo = performance.now();
  let perdida = false;
  function cuadro(ahora) {
    idRaf = 0;
    if (!visible || perdida || document.hidden) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const volando = avanzarVuelo(ahora);
    const meciendo = animarPendulo(dt);
    const control = controles.update();
    renderer.render(scene, camara);
    if (volando || meciendo || control || arrastrando) idRaf = requestAnimationFrame(cuadro);
  }
  function pedirCuadro() {
    if (!idRaf && visible && !perdida) {
      ultimo = performance.now();
      idRaf = requestAnimationFrame(cuadro);
    }
  }
  const observador = new ResizeObserver(medir);
  observador.observe(contenedor);
  const vigia = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) pedirCuadro();
    else if (idRaf) { cancelAnimationFrame(idRaf); idRaf = 0; }
  }, { rootMargin: '60px' });
  vigia.observe(contenedor);
  const alCambiarVisibilidad = () => { if (!document.hidden) pedirCuadro(); };
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  const alPerderContexto = (ev) => {
    ev.preventDefault();
    perdida = true;
    contenedor.dispatchEvent(new CustomEvent('medalla:perdida', { bubbles: true }));
  };
  canvas.addEventListener('webglcontextlost', alPerderContexto);

  // Primer cuadro: se mide, se dibuja una vez y se le da un empujoncito para que se note que cuelga.
  medir();
  renderer.render(scene, camara);
  if (!reducido) omega = 0.3;
  pedirCuadro();

  return {
    canvas,
    verOtraCara,
    /** Libera la GPU y los escuchadores: para cuando la página sale de escena. */
    destruir() {
      cancelAnimationFrame(idRaf);
      idRaf = 0;
      visible = false;
      observador.disconnect();
      vigia.disconnect();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      mqReducido.removeEventListener?.('change', alCambiarReducido);
      controles.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [].concat(o.material ?? [])) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
      });
      entorno.dispose();
      pmrem.dispose();
      sala.dispose();
      renderer.dispose();
      canvas.remove();
      boton.remove();
    },
  };
}
