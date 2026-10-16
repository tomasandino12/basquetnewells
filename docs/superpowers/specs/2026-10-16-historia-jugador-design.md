# Historia del jugador — spec

**Fecha:** 2026-10-16 · **Origen:** prompt 02 (reunión con profes del 15/10) · **Plan:** `docs/superpowers/plans/2026-10-16-historia-jugador.md`

## Problema

El profe sólo ve los planteles que tiene asignados (`puede_ver_plantel`, 0018). Si recibe en U17 a un chico que viene de U15, no ve nada de lo que se trabajó con él antes. La app existe para la memoria institucional y hoy esa historia no aparece en ningún lado.

## Qué hay en el modelo (verificado)

- **Alcanza para armar la historia; no se dispara el stop.** `pertenencia` tiene `plantel_id`, `temporada_id`, `desde`/`hasta` y se cierra sin borrarse (0040). `asignacion_plantel` tiene historia completa desde 0017 (`desde`/`hasta`, no se borra): se pueden listar los profes de cualquier plantel pasado. Sus nombres salen de los metadatos de Auth, como en `nombres_del_club`.
- Partidos, baterías de tiro, salto, sprint y Yo-Yo cuelgan de un plantel (`partido.plantel_id`, `sesion_medicion.plantel_id`), así que caen solos en su temporada.
- `medicion_corporal` y `movimiento_escalon` no tienen plantel, sólo fecha. Y `temporada` no tiene fechas, sólo `nombre`. Se ubican por fecha contra los rangos `desde`/`hasta` de las pertenencias del chico (ver §5).
- No hay temporada anterior en producción: hoy todo es 2026. La prueba de aceptación se hace con una temporada 2025 sembrada **sólo en la base local**.

## Choques con el prompt (decisiones a confirmar antes de ejecutar)

