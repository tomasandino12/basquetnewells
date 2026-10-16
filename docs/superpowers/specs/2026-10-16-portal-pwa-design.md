# Portal del básquet en la landing + PWA — diseño

Fecha: 16/10/2026 · Rama: `feat/portal-pwa` · Tag de vuelta atrás: `pre-portal-pwa`

## Qué hay hoy

- **Landing**: no es una página aparte. Es la vista `#v-landing` dentro del shell público (`#publico`) de `public/index.html`, la misma página que la app. `main.js` lee la sesión y decide: con sesión va a la app, sin sesión muestra la landing. Hero con el escudo y el nombre del club (ya en uso), botones "Crear cuenta" / "Ya tengo cuenta", bento de beneficios con demos animadas (`landingAnimada.js`), pie legal.
- **Ruteo**: `vercel.json` reescribe `/` → `/public/index.html` y tiene `/privacidad`, `/terminos`, `robots`, `sitemap`. Dentro de la app no hay rutas: `historial.js` usa `pushState` sin URL. El login vuelve a `origin + pathname` (`urlDeRetorno()` en `repos/auth.js`), o sea `/`.
- **Manifest**: no existe. **Service worker**: no existe. **Íconos**: sólo `public/escudo.png` (favicon y `og:image`).
- **CSP** (vercel.json): `frame-src` sólo permite `youtube-nocookie.com`; `worker-src` y `manifest-src` caen en `'self'`, alcanza.
- **Caché HTTP**: `/` y `index.html` con `no-store`; `/src/**`, `/public/css/**` y `config.js` con `no-cache`. Los nombres de archivo no llevan hash (no hay build): hoy cada deploy llega porque el navegador revalida.
- `.btn.sec` sobre el fondo oscuro ya está arreglado con `.publico .btn.sec` en `publico.css`; lo nuevo va dentro de `.publico` y lo hereda.

Nada de lo pedido exige cambiar rutas existentes ni las URLs de redirección de Supabase Auth: el `start_url` del manifest es `/`, que ya es la URL de retorno.

## Qué se construye

1. **Bloque "Básquet" en la landing**, dentro de `#v-landing`, entre los botones de acceso y el bento:
   - *Inscripción*: botón al formulario externo (abre en pestaña nueva).
   - *Calendario*: dos Google Calendar embebidos (partidos/torneos y eventos/recaudación), vista agenda, `loading="lazy"`.
   - *Información*: texto fijo (categorías, horarios, contacto). El contenido lo pasa el club; mientras tanto, placeholders marcados.
   - El bento actual queda igual, con un título que lo separe ("Para los profes").
   - Sin anclas `#...` en la URL: el `hash` lo lee el flujo de recuperación de clave (`main.js:82`).
2. **Configuración única** `src/data/portal.js`: IDs de los dos calendarios y URL del formulario. Lo que falta va como `null` con un comentario `PENDIENTE`. Funciones puras: armar la URL de embed desde el ID del calendario y validar enlaces (sólo `https`, sólo hosts permitidos: `calendar.google.com`, `docs.google.com/forms`, `forms.gle`). Si un valor es `null` o inválido, la tarjeta muestra "Próximamente" en vez de un iframe o botón roto.
3. **`src/ui/portalLanding.js`**: completa iframes y botón desde la configuración. No importa `repositorio.js` ni nada de datos.
4. **CSP**: se suma `https://calendar.google.com` a `frame-src`. Nada más.
5. **Íconos genéricos** (pelota, sin escudo) en `public/icons/`: SVG fuente + PNG 192, 512, 512 maskable y `apple-touch-icon` 180. Los PNG se generan una vez con un canvas en el navegador y se commitean (sin dependencias ni build).
6. **Manifest** `public/manifest.webmanifest`: `name`/`short_name` "Inferiores" (el mismo título de hoy), `start_url` y `scope` `/`, `display: standalone`, colores `#131316`, los íconos de arriba. En el `<head>`: `<link rel="manifest">`, `apple-touch-icon` y las meta de iOS (`apple-mobile-web-app-capable`, `status-bar-style`).
7. **Service worker** `public/sw.js` (script clásico, sin módulos, por Safari), registrado desde `src/ui/pwa.js` con `scope: '/'`. Vercel le agrega `Service-Worker-Allowed: /` y `Cache-Control: no-cache` (header nuevo, no ruta nueva). Reglas:
   - Sólo toca pedidos `GET` del propio origen. **Cualquier otro origen (Supabase, Google) ni se intercepta**: no hay `respondWith`, va directo a la red y nunca entra a la caché.
   - Navegaciones (HTML): network-first; se guarda sólo `/` sin query (nunca la vuelta del login con `?code=`), y la copia se usa sólo si no hay red.
   - Estáticos: ver decisión abierta 1.
   - `activate` borra todo caché cuyo nombre no sea el de la versión actual; `skipWaiting` + `clients.claim` para que un deploy entre al recargar.
   - Plan de escape documentado: si el SW rompe algo, se publica un `sw.js` que se desregistra y borra sus cachés.

