# Historia del jugador — spec

**Fecha:** 2026-10-16 · **Origen:** prompt 02 (reunión con profes del 15/10) · **Plan:** `docs/superpowers/plans/2026-10-16-historia-jugador.md`

## Problema

El profe sólo ve los planteles que tiene asignados (`puede_ver_plantel`, 0018). Si recibe en U17 a un chico que viene de U15, no ve nada de lo que se trabajó con él antes. La app existe para la memoria institucional, y hoy esa historia no aparece en ningún lado.

**Lo que importa (Tomás, 16/10):** qué se fue trabajando con el chico y cómo llega a la categoría. Eso pesa más que los puntos. Esta primera versión arma la historia desde ese lado, y después se pule.

## Qué hay en el modelo (verificado)

- **Alcanza; no se dispara el stop.** `pertenencia` tiene `plantel_id`, `temporada_id` y `desde`/`hasta`, y se cierra sin borrarse (0040). `asignacion_plantel` guarda historia completa desde 0017: se pueden listar los profes de cualquier plantel pasado, con el nombre de los metadatos de Auth.
- Del plantel cuelgan el plan físico (`plan_fisico` → `sesion_fisico` (fecha) → `ejercicio_asignado` (bloque, nombre)), los partidos y las sesiones de medición (tiro, salto, sprint, Yo-Yo). Caen solos en su temporada.
- `medicion_corporal`, `movimiento_escalon` (cargas de fuerza) y `envio_recurso` (material que recibió) no tienen plantel, sólo fecha. Como `temporada` no tiene fechas, se ubican contra los rangos de las pertenencias (§5).
- `jugada_plantel` no tiene fecha y dice lo asignado **hoy**, así que no entra en la historia.
- No hay temporada anterior en producción. La prueba de aceptación usa una 2025 sembrada **sólo en la base local**.

## Decisiones (confirmadas por Tomás el 16/10)

