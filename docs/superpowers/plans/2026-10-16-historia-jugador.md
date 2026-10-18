# Historia del jugador — plan

> Ejecutar en la sesión, de a una task, sin subagentes (CLAUDE.md). Una task = un commit. Antes de cada commit: `npm run test:q`. Después: `graphify update .`. Al cerrar cada task: resumen en lenguaje simple y qué probar en el navegador. **No hacer merge**: lo hace Tomás después de probar.

**Objetivo:** en la ficha del jugador, una sección "Historia por temporada" con su recorrido, visible para el profe que lo tiene hoy en su plantel.

**Spec:** `docs/superpowers/specs/2026-10-16-historia-jugador-design.md`. **Antes de la Task 1 hay que confirmar D1–D4** (tabla de choques de la spec). El plan asume las recomendaciones; si alguna cambia, se ajusta este plan primero.

**Rama:** `feat/historia-jugador`. **Tag de respaldo:** `pre-historia`.

## Restricciones globales

- Sólo lectura: ninguna escritura nueva, ni en SQL ni en el cliente.
- La migración no crea, cambia ni borra policies, y no otorga nada sobre tablas. Si en algún momento hace falta, **parar** (stop condition del prompt).
- Datos de prueba de temporadas anteriores, **sólo en la base local**. Nunca en producción.
- Antes de cada `npx supabase db push`: parar y preguntar si se corrió `npm run backup`.
- Sin dependencias nuevas. Capas: la pantalla pide por `repositorio.js`; la lógica de agrupar va en `src/data/historiaJugador.js` (pura).
- `NULL` no es 0: un total de puros nulos es "sin dato" y un bloque vacío dice "Sin datos".
- Sin comparar con otros, sin normas, sin tendencias, sin "mejoró".
- CSS base de celular, breakpoints sólo en `layout.css`, áreas táctiles de 44 px, `hover` dentro de `@media (hover: hover)`.

## Estado

| Task | Estado |
|---|---|
| 0. Preparación y decisiones | pendiente |
| 1. Lógica pura de agrupación | pendiente |
| 2. Migración 0054 y contrato | pendiente |
| 3. Prueba local con temporada 2025 | pendiente |
| 4. Repo y fachada | pendiente |
| 5. Refactor: `ficha-historia` → `ficha-actual` | pendiente |
| 6. Sección en la ficha | pendiente |
| 7. Docs y `db push` | pendiente |

---

### Task 0: preparación y decisiones

- Confirmar D1–D4 con Tomás.
- `git status` tiene que estar limpio. Hoy hay archivos sin seguir (`docs/arquitectura-capas*`, `docs/prompt-revision-ux.md`, `.claude/skills/ui-ux-pro-max/`, un plan de jugadas): Tomás decide si se commitean, se ignoran o se mueven.
- `git tag pre-historia` y `git switch -c feat/historia-jugador`.

**Aceptación:** tag y rama creados, decisiones escritas en la tabla de la spec. Sin commit de código.

### Task 1: lógica pura de agrupación

**Archivos:** crear `src/data/historiaJugador.js` y `tests/historiaJugador.test.js`.

**Qué produce:**
- `FUENTES`: `[{ clave, ubicar: 'plantel' | 'fecha' }]` para `partidos`, `tiro`, `saltos`, `sprints`, `yoyos`, `corporales`, `escalones`.
- `temporadaDeFecha(fecha, pertenencias, temporadas)`: id de temporada o `null` (spec §5).
- `agruparHistoria(datos)`: `[{ temporada, categorias, profes, fuentes: { clave: items[] } }]`, de la temporada más reciente a la más vieja, más un grupo `sinTemporada` si hace falta. Una temporada sin pertenencias pero con datos (un partido de citado) también aparece.
- `totalesDePartidos(items)`: `{ jugados, minSegundos, pts, dos, tres, libres }`, donde cada total es `null` si todos sus valores lo son.
- `resumenDeTemporada(grupo)`: el texto de la línea de resumen ("8 partidos · sin mediciones físicas").

**Tests (`historiaJugador.test.js`):** `ordena de la temporada más reciente a la más vieja`, `un partido cae en la temporada de su plantel`, `una medición corporal cae por fecha en el rango de la pertenencia`, `una fecha fuera de todo rango va a sin temporada`, `citado en dos categorías: una sola temporada con las dos`, `un total de puros nulos es null, no 0`, `un bloque vacío queda como lista vacía, no se inventan ceros`, `agregar una clave a FUENTES no cambia el resultado de las demás`.

**Aceptación:** `node --test tests/historiaJugador.test.js` verde; `arquitectura.test.js` verde (módulo puro).

### Task 2: migración 0054 y contrato

**Archivos:** crear `supabase/migrations/0054_historia_jugador.sql`, `tests/contratoHistoria.test.js` y `tests/verificarHistoria.sql`. Modelo Opus (RLS/RPC).

