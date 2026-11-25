import * as THREE from '/public/vendor/three/three.module.min.js';
import { aTextura, azar, lienzo, contornoEscudo, achicar } from './vitrina3d.js';

/**
 * La medalla oficial de la Asociación Rosarina en 3D, colgando de su cinta. Es la segunda pieza de
 * la vitrina (la primera es la copa, en vitrina3d.js): no tiene renderer propio. `crearMedalla`
 * devuelve la pieza con la misma forma que la copa (`grupo`, `ancho`, `alto`, `centro`) y
 * `vitrina3d.js` la alterna con `mostrarPieza`, así que sigue habiendo un solo contexto WebGL.
 *
 * Se arma recién cuando se elige o cuando la página llega a "Las 15 estrellas" (vitrina3d la importa
 * con `import()`), y no importa nada de la UI.
 *
 * Referencia: docs/privado/historia-referencias/medallas-arbb.png (fuera de git). Es una medalla de
 * plata vieja, de una sola tinta: borde perlado, el anillo "ASOCIACIÓN ROSARINA DE BASQUETBOL", un
 * balón grabado de fondo y, al centro, el escudo con "ARBB" y la "R". Ojal rectangular arriba y cinta
 * roja y azul. Se dibuja entera en canvas (color + relieve) sobre un disco con un poco de domo, y el
 * dorso queda liso, sin datos inventados.
 *
 * El péndulo: la cinta es una tira que se dobla (el ángulo crece hacia abajo) y la medalla cuelga
 * de su extremo. Dos grados de libertad con inercia: el balanceo (péndulo amortiguado) y el giro
 * sobre su eje, que tiene dos reposos estables, de frente y de dorso, como una cinta que se destuerce.
 * Con movimiento reducido no hay balanceo ni inercia: sólo gira lo que el dedo o el mouse giran.
 */

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Medidas del modelo (unidades de la escena; el disco mide 3 de diámetro).
const R = 1.5; // radio del disco
const R_CARA = 1.4; // radio de la cara grabada (adentro del borde)
const T_CARA = 0.034; // altura de las caras: el borde sobresale
const T_BORDE = 0.056; // semiespesor del borde
const DOMO = 0.014; // cuánto abomba la cara en el centro: da un degradé de reflejo
const Y_DISCO = -(0.22 + R); // centro del disco, medido desde el ojal
const LARGO_CINTA = 3.2;
const ANCHO_CINTA = 0.56;
const Y_OJAL = 4.45; // altura del ojal en reposo
const Y_PIVOTE = Y_OJAL + LARGO_CINTA;
const Z_CINTA = 0.064; // la cinta pasa por delante del ojal

// ---------------------------------------------------------------------------
// Texturas dibujadas en canvas
// ---------------------------------------------------------------------------

/** Suma ruido (±amp) a un canvas: el grano fino del metal. */
function granear(g, ancho, alto, amp, semilla) {
  const r = azar(semilla);
  const img = g.getImageData(0, 0, ancho, alto);
  for (let i = 0; i < img.data.length; i += 4) {
    const d = (r() - 0.5) * amp;
    img.data[i] += d;
    img.data[i + 1] += d;
    img.data[i + 2] += d;
  }
  g.putImageData(img, 0, 0);
}

/**
 * Una cara de la medalla: dos canvas del mismo tamaño, el color (plata vieja) y el relieve (gris
 * medio = plano, claro = alto, oscuro = hundido). Las herramientas dibujan en los dos a la vez.
 */
