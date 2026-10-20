# Portal del básquet y Semillero separados — diseño (v2)

Estado: **aprobada por Tomás el 18/10** (incluida la lectura anónima de formularios por función). Plan: `docs/superpowers/plans/2026-10-18-portal-v2.md`. Fecha: 18/10/2026. Rama `feat/portal-pwa` (se rehace encima; nada mergeado). Reemplaza `2026-10-16-portal-pwa-design.md`: el bloque dentro de la landing no le sirvió.

## 1. Qué cambia

Hoy hay una sola página: la landing de Semillero con un bloque de básquet adentro. Pasan a ser **dos productos con dos puertas**:

| | Portal "Básquet Newell's" | Semillero (la app) |
|---|---|---|
| Para quién | Familias y cualquiera que busque al club | Profes, coordinación y jugadores |
| URL | `/` | `/app` |
| Estética | Negra, como newellsoldboys.com.ar (`publico.css`) | La actual: landing negra para entrar, app clara adentro |
| Instalable | No | **Sí**: manifest y service worker pasan acá |
| Datos | Sólo la lista de formularios activos (§3) | Todo, protegido por RLS |

El portal es el link que se reparte. Un botón lleva a Semillero, que conserva su landing actual (crear cuenta / ingresar) sin el bloque de básquet. `/app` es el link de profes y jugadores: lo instalan y abren siempre ahí.

## 2. Qué tiene el portal (mobile-first, en este orden)

1. **Presentación del club** (escudo y nombre ya en uso; sin usos nuevos del escudo hasta que el club lo apruebe).
2. **"¿Qué tengo que hacer?"**: pasos numerados que llevan a cada sección: 1) inscribir al chico, 2) mandar la documentación, 3) pagar y subir el comprobante, 4) mirar el calendario.
3. **Formularios** (§3): cada uno con una línea de para qué es y qué tener a mano ("Antes de empezar, tené a mano: el DNI del chico y el tuyo, la credencial de la obra social…") y qué pasa después. Nunca se replican preguntas: el formulario vive en Google, y los DNI, fotos y datos de salud **nunca pasan por Semillero**.
4. **Calendarios**: partidos/torneos y eventos/recaudación (dos Google Calendar, ya resueltos en esta rama).
5. **Información**: categorías, entrenamientos, contacto (texto fijo que pasa el club; hasta entonces "Próximamente").
6. **Entrar a Semillero**: botón a `/app` con cómo instalarla (Android: menú → Instalar; iPhone: Compartir → Agregar a inicio).
7. **"¿Dudas? Escribile al coordinador"**: un enlace de contacto (WhatsApp o mail) en `portal.js`; **dato pendiente del club**, porque no hay mail propio.

Textos en voseo y sin suponer que saben de computadoras (pedido de Tomás). El calendario, la información y el contacto viven en `src/data/portal.js`; un valor en `null` se ve como "Próximamente".

## 3. Formularios que carga la coordinación (decisión que Tomás debe aprobar)

**Pedido**: la coordinación suma, edita, ordena y oculta formularios desde su panel (ej. "hay que pagar las rifas: el coordinador suma el form, el padre lo abre y sube el comprobante"). **Esto rompe la regla "lo público no lee la base"** de la v1, así que se hace con la superficie más chica posible:

- **Tabla nueva `formulario_portal`** (migración **0058**; la 0057 es de cuentas de familia): `club_id`, `titulo`, `texto`, `enlace`, `orden`, `activo`, `creado_por`, fechas. **Sin ningún dato de jugadores, familias ni nada que se le parezca.**
- **Lectura anónima por una sola función**, `formularios_publicos(club)`, que devuelve **título, texto y enlace de las filas activas, en orden**. El visitante anónimo no recibe `select` sobre la tabla: sólo `execute` de esa función.
- **Escritura sólo del coordinador del club** (RLS + grants por columna; sin `delete`: se oculta con `activo = false`, queda el rastro de quién y cuándo). Patrón `0026_material.sql`.
- **Enlace validado dos veces**, en el panel y con un `check` de la base: sólo `https://docs.google.com/forms/…` o `https://forms.gle/…`. Largos en `limites.js` con su `check`; `contratoLimites` y un test de contrato comparan JS y SQL.
- **Pantalla "Coordinación → Formularios"** en Semillero: lista, agregar, editar, subir/bajar, mostrar/ocultar, con el aviso "esto lo ve cualquiera: no pongas nombres de chicos". Lo mostrado se escapa con `html\`\``.
- **Portal**: la lectura pasa por `repositorio.js` → `repos/portal.js` (área nueva, una línea en la fachada). El portal lleva el mismo import map inline que la app, por lo que su hash en la CSP es el mismo y no hace falta tocarla. Si la base no responde, el portal muestra el respaldo de `portal.js` con un aviso de que puede estar desactualizado; con la lista **vacía** dice "no hay formularios abiertos" (la coordinación pudo ocultarlos a propósito, por ejemplo al cerrar la inscripción, y no se le muestra a la familia uno cerrado). Todo lo demás sigue andando. Si la URL es la vuelta de un login, el portal no consulta nada: el cliente de Supabase canjearía el código en esa página.
- Después del push de 0058 la lista arranca vacía: la coordinación toca **"Agregar el de Inscripción"** en Coordinación → Familias → Formularios (viene precargado desde `portal.js`) y la familia vuelve a verlo. Hasta ese toque el portal dice que no hay formularios abiertos.

