/**
 * Las animaciones de scroll del portal. Todo es decoración: sin
 * IntersectionObserver (o sin .js-anim, que public/js/anim.js no prende con
 * movimiento reducido) no hace nada y la página se lee igual.
 */

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
