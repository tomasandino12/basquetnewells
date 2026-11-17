# App formativa (v3)

App móvil para clubes formadores de básquet (piloto: Newell's, multi-club desde el diseño). Importa las planillas .xlsx de la CABB, y maneja estadísticas, mediciones físicas, plan físico, biblioteca de ejercicios, inventario de material y coordinación de profes. **Hay datos de menores**: la privacidad no es opcional.

## Stack
- JS vanilla con módulos ES, **sin build ni framework**. El navegador sólo carga `/public/**` y `/src/**` (importmap en `public/index.html`; `supabase-js` y `xlsx` vendorizados en `public/vendor/`).
- Supabase (Postgres + RLS + Auth). Deploy estático en Vercel; `.vercelignore` deja afuera docs, supabase, tests y `*.md`.
- Tests con `node --test`, un archivo por módulo en `tests/` (se descubren solos: `tests/*.test.js`).

## Mudanza a React (`web/`)
La interfaz se muda de a poco a React; el plan y las etapas los lleva la Oficina Virtual. Lo nuevo vive en `web/` (Vite + React 19 + TypeScript + Tailwind 4, piezas al estilo shadcn con `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge` y `lucide-react`; rutas con `react-router` 7, datos con `@tanstack/react-query`, animaciones con `motion`; pruebas con Vitest y Testing Library). `src/data`, `src/parser` y `supabase/` no se mudan: `web/` importa la lógica pura con el atajo `@datos/…` y pide datos sólo por `repositorio.js`, como la app vieja.
- `web/` queda fuera del deploy (`.vercelignore`) hasta la etapa que conecte la app publicada; `tests/contratoMudanzaReact.test.js` lo vigila.
- Comandos: `npm --prefix web test` (Vitest), `npm --prefix web run check` (tipos) y `npm --prefix web run build`.
- **Paquetes:** versiones exactas, sin scripts de instalación (`web/.npmrc`), con al menos dos semanas de publicadas y compatibles con Node 22.14. Un agente no instala: si falta uno, lo pide con nombre, versión y para qué.
- Una pantalla mudándose a la vez. Tokens de color y tipografía, los de `DESIGN.md`.

## Comandos
- `npm run test:q` — toda la suite, salida mínima (~300 bytes). **Usar este.** Si algo falla, correr sólo ese archivo: `node --test tests/<archivo>.test.js`.
- `npm test` — la misma suite con salida TAP de ~60 KB. Evitarlo: gasta ~15k tokens por corrida.
- `npx supabase db push` — aplica migraciones a la base real. Pedir confirmación antes, y **antes de cada `db push` parar y preguntar si se corrió `npm run backup`** (`docs/guias/BACKUP.md`).

## Dónde está cada cosa
- `src/data/repositorio.js`: **fachada** de 15 líneas, sólo `export * from './repos/<área>.js'`. El código está en `src/data/repos/`: `auth`, `clubes`, `coordinacion`, `ejercicios`, `fisico`, `inventario`, `jugadores`, `mediciones`, `partidos`, `recursos`. `src/data/cliente.js`: el cliente Supabase compartido (`obtenerCliente`, `TAMANIO_PAGINA`).
- `src/data/*.js`: lógica pura y testeable (validar, agrupar, preparar payloads, calcular). Sin red ni DOM.
- `src/parser/`: parsers de xlsx (`parserCabb.js`, `parserFisico.js`). Contrato en `src/parser/PARSER.md`.
- `src/ui/main.js`: navegación (`registrarPantalla`, `ir`, `volver`, `refrescar`). `src/ui/pantallas/*.js`: una pantalla por archivo. Helpers de UI: `dom.js` (`$`), `errores.js` (mensajes de error), `html.js` (plantilla que escapa), `nav.js` (toast, escaparHtml, formatos).
- `DESIGN.md`: sistema de diseño (tokens, reglas de movimiento, componentes, checklist de pantalla nueva). Leerlo antes de tocar CSS o armar una pantalla.
- `supabase/migrations/`: numeradas. `supabase/ESQUEMA.md` documenta el modelo (le faltan las tablas de 0020–0022). `docs/guias/COORDINACION.md`: roles y despliegue.
- `docs/`: `guias/` (cómo se opera: backup, auth, coordinación, SEO), `decisiones/` (por qué: identidad visual, landing, evaluaciones físicas), `historico/`, `superpowers/` (planes y specs), `cartel-qr/`. `docs/privado/` no va a git (el repo es público): auditoría de seguridad, borradores legales, revisiones. Lo que muestre debilidades o pendientes de seguridad va ahí, nunca a un archivo versionado.
- `scripts/`: herramientas de Node (`backup`, `cartel-qr`); `scripts/verificacion-visual/`: galería, capturas y mediciones con puppeteer.
- `google/`: Apps Script y guías de los formularios de Google.

## Arquitectura: reglas que verifica `tests/arquitectura.test.js`
Flujo de dependencias: **pantalla → `repositorio.js` → `repos/<área>` → `cliente.js`**, y lógica pura en `src/data/*.js`. No hay clases ni capas extra: son funciones y módulos.
- La UI **nunca** habla con Supabase ni importa de `repos/` o `cliente.js`: pide todo por `repositorio.js`.
- `src/data/*.js` (salvo `cliente.js`, `repositorio.js`, `repos/`) es puro: no importa UI ni repositorio, no usa DOM ni `fetch`. Si una función de un repo pasa de ~10 líneas de lógica sin red (calcular, agrupar, validar), esa lógica va a un módulo puro con su test y el repo sólo consulta y mapea.
- Un repo devuelve objetos de dominio en camelCase (mapper `xDesdeFila`), nunca filas crudas de la base.
- Función de acceso nueva → en el repo de su área. Área nueva → archivo nuevo en `repos/` + una línea en la fachada (el test lo exige).
- `$` se importa de `ui/dom.js`; los errores se cuentan con `textoDeError`, `avisoDeError` o `mensajeAlGuardar` de `ui/errores.js`. **No copiar** el texto de "sin conexión" ni redefinir `$`.
- **HTML nuevo con `html\`...\`` de `ui/html.js`**: escapa todo lo interpolado; `crudo()` sólo para HTML propio. Una pantalla que se toca y todavía usa `escaparHtml` a mano se migra si el cambio es chico; no mezclar los dos estilos en un mismo template.
- Una regla que vive en SQL **y** en JS (listas de tipos, rangos) lleva un test de contrato que lee la migración y la compara (modelo: `tests/contratoMaterial.test.js`).
- Sin patrones de catálogo por adelantado (factory, builder, clases con herencia…): se usan cuando duele algo concreto. Candidatos reales, para cuando llegue el momento: registro de parsers si aparece un tercer formato de planilla; cola de escrituras si hay modo sin conexión.
- Deuda conocida: la paginación (`range` en bucle) se repite en 4 repos y podría ser un helper en `cliente.js`; las pantallas viejas usan `escaparHtml` manual.
- Refactor y feature no van en el mismo commit.

## Reglas del proyecto
- **La seguridad la impone RLS, no la interfaz.** Roles: entrenador (sus planteles asignados), coordinador (agregados del club, más las fichas de emergencia en sólo lectura: decisión de Tomás 03/11, policy `emergencia_ver` de 0059), o ambos. Fuera de las emergencias, el coordinador puro no lee datos individuales de menores (0018).
- **Una migración aplicada no se edita** (lo bloquea un hook): se agrega una nueva. Tabla nueva = `revoke all` + `grant` mínimo por columna + RLS + trigger de sellado. Patrón: `0026_material.sql`. Skill `/nueva-migracion`.
- `NULL` es "no se sabe", nunca `0`. Un jugador es único por club, no por categoría.
- **Texto que escribe un usuario**: su largo va en `src/data/limites.js` (y `maxlength` en el campo) y en un `check (char_length(...))` de la migración; `tests/contratoLimites.test.js` compara los dos. **Números tecleados**: siempre `decimalEstricto` de `src/data/numeros.js`, nunca `Number(texto)` (`Number("1e2")` da 100).
- Nada de autorización en `user_metadata` (lo edita el propio usuario) ni en el cliente: el cliente decide qué mostrar, la base decide qué se puede. Auditoría y pendientes de lanzamiento: `docs/privado/SEGURIDAD-LANZAMIENTO.md` (fuera de git).
- Los `.xlsx` reales de `tests/fixtures/` **no van a git** (nombres de menores); sólo `tests/fixtures/sintetico/`. Nunca abrirlos ni pegar sus nombres. Sin ellos, los tests que los usan se saltean.
- UI y comentarios en español rioplatense (voseo). Los comentarios explican el porqué, no el qué.
- `docs/historico/CAMBIOS.md` es histórico (v2→v3) y `docs/superpowers/` son planes y specs ya ejecutados: **no leerlos salvo que la tarea sea sobre ellos**.
- No usar junctions ni enlaces simbólicos hacia `node_modules` (ni a nada fuera de la carpeta) en worktrees: al borrar el worktree se borra también el original. En un worktree, correr `npm ci`.

## Cómo trabajar (ahorro de tokens)
- **Planes y specs cortos.** Esto tiene prioridad sobre el formato por defecto de `writing-plans`: spec de 1–2 páginas; plan de máximo ~10 KB, con una task por commit, cada una con archivos, criterio de aceptación y nombre de los tests a escribir. **No pegar código de implementación dentro del plan.** Si un cambio es chico y claro, no hace falta plan.
- **Ejecutar en la sesión, sin subagentes** (arrancan sin contexto y salen caros). Único aceptable: el review final de una rama larga.
- **Verificaciones por comando las corre Claude directo** (`test:q`, greps), sin ciclo implementer+reviewer. Antes de dar algo por terminado: `npm run test:q`.
- **Commitear cada paso verificado**: trabajo sin commitear se pierde si la carpeta o el worktree se cierra.
- **Dos repos, que no queden desfasados.** `AppSemillero` (privado: trabajo, ramas, deploy de Vercel) y `basquetnewells` (público: la misma historia de `main` sin `docs/privado/`). Cada vez que algo entra a `main`, sugerir (con botón, no pushear sin el sí) subir a los dos, en este orden: `git push` y después `npm run publicar -- --push https://github.com/tomasandino12/basquetnewells.git`. Las ramas sólo van al privado. Nunca `--force` contra el público: si `publicar` no hace fast-forward, es que se reescribió historia de `main`, y hay que parar y avisar.
- **Ramas: `main` y una sola `pruebas` (decidido el 17/11/2026).** Mientras no haya usuarios reales, se trabaja **directo en `main`** y se pushea (Vercel despliega solo); una rama aparte solo si el cambio puede romper algo grande. Lo que no está probado va a **`pruebas`**, la única rama de trabajo permanente: se mira en su vista previa de Vercel y, cuando está bien, `main` avanza con `git merge --ff-only pruebas` (historia lineal, sin commits de unión) y `pruebas` queda igual a `main`. Reglas: (1) no se acumula: se sube entera y seguido; si algo no está listo se saca de `pruebas` con `git revert`, no se deja esperando; (2) antes de trabajar en ella, `git merge main`; (3) **ninguna rama protege la base**: las migraciones siguen con backup primero aunque no haya usuarios, y no se sabe si la vista previa de Vercel apunta al mismo Supabase que producción (verificarlo antes de probar migraciones ahí); (4) no crear ramas por tarea (`feat/…`, `fix/…`, `claude/…`): las ramas viejas no se tocan y se borran cuando Tomás lo pida; (5) `pruebas` va solo al repo privado: al público (`publicar`) solo sale `main`. Cuando haya usuarios reales, `main` pasa a ser solo lo probado y todo cambio nuevo entra por `pruebas`.
- Modelo: Sonnet por defecto en este proyecto. Opus para diseño de specs, migraciones, RLS/RPC y el review final.
- Antes de leer varios archivos: `graphify query "<pregunta>" --budget 1500`. Después de cambiar código: `graphify update .` (sin LLM, gratis).
- `Grep` y `Read` con `offset`/`limit` en vez de archivos enteros. Los repos son chicos (50–280 líneas): se pueden leer completos; la fachada ya no tiene nada que leer.
- Al cerrar una unidad de trabajo (commit hecho), sugerir `/clear` en vez de seguir en la misma sesión.
- Skills del proyecto: `/nueva-migracion` y `/nueva-pantalla`.
