# Misiones del partido — spec

Pedido de la reunión con los profes del 15/10: no fomentar el individualismo por puntos. Antes de un partido el profe le da a cada chico 1 o 2 aportes concretos al equipo y al equipo un objetivo común; después marca cómo salió cada uno. Los logros de equipo se acumulan en la temporada.

## ⚠ Choque con el código: el coordinador (decidir antes de ejecutar)

El prompt dice "el coordinador solo lee" y pide probarlo con su cuenta. Desde **0018** el coordinador puro no lee **ningún** dato individual (`jugador`, `partido`, `estadistica_*`, `meta_zona`: cero filas) y no tiene la pantalla de plantel ni la ficha: su shell es Panorama / Profes / Inventario. Una misión individual es un dato de un menor, así que dejársela ver revierte 0018.

**Propuesta (A):** el coordinador puro lee sólo lo de equipo —la previa (fecha y rival) y las misiones de equipo con su estado— y lo ve en Panorama como "Logros del equipo" por categoría, sin poder editar. Las misiones individuales siguen la regla de 0018: cero filas. Quien es coordinador **y** entrenador del plantel escribe, como en todo lo demás (`puede_escribir_plantel`).
**Decidido (16/10): opción A.** Descartadas: (B) que vea también las individuales (rompe 0018) y (C) que no vea nada.

## Modelo

Tres tablas nuevas (migración 0055), todas con `revoke all`, grants mínimos por columna, RLS y trigger de sellado (patrón 0026):

- **`previa_partido`**: `id`, `club_id`, `plantel_id`, `fecha date`, `rival text` (opcional, ≤ `LIMITE.rival`), `partido_id` (nulo hasta vincular; único parcial: un partido tiene a lo sumo una previa), `creado_por/en`. FK compuestas por club al plantel y al partido; `partido.plantel_id` tiene que ser el mismo (lo valida un trigger).
- **`mision_jugador`**: `previa_id`, `jugador_id`, `orden` (1 o 2), y **o bien** `metrica` + `valor` (entero ≥ 0) **o bien** `texto` (≤ 150): un `check` exige exactamente una de las dos formas. `estado` (`logrado` | `en_proceso` | `no_logrado` | nulo = sin evaluar), `comentario` (≤ 300), `evaluado_por/en` sellados. `unique (previa_id, jugador_id, orden)` impone el máximo de 2. El jugador tiene que tener pertenencia vigente al plantel (policy de insert).
- **`mision_equipo`**: igual que la de jugador sin `jugador_id`; `orden` 1 a 3. Tope 3 para que el objetivo común siga siendo uno o dos, no una lista (a confirmar).

`NULL ≠ 0` en todo: `estado` nulo es "todavía no la evaluó", `valor` real nulo es "sin dato".

## Métricas (lista cerrada)

Confirmadas contra `estadistica_jugador_partido` (0001). Cada una con sentido fijo, así el profe no elige "al menos / como máximo" (un toque menos y sin errores):

| Clave | Columna | En pantalla | Sentido | Ámbito |
|---|---|---|---|---|
| `reb_of` | `reb_of` | Rebotes en ataque | al menos | jugador, equipo |
| `reb_def` | `reb_def` | Rebotes en defensa | al menos | jugador, equipo |
| `reb_tot` | `reb_tot` | Rebotes | al menos | jugador, equipo |
| `ast` | `ast` | Asistencias | al menos | jugador, equipo |
| `rec` | `rec` | Robos | al menos | jugador, equipo |
| `tap` | `tap_cometidos` | Tapas | al menos | jugador, equipo |
| `per` | `per` | Pérdidas | como máximo | jugador, equipo |
| `fal` | `fal_cometidas` | Faltas | como máximo | jugador, equipo |
| `puntos_rival` | `partido.puntos_rival` | Puntos del rival | como máximo | sólo equipo |

Quedan afuera a propósito `pts`, todo tiro (anotados, intentados, porcentaje), `val`, `mas_menos`, `min_segundos`, tapas y faltas recibidas, y "ganar" o los puntos propios (es anotación). "Rival en menos de 60" se carga como "Puntos del rival, como máximo 59". La lista vive en `src/data/misiones.js` y en un `check` de la migración; un test de contrato las compara.

## Vínculo misión → partido (punto 8)

El problema: la previa se carga antes y el `partido` nace con el import.

