import * as THREE from '/public/vendor/three/three.module.min.js';
import { OrbitControls } from '/public/vendor/three/OrbitControls.js';
import { RoomEnvironment } from '/public/vendor/three/RoomEnvironment.js';
import { placasDeCopa } from '../data/historia.js';

/**
 * La vitrina 3D de "Nuestra historia": una copa hecha a mano con Three.js, inspirada en la copa
 * challenger actual de la Asociación Rosarina (no hay fotos de las de época: no se inventan tres).
 * Todo es geometría procedural (torno para el cuenco y el tallo, cintas planas extruidas para las
 * asas, cilindros para la base) y texturas dibujadas en canvas (madera, placas, escudo), así que no
 * hay un solo archivo de modelo ni de imagen que bajar.
 *
 * Este módulo sólo se carga con `import()` cuando la vitrina se acerca al viewport (ver
 * src/ui/historia.js): por eso importa Three.js de forma estática acá adentro, y por eso no
 * importa nada de la UI. Habla con la página sólo por eventos del DOM:
 *  - escucha 'historia:seleccion' (detail = { epocaId, anio, anios }) sobre `.hist-vitrina`: si
 *    trae UN solo año enciende esa placa; con una época entera no enciende ninguna (doce placas
 *    rojas a la vez eran ruido) y sólo gira la cámara hacia el grupo;
 *  - emite 'historia:elegir' (detail = { anio }) sobre el contenedor cuando se toca una placa.
 *
 * Un solo renderer y una sola escena. Las piezas (hoy la copa; la medalla es la próxima) se
 * registran con `registrarPieza` y se alternan con `mostrarPieza`: no se crean dos contextos WebGL.
 */

// Los colores del club y de las placas. Los metales y la madera se definen en crearCopa.
const ROJO_CLUB = 0xe30613;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Lleva un ángulo a (-π, π]: sirve para girar siempre por el camino corto. */
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

// ---------------------------------------------------------------------------
// Texturas dibujadas en canvas
// ---------------------------------------------------------------------------

const lienzo = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};

/** Azar repetible: la madera se ve igual en cada carga (y en las capturas de verificación). */
function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Caoba rojiza lustrada con la veta HORIZONTAL (corre alrededor del torno: en un LatheGeometry la
 * coordenada u da la vuelta y la v sube). Las ondas tienen períodos enteros en u, así que la textura
 * empalma sin costura al repetirse. Sirve de color y de relieve.
 */