| # | Decisión | Consecuencia |
|---|---|---|
| D1 | **El coordinador no ve la historia.** Sigue viendo sólo datos generales y agregados (Panorama). | Se respeta 0018. La función rechaza al coordinador puro; quien tiene los dos roles entra por su lado de entrenador. |
| D2 | **El profe que suma a un chico de otra categoría ve su historia completa**, peso y altura incluidos. | Para **lectura** se deja a propósito sin efecto la ventana de 0039 (auditoría #8), sólo dentro de esta función. La sección corporal editable de la ficha sigue con su ventana: editar y borrar no cambian. Va escrito en el comentario de la migración y en `ESQUEMA.md`. |
| D3 | Forma: **qué se trabajó y cómo llega**, por encima de los números de partido. | §3. Es una primera versión para pulir después. |
| D4 | Velocidad = **sprint**. Resistencia = **Yo-Yo**. | `medicion_velocidad` se borró en 0045. |
| — | `detalleColapsableHtml` ya no existe. | Se usa `verDetallesHtml` (hoja), el colapsable actual del proyecto. |

## 1. Acceso: función `security definer`

**`historia_del_jugador(p_jugador_id uuid) returns jsonb`**, `stable security definer set search_path = ''`, con el patrón de `jugadores_del_club_para_dedup` y `mi_progreso`. Primero va la regla:

> quien llama es entrenador (`es_entrenador`) del club del jugador y hay una `pertenencia` del jugador con `hasta is null` en un plantel con `puede_ver_plantel` verdadero. Si no, `raise ... errcode '42501'`.

Lleva `revoke` a `public` y `anon` y `grant execute` sólo a `authenticated`. No crea, cambia ni borra ninguna policy.

**Por qué no policies extra (opción b):** habría que sumarlas en una docena de tablas, y como las policies se suman con OR, cambiaría lo que devuelve cada consulta existente. Por ejemplo, `obtenerPertenenciasDeJugador` pasaría a mostrar categorías ajenas en la cabecera de la ficha. Con la función, el permiso nuevo vive en un solo archivo y se revoca con un `revoke execute`.

**Auditable:** `tests/contratoHistoria.test.js` lee la migración y falla si toca policies, si otorga algo sobre tablas, si la función no es `security definer` con `search_path = ''` o si el grant no es sólo a `authenticated`. `tests/verificarHistoria.sql` prueba la regla con usuarios sintéticos.

## 2. Qué devuelve

Sólo de **ese** jugador: ningún dato de otro chico ni promedios.

```
temporadas    [{ id, nombre }]
planteles     [{ id, temporadaId, categoria, profes: [nombre] }]   -- asignaciones vigentes y cerradas
pertenencias  [{ plantelId, temporadaId, desde, hasta }]
planFisico    [{ plantelId, sesiones, primera, ultima, bloques: [{ bloque, ejercicios: [nombre] }] }]
cargas        [{ fecha, ejercicio, kg }]                           -- movimiento_escalon
recursos      [{ fecha, titulo }]                                  -- envio_recurso + recurso
saltos | sprints | yoyos   como mi_progreso, más plantelId
corporales    [{ fecha, peso, altura, ... }]                       -- sin ventana (D2)
tiro          [{ plantelId, fecha, anotados, intentos }]           -- por batería
partidos      [{ plantelId, fecha, minSegundos, pts, dos/tres/libres anotados e intentados }]
```

## 3. Cómo se ve

**Arriba, "Cómo llega":** el último dato de cada cosa **antes de que empezara su temporada actual**, con su fecha: salto por test, sprint por distancia, Yo-Yo, peso y altura, la última carga de cada ejercicio de fuerza y la última batería. Si algo no tiene dato: "sin medición". No hay flechas ni comparaciones.

**Debajo, una tarjeta por temporada,** la más reciente arriba (por `nombre`, como `clubes_para_solicitar`). Se ve siempre:
- Temporada, categorías (más de una si estuvo citado) y profes.
- Una línea de resumen, por ejemplo: "Plan físico: 24 sesiones · 3 materiales · 8 partidos".

En **"Ver detalles"** (la hoja), en este orden:
1. **Qué se trabajó.** Primero el plan físico de la categoría: sesiones, desde/hasta y bloques con sus ejercicios. Se rotula "Plan de la categoría" porque todavía no hay asistencia y no se sabe si fue a cada sesión. Después sus cargas de fuerza, ejercicio por ejercicio, con fechas y kg en orden. Al final, el material que recibió.
2. **Cómo terminó la temporada.** El último dato de la temporada para salto, velocidad (sprint), resistencia (Yo-Yo), peso y altura, y la lista con fechas de cada una.
3. **Tiro.** Las baterías por fecha, "anotados de intentados".
4. **Partidos.** Cuántos jugó y los totales de minutos, puntos, 2P, 3P y libres en "anotados de intentados", todos con el mismo peso visual.

Un bloque vacío dice **"Sin datos"** o **"Sin mediciones"**, nunca 0. Un total se calcula con los valores no nulos; si todos son nulos, "sin dato".

## 4. Extensible

`src/data/historiaJugador.js` define `FUENTES`, una lista de `{ clave, ubicar: 'plantel' | 'fecha' }`. La agrupación recorre esa lista sin saber qué hay en cada fuente. El componente de UI tiene `BLOQUES`, con `{ clave, seccion, titulo, html(items) }`.

Para sumar misiones o asistencia hace falta: (1) una migración nueva que haga `create or replace` de la función con una clave más; (2) una línea en `FUENTES`; (3) una entrada en `BLOQUES`. Ningún bloque existente se toca. El contrato verifica que cada clave del jsonb esté en `FUENTES`. Cuando haya asistencia, "Plan de la categoría" puede pasar a decir a cuántas sesiones fue.

## 5. Ubicar por fecha

Un dato sin plantel va a la temporada de la pertenencia cuyo rango `[desde, hasta]` contiene su fecha (`hasta` nulo = hoy); si cae en dos (citado), las dos son de la misma temporada o se elige la de nombre más alto. Si no cae en ninguna, va a un grupo final, **"Sin temporada"**. "Cómo llega" toma lo de fecha anterior al `desde` más viejo de sus pertenencias vigentes. Es lógica pura, con test.

## 6. Pantalla

Sección **"Historia por temporada"** en la ficha, entre los datos de la temporada actual y Cargas. El bloque que hoy tiene id `ficha-historia` pasa a llamarse `ficha-actual` en un commit de refactor aparte. Base de celular a 375 px, botones de 44 px como mínimo, ningún dato sólo por color, todo con `html\`...\``.

## Fuera de alcance

Exportar, vista para jugadores o familias, pase automático de categoría, editar el pasado, comparaciones entre jugadores y las jugadas (no tienen historia). Es sólo lectura.

## Riesgos conocidos

- Las pertenencias y asignaciones no se cierran solas con la temporada. Si quedan abiertas, el profe de U15 2025 sigue viendo a sus chicos. Ya pasa hoy y lo resuelve el pase de categoría, que queda fuera de alcance.
- D2 reabre para lectura lo que cerró la auditoría #8: le alcanza con sumar a un chico de su club a su plantel para ver toda su historia. Es una decisión de producto, y queda escrita en `ESQUEMA.md` y en `docs/SEGURIDAD-LANZAMIENTO.md`.