| # | Dice el prompt | Dice el código | Recomendación |
|---|---|---|---|
| D1 | "El coordinador ve la historia de todos, como ya lee todo el club" | Desde **0018** el coordinador **no lee ningún dato individual**: cero filas en `jugador`, partidos, mediciones. Su UI tampoco tiene ficha de jugador. | **Coordinador sin historia**, igual que hoy. Darle acceso revierte 0018 para los datos de menores y exige una pantalla nueva para llegar a la ficha. Si se quiere igual: función con rama de coordinador sin físico, pantalla de entrada desde Panorama y actualizar `docs/legal` y `docs/COORDINACION.md`. |
| D2 | El profe ve la historia **completa** de los chicos con pertenencia vigente en su plantel | **0039 (auditoría #8)** cerró justo eso: cualquier profe puede sumar a su plantel a un chico de otra categoría (el flujo del citado), y con eso leía toda su historia de peso y altura. Hoy una pertenencia sólo abre las medidas corporales **cargadas desde que existe**. La regla del prompt deja que el profe se dé el acceso a sí mismo: le alcanza con sumar al chico. | **Respetar la ventana de 0039 para lo corporal** (peso, altura, piernas): la historia muestra sólo lo que ya ve en la ficha. El resto (partidos, tiro, salto, sprint, Yo-Yo, cargas) se muestra completo, aceptando que sumar a un chico de otra categoría también lo abre. Si eso no alcanza: guardar cada lectura de historia en una tabla de auditoría que lea coordinación (no está en el plan). |
| D3 | Reutilizar `detalleColapsableHtml` | **Ya no existe**: lo reemplazó `verDetallesHtml` (`src/ui/componentes/verDetalles.js`), que abre una hoja, porque el `<details>` estiraba la pantalla. | Cada temporada es una tarjeta corta con su resumen siempre visible y **"Ver detalles"** (`verDetallesHtml`) para sus bloques. Es el colapsable actual del proyecto. |
| D4 | "Velocidad como lista con fecha" | La medición de velocidad se borró en **0045**. Hoy hay sprint (20/30 m, 0048) y Yo-Yo (0049). | "Velocidad" = **sprint**, lista con fecha. El Yo-Yo y el salto van en el bloque físico. |

El resto del documento asume las recomendaciones.

## 1. Acceso: función `security definer` (opción a)

**Una función nueva, `historia_del_jugador(p_jugador_id uuid) returns jsonb`**, `stable security definer set search_path = ''`, con el mismo patrón que `jugadores_del_club_para_dedup` y `mi_progreso`. Adentro, primero la regla:

> quien llama es entrenador del club del jugador y existe una `pertenencia` del jugador con `hasta is null` en un plantel para el que `puede_ver_plantel` da verdadero. Si no, `raise ... errcode '42501'`.

Después arma todo y devuelve un solo jsonb. `revoke` a `public` y `anon`, `grant execute` sólo a `authenticated`.

**Por qué no la opción b (policies de lectura extra en las tablas):** habría que sumarlas en unas once tablas (`pertenencia`, `plantel`, `temporada`, `partido`, `estadistica_jugador_partido`, `sesion_medicion`, `medicion_tiro/salto/sprint/yoyo`, `movimiento_escalon`). Las policies se suman con OR, así que **cambia lo que devuelve cualquier consulta existente**: `obtenerPertenenciasDeJugador` mostraría categorías ajenas en la cabecera de la ficha, y así con cada pantalla que filtra por jugador. Es lo que la decisión 2 quiere evitar, y además desparrama el permiso en once lugares. Con la función, el permiso nuevo vive en un archivo, no toca ninguna policy existente y se revoca con un `revoke execute`.

**Cómo se audita:** `tests/contratoHistoria.test.js` lee la migración y falla si crea, cambia o borra una policy, si otorga algo sobre una tabla, si la función no es `security definer` con `search_path = ''`, o si el `grant execute` no es sólo a `authenticated`. `tests/verificarHistoria.sql` prueba la regla con usuarios sintéticos (profe U17, profe U15, coordinador, jugador).

## 2. Qué devuelve

```
{ temporadas:   [{ id, nombre }],
  planteles:    [{ id, temporadaId, categoria, profes: [nombre] }],
  pertenencias: [{ plantelId, temporadaId, desde, hasta }],
  partidos:     [{ plantelId, fecha, rival, minSegundos, pts, dos*/tres*/libres* anotados e intentados }],
  tiro:         [{ plantelId, sesionId, fecha, anotados, intentos }],
  saltos | sprints | yoyos: misma forma que mi_progreso, más plantelId,
  corporales:   [{ fecha, peso, altura, ... }]   -- con la ventana de 0039 (D2),
  escalones:    [{ fecha, ejercicio, kg }] }
```

Sólo de **ese** jugador. Ningún dato de otro chico, ningún promedio. Los profes de un plantel son todas las asignaciones que tuvo, vigentes y cerradas, sin repetir.

## 3. Contenido por temporada

Orden: temporada de `nombre` más alto arriba (mismo criterio que `clubes_para_solicitar`). Por temporada:

- **Cabecera** (siempre visible): nombre, categorías (más de una si estuvo citado) y profes. Una línea de resumen: "8 partidos · 3 baterías · sin mediciones físicas".
- **Partidos**: cuántos jugó y los totales de lo que ya muestra la ficha: minutos, puntos, 2P, 3P y libres como "anotados de intentados". Los puntos con el mismo peso visual que lo demás.
- **Tiro**: baterías como serie, una fila por fecha con "anotados de intentados". Sin gráfico de tendencia.
- **Velocidad**: sprints con fecha, distancia y tiempo.
- **Físico**: salto (altura por test y fecha), Yo-Yo (idas con fecha), medidas corporales y cargas de fuerza. Sin comparación con normas ni flechas.

Cada bloque sin datos dice **"Sin datos"** (o "Sin mediciones"), nunca 0. Un total se calcula sólo con valores no nulos; si todos son nulos, "sin dato".

## 4. Extensible

Del lado de los datos, `src/data/historiaJugador.js` tiene una tabla `FUENTES`: `{ clave, ubicar: 'plantel' | 'fecha' }`. La agrupación recorre `FUENTES` y no sabe qué hay adentro de cada fuente. Del lado de la UI, el componente tiene una lista `BLOQUES`: `{ clave, titulo, html(items) }`.

Sumar misiones o asistencia es: (1) una migración nueva que hace `create or replace` de la función con una clave más; (2) una línea en `FUENTES`; (3) una entrada en `BLOQUES`. No se toca ningún bloque existente. `contratoHistoria.test.js` verifica que cada clave del jsonb de la migración más nueva esté en `FUENTES`.

## 5. Ubicar por fecha

Una medición sin plantel va a la temporada de la pertenencia cuyo rango `[desde, hasta]` contiene su fecha (`hasta` nulo = hoy). Si cae en más de una (citado), es la misma temporada o la de nombre más alto. Si no cae en ninguna, va a un grupo final **"Sin temporada"**. Lógica pura con test.

## 6. Pantalla

Sección **"Historia por temporada"** en la ficha, después de lo de la temporada actual y antes de Cargas. El bloque que hoy tiene id `ficha-historia` (los datos del plantel actual) se renombra a `ficha-actual` en un commit de refactor aparte, para que no haya dos "historias". Base de celular a 375 px, botones de 44 px como mínimo, ningún dato sólo por color, `html\`...\``.

## Fuera de alcance

Exportar, vista para jugadores o familias, pase automático de categoría, editar el pasado desde la historia, comparaciones entre jugadores. Se lee nada más.

## Riesgos conocidos

- Las pertenencias y asignaciones de una temporada no se cierran solas al empezar la siguiente. Si quedan abiertas, el profe de U15 2025 sigue viendo a sus chicos de entonces. Pasa lo mismo hoy y lo resuelve el pase de categoría, que está fuera de alcance.
- La potencia del salto necesita peso. Con la ventana de 0039 puede faltar en temporadas viejas: se muestra la altura y se dice qué falta, como hoy.
