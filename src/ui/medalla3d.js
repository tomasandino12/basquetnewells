import * as THREE from '/public/vendor/three/three.module.min.js';
import { OrbitControls } from '/public/vendor/three/OrbitControls.js';
import { RoomEnvironment } from '/public/vendor/three/RoomEnvironment.js';

/**
 * La medalla oficial de la Asociación Rosarina en 3D, en su propio visor (sección de cierre de
 * "Nuestra historia"). Tiene renderer, escena y bucle propios, porque va en un lugar distinto de la
 * página que la copa; src/ui/historia.js la trae con `import()` recién cuando la sección se acerca.
 * No importa nada de la UI ni de vitrina3d.js.
 *
 * Referencia: docs/privado/historia-referencias/medalla-arbb-frente-dorso-hd.webp (fuera de git) y
 * medallas-arbb.png. Es una pieza de peltre o plata envejecida con los bajorrelieves oscurecidos:
 *  - Cuerpo: un disco con bisel perimetral y una ojuela de arriba, trapezoidal con las esquinas
 *    redondeadas, FUNDIDA en la misma silueta (una sola extrusión), con un hueco oblongo.
 *  - Frente, de afuera hacia adentro: una corona de espigas finas, el anillo con "ASOCIACION ROSARINA
 *    DE BASQUETBOL" arriba y "• FUNDADA EN 1926 •" abajo (1926 es el año del centenario de la ARBB),
 *    el fondo con los gajos de la pelota y el escudo en relieve con "ARBB", bastones verticales y la "R".
 *  - Dorso: un aro liso y una pelota de básquet granulada (pebbled), con el eje polar rotado -40°.
 *    Sólo las cuatro costuras reales: meridiano, ecuador y las dos curvas laterales en "C".
 *  - Cinta roja y azul oscuro, acanalada (grosgrain), en lazo: pasa por el hueco y sube por delante y
 *    por detrás de la ojuela.
 *
 * Texturas de 1024×1024 dibujadas en canvas (`map`, `bumpMap` y `roughnessMap`), así que no hay un
 * solo archivo de imagen que bajar. La textura cubre x ∈ [-R, R] e y ∈ [-R, 2,3] para que la ojuela
 * también tenga su pedazo (el eje vertical va estirado: ver K_V y `coordenadas`).
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
const TAB = { base: 0.74, tope: 0.58, y: 2.14, esquina: 0.13 }; // la ojuela: medio ancho en la base y arriba, altura y radio de las esquinas
const HUECO = { y: 1.84, hx: 0.48, hy: 0.105, r: 0.06 }; // el hueco oblongo para la cinta
const Y_MIN = -R;
const Y_MAX = 2.3;
const K_V = (2 * R) / (Y_MAX - Y_MIN); // la textura estira el eje vertical: el disco ocupa K_V del alto
const N = 1024;
const C = N / 2; // el centro del disco, en px de textura
const Y_PIVOTE = HUECO.y + 4.4; // de dónde cuelga todo
const ANCHO_CINTA = 0.9;
const INCLINACION_PELOTA = -40; // grados: el eje polar de la pelota rota hacia arriba y a la izquierda

// El color del metal: peltre cálido, un poco más claro en lo alto del relieve y oscuro en lo hundido.
const BASE = '#85847f';
const CLARO = '#c2c1bc';
const gris = (n) => `rgb(${n},${n},${n})`;
// Alturas del relieve (128 es el plano medio; más alto = más alto).
const NIVEL = { plano: 150, banda: 122, fondo: 100, escudo: 178, estria: 135 };

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

/** Suma ruido (±amp) a un canvas: el grano fino del metal. */
function granear(g, amp, semilla) {
  const r = azar(semilla);
  const img = g.getImageData(0, 0, N, N);
  for (let i = 0; i < img.data.length; i += 4) {
    const d = (r() - 0.5) * amp;
    img.data[i] += d;
    img.data[i + 1] += d;
    img.data[i + 2] += d;
  }
  g.putImageData(img, 0, 0);
}

const cederPaso = () => new Promise((ok) => requestAnimationFrame(() => ok()));

// ---------------------------------------------------------------------------
// Texturas: una cara de la medalla = color + relieve (+ rugosidad, derivada del relieve)
// ---------------------------------------------------------------------------