## Decisiones abiertas (necesito tu OK)

1. **Estáticos cache-first choca con el deploy actual.** `/src/**` y `/public/css/**` no tienen hash en el nombre. Si el SW los sirve cache-first, un deploy llega a los celulares sólo cuando alguien acuerda subir la versión en `sw.js`; si se olvida, el celular instalado corre JS viejo con HTML nuevo, y eso rompe el criterio "el cambio se ve al recargar". **Recomiendo**: cache-first versionado sólo para lo que no cambia entre deploys (`public/vendor/`, `public/fonts/`, `public/icons/`, `escudo.png`), y `/src/**`, CSS y `config.js` sin interceptar (se comportan como hoy). La versión del caché es un hash corto de esos archivos y un test lo recalcula: si alguien cambia un vendor y no actualiza `sw.js`, el test falla. Alternativa literal: todo cache-first + subir la versión a mano en cada deploy.
2. **Orden de la landing.** Recomiendo: hero → botones de acceso → bloque Básquet (Inscripción, Calendario, Info) → "Para los profes" (bento actual) → pie. El hero ("Lo que se trabaja en inferiores, queda") le habla al profe; ¿lo dejamos o le sumamos una línea para familias?
3. **Política de privacidad.** Los iframes de Google cargan cookies de Google en la landing. Propongo una línea en la política ("la página pública muestra calendarios de Google; Google puede usar cookies propias") en una task aparte, o que lo veas con el club antes.
4. **Contenido de "Información"** (categorías, horarios, sede, contacto): lo tiene que pasar el club. Hasta entonces, placeholders.

## Reglas operativas para la coordinación (van a `docs/COORDINACION.md`)

- Los dos calendarios tienen que estar **públicos** para que el embed funcione: cualquiera que tenga el link ve todo. **Nunca nombres de jugadores** en títulos ni descripciones de eventos ("U13 vs. Rosario Central", no "U13: convocados …").
- El formulario de inscripción junta datos de menores fuera de la app: el responsable es el club (mismo criterio que `docs/legal`).

## Riesgos que hay que probar en el celular

- **iPhone instalado**: la app guarda la sesión aparte de Safari. Quien está logueado en Safari tiene que volver a entrar en la app instalada. Los links de mail (confirmar cuenta, recuperar clave) se abren en Safari, no en la instalada.
- **Google en iPhone instalado**: el login con Google sale a una hoja de Safari y vuelve; hay que confirmar que la sesión queda en la app instalada.
- **Local**: el servidor de desarrollo (esbuild) no manda `Service-Worker-Allowed`, así que el SW con `scope: '/'` sólo se prueba de verdad en un deploy de preview de Vercel.

## Fuera de alcance

Login de familias, datos en lo público, CMS de noticias, push, offline de la app, dominio propio, cambios al login.

## Criterios de aceptación

Los del prompt: manifest sin errores e instalable; instalado en Android y iPhone abre con ícono y sin barra; un deploy con cambio visible se ve al recargar; Cache Storage sin nada de `supabase.co`; login con email y Google y todas las pantallas siguen andando; 380 px sin scroll horizontal. Más: `npm run test:q` en verde.