| Opción | Cómo | Costo |
|---|---|---|
| 1. Trigger en `partido` | al insertar un partido, completa `partido_id` en la previa de ese plantel y fecha | lógica escondida dentro del import (el profe no sabe por qué quedó vinculada); con dos partidos el mismo día igual hace falta la mano; no se puede testear con `node --test` |
| 2. Llamada extra tras importar | el cliente vincula después de `importar_partido` | no es atómica (si se corta el wifi queda sin vincular) y toca el flujo del import |
| 3. Partido "programado" | se crea un partido vacío antes y el import lo completa | cambia `importar_partido` y la regla 1:1 con `importacion`: **stop condition** |
| **4. Vínculo calculado + fijado al evaluar (elegida)** | una función pura empareja previas y partidos por plantel + fecha (y rival si hay dos ese día); el `partido_id` se guarda recién cuando el profe evalúa o vincula a mano | si se importa un segundo partido del mismo día antes de evaluar, la previa pasa a "elegí el partido" (es lo correcto: es ambiguo) |

La 4 no toca el import ni su firma, es testeable y hace que el vínculo lo confirme siempre una persona. `vincularPrevias(previas, partidos)` devuelve por previa `{ partidoId, motivo }` con `motivo` ∈ `fijado` (ya tiene `partido_id`) · `fecha` (un único partido del plantel ese día) · `rival` (varios ese día, uno solo coincide con el rival escrito, comparando con `clavearNombre`) · `ambiguo` · `sin_partido`. Un partido ya fijado a una previa no se ofrece a otra.

## Valor real al lado de la misión

- Individual: la fila del jugador en el boxscore de ese partido. Sin fila, o con la columna nula → "sin dato". Un 0 leído es 0.
- Equipo: `totalesDelEquipo(estadisticas)` suma los jugadores propios; si **alguna** fila tiene esa columna nula, el total es "sin dato" (una suma parcial mentiría para abajo). `puntos_rival` sale de `partido`, nulo → "sin dato".
- Texto: "7 rebotes · misión: al menos 5". Misión de texto libre: sin valor, sólo la consigna.
- **La app nunca marca el estado**, ni lo sugiere ni lo resalta en verde/rojo: sólo muestra el número.

## Evaluación

Tres botones con ícono **y** palabra: Logrado / En proceso / No logrado, más un comentario corto opcional. **"En proceso"** en una misión de un solo partido = la intención se vio y hubo avance, pero no llegó (4 rebotes de 5; defendió bien al base la mitad del partido). No es "casi logrado" automático: lo decide el profe aunque el número esté a uno. Las misiones se pueden editar o borrar mientras no tienen estado; una evaluada sólo cambia de estado o comentario.

## Pantallas

- **Datos → Partidos**: botón "Armar misiones" (nueva previa: fecha, rival opcional) y lista de previas sin partido. Cada partido importado con previa muestra "Misiones" y lleva a la evaluación.
- **Previa** (`p-previa`): equipo arriba, después el plantel. Asignar a un jugador: tocar el jugador (1) → tocar la métrica o "Escribir" (2) → tocar el valor en el campo numérico, que ya tiene el foco (3) → "Agregar" (4). Quedan en el borrador de la pantalla; "Guardar misiones" escribe todo junto. Sin valores ni métricas propuestas.
- **Evaluación** (`p-misiones-partido`): cada misión con su valor real y los tres botones; si el vínculo es `ambiguo` o `sin_partido`, primero "¿De qué partido son estas misiones?" con los partidos del plantel. "Guardar evaluación" escribe todo junto y fija el vínculo.
- **Plantel**: tarjeta "Logros del equipo": "N logros esta temporada" y la lista (fecha, rival, misión). El plantel ya es de una temporada, así que el contador es por plantel.
- **Ficha del jugador**: sección "Misiones", orden cronológico (fecha, rival, consigna, valor real, estado). Sin totales, sin porcentajes, sin comparar con nadie.
- **Panorama (coordinador)**: los logros del equipo de cada categoría, de sólo lectura (opción A).
- No hay ranking ni conteo de misiones individuales en ninguna pantalla.

## Escrituras (wifi de gimnasio)

RPC `security invoker` con id generado en el cliente (idempotencia como 0038):

- `guardar_previa(payload)`: crea o actualiza la previa y reemplaza sus misiones sin evaluar en una transacción (las que no vienen se borran; tocar una evaluada falla con `MISION_EVALUADA`). Reintentar el mismo payload da el mismo resultado.
- `evaluar_misiones(payload)`: fija `partido_id` (falla con `PARTIDO_DE_OTRO_PLANTEL` o `PARTIDO_YA_VINCULADO`) y escribe estado y comentario de cada misión, todo o nada.
- Vincular a mano sin evaluar es un `update` de una fila (`partido_id`), sin RPC.

Cada RPC con su caso de rollback en `tests/verificarMisiones.sql` (un payload con una misión inválida al final no deja nada) y `tests/rollback0055.sql` para deshacer la migración en local.

## Fuera de alcance

Vista de jugador o padres (RLS: cero filas para cuentas de jugador), sugerencias o defaults, puntos y anotación, medallas o logros individuales, misiones de práctica, notificaciones, cambios al parser CABB o a `importar_partido`.