function caraDeMedalla(semilla) {
  const N = 1024;
  const C = N / 2;
  const [color, c] = lienzo(N, N);
  const [relieve, b] = lienzo(N, N);
  const r = azar(semilla);
  const OSC = 'rgba(44,46,52,.92)';
  const CLARO = '#e4e6e9';

  const base = c.createRadialGradient(C * 0.85, C * 0.75, 30, C, C, C * 1.05);
  base.addColorStop(0, '#d6d8dc');
  base.addColorStop(0.65, '#c1c4c9');
  base.addColorStop(1, '#a5a8ae');
  c.fillStyle = base;
  c.fillRect(0, 0, N, N);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, N, N);

  const api = {
    color,
    relieve,
    C,
    /** Una línea grabada (hundida): `trazar(g)` arma el camino en el contexto que le pasan. */
    linea(trazar, ancho = 6) {
      for (const [g, tinta] of [[c, OSC], [b, '#0e0e0e']]) {
        g.lineJoin = g.lineCap = 'round';
        g.strokeStyle = tinta;
        g.lineWidth = ancho;
        trazar(g);
        g.stroke();
      }
    },
    anillo(radio, ancho) {
      api.linea((g) => { g.beginPath(); g.arc(C, C, radio, 0, TAU); }, ancho);
    },
    /** Una corona de perlitas: el borde perlado de la medalla. */
    perlas(radio, n, rad, desde = 0, hasta = TAU) {
      for (let i = 0; i < n; i++) {
        const a = desde + ((hasta - desde) * i) / n;
        const x = C + Math.cos(a) * radio;
        const y = C + Math.sin(a) * radio;
        for (const [g, relleno, halo, blur] of [[c, CLARO, 'rgba(26,28,34,.85)', rad * 1.3], [b, '#ffffff', '#000', rad]]) {
          g.shadowColor = halo;
          g.shadowBlur = blur;
          g.fillStyle = relleno;
          g.beginPath();
          g.arc(x, y, rad, 0, TAU);
          g.fill();
        }
      }
      c.shadowBlur = b.shadowBlur = 0;
    },
    /** Una corona (entre dos radios) un escalón más baja y más oscura: el fondo del anillo de texto. */
    banda(r0, r1, tono, nivel) {
      for (const [g, relleno] of [[c, tono], [b, nivel]]) {
        g.fillStyle = relleno;
        g.beginPath();
        g.arc(C, C, r1, 0, TAU);
        g.arc(C, C, r0, 0, TAU, true);
        g.fill();
      }
    },
    /** Relieve alto: texto o forma clara con un halo oscuro que lo despega del fondo. */
    alto(dibujar, halo = 6) {
      for (const [g, relleno, sombra] of [[c, CLARO, 'rgba(24,26,32,.9)'], [b, '#ffffff', '#ffffff']]) {
        g.shadowColor = g === c ? sombra : 'rgba(255,255,255,.9)';
        g.shadowBlur = halo;
        g.fillStyle = relleno;
        dibujar(g);
      }
      c.shadowBlur = b.shadowBlur = 0;
    },
    /** Lo que da edad: manchas de pátina, rayones y la viñeta oscura hacia el borde. Va al final. */
    envejecer() {
      for (let i = 0; i < 40; i++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * C * 0.95;
        const x = C + Math.cos(a) * d;
        const y = C + Math.sin(a) * d;
        const rad = 30 + r() * 80;
        const m = c.createRadialGradient(x, y, 0, x, y, rad);
        m.addColorStop(0, `rgba(72,68,60,${0.04 + r() * 0.07})`);
        m.addColorStop(1, 'rgba(72,68,60,0)');
        c.fillStyle = m;
        c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 70; i++) { // rayones finos, de a pares claro y oscuro
        const x = r() * N;
        const y = r() * N;
        const largo = 30 + r() * 150;
        const ang = r() * TAU;
        c.strokeStyle = `rgba(${r() > 0.5 ? '255,255,255' : '40,42,48'},${0.05 + r() * 0.08})`;
        c.lineWidth = 1 + r();
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(ang) * largo, y + Math.sin(ang) * largo);
        c.stroke();
      }
      const vi = c.createRadialGradient(C, C, C * 0.7, C, C, C);
      vi.addColorStop(0, 'rgba(40,42,48,0)');
      vi.addColorStop(1, 'rgba(40,42,48,.34)');
      c.fillStyle = vi;
      c.fillRect(0, 0, N, N);
      granear(c, N, N, 16, semilla + 1);
      granear(b, N, N, 8, semilla + 2);
    },
  };
  return api;
}

