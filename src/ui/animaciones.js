/**
 * Las animaciones de scroll del portal. Todo es decoración: sin
 * IntersectionObserver (o sin .js-anim, que public/js/anim.js no prende con
 * movimiento reducido) no hace nada y la página se lee igual.
 */

/**
 * Parallax de la foto del hero en los navegadores sin línea de tiempo del
 * scroll (publico.css lo hace solo donde existe): baja hasta el 18% a lo largo
 * de una pantalla. El estado de reposo es el mismo que el de la hoja de estilos.
 */
export function iniciarParallax() {
  const foto = document.querySelector('.portal-heroe-foto');
  const conCss = window.CSS?.supports?.('animation-timeline: scroll()');
  if (!foto || conCss || !document.documentElement.classList.contains('js-anim')) return;
  let pendiente = false;
  const mover = () => {
    pendiente = false;
    const avance = Math.min(1, window.scrollY / window.innerHeight);
    foto.style.transform = `translateY(${(avance * 18).toFixed(2)}%) scale(1.1)`;
  };
  mover();
  window.addEventListener('scroll', () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(mover);
  }, { passive: true });
}

const REVELABLES = '.rise';
let observador = null;

/**
 * Cada .rise arranca oculto (publico.css, sólo bajo .js-anim) y entra una
 * sola vez, subiendo, al aparecer en pantalla. Con lo que se muestra después
 * de cargar (la sección "Lo que viene") hay que volver a llamar a `revelar`.
 * `data-anim-lista` le avisa a anim.js que este módulo corrió: sin ese aviso,
 * a los 3 s apaga las animaciones.
 */
export function iniciarRise(raiz = document) {
  const html = document.documentElement;
  if (html.classList.contains('js-anim') && typeof IntersectionObserver !== 'undefined') {
    observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        entrada.target.classList.add('visto');
        observador.unobserve(entrada.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
  }
  revelar(raiz);
  html.setAttribute('data-anim-lista', '');
}

/** Pone a observar lo revelable (.rise) de `raiz` (y a ella misma). Sin animaciones, lo muestra ya. */
export function revelar(raiz) {
  const nodos = [...(raiz.matches?.(REVELABLES) ? [raiz] : []), ...raiz.querySelectorAll(REVELABLES)];
  for (const nodo of nodos) {
    if (observador) observador.observe(nodo);
    else nodo.classList.add('visto');
  }
}

/**
 * El botón de pausa de la cinta de fechas: en el celular no hay hover, y una
 * cinta que se mueve sola sin poder frenarla cansa (y para algunas personas
 * es un problema). Pausa y reanuda; el estado va en `.pausada` y aria-pressed.
 */
export function iniciarCintaPausa() {
  document.addEventListener('click', (ev) => {
    const boton = ev.target.closest('[data-cinta-pausa]');
    if (!boton) return;
    const pausada = boton.closest('.portal-cinta').classList.toggle('pausada');
    boton.setAttribute('aria-pressed', String(pausada));
    boton.setAttribute('aria-label', pausada ? 'Reanudar la cinta de fechas' : 'Pausar la cinta de fechas');
  });
}

/**
 * La barra fija de abajo aparece cuando los botones del hero salieron de
 * pantalla POR ARRIBA (se scrolleó más allá) y se va cuando vuelven a verse.
 * Oculta es `inert`. No es una animación: funciona también con movimiento
 * reducido (ahí aparece sin deslizarse). Sin IntersectionObserver queda oculta.
 */
export function iniciarDock(idVigilado = 'portal-heroe', idDock = 'portal-dock') {
  const vigilado = document.getElementById(idVigilado);
  const dock = document.getElementById(idDock);
  if (!vigilado || !dock || typeof IntersectionObserver === 'undefined') return;
  new IntersectionObserver(([entrada]) => {
    const visible = !entrada.isIntersecting && entrada.boundingClientRect.top < 0;
    dock.classList.toggle('visible', visible);
    dock.toggleAttribute('inert', !visible);
  }).observe(vigilado);
}

/**
 * El sticker de sponsor del hero gira sin parar: cuando el hero sale de
 * pantalla se pausa (no gasta batería donde nadie lo ve). Sin
 * IntersectionObserver gira siempre; con movimiento reducido no gira (base.css).
 */
export function iniciarGiroSponsor() {
  const anillo = document.getElementById('anillo-sponsor');
  if (!anillo || typeof IntersectionObserver === 'undefined') return;
  new IntersectionObserver(([entrada]) => {
    anillo.classList.toggle('quieto', !entrada.isIntersecting);
  }).observe(anillo);
}