**Riesgo que queda**: una cuenta de coordinador comprometida podría publicar un enlace malicioso, acotado a dominios de Google, y quedaría registrado quién lo creó; se oculta con un toque. Se acepta.

## 4. Rutas y login (Tomás toca Supabase)

- `vercel.json`: `/` → portal, `/app` → la `index.html` de hoy (así los tests y el hash de CSP no se mueven). `/public/index.html` sigue respondiendo.
- `urlDeRetorno()` devuelve `origin + pathname`: desde `/app` es `https://app-semillero.vercel.app/app`. **Tomás agrega esa URL a "Redirect URLs" en Supabase Auth** (`docs/CONFIGURAR-AUTH.md`) **antes del deploy** (agregar no rompe nada). No se cambia código de login.
- Los mails ya enviados apuntan a `/`: un script mínimo del portal detecta `code=`, `access_token` o `type=recovery` y manda a `/app` conservando query y hash.

## 5. PWA: pasa a `/app`

Manifest (`id`, `start_url`, `scope`: `/app`), `<link rel="manifest">`, íconos y registro del service worker quedan sólo en la página de Semillero; `Service-Worker-Allowed: /app`. Mismas reglas del service worker (nunca cachea otro origen, `/src` ni CSS). El portal no lo registra.

## 6. Fuera de alcance

- **Login y cuentas de padres**: otro módulo (Cuentas de familia, prompt 08), con su spec, RLS y función de servidor, bloqueado hasta que el club confirme quién crea los vínculos. **No se diseña acá y el portal no tiene botón de padres.**
- Formularios con archivos, carpetas por chico y reinscripción: `claude/inscripcion-google-41cf4e`.
- Pagos, calendario dentro de la app, mensajería, push, noticias con CMS, dominio propio.

## 7. Privacidad

Calendarios públicos: nunca nombres de jugadores en eventos. Los iframes de Google ponen cookies de Google: una línea en la política de privacidad (texto lo revisa Tomás o el club), que también diga que los formularios y archivos de las familias son tratamiento del club en Google, fuera de la RLS (decisión de Tomás).

## 8. Qué se reaprovecha

Se queda: `portal.js`, CSP de Calendar, íconos, manifest, service worker y tests, guía de `COORDINACION.md`. Se desarma: el bloque `#basquet` de `index.html`; `portalLanding.js` pasa a servir al portal; `canonical`, `og:*`, `sitemap` y `metadatos.test.js` se ajustan.

## 9. A confirmar con Tomás

1. **Formularios desde el panel (§3)**: aprobación explícita de que el portal lea de la base esa única función. Si prefiere cero lectura, la alternativa es la lista fija en `portal.js` (cada formulario nuevo es un cambio de código).
2. **Rutas `/` y `/app`** y que él agrega la Redirect URL antes del deploy.
3. **Dominio** "basquetnewells": alias de Vercel que cambia canonical, Open Graph y Supabase; propongo dejarlo para después.
4. **Contacto** del coordinador (WhatsApp o mail) para "¿Dudas?".
5. **Orden de merge**: toca `index.html` y `main.js`, que también tocan otras ramas; hago un merge de prueba con todas antes de avisar que está lista.

## 10. Aceptación

`/` abre el portal negro sin scroll horizontal a 380 px, con un único pedido a Supabase (la función anónima); `/app` abre la landing de Semillero y el login con email y Google vuelve a `/app`; los links viejos de mail siguen andando; Manifest sin errores en `/app` y ninguno en `/`; Cache Storage sin `supabase.co`; un anónimo no puede leer ni escribir `formulario_portal` fuera de la función; un coordinador de otro club no ve ni edita los formularios de este; `npm run test:q` verde; las ramas en vuelo mergean sin conflictos.

## 11. Ampliación del 19/10: consultas, QR y sponsors

Pedidos de Tomás, aprobados por la coordinadora:
- **Acceso destacado "Quiero jugar en Newell's"** arriba del portal, y **sección "Sumate como sponsor o colaborador"**: son formularios de la lista de la coordinación con un **destino** (migración **0061**: columna `destino`, un formulario por destino y club). Marcar por orden no alcanzaba: el portal tiene que saber cuál es cuál aunque se reordene o se cambie el título.
- **QR impreso** a una dirección fija, **`/consultas`**, que redirige al formulario de consultas vigente (una ruta y no un ancla, porque el hash lo usa la vuelta del login). Cartel A4 y PNG generados sin dependencias (`npm run cartel-qr`), **como borrador hasta definir el dominio**.
- **Logos de sponsors**: franja lista pero oculta; se cargan por un arreglo en `src/data/portal.js` con archivos en `public/sponsors/`. Una pantalla de carga con Storage queda propuesta, no construida.
