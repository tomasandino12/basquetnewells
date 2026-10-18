# Portal del básquet y Semillero separados — diseño (v2)

Estado: **borrador para aprobar por Tomás**. Fecha: 18/10/2026. Rama `feat/portal-pwa` (se rehace encima; nada mergeado). Reemplaza el enfoque de `2026-10-16-portal-pwa-design.md`: el bloque dentro de la landing no le sirvió.

## 1. Qué cambia

Hoy hay una sola página: la landing de Semillero con un bloque de básquet adentro. Pasan a ser **dos productos con dos puertas**:

| | Portal "Básquet Newell's" | Semillero (la app) |
|---|---|---|
| Para quién | Familias y cualquiera que busque al club | Profes, coordinación, jugadores y familias vinculadas |
| URL | `/` | `/app` |
| Estética | Negra, como newellsoldboys.com.ar (`publico.css`) | La actual: landing negra para entrar, app clara adentro |
| Instalable | No | **Sí**: manifest y service worker pasan acá |
| Datos | Ninguno: estático, no toca la base | Todo, protegido por RLS |

El portal es el link que se reparte. Desde ahí un botón lleva a Semillero, que conserva su landing actual (crear cuenta / ingresar) sin el bloque de básquet. El link directo a `/app` es el que usan los profes y jugadores: lo instalan en el celular y abren siempre ahí.

## 2. Qué tiene el portal

Una sola página, mobile-first, en este orden:

1. **Presentación del club** (escudo y nombre ya en uso; sin usos nuevos del escudo hasta que el club lo apruebe).
2. **Familias: inscripción y trámites.** Tres botones a formularios de Google: *Inscripción* (la primera vez), *Reinscripción* (los años siguientes) y *Comprobante de aranceles*, más el link a la *Guía para padres*. **Cada botón lleva ayuda paso a paso**: qué tener a mano, qué pasa después, qué hacer si no tienen cuenta de Google (pedido de Tomás: no suponer que saben de computadoras). Los textos se alinean con los formularios de `claude/inscripcion-google-41cf4e` y se revisan contra ellos.
3. **Calendarios**: partidos/torneos y eventos/recaudación (los dos Google Calendar ya resueltos en esta rama).
4. **Información**: categorías, entrenamientos, contacto (texto fijo que pasa el club; hasta entonces "Próximamente").
5. **Entrar**, dos tarjetas: **Familias** → `/app` (ven "Mis chicos"; la ayuda dice "entrá con el mismo mail con que llenaste el formulario") y **Profes, jugadores y coordinación** → `/app`, con cómo instalarla (Android: menú → Instalar; iPhone: Compartir → Agregar a inicio).

Todos los enlaces viven en un solo archivo, `src/data/portal.js` (ya existe: se le suman los formularios y la guía). Un enlace en `null` se ve como "Próximamente".

## 3. Rutas y login (lo que obliga a que Tomás toque Supabase)

- `vercel.json`: `/` → portal, `/app` → la página de Semillero (la misma `index.html` de hoy, así el hash de la CSP y los tests no se mueven). `/public/index.html` sigue respondiendo.
- Login: `urlDeRetorno()` devuelve `origin + pathname`; desde `/app` pasa a ser `https://app-semillero.vercel.app/app`. **Tomás tiene que agregar esa URL a "Redirect URLs" en Supabase Auth** (Authentication → URL Configuration; ver `docs/CONFIGURAR-AUTH.md`). Agregar no rompe lo que anda, así que **se hace antes del deploy**. No se cambia código de login.
- Mails ya enviados (confirmar cuenta, recuperar clave) apuntan a `/`, que ahora es el portal. Un script mínimo del portal detecta `code=`, `access_token` o `type=recovery` y manda a `/app` conservando la query y el hash, para que esos links sigan andando.
- Quien ya tenía la app abierta en `/` verá el portal y toca "Entrar". La app instalada abre `/app` directo.

## 4. PWA: pasa a `/app`

Manifest (`id`, `start_url`, `scope`: `/app`), `<link rel="manifest">`, íconos y registro del service worker quedan **sólo en la página de Semillero**. `Service-Worker-Allowed: /app`. El service worker mantiene las mismas reglas (nunca cachea otro origen ni `/src` ni CSS; vendor, fuentes e íconos cache-primero con versión por hash). El portal no lo registra. Los tests se ajustan al nuevo alcance.

## 5. Lo que NO hace esta spec (y quién lo hace)

- **Cuenta de familia, importador de inscriptos, tabla de vínculos, "Mis chicos"**: `claude/cuentas-familia-c6c955` (spec aprobada, migración **0057** suya). Esta spec **no agrega migración**.
- **Formularios, scripts de Drive, carpetas por chico, reinscripción corta**: `claude/inscripcion-google-41cf4e` (aprobada). Los archivos y datos de salud viven en Google, no en Semillero.
- Pagos, calendario dentro de la app, mensajería, notificaciones push, noticias con CMS, dominio propio.

## 6. Seguridad y privacidad

- El portal no importa `repositorio.js`, no usa Supabase ni tiene import map: no necesita hash nuevo en la CSP. Sólo `frame-src` ya permite `calendar.google.com`.
- Los calendarios son públicos: nunca nombres de jugadores en los eventos (ya está en `docs/COORDINACION.md`). Los iframes de Google ponen cookies de Google: **agregar una línea a la política de privacidad** (texto lo revisa Tomás o el club).
- Los formularios y archivos de las familias quedan fuera del control de la RLS: es decisión de Tomás ("que usen los formularios y el almacenamiento de Google"), y la política de privacidad debe decir que ese tratamiento es del club.

## 7. Qué se reaprovecha y qué se desarma de la v1

Se queda: `portal.js` (+ formularios), CSP de Calendar, íconos, manifest, service worker y sus tests, la guía de `COORDINACION.md`. Se desarma: el bloque `#basquet` y los títulos de `index.html`; `portalLanding.js` pasa a servir al portal; `canonical`, `og:*`, `sitemap` y `tests/metadatos.test.js` se ajustan (portal en `/`, app en `/app`).

## 8. A confirmar con Tomás

1. **Rutas `/` y `/app`** y que él agrega la Redirect URL antes del deploy.
2. **Dominio**: hoy es `app-semillero.vercel.app` para todo. "basquetnewells" sería un alias de Vercel (gratis) que cambia canonical, Open Graph y la configuración de Supabase; propongo dejarlo para después, no bloquea nada.
3. **Portal no instalable**: sólo Semillero se instala. ¿Está bien?
4. **Orden de merge**: este cambio toca `index.html` y `main.js`, igual que cuentas-familia. Propongo mergear **primero cuentas-familia** y rehacer esto encima; lo verifico con un merge de prueba.

## 9. Aceptación

`/` abre el portal negro sin scroll horizontal a 380 px y sin ningún pedido a Supabase; `/app` abre la landing de Semillero y el login con email y con Google vuelve a `/app`; los links viejos de mail siguen andando; DevTools → Manifest sin errores en `/app` y no hay manifest en `/`; Cache Storage sin `supabase.co`; `npm run test:q` verde; las 5+ ramas en vuelo mergean sin conflictos.
