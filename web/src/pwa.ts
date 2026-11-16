/**
 * Registra el service worker que hace instalable la app (public/sw.js). Alcance /app aunque el archivo viva
 * en /public/: Vercel lo permite con el header Service-Worker-Allowed. En la compu (servidor de Vite) ese
 * header no está y el registro falla: la app anda igual, sólo que no se puede instalar. El portal público (/)
 * no lo registra ni queda bajo su alcance.
 */
export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !window.location.pathname.startsWith('/app')) return;
  const registrar = () =>
    navigator.serviceWorker
      .register('/public/sw.js', { scope: '/app' })
      .catch((e) => console.warn('No se pudo registrar el service worker:', e?.message ?? e));
  // Después de la carga: que no compita con la primera pintada.
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar, { once: true });
}
