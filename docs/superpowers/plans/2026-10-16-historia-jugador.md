# Historia del jugador — plan

> Ejecutar en la sesión, de a una task, sin subagentes (CLAUDE.md). Una task = un commit. Antes de cada commit: `npm run test:q`. Después: `graphify update .`. Al cerrar cada task: resumen en lenguaje simple y qué probar en el navegador. **No hacer merge**: lo hace Tomás después de probar.

**Objetivo:** en la ficha del jugador, una sección "Historia por temporada" que muestre qué se trabajó con el chico y cómo llega, visible para el profe que lo tiene hoy en su plantel.

**Spec:** `docs/superpowers/specs/2026-10-16-historia-jugador-design.md` (D1–D4 confirmadas el 16/10).

**Rama:** `feat/historia-jugador`, en el worktree `.claude/worktrees/historia` (el checkout principal lo usa la sesión de misiones). **Tag:** `pre-historia` (= `6fe9971`, en `main`). En el worktree, correr `npm ci` antes de la primera prueba.

## Trabajo en paralelo: orden y dependencias

Al 16/10 hay cuatro ramas abiertas además de esta:

| Rama | Migración | Toca lo mismo que historia |
|---|---|---|
| `feat/backup` | — | nada; pero hace falta para cualquier `db push` (`npm run backup`) |
| `feat/finanzas` | **0054 ya escrita** | `ESQUEMA.md`, `layout.css`, `main.js` |
| `feat/misiones-partido` | **0054 en el plan** (choca con finanzas) | `fichaJugador.js` (Task 8), `ESQUEMA.md`, `layout.css` |
| `feat/portal-pwa` | — | `layout.css`, `main.js` |

**Choques reales:**
1. **Número de migración.** Finanzas y misiones van las dos por 0054, y esta rama necesita uno más. Una migración no aplicada se puede renumerar sin problema, pero los tests de contrato que leen la migración por nombre se renumeran con ella. Regla: **el número se fija recién al `db push`, según el orden de merge.** Mientras tanto, esta rama escribe `0056_historia_jugador.sql`.
2. **`fichaJugador.js`.** Lo tocan misiones (sección de misiones) y esta rama (refactor de id y sección nueva). Hay que mergear una antes de que la otra toque la ficha.
3. `ESQUEMA.md` y `layout.css`: conflictos chicos de texto, se resuelven al mergear.

**Orden recomendado:** backup → finanzas (0054) → misiones (0055) → historia (0056). Las tasks 1 a 4 de esta rama sólo crean archivos nuevos (más una función en `repos/jugadores.js`), así que **pueden avanzar ya**, en paralelo. Desde la task 5 (la ficha), esperar a que misiones esté mergeada en `main` y traerla con `sync_with_base_branch`. El bloque de misiones dentro de la historia queda para después, como el primer uso de la extensión (spec §4).

**Base local (18/10):** la función de 0056 está aplicada **a mano** (psql), sin fila en `supabase_migrations.schema_migrations`. Un `db reset` la borra: hay que volver a aplicarla con `docker exec -i <db> psql -U postgres < supabase/migrations/0056_historia_jugador.sql`. Ni la función ni sus pruebas leen tablas de 0054 o 0055. 0056 no crea tablas ni texto que escriba un usuario: no suma nada a `contratoLimites.test.js` (`TABLAS_NUEVAS`, `LIMITES_POR_COLUMNA`), así que no choca con misiones ahí.

## Restricciones globales

- Sólo lectura. La migración no crea, cambia ni borra policies, y no otorga nada sobre tablas. Si hiciera falta: **parar**.
- Datos de una temporada anterior, **sólo en la base local**. Nunca en producción.
- Antes de cada `npx supabase db push`: parar y preguntar si se corrió `npm run backup`.
- Sin dependencias nuevas. Capas: la pantalla pide por `repositorio.js`; agrupar y calcular va en `src/data/historiaJugador.js` (puro).
- `NULL` no es 0: "sin dato", "Sin datos", "sin medición".
- Sin comparar con otros jugadores, sin normas, sin tendencias, sin "mejoró". Sin jerga ("Asistencias", no "AST").
- CSS base de celular, breakpoints sólo en `layout.css`, toques de 44 px, `hover` dentro de `@media (hover: hover)`, nada sólo por color.

