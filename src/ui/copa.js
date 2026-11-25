/**
 * La copa de "Nuestra historia": la foto del trofeo con el tambor de 15 placas en CSS 3D encima (sin WebGL).
 * El marcado está en public/historia.html y el aspecto en public/css/historia.css; acá sólo el movimiento:
 *  - El tambor gira con `--giro` (grados): arrastre horizontal con mouse o dedo, con inercia, y si nadie lo toca
 *    va solo hasta dejar de frente la placa activa, por el camino corto.
 *  - La placa activa es la del año elegido ('historia:seleccion' con un solo año) o la del año que se está
 *    leyendo en la línea ('historia:foco'). Gana la última señal, salvo un foco que llega justo después de
 *    una elección: es la línea desplazándose hacia lo elegido, pasando por otros años.
 *  - Tocar una placa la activa y emite 'historia:elegir' { anio } (la página lleva la línea hasta ese título).
 *  - Toda la copa se inclina apenas siguiendo al mouse o al arrastre (`--ty`, `--tx`) y el reflejo del cromo
 *    la acompaña (`--lx`).
 * El rAF corre sólo mientras algo se mueve; fuera de pantalla o con la pestaña oculta se corta. Con
 * `prefers-reduced-motion` no hay inercia ni inclinación: el tambor salta a su lugar.
 * No importa nada de la UI.
 */

const GRADOS_POR_PX = 0.4; // ~450 px de arrastre = media vuelta
const VEL_LERP = 6; // 1/s: qué tan rápido el tambor alcanza su meta
const INERCIA_S = 0.3;
const VEL_MAX = 900; // °/s
const UMBRAL_PX = 6; // menos que esto es un toque, no un arrastre
const PAUSA_FOCO_MS = 1500;
const INCLINACION = { y: 5, x: 2.5 }; // tope en grados: un gesto, no un giro de la foto
const PISTA = 'Arrastrá la copa para girar las placas';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * @param {HTMLElement} escenario  #vitrina-escenario (contiene .copa y su .copa-tambor)
 * @returns {{ activar: (anio: number) => void, alFrente: () => void, destruir: () => void } | null}
 */
