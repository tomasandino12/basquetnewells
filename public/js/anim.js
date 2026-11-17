/*
 * Prende las animaciones del portal. Es un script externo y síncrono (la CSP
 * no deja inline): corre en el <head>, antes del primer pintado, para que lo
 * que arranca oculto (.js-anim .rise) nunca se vea y desaparezca de golpe.
 *
 * Sin movimiento reducido ni IntersectionObserver no se prende nada: la página
 * se lee entera, sin animar. Y si el módulo que revela las secciones
 * (src/ui/animaciones.js) no avisó en 3 segundos, se apaga: mejor una página
 * sin animar que contenido invisible.
 *
 * Tres cosas más, que valen también con movimiento reducido:
 *  - `.js` en la raíz: con JavaScript. Es lo que muestra el esqueleto de la cinta (sin JS no
 *    habría quién lo reemplace).
 *  - `.fuentes` en la raíz: las tipografías de la primera pantalla ya llegaron. La entrada del
 *    hero espera ese aviso (publico.css), así el título nunca se ve en una letra y salta a otra.
 *    Si tardan más de 1,2 s, se sigue igual con la de respaldo (que mide casi lo mismo).
 *  - Si la cinta sigue "cargando" a los 8 s (el módulo falló, o la red), se esconde: un esqueleto
 *    que brilla para siempre es peor que no tener cinta.
 */
(function () {
  var raiz = document.documentElement;
  raiz.classList.add('js');

  var fuentesListas = function () { raiz.classList.add('fuentes'); };
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('700 1em "Barlow Condensed"'),
      document.fonts.load('600 1em "Barlow Condensed"'),
      document.fonts.load('400 1em Inter'),
    ]).then(fuentesListas, fuentesListas);
    setTimeout(fuentesListas, 1200);
  } else {
    fuentesListas();
  }

  setTimeout(function () {
    var cinta = document.getElementById('cinta');
    if (cinta && cinta.getAttribute('aria-busy') === 'true') cinta.hidden = true;
  }, 8000);

  var sinMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sinMovimiento || !('IntersectionObserver' in window)) return;
  raiz.classList.add('js-anim');
  setTimeout(function () {
    if (!raiz.hasAttribute('data-anim-lista')) raiz.classList.remove('js-anim');
  }, 3000);
})();