## Estado

| Task | Estado |
|---|---|
| 0. Decisiones, tag, rama y worktree | hecha (16/10) |
| 1. Lógica pura: agrupar y ubicar por fecha | hecha (16/10) |
| 2. Lógica pura: "Cómo llega" y resúmenes | hecha (16/10; fija la forma de cada fuente, ver el comentario de `historiaJugador.js`) |
| 3. Migración 0056 y contrato | hecha (18/10; se prueba contra la base en la Task 4) |
| 4. Prueba local con temporada 2025 + repo | hecha (18/10; verificarHistoria 6/6 OK en local, 0056 aplicada a mano sin reset; el seed se probó con rollback, todavía no se cargó) |
| 5. Refactor: `ficha-historia` → `ficha-actual` | **espera merge de misiones** |
| 6. Sección en la ficha | pendiente |
| 7. Docs y `db push` | push hecho (18/10, 0001–0056 en producción); faltan ESQUEMA.md y SEGURIDAD-LANZAMIENTO.md |

---

### Task 1: lógica pura, agrupar y ubicar por fecha

**Archivos:** crear `src/data/historiaJugador.js` y `tests/historiaJugador.test.js`.

**Qué produce:** `FUENTES` (spec §4) con `planFisico`, `cargas`, `recursos`, `saltos`, `sprints`, `yoyos`, `corporales`, `tiro`, `partidos`. `temporadaDeFecha(fecha, pertenencias, temporadas)` y `agruparHistoria(datos)`, que devuelve `[{ temporada, categorias, profes, fuentes }]`, de la más reciente a la más vieja, con el grupo `sinTemporada` si hace falta.

**Tests:** `ordena de la temporada más reciente a la más vieja`, `un partido y un plan físico caen en la temporada de su plantel`, `una carga y un material caen por fecha en el rango de la pertenencia`, `una fecha fuera de todo rango va a sin temporada`, `citado en dos categorías: una temporada con las dos`, `una fuente vacía queda como lista vacía`, `agregar una clave a FUENTES no cambia las demás`.

**Aceptación:** el test y `arquitectura.test.js` en verde.

### Task 2: lógica pura, "Cómo llega" y resúmenes

**Archivos:** `src/data/historiaJugador.js` y su test.

**Qué produce:**
- `comoLlega(datos)`: el último dato de cada tipo anterior a la temporada actual (spec §5), con fecha; `null` si no hay. Salto por test, sprint por distancia, cargas por ejercicio.
- `comoTermino(grupo)`: lo mismo, dentro de una temporada.
- `totalesDePartidos(items)`: cada total es `null` si todos sus valores lo son.
- `resumenDeTemporada(grupo)`: la línea de la tarjeta.
- La altura del salto y la velocidad del sprint salen de `salto.js` y `sprint.js`, que ya existen; no se duplican fórmulas.

**Tests:** `cómo llega toma lo anterior a la temporada actual`, `cómo llega sin mediciones da null, no 0`, `el salto se separa por test y el sprint por distancia`, `un total de puros nulos es null`, `el resumen nombra el plan físico antes que los partidos`.

### Task 3: migración 0056 y contrato

**Archivos:** crear `supabase/migrations/0056_historia_jugador.sql`, `tests/contratoHistoria.test.js` y `tests/verificarHistoria.sql`. Modelo Opus.

**Qué produce:** `historia_del_jugador(p_jugador_id uuid)`, con la regla de la spec §1 y la forma de la spec §2. Los corporales van **sin** la ventana de 0039 (D2), y el comentario de la migración explica por qué. Los profes salen de todas las `asignacion_plantel` del plantel, sin repetir. Con `revoke` a `public` y `anon` y `grant execute` a `authenticated`.