export function montarCopa(escenario) {
  const copa = escenario?.querySelector('.copa');
  const tambor = copa?.querySelector('.copa-tambor');
  if (!tambor) return null;
  const placas = [...tambor.querySelectorAll('.placa')];
  // El ángulo de cada placa sale del marcado: su lugar en la fila (--i) por el paso de esa fila (360°/--n).
  const angulos = new Map(placas.map((b) => {
    const li = b.parentElement;
    const n = Number(li.parentElement.style.getPropertyValue('--n'));
    return [Number(b.dataset.anio), (Number(li.style.getPropertyValue('--i')) * 360) / n];
  }));

  const mqReducido = matchMedia('(prefers-reduced-motion: reduce)');
  let reducido = mqReducido.matches;
  const mqMouse = matchMedia('(hover: hover) and (pointer: fine)');

  let giro = 0; // lo dibujado
  let meta = 0; // a dónde va
  const incl = { x: 0, y: 0 };
  const inclMeta = { x: 0, y: 0 };
  let activa = null;
  let ultimaEleccion = -Infinity;

  /** El giro que deja `anio` de frente, a menos de media vuelta de donde está ahora. */
  const metaPara = (anio) => {
    const a = -(angulos.get(anio) ?? 0);
    return a + 360 * Math.round((meta - a) / 360);
  };

  function dibujar() {
    tambor.style.setProperty('--giro', `${giro.toFixed(2)}deg`);
    copa.style.setProperty('--ty', `${incl.y.toFixed(2)}deg`);
    copa.style.setProperty('--tx', `${incl.x.toFixed(2)}deg`);
    copa.style.setProperty('--lx', (incl.y / INCLINACION.y).toFixed(3));
  }

  // --- Bucle: sólo mientras algo se mueve. ---
  let visible = true;
  let idRaf = 0;
  let ultimo = 0;
  let arrastrando = false;
  function cuadro(ahora) {
    idRaf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const k = 1 - Math.exp(-VEL_LERP * dt);
    if (reducido) {
      giro = meta;
      incl.x = incl.y = 0;
    } else {
      giro += (meta - giro) * k;
      incl.x += (inclMeta.x - incl.x) * k;
      incl.y += (inclMeta.y - incl.y) * k;
    }
    const quieta = !arrastrando && Math.abs(meta - giro) < 0.05
      && Math.abs(inclMeta.x - incl.x) < 0.02 && Math.abs(inclMeta.y - incl.y) < 0.02;
    if (quieta) { giro = meta; incl.x = inclMeta.x; incl.y = inclMeta.y; }
    dibujar();
    if (!quieta) idRaf = requestAnimationFrame(cuadro);
  }
  function pedirCuadro() {
    if (idRaf || !visible || document.hidden) return;
    ultimo = performance.now();
    idRaf = requestAnimationFrame(cuadro);
  }

  /** Enciende la placa de `anio` y, si no hay un dedo encima, la trae al frente. */
  function activar(anio) {
    if (!angulos.has(anio)) return;
    activa = anio;
    for (const b of placas) {
      const es = Number(b.dataset.anio) === anio;
      b.classList.toggle('activa', es);
      b.parentElement.classList.toggle('activa', es);
      if (es) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    if (!arrastrando) meta = metaPara(anio);
    pedirCuadro();
  }

  // --- Lo que elige la página. ---
  const raiz = escenario.closest('.hist-vitrina') ?? escenario;
  const alSeleccionar = (ev) => {
    const anios = ev.detail?.anios ?? [];
    if (anios.length !== 1) return;
    ultimaEleccion = performance.now();
    activar(anios[0]);
  };
  const alFoco = (ev) => {
    if (performance.now() - ultimaEleccion < PAUSA_FOCO_MS) return;
    activar(Number(ev.detail?.anio));
  };
  raiz.addEventListener('historia:seleccion', alSeleccionar);
  raiz.addEventListener('historia:foco', alFoco);

  // --- Arrastre (el dedo vertical sigue siendo scroll: touch-action:pan-y en el CSS). ---
  let inicio = null;
  let xAnterior = 0;
  let vel = 0;
  let ultimoMov = 0;
  let sinClick = false; // el click que llega al soltar un arrastre no es un toque
  escenario.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    inicio = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    sinClick = false;
  });
  escenario.addEventListener('pointermove', (ev) => {
    if (inicio && !arrastrando) {
      const dx = ev.clientX - inicio.x;
      if (Math.abs(dx) > UMBRAL_PX && Math.abs(dx) > Math.abs(ev.clientY - inicio.y)) {
        arrastrando = true;
        xAnterior = ev.clientX;
        vel = 0;
        ultimoMov = performance.now();
        ocultarPista();
        try { escenario.setPointerCapture(inicio.id); } catch { /* el puntero ya se soltó */ }
      }
    }
    if (arrastrando) {
      const dx = ev.clientX - xAnterior;
      xAnterior = ev.clientX;
      if (!dx) return;
      const dGrados = dx * GRADOS_POR_PX;
      meta += dGrados;
      const ahora = performance.now();
      vel = vel * 0.7 + ((dGrados / Math.max(8, ahora - ultimoMov)) * 1000) * 0.3;
      ultimoMov = ahora;
      // Al arrastrar, la copa se ladea un poco hacia donde va.
      inclMeta.y = clamp(vel / 120, -INCLINACION.y, INCLINACION.y);
      pedirCuadro();
    } else if (ev.pointerType === 'mouse' && !ev.buttons && mqMouse.matches && !reducido) {
      const r = escenario.getBoundingClientRect();
      inclMeta.y = clamp(((ev.clientX - r.left) / r.width - 0.5) * 2, -1, 1) * INCLINACION.y;
      inclMeta.x = clamp((0.5 - (ev.clientY - r.top) / r.height) * 2, -1, 1) * INCLINACION.x;
      pedirCuadro();
    }
  });
  const soltar = () => {
    inicio = null;
    if (!arrastrando) return;
    arrastrando = false;
    sinClick = true;
    if (!reducido && performance.now() - ultimoMov < 80) meta += clamp(vel, -VEL_MAX, VEL_MAX) * INERCIA_S;
    inclMeta.y = 0;
    pedirCuadro();
  };
  escenario.addEventListener('pointerup', soltar);
  escenario.addEventListener('pointercancel', soltar);
  escenario.addEventListener('lostpointercapture', soltar);
  escenario.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType !== 'mouse' || arrastrando) return;
    inclMeta.x = inclMeta.y = 0;
    pedirCuadro();
  });

  // --- Tocar una placa (o Enter/Espacio sobre ella). ---
  tambor.addEventListener('click', (ev) => {
    const b = ev.target.closest('.placa');
    if (!b) return;
    if (sinClick) { sinClick = false; return; }
    const anio = Number(b.dataset.anio);
    ultimaEleccion = performance.now();
    activar(anio);
    escenario.dispatchEvent(new CustomEvent('historia:elegir', { bubbles: true, detail: { anio } }));
  });
  // Con el teclado, la placa que toma el foco se trae al frente aunque esté atrás.
  tambor.addEventListener('focusin', (ev) => {
    const b = ev.target.closest('.placa');
    if (!b || arrastrando) return;
    meta = metaPara(Number(b.dataset.anio));
    pedirCuadro();
  });

  // --- Ayudas: "Volver al frente" y la pista del gesto. ---
  const alFrente = () => {
    meta = activa != null ? metaPara(activa) : 360 * Math.round(meta / 360);
    inclMeta.x = inclMeta.y = 0;
    pedirCuadro();
  };
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'vitrina-frente';
  boton.textContent = 'Volver al frente';
  boton.addEventListener('click', alFrente);
  const pista = document.createElement('p');
  pista.className = 'vitrina-pista';
  pista.textContent = PISTA;
  function ocultarPista() { pista.classList.add('oculta'); }
  escenario.append(boton, pista);
  copa.classList.add('viva');

  const alCambiarReducido = () => {
    reducido = mqReducido.matches;
    if (reducido) { inclMeta.x = inclMeta.y = 0; giro = meta; incl.x = incl.y = 0; dibujar(); }
  };
  mqReducido.addEventListener?.('change', alCambiarReducido);

  // --- Fuera de pantalla (en el celular la copa queda arriba mientras se lee) el bucle se corta. ---
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

  dibujar();

  return {
    activar,
    alFrente,
    destruir() {
      cancelAnimationFrame(idRaf);
      idRaf = 0;
      visible = false;
      vigia?.disconnect();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      mqReducido.removeEventListener?.('change', alCambiarReducido);
      raiz.removeEventListener('historia:seleccion', alSeleccionar);
      raiz.removeEventListener('historia:foco', alFoco);
      boton.remove();
      pista.remove();
      copa.classList.remove('viva');
    },
  };
}