function texturaMadera() {
  const W = 1024;
  const H = 512;
  const [c, g] = lienzo(W, H);
  const img = g.createImageData(W, H);
  const r = azar(11);
  // Ruido de valor periódico en u: manchas suaves que doblan la veta.
  const GU = 12;
  const GV = 48;
  const red = Float32Array.from({ length: GU * GV }, () => r());
  const liso = (t) => t * t * (3 - 2 * t);
  const ruido = (u, v) => {
    const x = u * GU;
    const y = v * GV;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = liso(x - x0);
    const fy = liso(y - y0);
    const q = (i, j) => red[(j % GV) * GU + (i % GU)];
    return (q(x0, y0) * (1 - fx) + q(x0 + 1, y0) * fx) * (1 - fy) + (q(x0, y0 + 1) * (1 - fx) + q(x0 + 1, y0 + 1) * fx) * fy;
  };
  const OSC = [59, 23, 14]; // #3b170e
  const CLA = [110, 44, 27]; // #6e2c1b
  const TAU = Math.PI * 2;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // Ondas suaves que sólo doblan un poco las vetas: las líneas siguen horizontales.
      const onda = 0.9 * Math.sin(TAU * 2 * u + v * 3.1) + 0.5 * Math.sin(TAU * 5 * u - v * 7.3) + 0.25 * Math.sin(TAU * 3 * u + v * 11);
      const t = v * 34 + onda * 0.28 + ruido(u, v) * 0.9;
      const grande = 0.5 + 0.5 * Math.sin(TAU * t);
      const fina = 0.5 + 0.5 * Math.sin(TAU * (v * 150 + onda * 0.5 + ruido(u * 2 % 1, v * 2 % 1) * 1.6));
      let k = 0.5 * grande + 0.28 * fina + 0.22 * ruido(u, v * 0.5);
      k = Math.min(1, Math.max(0, (k - 0.5) * 1.5 + 0.5)) + (r() - 0.5) * 0.05;
      const i = (y * W + x) * 4;
      img.data[i] = OSC[0] + (CLA[0] - OSC[0]) * k;
      img.data[i + 1] = OSC[1] + (CLA[1] - OSC[1]) * k;
      img.data[i + 2] = OSC[2] + (CLA[2] - OSC[2]) * k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Grano fino y manchas de pátina para el bronce de las asas: sirve de relieve y de rugosidad. */
function texturaBronce() {
  const [c, g] = lienzo(256, 256);
  const r = azar(23);
  g.fillStyle = '#e2e2e2';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 30; i++) { // manchas de pátina, de a poco más oscuras
    const x = r() * 256;
    const y = r() * 256;
    const rad = 20 + r() * 44;
    const m = g.createRadialGradient(x, y, 0, x, y, rad);
    m.addColorStop(0, `rgba(80,72,56,${0.015 + r() * 0.03})`); // apenas una variación: bronce satinado, no manchado
    m.addColorStop(1, 'rgba(80,72,56,0)');
    g.fillStyle = m;
    // El círculo se dibuja también corrido una vuelta, para que la textura empalme al repetirse.
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { g.save(); g.translate(dx, dy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); }
  }
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) { // grano
    const d = (r() - 0.5) * 20; // grano fino, ±4% de luminosidad
    img.data[i] += d;
    img.data[i + 1] += d;
    img.data[i + 2] += d;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Una placa plateada con el año grabado. Devuelve el color y el relieve (la tinta es el hueco). */
function texturasPlaca(anio, numero) {
  const W = 256;
  const H = 160;
  const [color, g] = lienzo(W, H);
  const lin = g.createLinearGradient(0, 0, W, H);
  lin.addColorStop(0, '#e6e8ec');
  lin.addColorStop(0.45, '#b9bdc5');
  lin.addColorStop(1, '#d3d6dc');
  g.fillStyle = lin;
  g.fillRect(0, 0, W, H);
  // Cepillado horizontal, como el metal grabado.
  const r = azar(anio);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(${r() > 0.5 ? '255,255,255' : '60,62,70'},${0.03 + r() * 0.06})`;
    g.beginPath();
    const y = r() * H;
    g.moveTo(0, y);
    g.lineTo(W, y + (r() - 0.5) * 4);
    g.stroke();
  }
  g.strokeStyle = 'rgba(40,42,50,.75)';
  g.lineWidth = 3;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = '#26272d';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 84px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.fillText(String(anio), W / 2, H / 2 + 6);
  g.font = '500 20px "JetBrains Mono", monospace';
  g.fillText(`TÍTULO ${String(numero).padStart(2, '0')}`, W / 2, 34);

  const [relieve, b] = lienzo(W, H);
  b.fillStyle = '#9a9a9a';
  b.fillRect(0, 0, W, H);
  b.strokeStyle = '#2a2a2a';
  b.lineWidth = 4;
  b.strokeRect(10, 10, W - 20, H - 20);
  b.shadowColor = '#000';
  b.shadowBlur = 5;
  b.fillStyle = '#1c1c1c';
  b.textAlign = 'center';
  b.textBaseline = 'middle';
  b.font = '700 84px "Barlow Condensed", "Arial Narrow", sans-serif';
  b.fillText(String(anio), W / 2, H / 2 + 6);
  b.shadowBlur = 0;
  b.font = '500 20px "JetBrains Mono", monospace';
  b.fillText(`TÍTULO ${String(numero).padStart(2, '0')}`, W / 2, 34);
  return { color, relieve };
}

/**
 * La silueta del escudo del logo de la Asociación Rosarina, en coordenadas de 0 a 1 (v hacia arriba):
 * borde superior recto con las esquinas vivas, lados rectos hasta la mitad y abajo una curva que cierra
 * en una punta bien marcada.
 */
function contornoEscudo(pasos = 48) {
  const mitad = 0.46;
  // Las dos puntas de arriba abren apenas hacia afuera; después los lados bajan rectos.
  const der = [[0.5 + mitad + 0.025, 1], [0.5 + mitad, 0.94], [0.5 + mitad, 0.5]];
  for (let k = 1; k <= pasos; k++) {
    const s = k / pasos;
    der.push([0.5 + mitad * (1 - s ** 1.5), 0.5 * (1 - s)]); // exponente bajo: la curva llega a la punta en ángulo
  }
  // Lado izquierdo: el espejo, de la punta hacia arriba.
  const izq = der.slice(0, -1).reverse().map(([x, v]) => [1 - x, v]);
  return [...der, ...izq];
}

/** Achica un polígono hacia su centro: sirve para el filete y el relieve interior. */
const achicar = (pts, f, cx = 0.5, cv = 0.52) => pts.map(([x, v]) => [cx + (x - cx) * f, cv + (v - cv) * f]);

/**
 * Las cuatro texturas del escudo (la silueta como alfa, el color, el relieve y la mezcla
 * rugosidad/metal). Medido sobre la foto de la copa real: TODO el escudo es azul rey, con un filete
 * fino plateado en el contorno y una "R" roja de palo, ancha y bold, con un contorno blanco fino.
 * El relieve de la R y del filete sale del mapa de relieve y el filete además es un tubo real
 * (ver `crearCopa`).
 */
function texturasEscudo() {
  const W = 512;
  const H = 640;
  const contorno = contornoEscudo();
  const interior = achicar(contorno, 0.93);
  const trazar = (g, pts) => {
    g.beginPath();
    pts.forEach(([x, v], i) => (i ? g.lineTo(x * W, (1 - v) * H) : g.moveTo(x * W, (1 - v) * H)));
    g.closePath();
  };
  const R = (g, estilo) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${H * 0.7}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    estilo(g, W / 2, H * 0.51);
  };

  const [alfa, a] = lienzo(W, H);
  a.fillStyle = '#000';
  a.fillRect(0, 0, W, H);
  a.fillStyle = '#fff';
  trazar(a, contorno);
  a.fill();

  const [color, c] = lienzo(W, H);
  // Azul rey, apenas más claro arriba (esmalte que toma la luz del cuarto).
  const azul = c.createLinearGradient(0, 0, 0, H);
  // Azul Francia intenso (#0d47a1). Se pinta un escalón más oscuro: el metal y el cuarto lo aclaran al renderizar.
  azul.addColorStop(0, '#0a3a8e');
  azul.addColorStop(1, '#072c72');
  c.fillStyle = azul;
  trazar(c, contorno);
  c.fill();
  // Filete fino plateado en el contorno (la mitad de afuera queda recortada por el escudo).
  c.save();
  trazar(c, contorno);
  c.clip();
  c.lineJoin = 'round';
  c.lineWidth = 9;
  c.strokeStyle = '#e2c46e'; // filete dorado fino
  trazar(c, contorno);
  c.stroke();
  // Reflejo de esmalte: una franja clara en diagonal.
  const brillo = c.createLinearGradient(0, 0, W, H * 0.7);
  brillo.addColorStop(0, 'rgba(255,255,255,.08)');
  brillo.addColorStop(0.45, 'rgba(255,255,255,0)');
  c.fillStyle = brillo;
  c.fillRect(0, 0, W, H);
  c.restore();
  // La R: roja, de palo, con un contorno blanco fino.
  R(c, (g, x, y) => {
    g.lineJoin = 'round';
    g.lineWidth = 22; // filete blanco grueso
    g.strokeStyle = '#ffffff';
    g.strokeText('R', x, y);
    g.fillStyle = '#a81e1e'; // rojo #d32f2f, un escalón más oscuro: el esmalte brilla y lo aclara
    g.fillText('R', x, y);
  });

  const [relieve, b] = lienzo(W, H);
  b.fillStyle = '#000';
  b.fillRect(0, 0, W, H);
  b.shadowColor = '#fff';
  b.shadowBlur = 12;
  b.fillStyle = '#e4e4e4'; // el filete queda alto
  trazar(b, contorno);
  b.fill();
  b.shadowBlur = 0;
  b.fillStyle = '#686868'; // el campo azul, apenas hundido
  trazar(b, interior);
  b.fill();
  R(b, (g, x, y) => {
    g.shadowColor = '#fff';
    g.shadowBlur = 8;
    g.lineJoin = 'round';
    g.lineWidth = 22;
    g.strokeStyle = '#fff';
    g.strokeText('R', x, y);
    g.shadowBlur = 0;
    g.fillStyle = '#fff'; // la R, lo más alto
    g.fillText('R', x, y);
  });

  // Canal G = rugosidad, canal B = metal (lo que lee Three.js). Esmalte: brillante y casi sin metal;
  // el filete, de metal pulido.
  const [mezcla, m] = lienzo(W, H);
  m.fillStyle = 'rgb(0,70,190)';
  m.fillRect(0, 0, W, H);
  m.fillStyle = 'rgb(0,105,25)'; // esmalte: brillante pero no espejo (si no, el azul y el rojo se lavan)
  trazar(m, interior);
  m.fill();

  return { alfa, color, relieve, mezcla, contorno };
}

/** Un degradé radial en canvas: sirve de charco de luz en el piso. */
function texturaCharco() {
  const [c, g] = lienzo(256, 256);
  const rad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rad.addColorStop(0, 'rgba(255,226,180,1)');
  rad.addColorStop(0.55, 'rgba(255,226,180,.35)');
  rad.addColorStop(1, 'rgba(255,226,180,0)');
  g.fillStyle = rad;
  g.fillRect(0, 0, 256, 256);
  return c;
}

// ---------------------------------------------------------------------------
// La copa
// ---------------------------------------------------------------------------

/** Una Texture lista para usar. `color` = true marca la textura como sRGB (las demás son datos). */
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

/**
 * Arma la copa, de pie sobre y = 0 y mirando hacia +z. Devuelve el grupo, las placas (para el
 * raycaster) y las medidas que usa el encuadre de la cámara.
 *
 * Las proporciones están medidas sobre la foto de la copa real (docs/privado/historia-referencias/
 * copa-arbb-recorte-tomas.png) en unidades del radio del borde, R: y = 0 en el borde y negativo hacia
 * abajo. `P([r, y])` las pasa a unidades del modelo (R = 1,4), de modo que cada número de abajo se
 * puede comparar a ojo con la foto.
 *
 * Cuenco: torno (LatheGeometry) con la pared exterior, el labio y la pared interior en una sola
 * pieza; así el borde se ve macizo y no una cáscara de papel.
 */
function crearCopa({ aniso }) {
  const grupo = new THREE.Group();
  grupo.name = 'copa';
  const R = 1.4;
  const ALTURA_R = 4.7; // de la base de madera al borde, en R
  const X = (r) => r * R;
  const Y = (y) => (ALTURA_R + y) * R;
  const P = ([r, y]) => new THREE.Vector2(X(r), Y(y));
  // Cromo espejo: el cuenco y el pie de la copa real reflejan todo el cuarto.
  const plata = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08 });
  const mapaMadera = aTextura(texturaMadera(), { color: true, aniso, repetir: [2, 1] });
  // Caoba rojiza laqueada: la veta va por el color y por el relieve, y el barniz da el brillo.
  const madera = new THREE.MeshPhysicalMaterial({
    map: mapaMadera, bumpMap: mapaMadera, bumpScale: 0.25, color: 0xc4c4c4, metalness: 0.05, roughness: 0.25,
    clearcoat: 0.85, clearcoatRoughness: 0.15,
  });
  const sombras = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const torno = (puntos, material, segmentos = 96) => {
    const geo = new THREE.LatheGeometry(puntos, segmentos);
    // La v de LatheGeometry reparte por índice de punto: un tramo recto de dos puntos quedaría con la
    // textura estirada. Se reescribe por largo recorrido, así la veta tiene el mismo tamaño en todo el perfil.
    const acum = [0];
    for (let j = 1; j < puntos.length; j++) acum.push(acum[j - 1] + puntos[j].distanceTo(puntos[j - 1]));
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, acum[i % puntos.length] / acum[acum.length - 1]);
    const m = sombras(new THREE.Mesh(geo, material));
    grupo.add(m);
    return m;
  };
  /** Una curva suave (centrípeta: no se pasa de largo) por los puntos [r, y], repartida por largo de arco. */
  const curva = (pts, n) => new THREE.CatmullRomCurve3(pts.map((p) => { const v = P(p); return new THREE.Vector3(v.x, v.y, 0); }), false, 'centripetal')
    .getSpacedPoints(n).map((v) => new THREE.Vector2(v.x, v.y));
  const aristas = (pts) => pts.map(P); // cantos vivos

  // --- Base de caoba, de abajo hacia arriba: zócalo ancho con doble moldura escalonada (pecho de
  // paloma), tambor alto donde van las placas y, arriba, la tapa fina con alero redondeado: el disco
  // de arriba sobresale más que el tambor. Un solo torno, así la veta empalma de punta a punta. ---
  const Y_TAPA = -3.05; // cara de arriba de la madera: ahí apoya el pie de plata
  const RADIO_DRUM = 0.79;
  torno([
    ...aristas([[0, -4.7], [1.14, -4.7]]),
    ...curva([[1.14, -4.7], [1.2, -4.675], [1.225, -4.61], [1.222, -4.54], [1.19, -4.485]], 12), // zócalo: borde redondeado
    ...curva([[1.19, -4.485], [1.12, -4.445], [1.07, -4.405], [1.052, -4.37]], 14), // primera moldura: gola cóncava
    ...curva([[1.052, -4.37], [1.085, -4.33], [1.1, -4.255], [1.08, -4.18], [1.02, -4.13]], 14), // segunda: toro
    ...curva([[1.02, -4.13], [0.93, -4.09], [0.84, -4.04], [RADIO_DRUM + 0.005, -3.96]], 12), // cuello de la base al tambor
    ...aristas([[RADIO_DRUM, -3.92], [RADIO_DRUM, -3.26]]), // el tambor
    ...curva([[RADIO_DRUM, -3.26], [0.805, -3.225], [0.87, -3.2], [0.93, -3.188]], 10), // empalme con la tapa
    ...curva([[0.93, -3.188], [0.968, -3.172], [0.985, -3.128], [0.97, -3.083], [0.93, -3.057], [0.88, -3.05]], 16), // alero redondeado, fino
    ...aristas([[0.8, -3.05], [0, -3.05]]),
  ], madera, 128);

  // --- Las 15 placas, una por título, curvas, sobre el tambor, cada una con sus dos remaches. ---
  const placas = [];
  const RADIO_TAMBOR = X(RADIO_DRUM);
  const Y_PLACAS = Y(-3.55);
  const radioPlaca = RADIO_TAMBOR + 0.012;
  const ANCHO_PLACA = 0.3;
  const remache = new THREE.SphereGeometry(0.014, 12, 8);
  // La caja se dobla sobre el tambor: cada vértice se lleva a su arco, así la placa abraza la madera.
  const geoPlaca = new THREE.BoxGeometry(ANCHO_PLACA, 0.19, 0.03, 12, 1, 1);
  const pos = geoPlaca.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const rho = radioPlaca + pos.getZ(i);
    const fi = pos.getX(i) / radioPlaca;
    pos.setXYZ(i, Math.sin(fi) * rho, pos.getY(i), Math.cos(fi) * rho - radioPlaca);
  }
  geoPlaca.computeVertexNormals();
  for (const p of placasDeCopa()) {
    const { color, relieve } = texturasPlaca(p.anio, p.numero);
    const mat = new THREE.MeshStandardMaterial({
      map: aTextura(color, { color: true, aniso }),
      bumpMap: aTextura(relieve, { aniso }),
      bumpScale: 1.2,
      color: 0xffffff,
      metalness: 0.78,
      roughness: 0.34,
      emissive: new THREE.Color(ROJO_CLUB),
      emissiveIntensity: 0,
    });
    const placa = sombras(new THREE.Mesh(geoPlaca, mat));
    for (const lado of [-1, 1]) {
      const fi = (lado * (ANCHO_PLACA / 2 - 0.024)) / radioPlaca;
      const rem = sombras(new THREE.Mesh(remache, plata));
      rem.scale.z = 0.55;
      rem.position.set(Math.sin(fi) * (radioPlaca + 0.015), 0, Math.cos(fi) * (radioPlaca + 0.015) - radioPlaca);
      rem.rotation.y = fi;
      placa.add(rem);
    }
    const radio = radioPlaca;
    // El ángulo sale de una función pura (src/data/historia.js): 0 es el frente, positivo a la derecha.
    placa.position.set(Math.sin(p.angulo) * radio, Y_PLACAS, Math.cos(p.angulo) * radio);
    placa.rotation.y = p.angulo;
    placa.userData = { anio: p.anio, angulo: p.angulo, brillo: 0, objetivo: 0, radio };
    grupo.add(placa);
    placas.push(placa);
  }

  // --- Pie y fuste en un solo torno, de abajo hacia arriba: campana ancha con borde, garganta cóncava
  // estrecha, nudo central bulboso, y el collarín fino bajo el cuenco. Al revés, las normales miran
  // hacia adentro y el pie se vería transparente. ---
  torno([
    ...aristas([[0, Y_TAPA - 0.04], [0.74, Y_TAPA - 0.04]]),
    ...curva([[0.74, Y_TAPA - 0.04], [0.775, -3.02], [0.78, -2.98], [0.76, -2.92], [0.7, -2.86], [0.6, -2.8], [0.48, -2.74], [0.37, -2.68], [0.3, -2.6], [0.27, -2.52], [0.265, -2.44]], 70), // campana y garganta
    ...curva([[0.265, -2.44], [0.37, -2.4], [0.45, -2.33], [0.48, -2.235], [0.445, -2.14], [0.35, -2.09], [0.3, -2.075]], 50), // el nudo
    ...aristas([[0.4, -2.07], [0.475, -2.055], [0.485, -2.03], [0.485, -1.94], [0.465, -1.9]]), // collarín
  ], plata, 128);

  // --- Cuenco cromado: paredes altas, casi rectas, que se cierran en una curva amplia y continua hacia
  // el cuello, y el labio: un anillo saliente redondeado en la boca. ---
  const exterior = new THREE.SplineCurve([[0.47, -1.9], [0.58, -1.83], [0.74, -1.66], [0.86, -1.38], [0.93, -0.95], [0.975, -0.42], [0.993, -0.07]].map(P));
  const interior = new THREE.SplineCurve([[0.966, -0.02], [0.945, -0.65], [0.87, -1.25], [0.75, -1.52], [0.52, -1.65], [0, -1.68]].map(P));
  torno([
    P([0, -1.9]), P([0.4, -1.9]),
    ...exterior.getPoints(56),
    ...curva([[0.993, -0.07], [1.014, -0.05], [1.024, -0.015], [1.016, 0.022], [0.994, 0.036], [0.975, 0.024], [0.967, 0]], 16), // el labio
    ...interior.getPoints(30),
  ], plata, 128);

  // --- Asas de bronce fundido: cintas planas, con el perfil dibujado con curvas Bézier. Nacen un
  // poco por encima del labio, tienen un hombro corto y horizontal, una muesca cóncava que termina en
  // un espolón agudo hacia afuera, y bajan en un arco que se afina hasta entrar en la panza del cuenco.
  // El hueco es una lágrima con una cuña colgando junto al cuenco. Los dos extremos entran en la
  // pared: nada queda suelto. ---
  const perfilAsa = (lado) => {
    const pt = ([r, y]) => [lado * X(r), Y(y)];
    const forma = new THREE.Shape();
    const m = (a) => forma.moveTo(...pt(a));
    const l = (a) => forma.lineTo(...pt(a));
    const b = (c1, c2, e) => forma.bezierCurveTo(...pt(c1), ...pt(c2), ...pt(e));
    m([0.955, -0.03]);
    l([0.975, 0.045]);
    b([1.0, 0.15], [1.06, 0.168], [1.16, 0.168]); // sube y se acuesta en el hombro
    l([1.56, 0.168]); // hombro superior: recto y horizontal, termina en una esquina viva
    b([1.5, 0.06], [1.58, -0.1], [1.9, -0.27]); // desde la esquina, una mordida cóncava hacia adentro que se abre hasta el espolón
    l([1.72, -0.325]); // el espolón vuelve sobre sí mismo
    b([1.66, -0.48], [1.6, -0.78], [1.5, -1.04]); // arco exterior
    b([1.36, -1.4], [1.12, -1.64], [0.84, -1.74]);
    l([0.64, -1.7]);
    l([0.66, -1.58]);
    b([0.95, -1.52], [1.17, -1.3], [1.29, -0.98]); // borde interior, que se afina hacia el cuenco
    b([1.38, -0.72], [1.42, -0.45], [1.415, -0.24]);
    b([1.41, -0.12], [1.36, -0.075], [1.26, -0.075]);
    l([1.1, -0.31]); // la cuña colgante
    l([0.975, -0.13]);
    forma.closePath();
    return forma;
  };
  const ESPESOR_ASA = 0.07;
  const mapaBronce = aTextura(texturaBronce(), { aniso, repetir: [1.4, 1.4] });
  const bronce = new THREE.MeshStandardMaterial({
    color: 0xb89b5e, metalness: 0.85, roughness: 0.35, bumpMap: mapaBronce, bumpScale: 0.7, roughnessMap: mapaBronce,
    map: aTextura(texturaBronce(), { color: true, aniso, repetir: [1.4, 1.4] }), // la pátina también oscurece un poco
  });
  for (const lado of [1, -1]) {
    const geo = new THREE.ExtrudeGeometry(perfilAsa(lado), {
      depth: ESPESOR_ASA, steps: 1, curveSegments: 28,
      bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelOffset: 0, bevelSegments: 4,
    });
    geo.translate(0, 0, -ESPESOR_ASA / 2);
    grupo.add(sombras(new THREE.Mesh(geo, bronce)));
  }

  // --- El escudo de la R, integrado al cuenco. Es un parche del mismo torno (LatheGeometry con
  // un ángulo corto) un pelo por fuera de la pared: así sigue la curva del cuenco y no flota en
  // los bordes. La silueta sale del mapa alfa; el relieve, del bumpMap; el filete dorado es
  // además un tubo de verdad que sube del metal. ---
  const E = texturasEscudo();
  const largo = exterior.getLength();
  const ALTO_ESCUDO = 0.92 * R;
  const ANCHO_ESCUDO = 0.76 * R;
  const BASE_ESCUDO = Y(-0.57) - ALTO_ESCUDO / 2;
  let u0 = 0;
  while (exterior.getPointAt(u0).y < BASE_ESCUDO && u0 < 1) u0 += 0.002;
  const du = ALTO_ESCUDO / largo;
  const sobre = 0.014; // cuánto sobresale del metal
  const enParche = (u) => {
    const p = exterior.getPointAt(clamp(u, 0, 1));
    const t = exterior.getTangentAt(clamp(u, 0, 1));
    return new THREE.Vector2(p.x + t.y * sobre, p.y - t.x * sobre); // normal exterior = (t.y, -t.x)
  };
  const puntosParche = Array.from({ length: 28 }, (_, i) => enParche(u0 + (du * i) / 27));
  const radioMedio = puntosParche[14].x;
  const giro = ANCHO_ESCUDO / radioMedio;
  const parche = new THREE.Mesh(
    new THREE.LatheGeometry(puntosParche, 56, -giro / 2, giro),
    new THREE.MeshStandardMaterial({
      map: aTextura(E.color, { color: true, aniso }),
      alphaMap: aTextura(E.alfa, { aniso }),
      alphaTest: 0.5,
      bumpMap: aTextura(E.relieve, { aniso }),
      bumpScale: 2,
      roughnessMap: aTextura(E.mezcla, { aniso }),
      metalnessMap: aTextura(E.mezcla, { aniso }),
      roughness: 1,
      metalness: 1,
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
  );
  parche.name = 'escudo';
  parche.receiveShadow = true;
  grupo.add(parche);
  // Filete: el contorno del escudo llevado a 3D sobre el mismo parche. Se densifica antes de la
  // curva suave: sin eso, la spline se pasa de largo en las esquinas de arriba y el tubo sale del escudo.
  const aLaPared = ([u, v]) => {
    const q = enParche(u0 + v * du);
    const fi = (u - 0.5) * giro;
    return new THREE.Vector3(Math.sin(fi) * (q.x + 0.006), q.y, Math.cos(fi) * (q.x + 0.006));
  };
  const denso = [];
  E.contorno.forEach((a, i) => {
    const b = E.contorno[(i + 1) % E.contorno.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.025));
    for (let k = 0; k < n; k++) denso.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  });
  const borde = new THREE.CatmullRomCurve3(denso.map(aLaPared), true, 'centripetal');
  const oroFilete = new THREE.MeshStandardMaterial({ color: 0xd9b45e, metalness: 1, roughness: 0.22 });
  grupo.add(sombras(new THREE.Mesh(new THREE.TubeGeometry(borde, 320, 0.0085, 8, true), oroFilete)));

  return { grupo, placas, ancho: 5.8, alto: 7.1, centro: new THREE.Vector3(0, 3.4, 0), frente: 0 };
}

// ---------------------------------------------------------------------------
// La vitrina: renderer, luces, cámara y movimiento
// ---------------------------------------------------------------------------

/**
 * Monta la vitrina en `contenedor` y devuelve una promesa con su API, una vez dibujado el primer
 * cuadro (la página cambia `data-estado` recién entonces, así el SVG de respaldo no parpadea).
 *
 * @param {HTMLElement} contenedor  donde va el canvas (#vitrina-escenario)
 * @param {object} [opciones]
 * @param {string} [opciones.glbUrl]  reservado para un escaneo futuro: el cargador de GLB no está
 *   vendorizado (fuera de alcance en la spec), así que por ahora se avisa por consola y se usa la copa.
 * @param {HTMLElement} [opciones.escena]  el bloque que se recorre con el scroll: su avance hace girar
 *   un poco la pieza.
 * @param {number[]} [opciones.anios]  años a marcar desde el primer cuadro (la selección de la página).
 */
export async function crearVitrina(contenedor, { glbUrl = null, escena = null, anios = [] } = {}) {
  if (glbUrl) console.warn('vitrina3d: glbUrl todavía no está soportado; se muestra la copa procedural.');

  // Las fuentes de las placas (Barlow Condensed) tienen que estar listas antes de dibujarlas en canvas.
  try {
    await document.fonts?.load('700 84px "Barlow Condensed"');
  } catch { /* si falla, el canvas usa la de respaldo */ }

  // Estado del bucle de dibujo (más abajo, en `cuadro` y `pedirCuadro`). Va arriba porque casi todo
  // lo que cambia algo llama a `pedirCuadro`, incluso antes de que arranque el bucle.
  let visible = true;
  let idRaf = 0;
  let ultimo = performance.now();
  let perdida = false;

  const mqReducido = matchMedia('(prefers-reduced-motion: reduce)');
  const mqTactil = matchMedia('(pointer: coarse)');
  let reducido = mqReducido.matches;
  const alCambiarReducido = () => { reducido = mqReducido.matches; pedirCuadro(); };
  mqReducido.addEventListener?.('change', alCambiarReducido);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // desde r18x ya es la suave; PCFSoftShadowMap quedó en desuso
  const canvas = renderer.domElement;
  canvas.className = 'vitrina-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'La copa de Primera en 3D, con una placa por cada título. Arrastrá para girarla y tocá una placa para ver ese año.');
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  // Reflejos: sin un entorno, el metal sólo brilla donde pega una luz y se ve plano. RoomEnvironment
  // es una sala de estudio con paneles de luz, la referencia habitual para metales PBR.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sala = new RoomEnvironment();
  // Dos tiras de luz altas, adelante y a los costados (como las softboxes de una foto de producto):
  // dibujan en el cuenco las franjas claras y oscuras que hacen leer "plata pulida" en vez de gris.
  const tira = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(9), toneMapped: false });
  for (const x of [-4.2, 4.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.1), tira);
    t.position.set(x, 3.5, 4.5);
    sala.add(t);
  }
  const entorno = pmrem.fromScene(sala, 0.04);
  scene.environment = entorno.texture;
  scene.environmentIntensity = 1.05;

  // Luz de vitrina: un foco cenital cálido que dibuja el cuenco y tira la sombra de contacto.
  const foco = new THREE.SpotLight(0xffddb0, 900, 0, 0.36, 0.9, 1.6);
  foco.position.set(0.5, 16, 2.4);
  foco.target.position.set(0, 2.2, 0);
  foco.castShadow = true;
  foco.shadow.mapSize.set(1024, 1024);
  foco.shadow.bias = -0.0004;
  foco.shadow.normalBias = 0.02;
  foco.shadow.radius = 5;
  scene.add(foco, foco.target);
  // Recortes de borde: uno rojizo del lado del club y otro frío del otro, bajitos, por detrás.
  const recorteRojo = new THREE.DirectionalLight(0xff5a48, 1.7);
  recorteRojo.position.set(-6, 3.5, -5);
  const recorteFrio = new THREE.DirectionalLight(0x8db4ff, 1.1);
  recorteFrio.position.set(6.5, 2.5, -4.5);
  scene.add(recorteRojo, recorteFrio);

  // Piso: un charco de luz apenas visible y una sombra que sólo dibuja la sombra (ShadowMaterial).
  const piso = new THREE.Group();
  const charco = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 64),
    new THREE.MeshBasicMaterial({ map: aTextura(texturaCharco(), { color: true }), transparent: true, opacity: 0.07, depthWrite: false, toneMapped: false }),
  );
  charco.rotation.x = -Math.PI / 2;
  charco.position.y = 0.002;
  const sombraPiso = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.ShadowMaterial({ opacity: 0.32 }));
  sombraPiso.rotation.x = -Math.PI / 2;
  sombraPiso.receiveShadow = true;
  piso.add(charco, sombraPiso);
  scene.add(piso);

  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  // --- Piezas: hoy la copa; la medalla se suma con `registrarPieza`. ---
  const piezas = new Map();
  let actual = null;
  const registrarPieza = (nombre, pieza) => {
    pieza.grupo.visible = false;
    scene.add(pieza.grupo);
    piezas.set(nombre, pieza);
  };
  const copa = crearCopa({ aniso });
  registrarPieza('copa', copa);
  // Pivote: lo que gira con el scroll y se mece en reposo. La pieza que se muestra cuelga de él.
  const pivote = new THREE.Group();

  contenedor.append(canvas);

  // --- Controles: arrastrar en cualquier momento. Sin pan; el zoom queda acotado y sólo con
  // pellizco o Ctrl+rueda, porque la rueda sola tiene que seguir haciendo scroll en la página. ---
  canvas.addEventListener('wheel', (ev) => { if (!ev.ctrlKey) ev.stopImmediatePropagation(); }, { passive: true });
  const controles = new OrbitControls(camara, canvas);
  controles.enableDamping = true;
  controles.dampingFactor = 0.07;
  controles.enablePan = false;
  controles.rotateSpeed = 0.7;
  controles.zoomSpeed = 0.5;
  // OrbitControls pone touch-action:none al conectarse, y eso trabaría el scroll del dedo sobre la copa.
  canvas.style.touchAction = 'pan-y';
  controles.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const POLAR_FRENTE = THREE.MathUtils.degToRad(80);
  const home = { az: 0, pol: POLAR_FRENTE, dist: 14, target: new THREE.Vector3() };
  const limitarPolar = () => {
    // En el celular sólo se gira en horizontal: la altura queda fija (y el gesto vertical es del scroll).
    if (mqTactil.matches) controles.minPolarAngle = controles.maxPolarAngle = POLAR_FRENTE;
    else { controles.minPolarAngle = THREE.MathUtils.degToRad(58); controles.maxPolarAngle = THREE.MathUtils.degToRad(94); }
  };
  limitarPolar();

  // --- Encuadre: la distancia sale de las medidas de la pieza y del aspecto del canvas. ---
  let ancho = 0;
  let alto = 0;
  let enHome = true; // mientras nadie mueve la cámara, un resize la reencuadra
  const encuadrar = () => {
    if (!actual || !ancho) return;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2);
    const aspecto = ancho / alto;
    const dist = Math.max(actual.alto / 2 / tanV, actual.ancho / 2 / (tanV * aspecto)) * 1.1;
    home.dist = dist;
    home.target.copy(actual.centro);
    controles.minDistance = dist * 0.42;
    controles.maxDistance = dist * 1.15;
    if (enHome) aplicarVista({ az: pivote.rotation.y, pol: home.pol, dist, target: home.target });
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
    encuadrar();
    pedirCuadro();
  };

  // --- Vistas y vuelos de cámara (esféricas alrededor del objetivo). ---
  const esf = new THREE.Spherical();
  const delta = new THREE.Vector3();
  const leerVista = () => {
    delta.copy(camara.position).sub(controles.target);
    esf.setFromVector3(delta);
    return { az: esf.theta, pol: esf.phi, dist: esf.radius, target: controles.target.clone() };
  };
  function aplicarVista(v) {
    controles.target.copy(v.target);
    esf.set(v.dist, v.pol, v.az);
    camara.position.copy(controles.target).add(delta.setFromSpherical(esf));
    camara.lookAt(controles.target);
  }
  let vuelo = null;
  /** Lleva la cámara a `hasta` en ~0,9 s (de golpe con movimiento reducido). Siempre por el lado corto. */
  const volarA = (hasta) => {
    const desde = leerVista();
    const destino = { ...hasta, az: desde.az + envolver(hasta.az - desde.az) };
    destino.pol = clamp(destino.pol, controles.minPolarAngle, controles.maxPolarAngle);
    destino.dist = clamp(destino.dist, controles.minDistance, controles.maxDistance);
    enHome = false;
    if (reducido) { aplicarVista(destino); vuelo = null; pedirCuadro(); return; }
    vuelo = { desde, hasta: destino, t0: performance.now(), dur: 900 };
    pedirCuadro();
  };
  const avanzarVuelo = (ahora) => {
    if (!vuelo) return false;
    const p = clamp((ahora - vuelo.t0) / vuelo.dur, 0, 1);
    const k = suave(p);
    const { desde: a, hasta: b } = vuelo;
    aplicarVista({
      az: a.az + (b.az - a.az) * k,
      pol: a.pol + (b.pol - a.pol) * k,
      dist: a.dist + (b.dist - a.dist) * k,
      target: a.target.clone().lerp(b.target, k),
    });
    if (p >= 1) vuelo = null;
    return true;
  };

  // --- Placas: marcar, tocar, señalar con el mouse. ---
  // Sólo se enciende la placa de UN año puntual. Una época (varios años) o el arranque no encienden
  // ninguna: doce placas rojas a la vez se leían como rosadas y ensuciaban la copa.
  const resaltar = (lista) => {
    const unico = lista.length === 1 ? lista[0] : null;
    copa.placas.forEach((p) => { p.userData.objetivo = p.userData.anio === unico ? 1 : 0; });
    pedirCuadro();
  };
  resaltar(anios);
  const placaDe = (anio) => copa.placas.find((p) => p.userData.anio === anio);
  const raycaster = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const placaBajo = (ev) => {
    if (actual !== copa) return null;
    const r = canvas.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(puntero, camara);
    return raycaster.intersectObjects(copa.placas, false)[0]?.object ?? null;
  };
  /** Acerca la cámara a una placa: se para frente a ella y mira su altura. */
  const acercarA = (placa) => {
    const objetivo = new THREE.Vector3(0, copa.placas[0].position.y, 0);
    volarA({ az: placa.userData.angulo + pivote.rotation.y, pol: POLAR_FRENTE, dist: home.dist * 0.58, target: objetivo });
  };
  /** Gira la cámara hacia el centro de un grupo de placas (una época), a distancia normal. */
  const mostrarGrupo = (lista) => {
    const ps = lista.map(placaDe).filter(Boolean);
    if (!ps.length) return;
    const media = ps.reduce((s, p) => s + p.userData.angulo, 0) / ps.length;
    volarA({ az: media + pivote.rotation.y, pol: POLAR_FRENTE, dist: home.dist, target: home.target });
  };

  let abajo = null;
  let usuario = false; // hay un dedo o un mouse arrastrando: la animación automática no pisa el gesto
  canvas.addEventListener('pointerdown', (ev) => { abajo = { x: ev.clientX, y: ev.clientY, t: performance.now() }; usuario = true; vuelo = null; ocultarPista(); });
  canvas.addEventListener('pointerup', (ev) => {
    usuario = false;
    if (!abajo) return;
    const toque = Math.hypot(ev.clientX - abajo.x, ev.clientY - abajo.y) < 7 && performance.now() - abajo.t < 600;
    abajo = null;
    if (!toque) { enHome = false; return; }
    const placa = placaBajo(ev);
    if (!placa) return;
    acercarA(placa);
    contenedor.dispatchEvent(new CustomEvent('historia:elegir', { bubbles: true, detail: { anio: placa.userData.anio } }));
  });
  canvas.addEventListener('pointercancel', () => { usuario = false; abajo = null; });
  let hover = false;
  let cuadroHover = 0;
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.buttons || cuadroHover) return;
    cuadroHover = requestAnimationFrame(() => {
      cuadroHover = 0;
      const sobre = !!placaBajo(ev);
      if (sobre !== hover) { hover = sobre; canvas.style.cursor = sobre ? 'pointer' : ''; }
    });
  });
  controles.addEventListener('start', () => { vuelo = null; enHome = false; });

  // Lo que elige la página (tarjetas, estrellas, scroll de épocas) se refleja en la copa.
  const raiz = contenedor.closest('.hist-vitrina') ?? contenedor;
  const alSeleccionar = (ev) => {
    const lista = ev.detail?.anios ?? [];
    resaltar(lista);
    if (usuario || actual !== copa) return;
    if (lista.length === 1) acercarA(placaDe(lista[0]));
    else if (lista.length > 1) mostrarGrupo(lista);
  };
  raiz.addEventListener('historia:seleccion', alSeleccionar);

  // --- Ayudas visibles: "Ver de frente" y la pista de gestos. ---
  const frente = document.createElement('button');
  frente.type = 'button';
  frente.className = 'vitrina-frente';
  frente.textContent = 'Ver de frente';
  frente.addEventListener('click', () => { enHome = true; volarA({ az: pivote.rotation.y, pol: home.pol, dist: home.dist, target: home.target }); enHome = true; });
  const pista = document.createElement('p');
  pista.className = 'vitrina-pista';
  pista.textContent = 'Arrastrá para girar · Tocá una placa';
  function ocultarPista() { pista.classList.add('oculta'); }
  contenedor.append(frente, pista);

  // --- Mostrar piezas y movimiento. ---
  const mostrarPieza = (nombre) => {
    const p = piezas.get(nombre);
    if (!p) return;
    piezas.forEach((x) => { x.grupo.visible = x === p; });
    actual = p;
    pivote.add(p.grupo);
    scene.add(pivote);
    enHome = true;
    encuadrar();
    pedirCuadro();
  };

  let progreso = 0;
  const leerScroll = () => {
    if (!escena) return;
    const r = escena.getBoundingClientRect();
    const total = r.height - innerHeight;
    progreso = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    pedirCuadro();
  };
  addEventListener('scroll', leerScroll, { passive: true });
  leerScroll();

  let giro = 0;
  const animar = (t, dt) => {
    // Con movimiento reducido: pose fija. El arrastre sigue, porque lo maneja OrbitControls.
    if (reducido) { pivote.rotation.set(0, 0, 0); pivote.position.y = 0; return false; }
    const meta = progreso * 1.3; // arranca de frente y gira unos 75° a lo largo de la línea
    giro += (meta - giro) * Math.min(1, dt * 3);
    pivote.rotation.y = giro + Math.sin(t * 0.4) * 0.035;
    pivote.rotation.x = Math.sin(t * 0.7) * 0.01;
    pivote.rotation.z = Math.sin(t * 0.55 + 1) * 0.008;
    pivote.position.y = 0.05 + Math.sin(t * 0.9) * 0.045;
    return true;
  };
  const animarPlacas = (dt) => {
    let pendiente = false;
    for (const p of copa.placas) {
      const d = p.userData;
      const dif = d.objetivo - d.brillo;
      if (Math.abs(dif) > 0.002) { d.brillo += dif * Math.min(1, dt * 7); pendiente = true; } else d.brillo = d.objetivo;
      // Encendida: el plateado se apaga (color oscuro) y el emisivo pone un rojo de club; sumar rojo
      // sobre plata clara daba rosa.
      p.material.color.setScalar(1 - 0.82 * d.brillo);
      p.material.emissiveIntensity = d.brillo * 0.55;
      p.position.z = Math.cos(d.angulo) * (d.radio + d.brillo * 0.018);
      p.position.x = Math.sin(d.angulo) * (d.radio + d.brillo * 0.018);
    }
    return pendiente;
  };

  // --- Bucle: sólo corre si la vitrina se ve; con movimiento reducido, sólo cuando algo cambia. ---
  function cuadro(ahora) {
    idRaf = 0;
    if (!visible || perdida || document.hidden) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const moviendo = !!avanzarVuelo(ahora);
    const meciendo = animar(ahora / 1000, dt);
    const placas = animarPlacas(dt);
    const control = controles.update();
    // Al arrastrar o volar, el pivote queda como esté: el giro del scroll sigue por su cuenta.
    renderer.render(scene, camara);
    if (meciendo || moviendo || placas || control || usuario) idRaf = requestAnimationFrame(cuadro);
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
  }, { rootMargin: '80px' });
  vigia.observe(contenedor);
  const alCambiarVisibilidad = () => { if (!document.hidden) pedirCuadro(); };
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  const alPerderContexto = (ev) => {
    ev.preventDefault();
    perdida = true;
    contenedor.dispatchEvent(new CustomEvent('vitrina:perdida', { bubbles: true }));
  };
  canvas.addEventListener('webglcontextlost', alPerderContexto);
  mqTactil.addEventListener?.('change', limitarPolar);

  // Primer cuadro: se mide, se elige la copa y se dibuja una vez antes de devolver el control.
  medir();
  mostrarPieza('copa');
  renderer.render(scene, camara);
  pedirCuadro();

  return {
    canvas,
    piezas,
    registrarPieza,
    mostrarPieza,
    verDeFrente: () => frente.click(),
    resaltar,
    /** Libera la GPU y los escuchadores: para cuando la página sale de escena. */
    destruir() {
      cancelAnimationFrame(idRaf);
      idRaf = 0;
      visible = false;
      observador.disconnect();
      vigia.disconnect();
      removeEventListener('scroll', leerScroll);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      raiz.removeEventListener('historia:seleccion', alSeleccionar);
      mqReducido.removeEventListener?.('change', alCambiarReducido);
      mqTactil.removeEventListener?.('change', limitarPolar);
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
      renderer.dispose();
      canvas.remove();
      frente.remove();
      pista.remove();
    },
  };
}