/** El frente: perlado, anillo con el nombre, balón de fondo y el escudo con "ARBB" y la "R". */
function texturasFrente() {
  const t = caraDeMedalla(7);
  const { C, linea } = t;
  const c = t.color.getContext('2d');
  const b = t.relieve.getContext('2d');
  const grados = (g) => (g * Math.PI) / 180;

  // Coronas, de afuera hacia adentro (radios en px sobre un radio total de 512).
  t.perlas(486, 176, 5.4);
  t.anillo(455, 5);
  t.banda(354, 447, 'rgba(70,72,80,.34)', '#5e5e5e');
  t.anillo(346, 6);
  t.anillo(335, 3);

  // El nombre en el anillo, de abajo a la izquierda hasta abajo a la derecha, pasando por arriba.
  const TEXTO = 'ASOCIACIÓN ROSARINA DE BASQUETBOL';
  const radioTexto = 401;
  const desde = grados(-126);
  const hasta = grados(126);
  c.font = b.font = '700 68px Georgia, "Times New Roman", serif';
  c.textAlign = b.textAlign = 'center';
  c.textBaseline = b.textBaseline = 'middle';
  const letras = [...TEXTO];
  const anchos = letras.map((ch) => c.measureText(ch).width);
  const extra = ((hasta - desde) * radioTexto - anchos.reduce((s, w) => s + w, 0)) / (letras.length - 1);
  let recorrido = 0;
  letras.forEach((ch, i) => {
    const angulo = desde + (recorrido + anchos[i] / 2) / radioTexto;
    recorrido += anchos[i] + extra;
    if (ch === ' ') return;
    t.alto((g) => {
      g.save();
      g.translate(C, C);
      g.rotate(angulo);
      g.translate(0, -radioTexto);
      g.fillText(ch, 0, 0);
      g.restore();
    }, 4);
  });
  // Dos puntos separan el principio y el final del nombre, abajo.
  // (El ángulo del canvas arranca a la derecha; el del texto, arriba: de ahí el -90°.)
  for (const lado of [-1, 1]) t.perlas(radioTexto, 1, 9, grados(lado * 142 - 90));

  // El balón: círculo, los dos ejes y las dos costuras curvas.
  const bx = C;
  const by = C + 6;
  const Rb = 316;
  linea((g) => { g.beginPath(); g.arc(bx, by, Rb, 0, TAU); }, 13);
  linea((g) => { g.beginPath(); g.moveTo(bx, by - Rb); g.lineTo(bx, by + Rb); }, 12);
  linea((g) => { g.beginPath(); g.moveTo(bx - Rb, by); g.lineTo(bx + Rb, by); }, 12);
  for (const lado of [-1, 1]) {
    linea((g) => {
      g.beginPath();
      g.moveTo(bx + lado * Rb * 0.3, by - Rb * 0.955);
      g.quadraticCurveTo(bx + lado * Rb * 1.15, by, bx + lado * Rb * 0.3, by + Rb * 0.955);
    }, 12);
  }

  // El escudo (la misma silueta que el de la copa: recto arriba, lados rectos y punta abajo).
  const AN = 540;
  const AL = 636;
  const X0 = C - AN / 2;
  const Y0 = C + 22 - AL / 2;
  const aPx = ([x, v]) => [X0 + x * AN, Y0 + (1 - v) * AL];
  const camino = (pts) => (g) => {
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = aPx(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath();
  };
  const contorno = contornoEscudo();
  // El cuerpo del escudo, un escalón más alto que el balón.
  for (const [g, relleno] of [[c, '#d3d5d9'], [b, '#a6a6a6']]) {
    g.fillStyle = relleno;
    camino(contorno)(g);
    g.fill();
  }
  linea(camino(contorno), 15);
  linea(camino(achicar(contorno, 0.9)), 6);
  linea(camino(achicar(contorno, 0.81)), 4);
  // La franja de arriba, donde va "ARBB".
  const [xa] = aPx([0.095, 0.8]);
  const [xb, yb] = aPx([0.905, 0.8]);
  linea((g) => { g.beginPath(); g.moveTo(xa, yb); g.lineTo(xb, yb); }, 6);
  c.textAlign = b.textAlign = 'center';
  c.textBaseline = b.textBaseline = 'middle';
  const [, yTexto] = aPx([0.5, 0.9]);
  for (const [g, tinta] of [[c, 'rgba(40,42,48,.95)'], [b, '#161616']]) {
    g.font = '900 84px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = tinta;
    g.fillText('ARBB', C, yTexto + 4);
  }
  // La "R", clara y en relieve.
  const [, yR] = aPx([0.5, 0.45]);
  t.alto((g) => {
    g.font = '900 350px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.fillText('R', C, yR);
  }, 9);

  t.envejecer();
  return { color: t.color, relieve: t.relieve };
}

/** El dorso: liso, con el mismo perlado y dos anillos finos. Queda libre para grabar. */
function texturasDorso() {
  const t = caraDeMedalla(31);
  const c = t.color.getContext('2d');
  const r = azar(5);
  // Cepillado en círculos concéntricos.
  for (let i = 0; i < 320; i++) {
    c.strokeStyle = `rgba(${r() > 0.5 ? '255,255,255' : '50,52,58'},${0.025 + r() * 0.05})`;
    c.lineWidth = 1 + r() * 1.5;
    c.beginPath();
    c.arc(t.C, t.C, 20 + r() * 470, 0, TAU);
    c.stroke();
  }
  t.perlas(486, 176, 5.4);
  t.anillo(455, 5);
  t.anillo(430, 3);
  t.envejecer();
  return { color: t.color, relieve: t.relieve };
}

/** El canto: grano y un estriado fino, como el borde de una moneda gastada. */
function texturaBorde() {
  const W = 512;
  const H = 64;
  const [c, g] = lienzo(W, H);
  const r = azar(3);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const estria = x % 6 < 2 ? 0.7 : 1;
      const v = 178 * estria + (r() - 0.5) * 34;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Ruido de rugosidad (lo lee el canal G): el metal no brilla parejo. */
function texturaGrano() {
  const [c, g] = lienzo(256, 256);
  const r = azar(19);
  g.fillStyle = '#d2d2d2';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const x = r() * 256;
    const y = r() * 256;
    const rad = 14 + r() * 40;
    const m = g.createRadialGradient(x, y, 0, x, y, rad);
    m.addColorStop(0, `rgba(${r() > 0.5 ? '255,255,255' : '90,90,90'},${0.1 + r() * 0.2})`);
    m.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = m;
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { g.save(); g.translate(dx, dy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); }
  }
  granear(g, 256, 256, 40, 23);
  return c;
}

/** La cinta: roja con una franja azul a cada lado, sin dibujos. Una trama fina, a mano, de tejido. */
function texturasCinta() {
  const W = 128;
  const H = 128;
  const [color, c] = lienzo(W, H);
  const [relieve, b] = lienzo(W, H);
  const r = azar(41);
  const img = c.createImageData(W, H);
  const bump = b.createImageData(W, H);
  const ROJO = [160, 8, 22];
  const AZUL = [10, 36, 104];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const azul = u < 0.15 || u > 0.85;
      const col = azul ? AZUL : ROJO;
      const trama = (((x >> 1) ^ (y >> 1)) & 1) * 0.1; // tafetán: cuadritos que se alternan
      const hilo = (y % 4 < 2 ? 0.05 : 0) + (r() - 0.5) * 0.12;
      const orilla = Math.abs(u - 0.15) < 0.012 || Math.abs(u - 0.85) < 0.012 ? 0.7 : 1; // costura entre las franjas
      const k = (0.86 + trama + hilo) * orilla;
      const i = (y * W + x) * 4;
      img.data[i] = col[0] * k;
      img.data[i + 1] = col[1] * k;
      img.data[i + 2] = col[2] * k;
      img.data[i + 3] = 255;
      const alt = 128 + trama * 700 + hilo * 300;
      bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = alt;
      bump.data[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  b.putImageData(bump, 0, 0);
  return { color, relieve };
}

/** Transparencia de la cinta: se desvanece hacia arriba, así no hay un corte seco contra la página. */
function texturaFundido() {
  const [c, g] = lienzo(8, 128);
  // v = 0 es el borde de abajo del canvas: ahí está el extremo de arriba de la cinta.
  const deg = g.createLinearGradient(0, 128, 0, 128 * 0.5);
  deg.addColorStop(0, '#000');
  deg.addColorStop(0.35, '#2a2a2a');
  deg.addColorStop(0.7, '#b0b0b0');
  deg.addColorStop(1, '#fff');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 8, 128);
  g.fillStyle = deg;
  g.fillRect(0, 128 * 0.5, 8, 128 * 0.5);
  return c;
}

// ---------------------------------------------------------------------------
// La medalla
// ---------------------------------------------------------------------------

/** Una cara del disco: un anillo con domo, de modo que el reflejo cambie suave por la superficie. */
function geometriaCara() {
  const geo = new THREE.RingGeometry(0.0001, R_CARA + 0.004, 96, 28);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = Math.min(1, Math.hypot(p.getX(i), p.getY(i)) / R_CARA);
    p.setZ(i, T_CARA + DOMO * (1 - k * k));
  }
  geo.computeVertexNormals();
  return geo;
}

