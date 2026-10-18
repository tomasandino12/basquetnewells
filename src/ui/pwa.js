/*
 * Registra el service worker que hace instalable el sitio (public/sw.js).
 * Alcance / aunque el archivo viva en /public/: Vercel lo permite con el
 * header Service-Worker-Allowed. En local (esbuild) ese header no está y el
 * registro falla: la app anda igual, sólo que no se puede instalar.
 */
export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const registrar = () => navigator.serviceWorker.register('/public/sw.js', { scope: '/' })
    .catch((e) => console.warn('No se pudo registrar el service worker:', e?.message ?? e));
  // Después de la carga: que no compita con la primera pintada de la landing.
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar, { once: true });
}
