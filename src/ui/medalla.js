/**
 * La medalla de la Asociación Rosarina, en CSS 3D (sin WebGL: en la página el único renderer es el de la copa).
 * El marcado y el aspecto viven en public/historia.html y public/css/historia.css (dos caras, siete capas de canto
 * y un brillo); acá sólo está el movimiento:
 *  - Arrastre con mouse o dedo (pointer events con captura): gira en `rotateY` sin límite, con inercia por
 *    `lerp` hacia una meta, y una leve inclinación en `rotateX` que se balancea como un péndulo (resorte amortiguado).
 *  - El botón "Ver frente / dorso" (y las flechas del teclado) mueven la meta de a 180° / 45°.
 *  - El brillo especular se desplaza según el ángulo (variables --bx y --bo de cada cara).
 *  - El rAF corre sólo mientras algo se mueve (arrastre, inercia, balanceo) y se apaga quieta, fuera de pantalla
 *    o con la pestaña oculta. Con `prefers-reduced-motion` no hay inercia ni péndulo: la medalla sigue al dedo y
 *    el botón la da vuelta de golpe.
 * No importa nada de la UI.
 */

const GRADOS_POR_PX = 0.45; // 400 px de arrastre ≈ media vuelta
const VEL_LERP = 9; // 1/s: qué tan rápido la medalla alcanza su meta
const INERCIA_S = 0.28; // cuántos segundos "más" sigue girando al soltar, a la velocidad que traía
const VEL_MAX = 1600; // °/s
const PENDULO = { w0: 5.2, zeta: 0.22, max: 13, empuje: 2.4 }; // frecuencia (rad/s), amortiguación, tope en grados, grados/s por px
const BRILLO_BASE = -14; // % del destello cuando está de frente: arriba a la izquierda, como una luz de estudio
const BRILLO_RECORRIDO = 34; // cuánto se corre (%) a cada lado al girar

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rad = (g) => (g * Math.PI) / 180;

/**
 * @param {HTMLElement} escenario  #medalla-escenario (contiene .medal-3d)
 * @returns {{ verOtraCara: () => void, destruir: () => void } | null}
 */
