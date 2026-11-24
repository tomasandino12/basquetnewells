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

/** Caoba rojiza lustrada, con veta vertical. Sirve de color y de relieve. */
function texturaMadera() {
  const [c, g] = lienzo(512, 256);
  const lin = g.createLinearGradient(0, 0, 512, 0);
  lin.addColorStop(0, '#3a1307');
  lin.addColorStop(0.5, '#5e2610');
  lin.addColorStop(1, '#3a1307');
  g.fillStyle = lin;
  g.fillRect(0, 0, 512, 256);
  const r = azar(7);
  for (let i = 0; i < 340; i++) {
    const x = r() * 512;
    const claro = r() > 0.55;
    g.strokeStyle = claro ? `rgba(214,128,72,${0.05 + r() * 0.12})` : `rgba(44,14,5,${0.08 + r() * 0.2})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    g.moveTo(x, 0);
    const onda = (r() - 0.5) * 14;
    g.bezierCurveTo(x + onda, 85, x - onda, 170, x + onda * 0.4, 256);
    g.stroke();
  }
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
 * La silueta del escudo heráldico de la insignia, en coordenadas de 0 a 1 (v hacia arriba): borde
 * superior recto con las esquinas apenas recortadas, lados rectos y una punta redondeada abajo.
 */
function contornoEscudo(pasos = 48) {
  const mitad = 0.46;
  const der = [[0.5 + mitad - 0.07, 0.995], [0.5 + mitad, 0.94], [0.5 + mitad, 0.5]];
  for (let k = 1; k <= pasos; k++) {
    const s = k / pasos;
    der.push([0.5 + mitad * (1 - s ** 1.85) ** 0.72, 0.5 * (1 - s)]);
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
  azul.addColorStop(0, '#2850b0');
  azul.addColorStop(1, '#173488');
  c.fillStyle = azul;
  trazar(c, contorno);
  c.fill();
  // Filete fino plateado en el contorno (la mitad de afuera queda recortada por el escudo).
  c.save();
  trazar(c, contorno);
  c.clip();
  c.lineJoin = 'round';
  c.lineWidth = 14;
  c.strokeStyle = '#dde3f0';
  trazar(c, contorno);
  c.stroke();
  // Reflejo de esmalte: una franja clara en diagonal.
  const brillo = c.createLinearGradient(0, 0, W, H * 0.7);
  brillo.addColorStop(0, 'rgba(255,255,255,.16)');
  brillo.addColorStop(0.45, 'rgba(255,255,255,0)');
  c.fillStyle = brillo;
  c.fillRect(0, 0, W, H);
  c.restore();
  // La R: roja, de palo, con un contorno blanco fino.
  R(c, (g, x, y) => {
    g.lineJoin = 'round';
    g.lineWidth = 12;
    g.strokeStyle = '#ffffff';
    g.strokeText('R', x, y);
    g.fillStyle = '#e0262b';
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
    g.lineWidth = 12;
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
  m.fillStyle = 'rgb(0,60,25)';
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
  const ALTURA_R = 4.18; // de la base de madera al borde, en R
  const X = (r) => r * R;
  const Y = (y) => (ALTURA_R + y) * R;
  const P = ([r, y]) => new THREE.Vector2(X(r), Y(y));
  // Cromo espejo: el cuenco y el pie de la copa real reflejan todo el cuarto.
  const plata = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.07 });
  const mapaMadera = aTextura(texturaMadera(), { color: true, aniso, repetir: [3, 1] });
  // Caoba rojiza lustrada: barniz (clearcoat) sobre la veta.
  const madera = new THREE.MeshPhysicalMaterial({
    map: mapaMadera, bumpMap: mapaMadera, bumpScale: 0.45, color: 0xffffff, metalness: 0.05, roughness: 0.4,
    clearcoat: 0.5, clearcoatRoughness: 0.22,
  });
  const sombras = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const torno = (puntos, material, segmentos = 96) => {
    const m = sombras(new THREE.Mesh(new THREE.LatheGeometry(puntos, segmentos), material));
    grupo.add(m);
    return m;
  };

  // --- Base de madera en dos cuerpos, casi tan alta como el cuenco: arriba un tambor (donde van las
  // placas) y abajo un plato mucho más ancho, con el canto moldurado (ogee). ---
  torno([
    [0.915, -3.43], [0.905, -3.2], [0.92, -3.05], [0.97, -2.985], [0.985, -2.95], [0.95, -2.94], [0.88, -3.0], [0, -3.0],
  ].map(P), madera);
  torno([
    [0, -4.18], [1.3, -4.18], [1.38, -4.15], [1.42, -4.06], [1.41, -3.9], [1.36, -3.8], [1.39, -3.7], [1.43, -3.6],
    [1.42, -3.5], [1.36, -3.455], [1.15, -3.435], [0.9, -3.42],
  ].map(P), madera, 128);

  // --- Las 15 placas, una por título, chicas, sobre el tambor. ---
  const placas = [];
  const RADIO_TAMBOR = X(0.915);
  const Y_PLACAS = Y(-3.2);
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
    const placa = sombras(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.19, 0.03), mat));
    const radio = RADIO_TAMBOR + 0.012;
    // El ángulo sale de una función pura (src/data/historia.js): 0 es el frente, positivo a la derecha.
    placa.position.set(Math.sin(p.angulo) * radio, Y_PLACAS, Math.cos(p.angulo) * radio);
    placa.rotation.y = p.angulo;
    placa.userData = { anio: p.anio, angulo: p.angulo, brillo: 0, objetivo: 0, radio };
    grupo.add(placa);
    placas.push(placa);
  }

  // --- Pie en campana ancha, nudo gordo tipo balaustre (urna), cuello y anillo de unión. Una sola
  // curva suave pasa por cada medida. ---
  const pie = new THREE.SplineCurve([
    [0.5, -1.92], [0.4, -1.96], [0.34, -2.0], [0.43, -2.07], [0.48, -2.16], [0.43, -2.3], [0.27, -2.45], [0.3, -2.54],
    [0.4, -2.62], [0.66, -2.68], [0.8, -2.78], [0.86, -2.92], [0.855, -3.01], [0.83, -3.04],
  ].map(P));
  torno([...pie.getPoints(140), P([0.5, -3.04]), P([0, -3.04])], plata, 96);
  const anillo = sombras(new THREE.Mesh(new THREE.CylinderGeometry(X(0.51), X(0.5), Y(-1.8) - Y(-1.92), 64, 1), plata));
  anillo.position.y = (Y(-1.8) + Y(-1.92)) / 2;
  grupo.add(anillo);

  // --- Cuenco cromado, casi recto, con el labio fino. ---
  const exterior = new THREE.SplineCurve([[0.62, -1.75], [0.8, -1.55], [0.9, -1.25], [0.96, -0.65], [1.0, 0]].map(P));
  const interior = new THREE.SplineCurve([[0.965, -0.02], [0.94, -0.65], [0.86, -1.25], [0.74, -1.5], [0.5, -1.62], [0, -1.65]].map(P));
  torno([
    P([0, -1.78]), P([0.4, -1.78]),
    ...exterior.getPoints(48),
    P([1.008, 0.01]), P([0.99, 0.025]), P([0.972, 0.01]),
    ...interior.getPoints(30),
  ], plata, 128);

  // --- Asas: chapa dorada plana (latón pulido), con la forma medida sobre la foto. Están en el plano
  // radial, así que de frente se ve su contorno: un brazo superior que sale del borde, una esquina
  // redondeada y un brazo inferior que baja en diagonal hacia el cuenco. El hueco es una lágrima
  // alargada. Los dos extremos entran en la pared del cuenco: nada queda suelto. La izquierda es
  // la derecha espejada. ---
  const trazo = (pts) => new THREE.CatmullRomCurve3(pts.map(([r, y]) => new THREE.Vector3(X(r), Y(y), 0)), false, 'centripetal')
    .getPoints(60).map((v) => [v.x, v.y]);
  const contornoAsa = [
    ...trazo([[0.97, 0.07], [1.0, 0.08], [1.16, 0.15], [1.22, 0.11], [1.65, 0.21], [1.89, 0.02], [1.93, -0.16], [1.77, -0.65], [1.52, -1.07], [1.22, -1.44], [0.85, -1.68]]),
    ...[[0.72, -1.6]].map(([r, y]) => [X(r), Y(y)]),
    ...trazo([[0.74, -1.56], [0.79, -1.56], [1.28, -1.26], [1.59, -0.77], [1.71, -0.28], [1.59, -0.1], [1.04, -0.1], [0.97, -0.1]]),
  ];
  const ESPESOR_ASA = 0.07 * R;
  const BISEL_ASA = 0.019;
  const oroAsa = new THREE.MeshStandardMaterial({ color: 0xcfae4c, metalness: 1, roughness: 0.24 });
  for (const lado of [1, -1]) {
    const forma = new THREE.Shape(contornoAsa.map(([x, y]) => new THREE.Vector2(x * lado, y)));
    const geo = new THREE.ExtrudeGeometry(forma, {
      depth: ESPESOR_ASA - 2 * BISEL_ASA, steps: 1, curveSegments: 1,
      bevelEnabled: true, bevelThickness: BISEL_ASA, bevelSize: 0.012, bevelOffset: 0, bevelSegments: 2,
    });
    geo.translate(0, 0, -(ESPESOR_ASA - 2 * BISEL_ASA) / 2);
    grupo.add(sombras(new THREE.Mesh(geo, oroAsa)));
  }

  // --- El escudo de la R, integrado al cuenco. Es un parche del mismo torno (LatheGeometry con
  // un ángulo corto) un pelo por fuera de la pared: así sigue la curva del cuenco y no flota en
  // los bordes. La silueta sale del mapa alfa; el relieve, del bumpMap; el filete plateado es
  // además un tubo de verdad que sube del metal. ---
  const E = texturasEscudo();
  const largo = exterior.getLength();
  const ALTO_ESCUDO = 0.83 * R;
  const ANCHO_ESCUDO = 0.65 * R;
  const BASE_ESCUDO = Y(-0.5) - ALTO_ESCUDO / 2;
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
  // Filete: el contorno del escudo llevado a 3D sobre el mismo parche.
  const aLaPared = ([u, v]) => {
    const q = enParche(u0 + v * du);
    const fi = (u - 0.5) * giro;
    return new THREE.Vector3(Math.sin(fi) * (q.x + 0.006), q.y, Math.cos(fi) * (q.x + 0.006));
  };
  const borde = new THREE.CatmullRomCurve3(E.contorno.map(aLaPared), true, 'centripetal');
  grupo.add(sombras(new THREE.Mesh(new THREE.TubeGeometry(borde, 220, 0.012, 8, true), plata)));

  return { grupo, placas, ancho: 5.5, alto: 6.3, centro: new THREE.Vector3(0, 3.05, 0), frente: 0 };
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