/** El borde del disco: un torno con el resalto, el canto redondeado y la pared hundida hacia la cara. */
function geometriaBorde() {
  const perfil = [
    [R_CARA, T_CARA], [R_CARA + 0.012, T_BORDE - 0.006], [R_CARA + 0.03, T_BORDE], [R - 0.03, T_BORDE],
    [R - 0.008, T_BORDE - 0.016], [R, 0.014], [R, -0.014], [R - 0.008, -(T_BORDE - 0.016)], [R - 0.03, -T_BORDE],
    [R_CARA + 0.03, -T_BORDE], [R_CARA + 0.012, -(T_BORDE - 0.006)], [R_CARA, -T_CARA],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(perfil, 160);
  geo.rotateX(Math.PI / 2); // el eje del torno pasa de y a z: el disco mira hacia +z
  return geo;
}

/** El ojal: una orejita con una ranura rectangular, que baja hasta fundirse con el borde del disco. */
function geometriaOjal() {
  const forma = new THREE.Shape();
  const ARRIBA = 0.3;
  const ANCHO = 0.5;
  const RAD = 0.13;
  // La base sigue un arco del radio medio del borde: queda fundida con el disco, sin huecos ni solapes.
  const yBase = (x) => Y_DISCO + Math.sqrt(1.46 * 1.46 - x * x);
  forma.moveTo(-ANCHO, yBase(-ANCHO));
  for (let k = 0; k <= 12; k++) { const x = -ANCHO + (2 * ANCHO * k) / 12; forma.lineTo(x, yBase(x)); }
  forma.lineTo(ANCHO, ARRIBA - RAD);
  forma.absarc(ANCHO - RAD, ARRIBA - RAD, RAD, 0, Math.PI / 2, false);
  forma.lineTo(-ANCHO + RAD, ARRIBA);
  forma.absarc(-ANCHO + RAD, ARRIBA - RAD, RAD, Math.PI / 2, Math.PI, false);
  forma.lineTo(-ANCHO, yBase(-ANCHO));
  const ranura = new THREE.Path();
  const hx = 0.31;
  const hy = 0.075;
  const rr = 0.045;
  ranura.moveTo(-hx + rr, -hy);
  ranura.lineTo(hx - rr, -hy);
  ranura.absarc(hx - rr, -hy + rr, rr, -Math.PI / 2, 0, false);
  ranura.lineTo(hx, hy - rr);
  ranura.absarc(hx - rr, hy - rr, rr, 0, Math.PI / 2, false);
  ranura.lineTo(-hx + rr, hy);
  ranura.absarc(-hx + rr, hy - rr, rr, Math.PI / 2, Math.PI, false);
  ranura.lineTo(-hx, -hy + rr);
  ranura.absarc(-hx + rr, -hy + rr, rr, Math.PI, Math.PI * 1.5, false);
  forma.holes.push(ranura);
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.014, bevelSegments: 3, curveSegments: 10,
  });
  geo.translate(0, 0, -0.035);
  return geo;
}