**Qué produce:** `historia_del_jugador(p_jugador_id uuid) returns jsonb`, `stable security definer set search_path = ''`, con la regla de acceso de la spec §1 al principio y la forma de la spec §2. Corporales con la misma ventana de 0039 (`creado_en` desde que existe la pertenencia que da acceso). Profes: todas las `asignacion_plantel` del plantel, nombre desde `auth.users.raw_user_meta_data->>'nombre'`. `revoke ... from public, anon`, `grant execute ... to authenticated`. Comentario arriba con el porqué (prompt 02, D1–D4).

**Tests (`contratoHistoria.test.js`):** `0054 no crea, cambia ni borra policies`, `0054 no otorga nada sobre tablas`, `la función es security definer con search_path vacío`, `el grant execute es sólo a authenticated`, `la regla de acceso usa puede_ver_plantel y pertenencia vigente`, `cada clave del jsonb está en FUENTES`. Si `contratoAccesoJugador.test.js` también escanea migraciones nuevas, confirmar que no salta.

**`verificarHistoria.sql`** (para el SQL Editor local, con usuarios sintéticos y `set local role`/`request.jwt.claims`): profe U17 ve al chico que viene de U15 con su temporada 2025; profe U17 recibe 42501 con un chico de U15 que no está en su plantel; coordinador puro recibe 42501 (D1); jugador recibe 42501; un profe dado de baja recibe 42501.

**Aceptación:** `npm run test:q` verde. Todavía **sin** `db push`.

### Task 3: prueba local con temporada 2025

**Archivos:** crear `tests/sembrarHistoriaLocal.sql` (no es migración; se corre a mano contra la base local).

**Qué produce:** temporada 2025 del club de prueba con planteles U15M y U17M 2025, un profe con asignación **cerrada** a U15M 2025, un chico con pertenencia cerrada en U15M 2025 y vigente en U17M 2026, un partido y una batería en 2025, y otro chico sólo en U15M 2026. Arranca con un guard que aborta si la base no es la local (por ejemplo, si existe el club de Newell's real).

**Pasos:** `npx supabase start` (Docker), aplicar migraciones, sembrar, correr `verificarHistoria.sql`.

**Aceptación:** los cinco casos de `verificarHistoria.sql` dan lo esperado. Commit del seed y de los ajustes que hayan salido.

### Task 4: repo y fachada

**Archivos:** `src/data/repos/jugadores.js` (`obtenerHistoriaDelJugador(jugadorId)`: `rpc` y mapper `historiaDesdeJson` a camelCase). Si el mapper pasa de ~10 líneas, va a `historiaJugador.js` con su test. La fachada ya exporta todo `jugadores.js`: no cambia.

**Tests:** si el mapper es puro, `historiaDesdeJson pasa a camelCase y conserva los null` en `historiaJugador.test.js`.

**Aceptación:** `test:q` verde; `arquitectura.test.js` verde.

### Task 5: refactor, `ficha-historia` → `ficha-actual`

**Archivos:** `src/ui/pantallas/fichaJugador.js` y el CSS que use ese id, si hay. Sólo el renombre, sin cambio de comportamiento (refactor y feature no van en el mismo commit).

**Aceptación:** `grep -rn "ficha-historia" src public` vacío; `test:q` verde.

### Task 6: sección en la ficha

**Archivos:** crear `src/ui/componentes/historiaTemporadas.js` (lista `BLOQUES`, `html\`...\``, `verDetallesHtml` por temporada). En `fichaJugador.js`, un `<div class="pad" id="ficha-temporadas">` antes de `ficha-cargas`, con su propio try/catch y `avisoInline` si falla, como los demás bloques. Estilos en el CSS de componentes que corresponda, consultando `DESIGN.md` y su checklist.

**Qué se ve:** por temporada, una tarjeta con nombre, categorías, profes, la línea de resumen y "Ver detalles". En la hoja, los bloques Partidos, Tiro, Velocidad y Físico. Cada bloque vacío dice "Sin datos" o "Sin mediciones". Puntos con el mismo peso que el resto. Ningún dato sólo por color.

**Aceptación:** con la base local sembrada, en el navegador a 375 px: (1) profe U17 ve 2026 arriba y 2025 abajo, con el partido y la batería de 2025; (2) en la ficha del chico de U15 no llega (no está en su plantel) y la consulta directa a la RPC devuelve error; (3) un bloque sin datos dice "Sin datos"; (4) se usa con una mano, botones de 44 px. `grep` de capas limpio: `grep -rn "supabase\|repos/\|cliente.js" src/ui` sin resultados nuevos.

### Task 7: docs y `db push`

**Archivos:** `supabase/ESQUEMA.md` (sección "Historia del jugador (0054)", fila en la tabla de funciones y en la de RLS) y la memoria del proyecto.

**Pasos:** parar y preguntar si se corrió `npm run backup` → `npx supabase db push` → probar en producción con la cuenta de un profe que el único caso real es 2026 (una sola temporada, sin datos sembrados).

**Aceptación:** `test:q` verde, 0054 aplicada, Estado de este plan al día. Sin merge.
