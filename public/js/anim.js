/*
 * Prende las animaciones del portal. Es un script externo y síncrono (la CSP
 * no deja inline): corre en el <head>, antes del primer pintado, para que lo
 * que arranca oculto (.js-anim .rise) nunca se vea y desaparezca de golpe.
 *
 * Sin movimiento reducido ni IntersectionObserver no se prende nada: la página
 * se lee entera, sin animar. Y si el módulo que revela las secciones
 * (src/ui/animaciones.js) no avisó en 3 segundos, se apaga: mejor una página
 * sin animar que contenido invisible.
 */
(function () {
  var raiz = document.documentElement;
  var sinMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (sinMovimiento || !('IntersectionObserver' in window)) return;
  raiz.classList.add('js-anim');
  setTimeout(function () {
    if (!raiz.hasAttribute('data-anim-lista')) raiz.classList.remove('js-anim');
  }, 3000);
})();