/**
 * Arma la medalla. Devuelve la pieza: el grupo, las medidas que usa el encuadre y los ganchos que
 * usa la vitrina (`animar`, `puntero`, `alVerDeFrente`, `objetivos`).
 */
export function crearMedalla({ aniso = 4 } = {}) {
  const grupo = new THREE.Group();
  grupo.name = 'medalla';
  const medalla = new THREE.Group(); // origen: el centro de la ranura del ojal
  medalla.rotation.order = 'ZYX'; // primero gira sobre su eje (y) y después se balancea (z)
  grupo.add(medalla);

  // --- Materiales: plata vieja, brillo parejo pero no espejo. ---
  const frente = texturasFrente();
  const dorso = texturasDorso();
  const grano = aTextura(texturaGrano(), { aniso, repetir: [2, 2] });
  const metal = (cara) => new THREE.MeshStandardMaterial({
    map: aTextura(cara.color, { color: true, aniso }),
    bumpMap: aTextura(cara.relieve, { aniso }),
    bumpScale: 3,
    roughnessMap: grano,
    roughness: 0.6,
    metalness: 0.92,
    color: 0x8e9197,
  });
  const bordeTex = aTextura(texturaBorde(), { color: true, aniso, repetir: [3, 1] });
  const matBorde = new THREE.MeshStandardMaterial({
    map: bordeTex, bumpMap: bordeTex, bumpScale: 2, roughness: 0.55, metalness: 0.9, color: 0xa4a7ad,
  });
  const matOjal = new THREE.MeshStandardMaterial({
    map: grano, bumpMap: grano, bumpScale: 0.3, roughness: 0.55, metalness: 0.9, color: 0x6a6d73,
  });

  // --- El disco: borde, cara del frente y cara del dorso. ---
  const disco = new THREE.Group();
  disco.position.y = Y_DISCO;
  const borde = new THREE.Mesh(geometriaBorde(), matBorde);
  const caraFrente = new THREE.Mesh(geometriaCara(), metal(frente));
  const caraDorso = new THREE.Mesh(geometriaCara(), metal(dorso));
  caraDorso.rotation.y = Math.PI;
  disco.add(borde, caraFrente, caraDorso);
  medalla.add(disco);
  medalla.add(new THREE.Mesh(geometriaOjal(), matOjal));

  // --- La cinta: una tira que se dobla y se retuerce hacia abajo (ver `colocar`). ---
  const FILAS = 30;
  const posiciones = new Float32Array((FILAS + 1) * 2 * 3);
  const uvs = new Float32Array((FILAS + 1) * 2 * 2);
  const colores = new Float32Array((FILAS + 1) * 2 * 3);
  const indices = [];
  for (let i = 0; i <= FILAS; i++) {
    const s = i / FILAS;
    // Hacia el extremo la cinta se oscurece: es el tramo que se mete en la ranura.
    const k = 0.5 * (s > 0.93 ? 1 - 0.88 * ((s - 0.93) / 0.07) : 1);
    for (let j = 0; j < 2; j++) {
      const n = i * 2 + j;
      uvs.set([j, s], n * 2);
      colores.set([k, k, k], n * 3);
    }
    if (i < FILAS) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geoCinta = new THREE.BufferGeometry();
  geoCinta.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
  geoCinta.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geoCinta.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  geoCinta.setIndex(indices);
  const texCinta = texturasCinta();
  const repetirCinta = [1, LARGO_CINTA / ANCHO_CINTA];
  const mapaCinta = aTextura(texCinta.color, { color: true, aniso, repetir: repetirCinta });
  const matCinta = new THREE.MeshPhysicalMaterial({
    map: mapaCinta,
    bumpMap: aTextura(texCinta.relieve, { aniso, repetir: repetirCinta }),
    bumpScale: 1.6,
    alphaMap: aTextura(texturaFundido(), {}),
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.45,
    sheen: 0.12,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0x8a2a30),
    side: THREE.DoubleSide,
  });
  const cinta = new THREE.Mesh(geoCinta, matCinta);
  cinta.frustumCulled = false; // la forma cambia a cada cuadro
  grupo.add(cinta);

  // --- Luces propias: un frente cálido y un recorte de borde. Viven en el grupo, así que la copa no las ve. ---
  const frenteLuz = new THREE.DirectionalLight(0xfff0dc, 1.3);
  frenteLuz.position.set(3.4, Y_OJAL + 2.5, 9);
  frenteLuz.target.position.set(0, Y_OJAL + Y_DISCO, 0);
  const bordeLuz = new THREE.DirectionalLight(0xff6a58, 1.1);
  bordeLuz.position.set(-5, Y_OJAL, -3);
  bordeLuz.target.position.copy(frenteLuz.target.position);
  grupo.add(frenteLuz, frenteLuz.target, bordeLuz, bordeLuz.target);

  // --- El movimiento. `theta` es el balanceo (+ lleva el extremo hacia la derecha) y `psi` el giro. ---
  let theta = 0;
  let omegaT = 0;
  let psi = 0;
  let omegaP = 0;
  let objetivoPsi = null; // "Ver de frente": a dónde ir en vez de al reposo más cercano
  let arrastrando = false;
  let sucio = true; // algo cambió con movimiento reducido: hay que dibujar

  const colocar = (th, ps) => {
    let x = 0;
    let y = 0;
    const dl = LARGO_CINTA / FILAS;
    const medio = ANCHO_CINTA / 2;
    for (let i = 0; i <= FILAS; i++) {
      const s = i / FILAS;
      const a = th * s ** 1.6; // la cinta se dobla más hacia abajo
      if (i) { x += Math.sin(a) * dl; y -= Math.cos(a) * dl; }
      const tw = ps * s ** 3; // y se retuerce sólo cerca de la medalla
      const wx = Math.cos(tw) * Math.cos(a);
      const wy = Math.cos(tw) * Math.sin(a);
      const wz = Math.sin(tw);
      const o = Z_CINTA * s ** 3;
      const ox = o * Math.sin(ps);
      const oz = o * Math.cos(ps);
      posiciones.set([x - medio * wx + ox, Y_PIVOTE + y - medio * wy, -medio * wz + oz, x + medio * wx + ox, Y_PIVOTE + y + medio * wy, medio * wz + oz], i * 6);
    }
    geoCinta.attributes.position.needsUpdate = true;
    geoCinta.computeVertexNormals();
    medalla.position.set(x, Y_PIVOTE + y, 0);
    medalla.rotation.set(0, ps, th);
  };
  colocar(0, 0);

  const W0 = 2.0; // frecuencia propia del péndulo (rad/s): ~3 s por vaivén
  const ZETA = 0.07; // amortiguación: un empujón dura unos segundos
  const K_GIRO = 9;
  const C_GIRO = 2.6;
  const GIRO_POR_ANCHO = 8; // radianes de giro por cada ancho de canvas que se arrastra

  /** Un cuadro. Devuelve true mientras algo siga moviéndose (la vitrina sigue pidiendo cuadros). */
  const animar = (t, dt, reducido) => {
    if (reducido) {
      // Quieta: sin balanceo ni inercia. El giro que dio el dedo se queda donde quedó.
      theta = omegaT = omegaP = 0;
      colocar(0, psi);
      const hubo = sucio;
      sucio = false;
      return hubo;
    }
    omegaT += (-W0 * W0 * theta - 2 * ZETA * W0 * omegaT) * dt;
    theta = clamp(theta + omegaT * dt, -0.7, 0.7);
    if (!arrastrando) {
      const fuerza = objetivoPsi !== null ? -K_GIRO * (psi - objetivoPsi) : -(K_GIRO / 2) * Math.sin(2 * psi);
      omegaP += (fuerza - C_GIRO * omegaP) * dt;
      psi += omegaP * dt;
      // La cinta no se retuerce más de una vuelta: ahí frena.
      if (Math.abs(psi) > TAU) { psi = Math.sign(psi) * TAU; omegaP *= -0.3; }
      if (objetivoPsi !== null && Math.abs(psi - objetivoPsi) < 0.004 && Math.abs(omegaP) < 0.03) { psi = objetivoPsi; omegaP = 0; objetivoPsi = null; }
    }
    // Una brisa suave, que no es física sino cinemática: no cambia el reposo ni le pelea al empujón.
    const brisa = 0.05 * Math.sin(t * 1.45) + 0.022 * Math.sin(t * 2.6 + 1.3);
    colocar(theta + brisa, psi + 0.1 * Math.sin(t * 0.7));
    return true;
  };

  return {
    grupo,
    nombre: 'medalla',
    ancho: 3.7,
    alto: 7.1,
    centro: new THREE.Vector3(0, 4.45, 0),
    polar: Math.PI / 2, // la cámara mira de costado, a la altura de la pieza
    orbitar: false, // OrbitControls apagado: el arrastre gira la medalla, no la cámara
    piso: false, // cuelga: sin sombra de piso
    etiqueta: 'La medalla oficial de la Asociación Rosarina colgando de su cinta roja y azul, en 3D. Arrastrala para girarla y ver el dorso.',
    pista: 'Arrastrá para girarla y ver el dorso',
    objetivos: [borde, caraFrente, caraDorso],
    animar,
    /**
     * Lo que le pasa el puntero (la vitrina lo traduce). `dx` y `vx` van en anchos de canvas (y por
     * segundo); `sobre` dice si el puntero está encima de la medalla.
     */
    puntero({ tipo, dx = 0, vx = 0, sobre = false, mouse = false, reducido = false }) {
      if (tipo === 'down') {
        arrastrando = true;
        objetivoPsi = null;
        omegaP = 0;
      } else if (tipo === 'move') {
        if (arrastrando) {
          psi = clamp(psi + dx * GIRO_POR_ANCHO, -TAU, TAU);
          omegaP = clamp(0.6 * omegaP + 0.4 * vx * GIRO_POR_ANCHO, -9, 9);
          if (!reducido) omegaT = clamp(omegaT + dx * 1.2, -2.5, 2.5);
          sucio = true;
        } else if (sobre && mouse && !reducido) {
          // Pasar el mouse por encima la empuja: un vaivén y un poco de giro.
          omegaT = clamp(omegaT + dx * 1.6, -2.5, 2.5);
          omegaP = clamp(omegaP + dx * 2.2, -14, 14);
        }
      } else if (tipo === 'up' || tipo === 'cancel') {
        arrastrando = false;
        omegaP = reducido ? 0 : clamp(vx * GIRO_POR_ANCHO * 0.6, -9, 9);
      }
    },
    /** "Ver de frente": vuelve al frente deshaciendo el giro, como una cinta que se destuerce. */
    alVerDeFrente(reducido) {
      objetivoPsi = 0;
      if (reducido) { psi = objetivoPsi; objetivoPsi = null; theta = omegaT = omegaP = 0; }
      sucio = true;
    },
  };
}