/**
 * Una cara: dos canvas de 1024×1024, el color (peltre) y el relieve (128 = plano, claro = alto,
 * oscuro = hundido). Se dibuja en "coordenadas de disco" (el centro en C, el radio del disco en 512 px,
 * y hacia abajo); `disco()` deja puesta la transformación que estira el eje vertical, y `plano()` la saca
 * para los rellenos y filtros de todo el canvas.
 */
function crearCara(semilla) {
  const [color, c] = lienzo(N, N);
  const [relieve, b] = lienzo(N, N);
  const ambos = [c, b];
  const az = azar(semilla);
  const plano = () => ambos.forEach((g) => g.setTransform(1, 0, 0, 1, 0, 0));
  const disco = () => ambos.forEach((g) => g.setTransform(1, 0, 0, K_V, 0, N * (1 - K_V)));

  plano();
  c.fillStyle = BASE;
  c.fillRect(0, 0, N, N);
  b.fillStyle = gris(NIVEL.plano);
  b.fillRect(0, 0, N, N);
  disco();

  const api = {
    color,
    relieve,
    c,
    b,
    plano,
    disco,
    az,
    /** Rellena una forma en el color y a una altura de relieve. `trazar(g)` arma el camino. */
    rellenar(trazar, tono, nivel) {
      c.fillStyle = tono;
      b.fillStyle = gris(nivel);
      for (const g of ambos) {
        trazar(g);
        g.fill();
      }
    },
    /** Una corona entre dos radios, un escalón más baja (y más oscura): los fondos de cada zona. */
    corona(r0, r1, tono, nivel) {
      api.rellenar((g) => { g.beginPath(); g.arc(C, C, r1, 0, TAU); if (r0 > 0) g.arc(C, C, r0, 0, TAU, true); }, tono, nivel);
    },
    /** Una línea grabada (hundida y oscura). */
    grabar(trazar, ancho = 5) {
      for (const [g, tinta] of [[c, 'rgba(34,33,30,.8)'], [b, '#1a1a1a']]) {
        g.lineJoin = g.lineCap = 'round';
        g.strokeStyle = tinta;
        g.lineWidth = ancho;
        trazar(g);
        g.stroke();
      }
    },
    anillo(radio, ancho) {
      api.grabar((g) => { g.beginPath(); g.arc(C, C, radio, 0, TAU); }, ancho);
    },
    /** Relieve alto: texto o forma clara con un halo oscuro que la despega del fondo. `dibujar(g)` rellena o traza. */
    elevar(dibujar, halo = 5) {
      for (const [g, tinta, sombra] of [[c, CLARO, 'rgba(30,29,27,.85)'], [b, '#f4f4f4', 'rgba(255,255,255,.95)']]) {
        g.shadowColor = sombra;
        g.shadowBlur = halo;
        g.fillStyle = g.strokeStyle = tinta;
        g.lineJoin = g.lineCap = 'round';
        dibujar(g);
      }
      c.shadowBlur = b.shadowBlur = 0;
    },
    /** Texto en arco, letra por letra. `sentido`: 1 sigue el reloj desde arriba; -1 es el texto de abajo (se lee de izquierda a derecha). */
    textoEnArco(texto, radio, centro, ancho, { fuente, sentido = 1, halo = 4 }) {
      for (const g of ambos) {
        g.font = fuente;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
      }
      const letras = [...texto];
      const medidas = letras.map((ch) => c.measureText(ch).width);
      const total = medidas.reduce((s, w) => s + w, 0);
      const hueco = (ancho * radio - total) / (letras.length - 1);
      let recorrido = 0;
      letras.forEach((ch, i) => {
        const mitad = (recorrido + medidas[i] / 2) / radio; // ángulo desde el principio del texto
        recorrido += medidas[i] + hueco;
        if (ch === ' ') return;
        // Arriba: empieza a la izquierda (-ancho/2) y sigue el reloj. Abajo: la misma lectura, con la letra mirando hacia adentro.
        const a = sentido === 1 ? centro - ancho / 2 + mitad : centro + ancho / 2 - mitad;
        api.elevar((g) => {
          g.save();
          g.translate(C, C);
          g.rotate(a);
          g.translate(0, sentido === 1 ? -radio : radio);
          g.fillText(ch, 0, 0);
          g.restore();
        }, halo);
      });
    },
    /** Lo que da edad: manchas de pátina, rayones y las huellas del uso. Va al final. */
    envejecer() {
      plano();
      for (let i = 0; i < 70; i++) {
        const x = az() * N;
        const y = az() * N;
        const rad = 30 + az() * 90;
        const m = c.createRadialGradient(x, y, 0, x, y, rad);
        m.addColorStop(0, `rgba(44,42,37,${0.1 + az() * 0.16})`);
        m.addColorStop(1, 'rgba(58,56,50,0)');
        c.fillStyle = m;
        c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 26; i++) { // zonas gastadas, más claras y pulidas
        const x = az() * N;
        const y = az() * N;
        const rad = 40 + az() * 110;
        const m = c.createRadialGradient(x, y, 0, x, y, rad);
        m.addColorStop(0, `rgba(236,235,230,${0.05 + az() * 0.08})`);
        m.addColorStop(1, 'rgba(236,235,230,0)');
        c.fillStyle = m;
        c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 90; i++) { // rayones finos, de a pares claro y oscuro
        const x = az() * N;
        const y = az() * N;
        const largo = 30 + az() * 170;
        const ang = az() * TAU;
        c.strokeStyle = `rgba(${az() > 0.5 ? '255,255,255' : '40,39,36'},${0.06 + az() * 0.1})`;
        c.lineWidth = 1 + az();
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(ang) * largo, y + Math.sin(ang) * largo);
        c.stroke();
      }
      granear(c, 18, semilla + 1);
      granear(b, 7, semilla + 2);
    },
  };
  return api;
}

