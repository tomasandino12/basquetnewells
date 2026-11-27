/**
 * Vista previa que sigue al puntero: al pasar el mouse por un acceso a "Nuestra historia" (los que tienen
 * `data-vista-copa`), la copa de la vitrina flota junto al cursor con un rótulo "VER VITRINA 3D →". Es la misma
 * foto fotorrealista de la copa, recortada y achicada (scripts/copa-arbb/cursor.py).
 *
 * Reglas:
 *  - Sólo con mouse de verdad: `(hover: hover) and (pointer: fine)`. En el celular no se instala ningún listener
 *    (ahí la copa va asomada en la tarjeta, por CSS: .ph-copa).
 *  - El cursor sigue siendo el normal: la copa es un elemento aparte (position: fixed, pointer-events: none) que se
 *    mueve sólo con transform, interpolado (lerp) en requestAnimationFrame.
 *  - El bucle y el listener de movimiento corren únicamente entre el mouseenter y el fin de la transición de salida.
 *  - Con prefers-reduced-motion no hay inercia ni inclinación: la copa va pegada al puntero.
 */

export const CONSULTA_MOUSE = '(hover: hover) and (pointer: fine)';
const LERP = 0.16;
const DESPLAZAMIENTO = { x: 24, y: -20 }; // a la derecha y arriba del puntero, para no tapar el texto
const INCLINACION_MAX = 8; // grados
const GRADOS_POR_PX = 0.55; // cuánto se inclina por cada px que el mouse avanza entre cuadros
const MARGEN = 8;
const FIN_DE_SALIDA_MS = 400; // por si la transición no avisa (pestaña en segundo plano)

const limitar = (x, a, b) => Math.min(b, Math.max(a, x));

/** Inclinación (grados) para una velocidad horizontal (px por cuadro): proporcional y acotada a ±8°. */
export function inclinacionPorVelocidad(vx) {
  return limitar(vx * GRADOS_POR_PX, -INCLINACION_MAX, INCLINACION_MAX);
}

/**
 * Dónde queda la esquina inferior izquierda de la copa para un puntero en (px, py): desplazada, y si se saldría
 * de la ventana pasa al otro lado del puntero o baja lo necesario.
 */
export function posicionDeLaCopa(px, py, { ancho, alto }, { ancho: vw }) {
  let x = px + DESPLAZAMIENTO.x;
  if (x + ancho > vw - MARGEN) x = px - DESPLAZAMIENTO.x - ancho;
  const y = Math.max(py + DESPLAZAMIENTO.y, alto + MARGEN);
  return { x: Math.max(MARGEN, x), y };
}

function crearFlotante(doc) {
  const raiz = doc.createElement('div');
  raiz.className = 'copa-cursor';
  raiz.setAttribute('aria-hidden', 'true');
  const cuerpo = doc.createElement('div');
  cuerpo.className = 'cc-cuerpo';
  const halo = doc.createElement('span');
  halo.className = 'cc-halo';
  const img = doc.createElement('img');
  img.className = 'cc-img';
  img.src = '/public/img/historia/copa-cursor-preview.webp';
  img.alt = '';
  img.width = 164;
  img.height = 220;
  img.decoding = 'async';
  img.draggable = false;
  const rotulo = doc.createElement('span');
  rotulo.className = 'cc-rotulo';
  rotulo.textContent = 'VER VITRINA 3D →';
  cuerpo.append(halo, img, rotulo);
  raiz.append(cuerpo);
  doc.body.append(raiz);
  return { raiz, cuerpo, img };
}

/** @returns {() => void} desinstala todo (lo usan los tests) */
export function iniciarCopaCursor(doc = document, win = window) {
  if (!win.matchMedia(CONSULTA_MOUSE).matches) return () => {};
  const objetivos = [...doc.querySelectorAll('[data-vista-copa]')];
  if (!objetivos.length) return () => {};
  const reducido = win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { raiz, cuerpo, img } = crearFlotante(doc);
  let tamano = null; // { ancho, alto } de la copa con su rótulo, se mide en la primera entrada
  const puntero = { x: 0, y: 0 };
  const pos = { x: 0, y: 0 };
  let inclinacion = 0;
  let cuadro = 0;
  let enCurso = false; // bucle y listener de movimiento encendidos
  let adentro = false;
  let espera = 0;

  const dibujar = () => {
    raiz.style.transform = `translate3d(${pos.x.toFixed(2)}px, ${pos.y.toFixed(2)}px, 0)`;
    img.style.transform = reducido ? '' : `rotate(${inclinacion.toFixed(2)}deg)`;
  };

  const alMover = (e) => {
    puntero.x = e.clientX;
    puntero.y = e.clientY;
  };

  const paso = () => {
    const meta = posicionDeLaCopa(puntero.x, puntero.y, tamano, { ancho: win.innerWidth });
    const k = reducido ? 1 : LERP;
    const antes = pos.x;
    pos.x += (meta.x - pos.x) * k;
    pos.y += (meta.y - pos.y) * k;
    // Velocidad horizontal real de la copa (no la del mouse): al frenar, se endereza sola.
    const vx = pos.x - antes;
    inclinacion += (inclinacionPorVelocidad(vx) - inclinacion) * 0.2;
    dibujar();
    cuadro = win.requestAnimationFrame(paso);
  };

  const encender = () => {
    if (enCurso) return;
    enCurso = true;
    doc.addEventListener('pointermove', alMover, { passive: true });
    cuadro = win.requestAnimationFrame(paso);
  };

  const apagar = () => {
    if (!enCurso) return;
    enCurso = false;
    win.cancelAnimationFrame(cuadro);
    doc.removeEventListener('pointermove', alMover);
    win.clearTimeout(espera);
  };

  const entrar = (e) => {
    adentro = true;
    win.clearTimeout(espera);
    puntero.x = e.clientX;
    puntero.y = e.clientY;
    if (!tamano) tamano = { ancho: cuerpo.offsetWidth || 105, alto: cuerpo.offsetHeight || 150 };
    if (!enCurso) {
      // Aparece ya junto al puntero, sin viajar desde la esquina.
      const meta = posicionDeLaCopa(puntero.x, puntero.y, tamano, { ancho: win.innerWidth });
      pos.x = meta.x;
      pos.y = meta.y;
      inclinacion = 0;
      dibujar();
    }
    encender();
    raiz.classList.add('visible');
  };

  const salir = () => {
    adentro = false;
    raiz.classList.remove('visible');
    // El bucle sigue hasta que termina el fundido de salida.
    espera = win.setTimeout(() => { if (!adentro) apagar(); }, FIN_DE_SALIDA_MS);
  };

  const alTerminarTransicion = (e) => {
    if (e.target === cuerpo && e.propertyName === 'opacity' && !adentro) apagar();
  };

  cuerpo.addEventListener('transitionend', alTerminarTransicion);
  for (const el of objetivos) {
    el.addEventListener('mouseenter', entrar);
    el.addEventListener('mouseleave', salir);
  }

  return () => {
    apagar();
    for (const el of objetivos) {
      el.removeEventListener('mouseenter', entrar);
      el.removeEventListener('mouseleave', salir);
    }
    cuerpo.removeEventListener('transitionend', alTerminarTransicion);
    raiz.remove();
  };
}
