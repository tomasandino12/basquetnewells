# Misiones del partido — plan

> Ejecutar en la sesión, de a una task, sin subagentes (CLAUDE.md). Una task = un commit. Antes de cada commit: `npm run test:q`. Después: `graphify update .`. Al cerrar cada task: resumen simple y qué probar en el navegador. **Sin merge**: lo hace Tomás después de probar.

**Objetivo:** el profe asigna misiones individuales (1 o 2 por chico) y de equipo antes del partido, las evalúa después con el valor real del boxscore al lado, y el plantel acumula logros de equipo.

**Spec:** `docs/superpowers/specs/2026-10-16-misiones-partido-design.md`.

**Rama:** `feat/misiones-partido` (desde `main`, tag `pre-misiones`).

## Restricciones globales

- Capas: pantalla → `repositorio.js` → `repos/misiones.js` → `cliente.js`. Toda la lógica (métricas, validación, valor real, totales, vínculo) en `src/data/misiones.js`, puro.
- HTML con `html\`...\``; `$` de `ui/dom.js`; errores con `ui/errores.js`. Números tecleados con `decimalEstricto` (y entero ≥ 0).
- Mobile-first, breakpoints sólo en `layout.css`, toques ≥ 44px, `hover` dentro de `@media (hover: hover)`. Estado con ícono **y** palabra, nunca sólo color. Sin jerga ("Asistencias", "Robos", no "AST", "REC").
- La app nunca escribe ni sugiere un estado. Sin ranking ni conteo de misiones individuales.
- No se toca `importar_partido` ni el parser. Sin dependencias nuevas.
- Estética (pedido de Tomás, 18/10): coherente con la app y con Newell's. La fuente de verdad es `DESIGN.md` (leerlo y seguir su checklist antes de cada pantalla). Papel y tarjetas blancas; Barlow Condensed en títulos, Inter en el cuerpo, IBM Plex Mono en los números; el color del club sólo con `--primario`, nunca un literal. Referencia visual: el proyecto de Stitch "Objetivos cortos — App formativa". Ahora importa que funcione y respete DESIGN.md: no inventar componentes ni estilos. Si algo no está cubierto, reusar el componente más parecido y anotarlo acá abajo. El pulido va en una pasada aparte.
- Antes de `npx supabase db push`: parar y preguntar si se corrió `npm run backup`.

## Componentes reusados por falta de uno propio

- Task 6: `.tarj`, `.tarj-h`, `.chips-tema`/`.chip-tema`, `.campo`, `.btn.sec.chico`, `.pie-fijo`, `.seccion-cab`, `.estado-vacio`, hoja y `.btn-icono` (tacho). Lo único nuevo en CSS son 4 reglas de `.mision-fila` / `.mision-tx` en `componentes.css` (una línea de misión con su botón de quitar): no había una fila de lista con acción por línea.
- Task 7: los tres estados son `.chip-tema` con `aria-pressed` (no había un selector de tres opciones: `.segmentado` es de dos), con glifo ✓ ◐ ✕ y la palabra; el elegir-partido es una `.tarj.tocable`. Sin CSS nuevo.
- Task 8: los logros usan `.tarj` + `.cifra` + `.tabla-ev`/`.fila-ev.dos` (como las secciones de la ficha); la sección de la ficha es `.tabla-ev` con `.chip`. Sin CSS nuevo.
- Task 9: Panorama reusa `bloqueLogros` (sin la `.tarj` propia, adentro de `.tarjeta-cat`). Sin CSS nuevo.

## Estado

