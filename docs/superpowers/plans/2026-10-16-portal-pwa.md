# Plan — Portal del básquet + PWA

Spec: `docs/superpowers/specs/2026-10-16-portal-pwa-design.md`. Rama `feat/portal-pwa`, tag `pre-portal-pwa`.
Una task = un commit. Al cerrar cada una: `npm run test:q`, commit, y resumen simple de qué probar en el navegador. Sin merge: lo hace Tomás.

**Antes de la Task 1**: confirmar las decisiones abiertas 1–4 de la spec. El plan asume las recomendaciones (estáticos inmutables cache-first; `/src` y CSS sin interceptar).

## Estado

| Task | Estado |
|---|---|
| 0. Tag y rama | hecha (16/10) |
| 1. Configuración del portal | hecha (16/10) |
| 2. CSP para Google Calendar | hecha (16/10) |
| 3. Bloque Básquet en la landing | hecha (16/10) |
| 4. Íconos genéricos | pendiente |
| 5. Manifest y meta de instalación | pendiente |
| 6. Service worker | pendiente |
| 7. Guía para la coordinación | pendiente |
| 8. Verificación en navegador y celular | pendiente |

## Task 1 — Configuración del portal (`feat(portal)`)
- Archivos: `src/data/portal.js`, `tests/portal.test.js`.
- `PORTAL` con `calendarios: [{ titulo, id }]` (dos) e `inscripcion` (URL); lo que falta va en `null` con `// PENDIENTE`. Funciones puras `urlEmbedCalendario(idOUrl)` (vista agenda, `ctz=America/Argentina/Buenos_Aires`; acepta el ID o la URL de embed que copia Google) y `enlaceInscripcion(url)`; `HOSTS_EMBEBIDOS` para el test de CSP.
- Aceptación: `null`, `http:`, `javascript:` y hosts ajenos devuelven `null`; el ID se codifica en la URL; `arquitectura.test.js` sigue verde (módulo puro).
- Tests: `urlEmbedCalendario arma la URL de agenda con el ID codificado`, `urlEmbedCalendario sin ID devuelve null`, `enlaceInscripcion rechaza http, javascript y hosts no permitidos`, `enlaceInscripcion acepta forms.gle y docs.google.com/forms`.

## Task 2 — CSP para Google Calendar (`feat(csp)`)
- Archivos: `vercel.json`, `tests/csp.test.js`.
- Sumar `https://calendar.google.com` a `frame-src`. Nada más cambia en la CSP.
- Aceptación: el embed carga en un deploy; el resto de la CSP idéntico.
- Tests: `frame-src permite cada host de calendario que arma portal.js`, `frame-src sólo deja YouTube sin cookies y Google Calendar, sin comodines`.

## Task 3 — Bloque Básquet en la landing (`feat(landing)`)
- Archivos: `public/index.html` (sección dentro de `#v-landing`, entre `.acciones-landing` y `.beneficios`, más un título "Para los profes" sobre el bento), `src/ui/portalLanding.js`, llamada desde donde se arma la landing en `main.js`, `public/css/publico.css` (breakpoints nuevos sólo en `layout.css`), `tests/landing.test.js`.
- HTML con `html\`\`` de `ui/html.js` para lo que arma el JS. Iframes con `loading="lazy"`, `title` accesible, `referrerpolicy="strict-origin-when-cross-origin"`, ancho 100 %. Botón de inscripción `<a class="btn" target="_blank" rel="noopener">`. Sin config → "Próximamente".
- Sin anclas `#` en la URL. Áreas táctiles ≥44 px, `hover` sólo en `@media (hover: hover)`.
- Aceptación: a 380 px sin scroll horizontal; botones secundarios visibles sobre el negro; los botones de acceso siguen arriba y andando; la página no hace ningún pedido a Supabase por esta sección.
- Tests: `la sección básquet está dentro de v-landing y antes del bento`, `portalLanding.js no importa repositorio ni repos`, `sin URL configurada la tarjeta dice Próximamente` (función que arma el HTML, probada con `toString()`), `el enlace de inscripción abre con rel=noopener`.

## Task 4 — Íconos genéricos (`feat(pwa)`)
- Archivos: `public/icons/icono.svg`, `icono-192.png`, `icono-512.png`, `icono-maskable-512.png`, `apple-touch-icon.png` (180), `tests/iconosPwa.test.js`.
- Pelota de básquet con los tokens de la app sobre `#131316`; el maskable deja el dibujo dentro del 80 % central. PNG generados una vez con un canvas en el navegador del panel; el script no se commitea.
- Aceptación: no usan el escudo; se ven bien en el preview de Chrome (Application → Manifest).
- Tests: `cada PNG tiene las medidas que dice su nombre` (lee el IHDR), `ningún ícono de la PWA es el escudo` (hash distinto).

## Task 5 — Manifest y meta de instalación (`feat(pwa)`)
- Archivos: `public/manifest.webmanifest`, `public/index.html` (`<head>`), `tests/manifest.test.js`.
- Campos de la spec. `id: "/"`. Meta de iOS. No cambiar `theme-color` ni el favicon.
- Aceptación: DevTools → Manifest sin errores ni avisos; un solo manifest en todo el repo.
- Tests: `el manifest es JSON válido con start_url y scope en /`, `cada ícono del manifest existe y coincide en medidas`, `index.html enlaza un solo manifest`, `start_url coincide con la URL de retorno del login` (pathname `/`).

## Task 6 — Service worker (`feat(pwa)`)
- Archivos: `public/sw.js`, `src/ui/pwa.js` (registro; si falla, sólo `console.warn`), import en `main.js`, `vercel.json` (headers para `/public/sw.js`: `Service-Worker-Allowed: /`, `Cache-Control: no-cache`), `tests/serviceWorker.test.js`.
- `sw.js` expone una función pura `estrategia(url, metodo, modo, origen)` → `'red-primero' | 'cache-primero' | null`; el test la corre con `vm` y un `self` falso.
- `VERSION` = hash corto de los archivos cache-first (vendor, fuentes, íconos, escudo).
- Aceptación: Cache Storage sin nada de `supabase.co` después de loguear y navegar; un deploy con cambio visible se ve al recargar en el instalado; los cachés viejos desaparecen al activar.
- Tests: `otro origen no se intercepta (supabase, google)`, `POST no se intercepta`, `una navegación es red-primero`, `src y css no se interceptan`, `vendor, fuentes e íconos son cache-primero`, `sólo se guarda / sin query`, `VERSION coincide con el hash de los archivos cacheados`, `activate borra los cachés de otra versión`, `pwa.js no usa fetch ni importa repositorio`.

## Task 7 — Guía para la coordinación (`docs`)
- Archivos: `docs/COORDINACION.md` (sección "Calendario e inscripción": hacer público el calendario, sacar el ID, pegarlo en `portal.js`, **nunca nombres de jugadores en los eventos**), `docs/SEGURIDAD-LANZAMIENTO.md` (SW: qué cachea, qué no, plan de escape), `DESIGN.md` si suma componente.
- Aceptación: alguien sin contexto puede cargar los IDs siguiendo la guía.

## Task 8 — Verificación (`docs`: resultados en este plan)
- Local con `preview_start app`: landing a 380 px y en escritorio, consola sin errores, login con email.
- Preview de Vercel (pedir OK antes de pushear la rama): Manifest sin errores, instalable, Cache Storage sin `supabase.co`, login con Google, deploy con cambio visible → se ve al recargar.
- Celulares (lo prueba Tomás): instalar en Android y iPhone, abrir sin barra, login con email y Google en el instalado, recuperar clave.
- Anotar resultados en la tabla de Estado.