export function montarMedalla(escenario) {
  const medal = escenario?.querySelector('.medal-3d');
  if (!medal) return null;
  const frente = medal.querySelector('.medal-frente');
  const dorso = medal.querySelector('.medal-dorso');

  const mqReducido = matchMedia('(prefers-reduced-motion: reduce)');
  let reducido = mqReducido.matches;
  const alCambiarReducido = () => {
    reducido = mqReducido.matches;
    if (reducido) { giro = meta; tilt = tiltV = 0; dibujar(); }
  };
  mqReducido.addEventListener?.('change', alCambiarReducido);

  let giro = 0; // ángulo dibujado (°)
  let meta = 0; // ángulo al que tiende
  let tilt = 0; // inclinación (°) y su velocidad
  let tiltV = 0;
  let arrastrando = false;
  let vel = 0; // °/s de la última parte del arrastre
  let ultimoMov = 0;

  function dibujar() {
    medal.style.transform = `rotateX(${tilt.toFixed(2)}deg) rotateY(${giro.toFixed(2)}deg)`;
    // Cada cara brilla más cuanto más de frente está y el destello cruza al girar; la inclinación lo mueve un poco.
    for (const [cara, desfase] of [[frente, 0], [dorso, 180]]) {
      const a = rad(giro - desfase);
      cara.style.setProperty('--bx', `${(BRILLO_BASE + Math.sin(a) * BRILLO_RECORRIDO - tilt * 0.9).toFixed(1)}%`);
      cara.style.setProperty('--bo', Math.max(0, Math.cos(a)).toFixed(2));
    }
  }

  // --- Bucle: sólo mientras algo se mueve. ---
  let visible = true;
  let idRaf = 0;
  let ultimo = 0;
  function cuadro(ahora) {
    idRaf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    if (reducido) {
      giro = meta;
      tilt = tiltV = 0;
    } else {
      giro += (meta - giro) * (1 - Math.exp(-VEL_LERP * dt));
      tiltV += (-PENDULO.w0 * PENDULO.w0 * tilt - 2 * PENDULO.zeta * PENDULO.w0 * tiltV) * dt;
      tilt = clamp(tilt + tiltV * dt, -PENDULO.max, PENDULO.max);
    }
    const quieta = !arrastrando && Math.abs(meta - giro) < 0.05 && Math.abs(tilt) < 0.03 && Math.abs(tiltV) < 0.4;
    if (quieta) { giro = meta; tilt = tiltV = 0; }
    dibujar();
    if (!quieta) idRaf = requestAnimationFrame(cuadro);
  }
  function pedirCuadro() {
    if (idRaf || !visible || document.hidden) return;
    ultimo = performance.now();
    idRaf = requestAnimationFrame(cuadro);
  }

  // --- Arrastre. ---
  let xAnterior = 0;
  escenario.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    arrastrando = true;
    xAnterior = ev.clientX;
    vel = 0;
    ultimoMov = performance.now();
    try { escenario.setPointerCapture(ev.pointerId); } catch { /* el puntero ya se soltó */ }
    pedirCuadro();
  });
  escenario.addEventListener('pointermove', (ev) => {
    if (!arrastrando) return;
    const dx = ev.clientX - xAnterior;
    xAnterior = ev.clientX;
    if (!dx) return;
    const dGrados = dx * GRADOS_POR_PX;
    meta += dGrados;
    const ahora = performance.now();
    const dtMs = Math.max(8, ahora - ultimoMov);
    ultimoMov = ahora;
    vel = vel * 0.7 + ((dGrados / dtMs) * 1000) * 0.3;
    if (!reducido) tiltV = clamp(tiltV + Math.abs(dx) * PENDULO.empuje, 0, 90);
    pedirCuadro();
  });
  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    // Si se frenó antes de soltar, no hay inercia.
    if (!reducido && performance.now() - ultimoMov < 80) meta += clamp(vel, -VEL_MAX, VEL_MAX) * INERCIA_S;
    pedirCuadro();
  };
  escenario.addEventListener('pointerup', soltar);
  escenario.addEventListener('pointercancel', soltar);
  escenario.addEventListener('lostpointercapture', soltar);

  // --- "Ver frente / dorso" y el teclado. ---
  const verOtraCara = () => {
    meta = (Math.round(meta / 180) + 1) * 180;
    if (!reducido) tiltV = clamp(tiltV + 20, 0, 90);
    pedirCuadro();
  };
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'medalla-giro';
  boton.textContent = 'Ver frente / dorso';
  boton.addEventListener('click', verOtraCara);
  escenario.after(boton); // debajo del visor, para no tapar la medalla
  escenario.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    meta += ev.key === 'ArrowRight' ? 45 : -45;
    pedirCuadro();
  });

  // --- Fuera de pantalla o con la pestaña oculta, el bucle se corta de verdad. ---
  const vigia = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) pedirCuadro();
      else if (idRaf) { cancelAnimationFrame(idRaf); idRaf = 0; }
    }, { rootMargin: '60px' })
    : null;
  vigia?.observe(escenario);
  const alCambiarVisibilidad = () => { if (!document.hidden) pedirCuadro(); };
  document.addEventListener('visibilitychange', alCambiarVisibilidad);

  // Primer cuadro: la medalla queda de frente, con un empujoncito para que se note que cuelga.
  if (!reducido) tiltV = 22;
  dibujar();
  pedirCuadro();

  return {
    verOtraCara,
    destruir() {
      cancelAnimationFrame(idRaf);
      idRaf = 0;
      visible = false;
      vigia?.disconnect();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      mqReducido.removeEventListener?.('change', alCambiarReducido);
      boton.remove();
    },
  };
}
