/*
 * Google Analytics 4, SÓLO en el portal público (portal.html). Ni la app ni
 * ninguna página interna cargan este archivo.
 *
 * Es un archivo externo porque la CSP no deja scripts inline. Va con `defer`
 * y la librería de Google (gtag.js) se pide recién cuando la página terminó de
 * cargar, para no competir con la foto del hero (LCP). Los clics se registran
 * con un único listener delegado: los botones se pintan después, desde
 * src/ui/portal.js, y el listener los alcanza igual.
 *
 * Qué evento es cada clic: lo dice `data-evento` en el contenedor del botón
 * (portal.html) o, para WhatsApp e Instagram, el destino del enlace.
 */
(function () {
  var ID = 'G-5DDKGTFXTC';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID);

  function cargarGtag() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }
  if (document.readyState === 'complete') cargarGtag();
  else window.addEventListener('load', cargarGtag);

  function hostDe(a) {
    try { return new URL(a.href, location.href).hostname; } catch (e) { return ''; }
  }

  function eventoDe(a) {
    var host = hostDe(a);
    if (host === 'wa.me' || host === 'api.whatsapp.com') return 'click_whatsapp';
    if (host === 'instagram.com' || host === 'www.instagram.com') return 'click_instagram';
    var contenedor = a.closest('[data-evento]');
    return contenedor ? contenedor.getAttribute('data-evento') : null;
  }

  function seccionDe(a) {
    var s = a.closest('section[id]');
    if (s) return s.id;
    if (a.closest('#portal-dock')) return 'dock';
    if (a.closest('footer')) return 'pie';
    if (a.closest('header')) return 'encabezado';
    if (a.closest('dialog')) return 'pago';
    return 'otra';
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    var nombre = eventoDe(a);
    if (!nombre) return;
    gtag('event', nombre, { link_url: a.href, section: seccionDe(a) });
  }, true);
})();
