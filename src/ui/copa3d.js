import * as THREE from '/public/vendor/three/three.module.min.js';
import { COPA } from '../data/copaMedidas.js';
import { MALLA } from '../data/copaMalla.js';
import { placasDeCopa, COLUMNAS_COPA } from '../data/historia.js';
import { cargarGlb } from './copa/glb.js';
import { crearDecal } from './copa/decal.js';
import { leerRgbe } from './copa/rgbe.js';

/**
 * La copa 3D de "Nuestra historia": un solo objeto que gira entero (cáliz, asas, escudo, base y placas en un
 * mismo THREE.Group). La forma es la malla de public/img/historia/copa-arbb.glb (la generó una IA; la limpia y
 * la separa en tres piezas scripts/copa-arbb/malla.py) con materiales PBR de verdad encima: cromo espejo, bronce
 * satinado y caoba con laca. El escudo es el recorte de la foto (escudo-arbb-hd.webp) proyectado como decal sobre
 * la superficie real del cáliz, y la caoba son píxeles del tambor de esa misma foto (scripts/copa-arbb/texturas.py).
 * Nada del color sale de la textura horneada de la malla generada: se veía de plástico y el escudo, derretido.
 * La cámara repite la de la foto (scripts/copa-arbb/preparar.py deja src/data/copaMedidas.js): a la altura de la
 * boca y a ~30 unidades, así la base se ve desde arriba y la boca casi de canto.
 *
 * Se carga con import() cuando la vitrina se acerca (src/ui/historia.js) y habla con la página por eventos:
 *  - escucha 'historia:seleccion' (un solo año en `anios`) y 'historia:foco' { anio } sobre .hist-vitrina:
 *    enciende esa placa y gira la copa hasta dejar su columna de frente. Gana la última señal, salvo un foco
 *    que llega justo después de una elección (la línea desplazándose hacia lo elegido);
 *  - emite 'historia:elegir' { anio } cuando se toca una placa.
 * Rendimiento: un solo canvas en la página, pixelRatio hasta 1,5, ~27.000 triángulos, texturas de las placas
 * dibujadas una sola vez (dos atlas: apagadas y encendida), y el bucle sólo corre mientras algo se mueve y la copa
 * se ve.
 */

const PASO = (Math.PI * 2) / COLUMNAS_COPA; // 45°: las dos filas van en las mismas columnas
const VEL_LERP = 5; // 1/s
const GRADOS_POR_PX = 0.45;
const INERCIA_S = 0.35;
const VEL_MAX = 14; // rad/s
const UMBRAL_PX = 6;
const UMBRAL_FRENTE = 0.15; // rad: desde cuánto girada se ofrece "Volver al frente"
const PAUSA_FOCO_MS = 1500;
const ETIQUETA = 'La copa de Primera de la Asociación Rosarina en 3D, con una placa por cada título. Arrastrá para girarla y tocá una placa para ir a ese año.';
const PISTA = 'Arrastrá para girar · Tocá una placa';

// La cámara de la foto (la estimó el script con las elipses de la foto): a 30 unidades, un poco por encima de
// la boca, mirando al medio de la copa.
const CAMARA = COPA.camara;
// Lo que tiene que entrar en cuadro (con las asas y la elipse de la base vista desde arriba).
// Cuánto se gira el estudio: así detrás de la cámara queda la pared gris clara (la que llena de plata el cáliz) y el
// paraguas de luz cae a un costado, que es lo que dibuja la franja brillante de los bordes.
const ROTACION_ENTORNO = -Math.PI / 2;
const CUADRO = { ancho: 8.6, arriba: 10.0, abajo: -1.2 };

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const envolver = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

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
  return [c, c.getContext('2d')];
};