/** La rugosidad (canal G) sale del relieve: lo hundido es más áspero y lo alto más pulido, más el ruido del uso. */
function mapaRugosidad(relieve, semilla) {
  const [rug, g] = lienzo(N, N);
  const r = azar(semilla);
  const origen = relieve.getContext('2d').getImageData(0, 0, N, N).data;
  const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = clamp(158 + (150 - origen[i * 4]) * 0.5 + (r() - 0.5) * 44, 38, 238);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) { // manchas grandes: el metal no brilla parejo
    const x = r() * N;
    const y = r() * N;
    const rad = 40 + r() * 120;
    const m = g.createRadialGradient(x, y, 0, x, y, rad);
    m.addColorStop(0, r() > 0.5 ? 'rgba(235,235,235,.28)' : 'rgba(70,70,70,.28)');
    m.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = m;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return rug;
}

/**
 * Las costuras de una pelota de básquet, de radio 1, vistas de frente. Son las cuatro que existen:
 * el meridiano, el ecuador (perpendicular) y las dos curvas laterales en "C", que son círculos menores de la
 * esfera (la parte que se ve) y se abren hacia afuera. Cada una es una lista de puntos [x, y] (y hacia arriba).
 */
function costurasPelota() {
  const alfa = grados(75);
  const beta = grados(60.5);
  const t0 = Math.asin(Math.min(1, (Math.cos(alfa) * Math.cos(beta)) / (Math.sin(alfa) * Math.sin(beta))));
  const lateral = (lado) => {
    const pts = [];
    for (let k = 0; k <= 160; k++) {
      const t = Math.PI - t0 + ((Math.PI + 2 * t0) * k) / 160; // sólo la parte de la esfera que mira al frente (z ≥ 0)
      const x = Math.cos(beta) * Math.sin(alfa) + Math.sin(beta) * Math.sin(t) * Math.cos(alfa);
      pts.push([lado * x, Math.sin(beta) * Math.cos(t)]);
    }
    return pts;
  };
  return [[[-1, 0], [1, 0]], [[0, -1], [0, 1]], lateral(1), lateral(-1)];
}

/** Lleva un punto de la pelota (x, y de -1 a 1, y hacia arriba) al disco, con su inclinación. */
function enLaPelota(cx, cy, rho, grad) {
  const f = grados(-grad); // el eje polar rota `grad` grados: con -40 mira arriba y a la izquierda
  const cos = Math.cos(f);
  const sen = Math.sin(f);
  return ([x, y]) => [cx + rho * (x * cos - y * sen), cy - rho * (x * sen + y * cos)];
}