| Task | Estado |
|---|---|
| 0. Confirmar la opción del coordinador (spec, "Choque con el código") | hecha: opción A (16/10) |
| 1. Lógica pura `misiones.js` | hecha |
| 2. Migración 0055: tablas, RLS, grants, sellado | hecha |
| 3. Migración 0055: RPCs `guardar_previa` y `evaluar_misiones` | hecha; verificada en local 18/10 (12/12 OK, en transacción con rollback) |
| 4. `db push` y verificación en el SQL Editor | push hecho 18/10 (prod 0001–0055); falta pegar `tests/verificarMisiones.sql` en el SQL Editor |
| 5. Repo `misiones.js` y fachada | hecha |
| 6. Pantalla de previa (asignar) | hecha (sin probar en navegador: el preview de esta sesión sirve la carpeta principal y hace falta login) |
| 7. Pantalla de evaluación y vínculo a mano | hecha (sin probar en navegador, igual que la 6) |
| 8. Logros en el plantel y misiones en la ficha | hecha |
| 9. Logros en Panorama (coordinador) | hecha |
| 10. ESQUEMA.md, prueba por rol y review final | hecha en lo que no necesita login: ESQUEMA.md, greps de capas/ranking/anotación limpios, RLS por rol probada en SQL (verificarMisiones 12/12). Falta la prueba en el navegador con login de profe y de coordinador (la hace Tomás) |

---

### Task 1 — Lógica pura

**Archivos:** `src/data/misiones.js`, `src/data/limites.js` (`textoMision: 150`, `comentarioMision: 300`), `tests/misiones.test.js`.

**Qué:** `METRICAS` (lista cerrada de la spec con clave, columna, etiqueta, sentido y ámbito), `ESTADOS`, `MAX_POR_JUGADOR = 2`, `MAX_DE_EQUIPO = 3`; `validarPrevia(borrador)`; `prepararPayloadPrevia`; `valorReal(mision, estadisticaDelJugador, partido)`; `totalesDelEquipo(estadisticas)`; `vincularPrevias(previas, partidos)`; `textoDeMision` / `textoDelValor` ("7 rebotes · misión: al menos 5", "sin dato").

**Aceptación:** ninguna métrica es puntos ni tiro; `valorReal` sin fila o con nulo → `null`, con 0 → 0; un nulo en cualquier fila → total `null`; vínculo cubre los cinco motivos.

**Tests:** `métricas no incluyen puntos ni tiro`, `sentido fijo por métrica`, `valorReal: sin fila es sin dato, 0 es 0`, `totalesDelEquipo: suma y nulo contagia`, `puntos_rival sólo en equipo`, `vincularPrevias: fijado / fecha / rival / ambiguo / sin_partido`, `un partido fijado no se ofrece a otra previa`, `validarPrevia: más de 2 por jugador, valor no entero, texto y métrica a la vez`.

### Task 2 — Migración 0055: tablas

**Archivos:** `supabase/migrations/0055_misiones_partido.sql`, `tests/contratoMisiones.test.js`, `tests/contratoLimites.test.js` (no se toca: finanzas edita esa línea; los largos de 0055 los compara `contratoMisiones`), `tests/rollback0055.sql`. `LIMITES_POR_COLUMNA` y `TABLAS_NUEVAS` se completaron después del merge de finanzas (18/10).

**Qué:** `previa_partido`, `mision_jugador`, `mision_equipo` como en la spec. Lectura y escritura por `puede_ver_plantel` / `puede_escribir_plantel`; insert de `mision_jugador` exige pertenencia vigente; `previa_partido` y `mision_equipo` además leíbles por `es_coordinador_de(club_id)` (opción A). Update por columna: misión `metrica, valor, texto` sólo sin estado (trigger), `estado, comentario` siempre; previa `rival, fecha, partido_id`. Trigger: sella autoría y evaluación, valida que el partido sea del mismo plantel, no deja cambiar `club_id` ni `plantel_id`. Cuentas de jugador: cero filas.

**Aceptación:** los checks de métrica y estado coinciden con `misiones.js`; los largos con `limites.js`.

**Tests:** `contratoMisiones: métricas del check = METRICAS`, `estados del check = ESTADOS`, `orden ≤ MAX_*`, `largos del check = LIMITE`, `RLS y revoke en las tres tablas`.

### Task 3 — Migración 0055: RPCs

