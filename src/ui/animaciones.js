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

/**
 * Cada .rise arranca oculto y desplazado (publico.css, sólo bajo .js-anim) y
 * entra una sola vez al aparecer en pantalla. `data-anim-lista` le avisa a
 * anim.js que este módulo corrió: sin ese aviso, a los 3 s apaga las animaciones.
 */
export function iniciarRise(raiz = document) {
  const html = document.documentElement;
  const elementos = raiz.querySelectorAll('.rise');
  if (!html.classList.contains('js-anim') || typeof IntersectionObserver === 'undefined') {
    elementos.forEach((e) => e.classList.add('visto'));
    html.setAttribute('data-anim-lista', '');
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      entrada.target.classList.add('visto');
      observador.unobserve(entrada.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  elementos.forEach((e) => observador.observe(e));
  html.setAttribute('data-anim-lista', '');
}