/** El frente: corona de espigas, anillo con el nombre, gajos de pelota de fondo y el escudo con "ARBB" y la "R". */
function texturasFrente() {
  const t = crearCara(7);
  const { c, b } = t;
  const FUENTE = '600 68px Candara, "Gill Sans", "Trebuchet MS", "Segoe UI", Arial, sans-serif';

  // Fondos de cada zona, de afuera hacia adentro (radios en px sobre un radio total de 512).
  t.corona(428, 472, 'rgba(46,45,41,.55)', NIVEL.banda); // la franja de las espigas
  t.corona(338, 424, 'rgba(40,39,36,.62)', NIVEL.banda - 6); // el anillo del nombre
  t.corona(0, 330, 'rgba(30,29,26,.72)', NIVEL.fondo); // el campo central
  t.anillo(478, 5);
  t.anillo(474, 2.4);
  t.anillo(427, 3.5);
  t.anillo(423, 2.4);
  t.anillo(336, 5);
  t.anillo(330, 2.4);

  // La corona de espigas: chevrones finos, todos mirando para afuera, como hojitas de trigo.
  const ESPIGAS = 120;
  for (let i = 0; i < ESPIGAS; i++) {
    t.elevar((g) => {
      g.save();
      g.translate(C, C);
      g.rotate((i / ESPIGAS) * TAU);
      g.translate(0, -451);
      g.lineWidth = 4.8;
      g.beginPath();
      g.moveTo(-10, 12);
      g.lineTo(0, -5);
      g.lineTo(10, 12);
      g.stroke();
      g.restore();
    }, 2.4);
  }

  // El nombre arriba (de abajo a la izquierda hasta abajo a la derecha, pasando por arriba) y la leyenda abajo.
  t.textoEnArco('ASOCIACION ROSARINA DE BASQUETBOL', 381, 0, grados(244), { fuente: FUENTE, halo: 4 });
  t.textoEnArco('FUNDADA EN 1926', 380, 0, grados(60), { fuente: '600 46px Candara, "Gill Sans", "Trebuchet MS", "Segoe UI", Arial, sans-serif', sentido: -1, halo: 3 });
  for (const lado of [-1, 1]) { // los dos puntos que flanquean la leyenda
    t.elevar((g) => {
      g.beginPath();
      g.arc(C + Math.sin(Math.PI + lado * grados(43)) * 381, C - Math.cos(Math.PI + lado * grados(43)) * 381, 10, 0, TAU);
      g.fill();
    }, 4);
  }

  // Los gajos de la pelota, de fondo: el círculo y las cuatro costuras, grabados finos.
  const aDisco = enLaPelota(C, C + 8, 312, INCLINACION_PELOTA);
  t.grabar((g) => { g.beginPath(); g.arc(C, C + 8, 312, 0, TAU); }, 10);
  for (const costura of costurasPelota()) {
    t.grabar((g) => {
      g.beginPath();
      costura.forEach((p, i) => { const [x, y] = aDisco(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    }, 9);
  }

  // El escudo: recto arriba, lados rectos y punta abajo.
  const AN = 436;
  const AL = 596;
  const X0 = C - AN / 2;
  const Y0 = C + 14 - AL / 2;
  const aPx = ([x, v]) => [X0 + x * AN, Y0 + (1 - v) * AL];
  const camino = (pts) => (g) => {
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = aPx(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath();
  };
  const contorno = contornoEscudo();
  t.rellenar(camino(contorno), '#b4b3ae', NIVEL.escudo); // el cuerpo, un escalón sobre el campo
  t.grabar(camino(contorno), 11);
  const interior = achicar(contorno, 0.88);
  t.grabar(camino(interior), 4);
  // La zona de los bastones: hundida, con rayitas verticales finas que la despegan del fondo.
  const zona = achicar(contorno, 0.84);
  t.rellenar(camino(zona), 'rgba(30,29,26,.7)', NIVEL.estria);
  for (const g of [c, b]) {
    g.save();
    camino(zona)(g);
    g.clip();
    const [x0] = aPx([0.05, 0]);
    const [x1] = aPx([0.95, 0]);
    const [, ySup] = aPx([0.5, 0.78]);
    for (let x = x0; x < x1; x += 8.5) {
      g.strokeStyle = g === c ? 'rgba(212,211,206,.34)' : '#b4b4b4';
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(x, ySup);
      g.lineTo(x, Y0 + AL);
      g.stroke();
      g.strokeStyle = g === c ? 'rgba(20,20,18,.55)' : '#2a2a2a';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x + 4.2, ySup);
      g.lineTo(x + 4.2, Y0 + AL);
      g.stroke();
    }
    g.restore();
  }
  // La franja de arriba, donde va "ARBB": plana y clara, separada por una línea.
  const [xa, yb] = aPx([0.07, 0.8]);
  const [xb] = aPx([0.93, 0.8]);
  t.grabar((g) => { g.beginPath(); g.moveTo(xa, yb); g.lineTo(xb, yb); }, 5);
  t.elevar((g) => {
    g.font = '900 92px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ARBB', C, aPx([0.5, 0.9])[1] + 5);
  }, 4);
  // La "R", grande, clara y en relieve.
  t.elevar((g) => {
    g.font = '900 440px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(C, C + 74);
    g.scale(0.7, 1);
    g.fillText('R', 0, 0);
    g.restore();
  }, 9);

  t.envejecer();
  return { color: t.color, relieve: t.relieve };
}

/** Una pelota hecha de bolitas: sprites con degradé, para el color y para el relieve. */
function spritesDeBolita() {
  const hacer = (rgb, a) => {
    const [s, g] = lienzo(32, 32);
    const d = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    d.addColorStop(0, `rgba(${rgb},${a})`);
    d.addColorStop(0.55, `rgba(${rgb},${a * 0.62})`);
    d.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = d;
    g.fillRect(0, 0, 32, 32);
    return s;
  };
  return { alto: hacer('255,255,255', 1), luz: hacer('196,195,190', 0.7), sombra: hacer('24,23,21', 0.7) };
}

/** El dorso: un aro liso y la pelota granulada en relieve, con sus cuatro costuras hundidas. */
function texturasDorso() {
  const t = crearCara(31);
  const { c, b } = t;
  const RHO = 424; // radio de la pelota

  t.anillo(474, 5.5);
  t.anillo(458, 2.6);
  t.corona(430, 452, 'rgba(62,61,57,.45)', NIVEL.banda - 8); // el canal entre el aro y la pelota
  t.anillo(452, 3.5);
  t.anillo(430, 5);

  // La pelota: un suelo más bajo y, encima, las bolitas. Se reparten en una retícula de Fibonacci sobre la
  // esfera (sin polos marcados) y se achatan hacia el borde como en una pelota de verdad.
  const cx = C;
  const cy = C + 2;
  t.rellenar((g) => { g.beginPath(); g.arc(cx, cy, RHO, 0, TAU); }, '#58574f', 98);
  const sp = spritesDeBolita();
  const giro = grados(-INCLINACION_PELOTA);
  const cos = Math.cos(giro);
  const sen = Math.sin(giro);
  const paso = 34;
  const M = Math.round((4 * Math.PI * RHO * RHO) / (paso * paso));
  const dorado = Math.PI * (3 - Math.sqrt(5));
  const az = t.az;
  const bolita = (g, img, x, y, ang, a, e, d) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale((a * e) / 16, a / 16);
    g.drawImage(img, -16 + d / (a * e), -16 + d / a);
    g.restore();
  };
  for (let i = 0; i < M; i++) {
    const y = 1 - (2 * (i + 0.5)) / M;
    const rr = Math.sqrt(1 - y * y);
    const th = i * dorado;
    const x = Math.cos(th) * rr;
    const z = Math.sin(th) * rr;
    if (z < 0.1) continue;
    // Hacia la pantalla: x, y con la inclinación de la pelota.
    const px = cx + RHO * (x * cos - y * sen) * 0.985;
    const py = cy - RHO * (x * sen + y * cos) * 0.985;
    const ang = Math.atan2(-(x * sen + y * cos), x * cos - y * sen); // el eje radial de la bolita
    const tam = (paso * 0.6) * (0.94 + az() * 0.12);
    bolita(c, sp.sombra, px, py, ang, tam, z, 1.7);
    bolita(c, sp.luz, px, py, ang, tam, z, -0.9);
    bolita(b, sp.alto, px, py, ang, tam, z, 0);
  }
  // La esfera se oscurece hacia el borde y brilla arriba a la izquierda (de donde la mira la luz).
  c.save();
  c.beginPath();
  c.arc(cx, cy, RHO, 0, TAU);
  c.clip();
  const dome = c.createRadialGradient(cx - RHO * 0.3, cy - RHO * 0.32, RHO * 0.08, cx, cy, RHO);
  dome.addColorStop(0, 'rgba(255,255,250,.13)');
  dome.addColorStop(0.5, 'rgba(255,255,250,0)');
  dome.addColorStop(1, 'rgba(14,14,12,.4)');
  c.fillStyle = dome;
  c.fillRect(0, 0, N, N);
  c.restore();

  // Las cuatro costuras, hundidas en el relieve (y oscuras en el color). Cortan las bolitas.
  const aDisco = enLaPelota(cx, cy, RHO * 0.985, INCLINACION_PELOTA);
  for (const costura of costurasPelota()) {
    t.grabar((g) => {
      g.save();
      g.beginPath();
      g.arc(cx, cy, RHO, 0, TAU);
      g.clip();
      g.beginPath();
      costura.forEach((p, i) => { const [x, y] = aDisco(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.restore();
    }, 22);
  }

  t.envejecer();
  return { color: t.color, relieve: t.relieve };
}

/** La silueta del escudo del logo de la Asociación Rosarina, en coordenadas de 0 a 1 (v hacia arriba). */
function contornoEscudo(pasos = 48) {
  const mitad = 0.46;
  const der = [[0.5 + mitad + 0.025, 1], [0.5 + mitad, 0.94], [0.5 + mitad, 0.5]];
  for (let k = 1; k <= pasos; k++) {
    const s = k / pasos;
    der.push([0.5 + mitad * (1 - s ** 1.5), 0.5 * (1 - s)]);
  }
  const izq = der.slice(0, -1).reverse().map(([x, v]) => [1 - x, v]);
  return [...der, ...izq];
}
const achicar = (pts, f, cx = 0.5, cv = 0.52) => pts.map(([x, v]) => [cx + (x - cx) * f, cv + (v - cv) * f]);

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

/** La cinta: roja y azul oscuro, partida al medio, acanalada como un grosgrain (canales cruzados y hilos a lo largo). */
function texturasCinta() {
  const W = 128;
  const [color, c] = lienzo(W, W);
  const [relieve, b] = lienzo(W, W);
  const r = azar(41);
  const img = c.createImageData(W, W);
  const bump = b.createImageData(W, W);
  const ROJO = [150, 10, 26];
  const AZUL = [16, 22, 58];
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const rojo = u < 0.58;
      const col = rojo ? ROJO : AZUL;
      const canal = 0.5 + 0.5 * Math.sin((y / 4) * TAU); // los canales: una cresta cada 4 px
      const hilo = (x % 3 === 0 ? 0.06 : 0) + (r() - 0.5) * 0.1; // los hilos de la urdimbre, a lo largo
      const costura = Math.abs(u - 0.58) < 0.012 ? 0.62 : 1; // el cambio de color
      const k = (0.74 + canal * 0.32 + hilo) * costura;
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
 * y canto/biseles) para darle a cada uno su material. Las UV de las caras salen de la posición (x, y),
 * mirrored en el dorso, con el mapeo de las texturas (ver `crearCara`).
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
  renderer.toneMappingExposure = 0.95;
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

  // --- Las texturas, de a una cara por cuadro. ---
  await cederPaso();
  const frente = texturasFrente();
  await cederPaso();
  const dorso = texturasDorso();
  await cederPaso();
  const rugFrente = mapaRugosidad(frente.relieve, 11);
  const rugDorso = mapaRugosidad(dorso.relieve, 12);

  const metal = (cara, rug) => new THREE.MeshStandardMaterial({
    map: aTextura(cara.color, { color: true, aniso }),
    bumpMap: aTextura(cara.relieve, { aniso }),
    bumpScale: 4,
    roughnessMap: aTextura(rug, { aniso }),
    roughness: 1,
    metalness: 0.88,
  });
  const cantoTex = aTextura(texturaCanto(), { color: true, aniso, repetir: [8, 1] });
  const matCanto = new THREE.MeshStandardMaterial({ map: cantoTex, bumpMap: cantoTex, bumpScale: 1.2, roughness: 0.5, metalness: 0.9, color: 0xc7c6c1 });

  // --- La medalla y su cinta, colgadas de un pivote arriba (el péndulo gira alrededor de él). ---
  const pendulo = new THREE.Group();
  pendulo.position.set(0, Y_PIVOTE, 0);
  const colgante = new THREE.Group();
  colgante.position.set(0, -Y_PIVOTE, 0);
  pendulo.add(colgante);
  scene.add(pendulo);

  const cuerpo = new THREE.Mesh(geometriaCuerpo(), [metal(frente, rugFrente), metal(dorso, rugDorso), matCanto]);
  colgante.add(cuerpo);

  const { geo: geoCinta } = geometriaCinta();
  const tc = texturasCinta();
  const cinta = new THREE.Mesh(geoCinta, new THREE.MeshPhysicalMaterial({
    map: aTextura(tc.color, { color: true, aniso, repetir: [1, 1.2] }),
    bumpMap: aTextura(tc.relieve, { aniso, repetir: [1, 1.2] }),
    bumpScale: 1.6,
    color: 0xb4b4b4,
    roughness: 0.88,
    metalness: 0,
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
