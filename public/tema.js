/*
 * Pone el tema elegido antes de que el navegador pinte, para que quien tiene la
 * app oscura no vea un destello blanco al abrirla. Script clásico y sin defer,
 * en el <head>; es un archivo y no un script dentro del HTML porque la CSP sólo
 * acepta scripts de 'self'.
 *
 * No importa módulos (corre antes del importmap): repite la regla mínima de
 * src/data/tema.js (clave, valor 'oscuro', color de la barra). El contrato
 * tests/contratoTokens.test.js las compara. Todo va en try/catch: en modo
 * privado localStorage puede tirar, y entonces la app queda clara.
 */
(function () {
  try {
    if (localStorage.getItem('semillero.tema') !== 'oscuro') return;
    document.documentElement.setAttribute('data-tema', 'oscuro');
    var barra = document.querySelector('meta[name="theme-color"]');
    if (barra) {
      barra.setAttribute('data-claro', barra.getAttribute('content'));
      barra.setAttribute('content', '#0D0D10');
    }
  } catch (e) { /* sin almacenamiento: claro */ }
})();