/** Azar repetible: la veta sale igual en cada carga. */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Entorno de estudio. Lo normal es el HDRI real de un estudio fotográfico (estudio.hdr: studio_small_03 de
// Poly Haven, CC0), que es lo que le da al cromo y a la laca de la caoba sus reflejos. Si no se puede bajar, queda
// este de respaldo: fondo negro y grandes franjas blancas verticales a los costados de la cámara, como en la foto.
// ---------------------------------------------------------------------------

function entornoDeRespaldo(renderer) {
  const w = 512;
  const h = 256;
  const datos = new Float32Array(w * h * 4);
  // u del equirectangular de three: dirección (x, z) → u = atan2(z, x) / 2π + 0,5. La cámara mira desde +z.
  const franja = (u, centro, ancho) => {
    const du = ((((u - centro) % 1) + 1.5) % 1) - 0.5; // distancia en la vuelta, de -0,5 a 0,5
    return Math.exp(-(du * du) / (2 * ancho * ancho));
  };
  for (let j = 0; j < h; j++) {
    const v = j / (h - 1); // 0 arriba, 1 abajo (fila 0 del DataTexture es abajo; se invierte al cargar: flipY)
    const alto = Math.exp(-(((v - 0.48) / 0.2) ** 2) * 2); // las franjas son altas pero no llegan a los polos
    const techo = Math.max(0, 1 - v / 0.18) * 0.35;
    for (let i = 0; i < w; i++) {
      const u = i / w;
      let l = 0.02 + techo;
      l += 8 * alto * (franja(u, 0.63, 0.02) + franja(u, 0.87, 0.024)); // izquierda y derecha, adelante
      l += 3 * alto * (franja(u, 0.35, 0.025) + franja(u, 0.15, 0.025)); // un contraluz más débil atrás
      // El frente, ancho y gris claro: sin esto, lo que el cromo refleja de frente (el medio del cáliz y del
      // tallo) es negro y se ve un manchón vertical oscuro.
      l += 0.9 * alto * franja(u, 0.75, 0.1);
      l += 0.12 * franja(u, 0.75, 0.2);
      // Abajo, el rebote cálido de la mesa de estudio.
      const piso = Math.max(0, (v - 0.55) / 0.45);
      const k = ((h - 1 - j) * w + i) * 4;
      datos[k] = l + 0.45 * piso;
      datos[k + 1] = l + 0.32 * piso;
      datos[k + 2] = l + 0.22 * piso;
      datos[k + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(datos, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return rt;
}

/**
 * El HDRI de estudio, pasado por PMREM. Va en half float: el filtrado lineal de float de 32 bits no existe en muchos
 * celulares. La rotación del entorno (en la escena) deja el paraguas de luz a un costado de la cámara.
 */
async function entornoDeEstudio(renderer) {
  try {
    const resp = await fetch('/public/img/historia/estudio.hdr');
    if (!resp.ok) throw new Error(String(resp.status));
    const { ancho, alto, datos } = leerRgbe(await resp.arrayBuffer());
    const mitad = new Uint16Array(datos.length);
    for (let i = 0; i < datos.length; i++) mitad[i] = THREE.DataUtils.toHalfFloat(Math.min(datos[i], 65000));
    const tex = new THREE.DataTexture(mitad, ancho, alto, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(tex);
    tex.dispose();
    pmrem.dispose();
    return rt;
  } catch {
    return entornoDeRespaldo(renderer);
  }
}

// ---------------------------------------------------------------------------
// Texturas dibujadas una vez
// ---------------------------------------------------------------------------

/**
 * Los dos atlas de placas (4 × 4 celdas de 256 × 128, una por lugar de la grilla): apagadas en plata ahumada y
 * encendidas en plata bruñida. Nunca rojas: el rojo empastaba el metal y no dejaba leer el año.
 */
const CELDA = { w: 256, h: 128, cols: 4 };
function atlasDePlacas(placas, encendida) {
  const [c, g] = lienzo(CELDA.w * CELDA.cols, CELDA.h * 4);
  placas.forEach((p, k) => {
    const x = (k % CELDA.cols) * CELDA.w;
    const y = Math.floor(k / CELDA.cols) * CELDA.h;
    g.save();
    g.translate(x, y);
    const fondo = g.createLinearGradient(0, 0, CELDA.w, CELDA.h);
    if (encendida) {
      fondo.addColorStop(0, '#FFFFFF');
      fondo.addColorStop(0.45, '#E6E9EF');
      fondo.addColorStop(0.55, '#FFFFFF');
      fondo.addColorStop(1, '#C8CDD6');
    } else {
      fondo.addColorStop(0, '#A6ACB5');
      fondo.addColorStop(1, '#858B94');
    }
    g.fillStyle = fondo;
    g.fillRect(0, 0, CELDA.w, CELDA.h);
    // Cepillado horizontal.
    const r = azar(97 + k);
    for (let l = 0; l < CELDA.h; l += 2) {
      g.fillStyle = `rgba(255,255,255,${(encendida ? 0.12 : 0.06) * r()})`;
      g.fillRect(0, l, CELDA.w, 1);
    }
    // Canto: un filo oscuro alrededor (y blanco si está encendida).
    g.strokeStyle = encendida ? '#FFFFFF' : 'rgba(20,22,26,.7)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, CELDA.w - 3, CELDA.h - 3);
    // Cuatro remaches.
    for (const [rx, ry] of [[14, 16], [CELDA.w - 14, 16], [14, CELDA.h - 16], [CELDA.w - 14, CELDA.h - 16]]) {
      const rm = g.createRadialGradient(rx - 1.5, ry - 1.5, 0.5, rx, ry, 6);
      rm.addColorStop(0, '#F2F3F5');
      rm.addColorStop(0.6, '#9EA2A9');
      rm.addColorStop(1, '#33363B');
      g.fillStyle = rm;
      g.beginPath();
      g.arc(rx, ry, 5.5, 0, Math.PI * 2);
      g.fill();
    }
    // El año, grabado. La placa de cabecera va en dos líneas grandes ("★ 15 ★" y "TÍTULOS"), para que pese
    // lo mismo que un año.
    const fuente = (peso, px) => `${peso} ${px}px "Barlow Condensed", "Barlow Condensed Respaldo", sans-serif`;
    const peso = encendida ? 700 : 600;
    const lineas = p.anio == null
      ? [{ texto: `★ ${p.texto.match(/\d+/)[0]} ★`, font: fuente(peso, 70), y: 42 }, { texto: 'TÍTULOS', font: fuente(700, 58), y: 95 }]
      : [{ texto: p.texto, font: fuente(peso, 96), y: CELDA.h / 2 + 5 }];
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const l of lineas) {
      g.font = l.font;
      g.fillStyle = encendida ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.22)';
      g.fillText(l.texto, CELDA.w / 2, l.y + 1.5);
      g.fillStyle = encendida ? '#09090B' : '#1E2024';
      g.fillText(l.texto, CELDA.w / 2, l.y);
    }
    g.restore();
  });
  return c;
}

/** El halo de la placa encendida: un óvalo blanco cálido que se apaga hacia afuera. */
function texturaHalo() {
  const [c, g] = lienzo(256, 128);
  g.translate(128, 64);
  g.scale(1, 0.5);
  const h = g.createRadialGradient(0, 0, 40, 0, 0, 128);
  h.addColorStop(0, 'rgba(255,244,225,.9)');
  h.addColorStop(1, 'rgba(255,244,225,0)');
  g.fillStyle = h;
  g.fillRect(-128, -128, 256, 256);
  return c;
}

function aTextura(canvas, { color = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function cargarTextura(url, aniso) {
  return new Promise((resolver, fallar) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      resolver(t);
    }, undefined, fallar);
  });
}

// ---------------------------------------------------------------------------
// La copa
// ---------------------------------------------------------------------------

/** Grano fino y sutil para el bump del bronce: ruido repetible, dibujado una sola vez. */
function texturaGrano() {
  const [c, g] = lienzo(256, 256);
  const r = azar(1950);
  const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const v = 128 + (r() - 0.5) * 70;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Hasta dónde llega el cáliz por el frente a una altura dada (para centrar la caja del decal sobre la pared). */
function zFrontal(geo, y) {
  const p = geo.attributes.position;
  let z = 0;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - y) < 0.1 && Math.abs(p.getX(i)) < 0.3) z = Math.max(z, p.getZ(i));
  return z;
}

async function crearCopa({ aniso }) {
  const grupo = new THREE.Group();
  const [geos, texEscudo, texCaoba] = await Promise.all([
    cargarGlb(THREE, '/public/img/historia/copa-arbb.glb'),
    cargarTextura('/public/img/historia/escudo-arbb-hd.webp', aniso),
    cargarTextura('/public/img/historia/caoba-real.webp', aniso),
  ]);

  // --- Las tres piezas de la malla, cada una con su material de verdad. ---
  // Plata pulida de trofeo: cáliz, tallo y pie. Todo el aspecto sale del entorno; con un poco de rugosidad (no
  // espejo puro) el brillo blanco se abre por toda la panza en vez de quedar en un hilo con manchones negros al lado.
  const cromo = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.045, envMapIntensity: 1.35 });
  // Bronce fundido satinado: las asas, con un grano muy fino de relieve.
  const grano = aTextura(texturaGrano(), { color: false, aniso });
  grano.wrapS = grano.wrapT = THREE.RepeatWrapping;
  grano.repeat.set(4, 4);
  const bronce = new THREE.MeshStandardMaterial({ color: 0xc6a664, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.25, bumpMap: grano, bumpScale: 0.35 });
  // Caoba barnizada: la veta es la de la foto; el barniz, el clearcoat.
  texCaoba.wrapS = texCaoba.wrapT = THREE.RepeatWrapping;
  texCaoba.repeat.set(2, 1);
  // Sin tinte: los tonos (bordó en la veta, rojo cálido en lo claro, casi sin verde para que no vire a naranja) ya vienen
  // en la textura, que está en sRGB.
  const caoba = new THREE.MeshPhysicalMaterial({ map: texCaoba, color: 0x6e4238, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.65 });
  grupo.add(new THREE.Mesh(geos.cromo, cromo), new THREE.Mesh(geos.bronce, bronce), new THREE.Mesh(geos.madera, caoba));

  // --- El escudo: el recorte de la foto proyectado sobre la pared real del cáliz, donde la malla tenía el suyo. ---
  const e = MALLA.escudo;
  const alto = (e.arriba - e.abajo) * 1.06;
  const ancho = alto * (texEscudo.image.width / texEscudo.image.height);
  const yMedio = (e.arriba + e.abajo) / 2;
  const zPared = zFrontal(geos.cromo, yMedio);
  const geoEscudo = crearDecal(THREE, geos.cromo, { centro: [0, yMedio, zPared], ancho, alto, profundidad: 0.8, separacion: 0.012 });
  // Esmalte con un barniz suave; el pequeño brillo propio evita que el azul se hunda en el negro de la página.
  const esmalte = new THREE.MeshPhysicalMaterial({
    map: texEscudo, emissiveMap: texEscudo, emissive: 0xffffff, emissiveIntensity: 0.1,
    metalness: 0.15, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 0.9,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const escudo = new THREE.Mesh(geoEscudo, esmalte);
  escudo.renderOrder = 1;
  grupo.add(escudo);

  // --- Las placas: 8 columnas × 2 filas sobre el tambor, cada 45°, curvas como el tambor. ---
  const placas = placasDeCopa();
  const tam = MALLA.tambor;
  const altoFila = (tam.arriba - tam.abajo) / 2;
  const altoPlaca = altoFila * 0.84;
  const radio = tam.radio + 0.015;
  const arcoPlaca = PASO * 0.86;
  const atlasApagado = aTextura(atlasDePlacas(placas, false), { aniso });
  const atlasEncendido = aTextura(atlasDePlacas(placas, true), { aniso });
  const apagada = new THREE.MeshStandardMaterial({ map: atlasApagado, emissiveMap: atlasApagado, emissive: 0xffffff, emissiveIntensity: 0.12, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.7 });
  const encendida = new THREE.MeshStandardMaterial({ map: atlasEncendido, emissiveMap: atlasEncendido, emissive: 0xffffff, emissiveIntensity: 0.6, metalness: 0.55, roughness: 0.16 });
  const mallas = placas.map((p, k) => {
    const geo = new THREE.CylinderGeometry(radio, radio, altoPlaca, 12, 1, true, -arcoPlaca / 2, arcoPlaca);
    // Cada placa lee su celda del atlas.
    const uv = geo.attributes.uv;
    const cx = (k % CELDA.cols) / CELDA.cols;
    const cy = 1 - (Math.floor(k / CELDA.cols) + 1) / 4;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, cx + uv.getX(i) / CELDA.cols, cy + uv.getY(i) / 4);
    const m = new THREE.Mesh(geo, apagada);
    m.rotation.y = p.columna * PASO;
    m.position.y = tam.arriba - altoFila * (p.fila + 0.5);
    m.userData = { ...p, brillo: 0, objetivo: 0 };
    grupo.add(m);
    return m;
  });
  const halo = new THREE.Mesh(
    new THREE.CylinderGeometry(radio - 0.004, radio - 0.004, altoPlaca * 1.9, 12, 1, true, -arcoPlaca * 0.75, arcoPlaca * 1.5),
    new THREE.MeshBasicMaterial({ map: aTextura(texturaHalo()), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  grupo.add(halo);

  return { grupo, placas: mallas, materiales: { apagada, encendida }, halo };
}

// ---------------------------------------------------------------------------
// La vitrina
// ---------------------------------------------------------------------------

/**
 * Monta la copa en `contenedor` (#vitrina-escenario).
 * @param {HTMLElement} contenedor
 * @param {{ anios?: number[] }} [opciones]  la selección de la página al montar
 */
export async function crearVitrina(contenedor, { anios = [] } = {}) {
  try {
    await document.fonts?.load('700 84px "Barlow Condensed"');
    await document.fonts?.load('600 84px "Barlow Condensed"');
  } catch { /* si falla, el canvas usa la de respaldo */ }

  let visible = true;
  let idRaf = 0;
  let ultimo = 0;
  let perdida = false;
  const mqReducido = matchMedia('(prefers-reduced-motion: reduce)');
  let reducido = mqReducido.matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const canvas = renderer.domElement;
  canvas.className = 'vitrina-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', ETIQUETA);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  // El entorno (HDRI de estudio) llega con la copa, más abajo: se bajan a la vez.
  // Una luz suave de arriba y adelante: el brillo de la laca de la madera y de las placas.
  const luz = new THREE.DirectionalLight(0xfff1e0, 1.0);
  luz.position.set(-3, 12, 10);
  scene.add(luz);
  // La base no se tiene que perder contra el fondo negro: una luz cálida de frente y abajo que pega en el
  // pedestal, y un contraluz bajo desde atrás que recorta el canto curvo de abajo.
  const pedestal = new THREE.PointLight(0xffd0a8, 8, 16, 2);
  pedestal.position.set(0, 0.6, 6.5);
  const contraluz = new THREE.DirectionalLight(0xffd6b8, 0.5);
  contraluz.position.set(0, -2, -8);
  scene.add(pedestal, contraluz);

  const camara = new THREE.PerspectiveCamera(22, 1, 1, 80);
  camara.position.set(0, CAMARA.y, CAMARA.z);
  camara.lookAt(0, CAMARA.miraY, 0);

  const [copa, entorno] = await Promise.all([crearCopa({ aniso }), entornoDeEstudio(renderer)]);
  scene.environment = entorno.texture;
  scene.environmentIntensity = 0.75; // el HDRI ya trae relleno: más y el cromo se lava hacia el blanco
  scene.environmentRotation.y = ROTACION_ENTORNO;
  scene.add(copa.grupo);
  contenedor.append(canvas);

  // --- Encuadre: la cámara queda donde está la de la foto; sólo cambia el campo visual según el aspecto. ---
  let ancho = 0;
  let alto = 0;
  const encuadrar = () => {
    const dist = Math.hypot(CAMARA.z, CAMARA.y - CAMARA.miraY);
    const tanArriba = (CUADRO.arriba - CAMARA.miraY) / dist;
    const tanAbajo = (CAMARA.miraY - CUADRO.abajo) / dist;
    const tanV = Math.max(tanArriba, tanAbajo) * 1.04;
    const tanH = (CUADRO.ancho / 2 / dist) * 1.04;
    const aspecto = ancho / alto;
    camara.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(tanV, tanH / aspecto)));
    camara.aspect = aspecto;
    camara.updateProjectionMatrix();
  };
  const medir = () => {
    const w = contenedor.clientWidth;
    const h = contenedor.clientHeight;
    if (!w || !h || (w === ancho && h === alto)) return;
    ancho = w;
    alto = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    encuadrar();
    pedirCuadro();
  };

  // --- Estado del giro y de la placa encendida. ---
  let giro = 0;
  let meta = 0;
  let activa = null;
  let ultimaEleccion = -Infinity;
  let arrastrando = false;
  const metaPara = (columna) => {
    const a = -columna * PASO;
    return a + Math.PI * 2 * Math.round((meta - a) / (Math.PI * 2));
  };
  const placaDe = (anio) => copa.placas.find((p) => p.userData.anio === anio);
  function activar(anio) {
    const p = placaDe(anio);
    if (!p) return;
    activa = anio;
    for (const m of copa.placas) m.userData.objetivo = m === p ? 1 : 0;
    if (!arrastrando) meta = metaPara(p.userData.columna);
    pedirCuadro();
  }

  // --- El bucle: sólo mientras algo se mueve y la copa se ve. ---
  function animarPlacas(dt) {
    let pendiente = false;
    const k = reducido ? 1 : 1 - Math.exp(-9 * dt);
    let enc = null;
    for (const m of copa.placas) {
      const d = m.userData;
      const dif = d.objetivo - d.brillo;
      if (Math.abs(dif) > 0.002) { d.brillo += dif * k; pendiente = true; } else d.brillo = d.objetivo;
      // La encendida sale un poco hacia afuera y crece; cambia de atlas a mitad de camino.
      const s = 1 + 0.06 * d.brillo;
      m.scale.set(s, 1 + 0.12 * d.brillo, s);
      m.material = d.brillo > 0.5 ? copa.materiales.encendida : copa.materiales.apagada;
      if (d.objetivo === 1) enc = m;
    }
    if (enc) {
      copa.halo.rotation.y = enc.rotation.y;
      copa.halo.position.y = enc.position.y;
      copa.halo.material.opacity = 0.55 * enc.userData.brillo;
    } else copa.halo.material.opacity = 0;
    return pendiente;
  }
  function cuadro(ahora) {
    idRaf = 0;
    if (!visible || perdida || document.hidden) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    if (reducido) giro = meta;
    else giro += (meta - giro) * (1 - Math.exp(-VEL_LERP * dt));
    const quieta = Math.abs(meta - giro) < 0.0005;
    if (quieta) giro = meta;
    copa.grupo.rotation.y = giro;
    actualizarFrente();
    const placas = animarPlacas(dt);
    renderer.render(scene, camara);
    if (!quieta || placas || arrastrando) idRaf = requestAnimationFrame(cuadro);
  }
  function pedirCuadro() {
    if (idRaf || !visible || perdida) return;
    ultimo = performance.now();
    idRaf = requestAnimationFrame(cuadro);
  }

  // --- Lo que elige la página. ---
  const raiz = contenedor.closest('.hist-vitrina') ?? contenedor;
  const alSeleccionar = (ev) => {
    const lista = ev.detail?.anios ?? [];
    if (lista.length !== 1) return;
    ultimaEleccion = performance.now();
    activar(lista[0]);
  };
  const alFoco = (ev) => {
    if (performance.now() - ultimaEleccion < PAUSA_FOCO_MS) return;
    activar(Number(ev.detail?.anio));
  };
  raiz.addEventListener('historia:seleccion', alSeleccionar);
  raiz.addEventListener('historia:foco', alFoco);

  // --- Arrastre (el dedo vertical sigue siendo scroll: touch-action:pan-y) y toque de una placa. ---
  const raycaster = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const placaBajo = (ev) => {
    const r = canvas.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(puntero, camara);
    return raycaster.intersectObjects(copa.placas, false)[0]?.object ?? null;
  };
  let inicio = null;
  let xAnterior = 0;
  let vel = 0;
  let ultimoMov = 0;
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    inicio = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, t: performance.now() };
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (inicio && !arrastrando) {
      const dx = ev.clientX - inicio.x;
      if (Math.abs(dx) > UMBRAL_PX && Math.abs(dx) > Math.abs(ev.clientY - inicio.y)) {
        arrastrando = true;
        xAnterior = ev.clientX;
        vel = 0;
        ultimoMov = performance.now();
        pista.classList.add('oculta');
        try { canvas.setPointerCapture(inicio.id); } catch { /* el puntero ya se soltó */ }
        pedirCuadro();
      }
    }
    if (arrastrando) {
      const dx = ev.clientX - xAnterior;
      xAnterior = ev.clientX;
      if (!dx) return;
      const d = THREE.MathUtils.degToRad(dx * GRADOS_POR_PX);
      meta += d;
      const ahora = performance.now();
      vel = vel * 0.7 + (d / Math.max(8, ahora - ultimoMov)) * 1000 * 0.3;
      ultimoMov = ahora;
      pedirCuadro();
    } else if (ev.pointerType === 'mouse' && !ev.buttons) {
      canvas.style.cursor = placaBajo(ev) ? 'pointer' : '';
    }
  });
  const soltar = (ev) => {
    const eraToque = inicio && !arrastrando && performance.now() - inicio.t < 600;
    inicio = null;
    if (arrastrando) {
      arrastrando = false;
      if (!reducido && performance.now() - ultimoMov < 80) meta += clamp(vel, -VEL_MAX, VEL_MAX) * INERCIA_S;
      pedirCuadro();
      return;
    }
    if (!eraToque || ev.type !== 'pointerup') return;
    const p = placaBajo(ev);
    if (!p || p.userData.anio == null) return;
    ultimaEleccion = performance.now();
    activar(p.userData.anio);
    contenedor.dispatchEvent(new CustomEvent('historia:elegir', { bubbles: true, detail: { anio: p.userData.anio } }));
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  // --- "Volver al frente" (el escudo de frente) y la pista del gesto. El botón va debajo de la copa y sólo se ve
  // cuando la copa está girada lejos del frente; en el frente se apaga (sigue ocupando su lugar: no mueve la página). ---
  const frente = document.createElement('button');
  frente.type = 'button';
  frente.className = 'vitrina-frente';
  frente.textContent = 'Volver al frente';
  frente.addEventListener('click', () => {
    meta = Math.PI * 2 * Math.round(meta / (Math.PI * 2));
    pedirCuadro();
  });
  const pista = document.createElement('p');
  pista.className = 'vitrina-pista';
  pista.textContent = PISTA;
  contenedor.append(pista);
  raiz.insertBefore(frente, raiz.querySelector('figcaption'));
  let frenteVisible = false;
  function actualizarFrente() {
    const lejos = Math.abs(envolver(giro)) > UMBRAL_FRENTE;
    if (lejos === frenteVisible) return;
    frenteVisible = lejos;
    frente.classList.toggle('visible', lejos);
  }

  const alCambiarReducido = () => { reducido = mqReducido.matches; pedirCuadro(); };
  mqReducido.addEventListener?.('change', alCambiarReducido);

  const observador = new ResizeObserver(medir);
  observador.observe(contenedor);
  const vigia = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) pedirCuadro();
    else if (idRaf) { cancelAnimationFrame(idRaf); idRaf = 0; }
  }, { rootMargin: '80px' });
  vigia.observe(contenedor);
  const alCambiarVisibilidad = () => { if (!document.hidden) pedirCuadro(); };
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    perdida = true;
    contenedor.dispatchEvent(new CustomEvent('vitrina:perdida', { bubbles: true }));
  });

  medir();
  if (anios.length === 1) activar(anios[0]);
  copa.grupo.rotation.y = giro = meta;
  actualizarFrente();
  animarPlacas(1);
  renderer.render(scene, camara);
  pedirCuadro();

  return {
    canvas,
    activar,
    destruir() {
      cancelAnimationFrame(idRaf);
      idRaf = 0;
      visible = false;
      observador.disconnect();
      vigia.disconnect();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      mqReducido.removeEventListener?.('change', alCambiarReducido);
      raiz.removeEventListener('historia:seleccion', alSeleccionar);
      raiz.removeEventListener('historia:foco', alFoco);
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [].concat(o.material ?? [])) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
      });
      for (const m of Object.values(copa.materiales)) { m.map?.dispose(); m.dispose(); }
      entorno.dispose();
      renderer.dispose();
      canvas.remove();
      frente.remove();
      pista.remove();
    },
  };
}