**Archivos:** el mismo `0055_misiones_partido.sql` (todavía sin aplicar), `tests/verificarMisiones.sql`, `tests/rollback0055.sql`.

**Qué:** `guardar_previa(payload)` y `evaluar_misiones(payload)`, `security invoker`, con los errores de la spec y la idempotencia por id del cliente. `revoke execute ... from anon`.

**Aceptación / `verificarMisiones.sql`:** (1) entrenador del plantel guarda y evalúa; (2) entrenador de otro plantel: cero filas y la RPC falla; (3) coordinador puro lee previa y equipo, cero filas de `mision_jugador`, no escribe; (4) payload con la última misión inválida no deja nada (rollback); (5) reintento del mismo `guardar_previa` no duplica; (6) `MISION_EVALUADA`, `PARTIDO_DE_OTRO_PLANTEL`, `PARTIDO_YA_VINCULADO`.

**Tests:** `contratoMisiones: las RPC son security invoker y sin grant a anon`.

### Task 4 — `db push` y verificación

**Parar y preguntar por `npm run backup`.** Después: `npx supabase db push`, y Tomás pega `tests/verificarMisiones.sql` en el SQL Editor. Actualizar la memoria de migraciones.

### Task 5 — Repo

**Archivos:** `src/data/repos/misiones.js`, `src/data/repositorio.js` (una línea).

**Qué:** `obtenerPreviasDelPlantel`, `obtenerMisionesDeLaPrevia`, `guardarPrevia`, `evaluarMisiones`, `vincularPrevia`, `obtenerLogrosDelPlantel`, `obtenerMisionesDelJugador`, `obtenerLogrosDelClub` (coordinador). Mappers `previaDesdeFila` / `misionDesdeFila` en camelCase.

**Aceptación:** `arquitectura.test.js` verde (fachada, sin filas crudas).

### Task 6 — Pantalla de previa

**Archivos:** `src/ui/pantallas/previa.js`, `registro.js`, `datos.js` (botón "Armar misiones" y previas sin partido), CSS según `DESIGN.md`. Usar `/nueva-pantalla`.

**Aceptación:** misión a un jugador en 4 toques (jugador → métrica → valor → Agregar); el selector no ofrece puntos ni tiro; sin valores propuestos; "Guardar misiones" en una sola RPC y reintentable sin duplicar.

**Probar en el navegador:** armar una previa con 2 misiones a un chico, 1 de texto a otro y 1 de equipo; cortar la red al guardar y reintentar.

### Task 7 — Pantalla de evaluación

**Archivos:** `src/ui/pantallas/misionesPartido.js`, `registro.js`, `datos.js` (entrada desde cada partido con previa).

**Aceptación:** valor real al lado de cada misión con métrica; "sin dato" para quien no está en el boxscore; ningún botón arranca marcado; vínculo `ambiguo`/`sin_partido` pide elegir el partido; guardar fija el vínculo.

**Probar:** importar la planilla sintética con la fecha de la previa y evaluar; dos partidos el mismo día.

### Task 8 — Plantel y ficha

**Archivos:** `src/ui/pantallas/plantel.js`, `src/ui/pantallas/fichaJugador.js` (sección nueva; si pasa de ~60 líneas, a un módulo aparte).

**Aceptación:** "N logros esta temporada" + lista en el plantel; misiones del chico en orden cronológico en la ficha, sin totales ni comparaciones.

### Task 9 — Panorama del coordinador

**Archivos:** `src/ui/pantallas/coordPanorama.js`.

**Aceptación:** por categoría, los logros del equipo, sin botones de edición. Ningún dato individual.

### Task 10 — Cierre

**Archivos:** `supabase/ESQUEMA.md` (sección 0055 y filas en las tablas de RLS).

**Aceptación:** prueba con cuenta de entrenador y de coordinador; `npm run test:q` verde; grep de capas limpio (`arquitectura.test.js`); review final de la rama (único subagente aceptable).