**Tests de contrato:** `no crea, cambia ni borra policies`, `no otorga nada sobre tablas`, `es security definer con search_path vacío`, `el grant es sólo a authenticated`, `la regla usa puede_ver_plantel, pertenencia vigente y es_entrenador`, `cada clave del jsonb está en FUENTES`. Verificar además que `contratoAccesoJugador.test.js` no salte.

**`verificarHistoria.sql`:** el profe U17 ve 2025 del chico que viene de U15; el mismo profe recibe 42501 con un chico de U15 que no está en su plantel; el coordinador puro, el jugador y un profe dado de baja reciben 42501.

**Aceptación:** `test:q` en verde. Sin `db push`.

### Task 4: prueba local con temporada 2025 y repo

**Archivos:** crear `tests/sembrarHistoriaLocal.sql` (no es una migración). En `src/data/repos/jugadores.js`, `obtenerHistoriaDelJugador(jugadorId)`: `rpc` más un mapper a camelCase. Si el mapper pasa de ~10 líneas, va a `historiaJugador.js` con su test.

**Seed:** temporada 2025 con U15M y U17M; un profe con asignación cerrada a U15M 2025; un chico con pertenencia cerrada en U15M 2025 y vigente en U17M 2026. En 2025, un plan físico con sesiones, cargas, un material, un salto, un sprint, un Yo-Yo, una batería y un partido. Además, otro chico sólo en U15M 2026. Arranca con un guard que aborta si la base no es la local.

**Pasos:** `npx supabase start` (Docker), migraciones, seed y `verificarHistoria.sql`.

**Aceptación:** los cinco casos dan lo esperado y `test:q` está en verde.

### Task 5: refactor, `ficha-historia` → `ficha-actual`

**Antes:** misiones mergeada en `main` y traída con `sync_with_base_branch`. Sólo el renombre, en un commit propio.

**Aceptación:** `grep -rn "ficha-historia" src public` vacío y `test:q` en verde.

### Task 6: sección en la ficha

**Archivos:** crear `src/ui/componentes/historiaTemporadas.js` (`BLOQUES`, `html\`...\``, `verDetallesHtml` por temporada). En `fichaJugador.js`, `<div class="pad" id="ficha-temporadas">` antes de `ficha-cargas`, con su try/catch y `avisoInline`. Estilos según `DESIGN.md` y su checklist: es la fuente de verdad. Coherente con el resto de la app y con la identidad del club (títulos condensados en mayúscula); el color del club entra **sólo** por `--primario`. Referencia visual: el proyecto de Stitch "Objetivos cortos — App formativa". **Sin componentes nuevos**: lo que DESIGN.md no cubra se anota acá y se resuelve en la pasada de pulido, que va aparte.

**Aceptación** (base local, 375 px):
1. El profe U17 ve "Cómo llega" con los datos de 2025, y las tarjetas de 2026 arriba y 2025 abajo.
2. En la hoja de 2025 aparecen, en orden, Qué se trabajó, Cómo terminó, Tiro y Partidos.
3. Al chico de U15 no llega, y la RPC directa da error.
4. Un bloque vacío dice "Sin datos".
5. Se usa con una mano.
6. `grep -rn "supabase\|repos/\|cliente.js" src/ui` no muestra nada nuevo.

### Task 7: docs y `db push`

**Archivos:** `supabase/ESQUEMA.md` (sección de la función, D2 escrita y filas en las tablas de funciones y RLS), `docs/SEGURIDAD-LANZAMIENTO.md` (D2) y la memoria.

**Pasos:** confirmar el número de migración según lo ya aplicado y renumerar si hace falta. Parar y preguntar por `npm run backup`. Después, `npx supabase db push`. Probar en producción con un profe; ahí sólo existe 2026.

**Aceptación:** `test:q` en verde, la migración aplicada y el Estado al día. Sin merge.
