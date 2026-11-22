# Constancia y asistencia en la vista del jugador — diseño

22/11, con las decisiones de Tomás del mismo día. Llevar a la vista del jugador dos piezas del laboratorio (`web/src/interacciones/Constancia.tsx`): el registro **«Hice mi rutina de hoy»** con la constancia semanal y la tarjeta de **asistencia continuada**. El fin es la adhesión: que los chicos sean más constantes. Es parte del producto, se arma ahora (no espera al MVP).

**Lo que ya rige y no cambia.** La cuenta de jugador no tiene `select` sobre ninguna tabla: lee y escribe lo suyo por funciones `security definer` que arrancan con `mi_jugador()` (0030; `registrar_apertura` de 0034 es el antecedente de escritura). El profe ve conteos de recursos, nunca quién, y nada con menos de 3 cuentas en el plantel (`resumen_recursos`, 0034). No hay cuenta profe y jugador a la vez (0032). **Las familias no tienen cuenta (PRD, 17/11).** Una cuenta de familia no tiene `cuenta_jugador`, así que todas las funciones nuevas le devuelven null y no se le abre nada.

## 1. Práctica con un recurso: «Hice mi rutina de hoy»

**Qué dato, dónde y quién lo ve.** «Este día practiqué este recurso» (un video de tiro, de manejo…). Lo marca el propio jugador. No guarda cuánto ni cómo, ni texto libre. Vive en Supabase. **El jugador** ve lo suyo. **El profe** ve **cuántos** del plantel lo practicaron, nunca quiénes. **Coordinación y familias** no ven nada.

Esto cambia la decisión de septiembre («sin botón *lo hice*: invita a mentir»). Ahora Tomás lo quiere como motivación. La apertura del recurso (0034) sigue igual, aparte.

**Tabla `practica_jugador`** (migración nueva, la próxima según `npx supabase migration list --remote`; hoy la última local es 0067). Columnas: `id`, `jugador_id`, `club_id`, `fecha date`, `tipo` ∈ `recurso | fisico`, `recurso_id` y `marcado_en` (sellado).
- **Tipo `fisico`:** queda listo en la base **sin pantalla ni función**, hasta que se defina el físico de antes del entrenamiento. Lleva `recurso_id` null y es una por día.
- **Tipo `recurso`:** una marca por recurso y día (índice único parcial).
- **Si se borra el recurso:** FK con `on delete set null (recurso_id)`, así el día practicado no se le borra de la constancia.
- **Permisos:** patrón de `0026_material.sql`, pero como `apertura_recurso`: `revoke all`, RLS activada, **ningún grant ni policy**. Nadie la toca directo.

**Funciones** (todas `security definer`; las del jugador arrancan con `mi_jugador()`):
- **`marcar_practica(p_recurso_id, p_hecho)`:** **la fecha la pone el servidor** (hoy en Argentina): se marca sólo el día en que se practica, y no hay mañana ni relleno. Sólo deja marcar recursos que se le enviaron a él (`envio_recurso`, como `registrar_apertura`). `false` borra la marca de hoy. Devuelve lo mismo que `mis_practicas()`.
- **`mis_practicas()`:** sus marcas de las últimas 12 semanas: fecha y recurso.
- **`practicas_del_plantel(p_plantel_id)`:** para el entrenador del plantel (`puede_ver_plantel`). Por recurso, cuántos lo practicaron esta semana y alguna vez; aparte, cuántos marcaron algo esta semana. **Ningún id de jugador**, y null con menos de 3 cuentas (misma regla que `resumen_recursos`).

**Borrado (Tomás: «si no es jugador del club, no nos sirve»).** Las marcas se borran cuando el chico se queda sin ninguna pertenencia vigente, con el mismo disparador y la misma regla que la emergencia (`borrar_emergencia_sin_plantel`, 0059). También se borran cuando se cierra su cuenta de jugador, porque ya nadie las ve.

**Pantalla.** El check va en **Inicio** (§3), con el texto «Registro personal para tu progreso · tu profe ve cuántos lo practicaron, nunca quién».
- **Al tocarlo:** se abre la lista de los recursos que le mandaron, sin los de tipo `lectura`, y elige cuál o cuáles practicó. Si tiene uno solo, se marca directo.
- **Sin recursos:** el check no aparece, y se le explica que llega cuando el profe le mande uno.
- **Constancia semanal:** los bloques en lima son los días con al menos una práctica. Si el recurso tiene `frecuencia_semanal` (0033), se muestra «2 de 3 veces esta semana».
- **Lado del profe:** el conteo aparece en su pantalla de recursos, junto a «abrieron».

## 2. Asistencia continuada (datos que ya existen)

**No hace falta tabla nueva:** `entrenamiento` y `asistencia` (0064/0066) ya lo tienen. Falta un camino de lectura, porque el jugador no lee esas tablas.

**`mi_asistencia()`** (`security definer`, `mi_jugador()`). Devuelve **un día por fecha de los últimos 12 meses**, con `fecha` y `vino` (`true`, `false` o `null`), **ya juntando todas sus categorías** (Tomás: «una sola racha, si fue a cualquiera de las dos»). La regla de cada día, en orden:
1. **Presente en alguno** → `true`. Un lesionado que vino cuenta.
2. **Lesionado ese día** (`lesion`) → `null`. La racha queda en pausa: no suma ni corta.
3. **Ausente o justificada en alguno** → `false`. La justificada cuenta como falta: avisar está bien, pero no fue.
4. **Nada de lo anterior** → `null` (no se lo tomó).

Sólo entran los días con `hubo = true` de planteles donde tenía pertenencia ese día. **No devuelve** el motivo, si avisó, la lesión, quién marcó ni nada de otro chico (Tomás: «sólo el número y algo superficial»). Va aparte de `mi_progreso()` para no copiar sus ~150 líneas una sexta vez.

La racha usa las reglas que ya existen, `asistenciaSeguida` y `mejorRacha`. Se mudan tal cual de `web/src/interacciones/logica.ts` a `src/data/constancia.js`, con su test, y va en su propio commit porque es un refactor.

**Vistas.** Lo primero que ve son **los últimos 10 entrenamientos**: la tira y la tarjeta del laboratorio. Un selector cambia a **mes** o **año**: una grilla de días en lima y huecos, con «viniste a X de Y» y la mejor racha del período.

**Profe y coordinador:** nada cambia. El profe ya ve la asistencia de su plantel, y coordinación sólo el %. La tarjeta no dice «sólo lo ves vos», porque la toma el profe.

## 3. Pantalla Inicio (reemplaza la pestaña Sesión)

La barra sigue con 5 pestañas: **Inicio**, Físico, Progreso, Jugadas, Recursos. `/jugador` abre en `/jugador/inicio`. Inicio tiene, en este orden:
1. La sesión de físico de hoy o la próxima, como un enlace a `/jugador/sesion/:id`. La ruta sigue existiendo, aunque ya no tenga pestaña.
2. «Tu semana»: el check y la constancia.
3. «Tu asistencia».

Hay que actualizar la guía de primer uso del jugador (`GuiaDePrimerUso`, modo `jugar`). La mano caliente queda en Progreso.

## 4. Privacidad, documentos y verificación

- **Aviso de privacidad** (`src/data/legal.js`): sumar que el jugador registra sus prácticas, que el profe ve sólo cuántos y que el jugador ve su propia asistencia. Subir `VERSION_LEGAL` para que vuelvan a aceptar. Va en esta misma tarea.
- **PRD:** su tabla de datos dice que asistencia y lesiones las ven sólo los profes. Sumar «y el jugador, la suya» y una fila para la práctica. El spec de 0064 («los jugadores no ven nada») queda superado.
- **`tests/verificarConstancia.sql`** (modelo `verificarCuentasFamilia.sql`). El jugador A no lee ni marca nada de B, ni recursos que no le mandaron. Profe, coordinador y familia reciben null en `mis_practicas`/`mi_asistencia`. `practicas_del_plantel` no trae ids y da null con menos de 3 cuentas. Al cerrar la última pertenencia, las marcas desaparecen.
- **Contratos:** `src/data/accesoJugador.js` suma `mis_practicas` y `mi_asistencia` a la lectura y `marcar_practica` a una lista nueva de escritura; su test lee también la migración nueva. Contrato de la lista `tipo` entre SQL y JS (modelo `contratoMaterial`).
- **Base:** antes del `db push`, `npm run backup`.

## 5. Decidido el 22/11

| Tema | Decisión |
|---|---|
| Marcar días | Sólo hoy, el día que lo hace |
| Qué se marca | La práctica de un recurso (rutina de básquet); el físico, después, desde Físico |
| Profe | Cuántos practicaron, nunca quién; mínimo 3 cuentas |
| Si deja el club | Se borran sus marcas |
| Justificada | Es falta y corta la racha |
| Lesionado sin venir | Pausa: no corta |
| Dos categorías | Una sola racha; vino si fue a cualquiera |
| Período | Últimos 10 primero; mes y año a elección |
| Qué ve de cada falta | Vino, faltó o sin tomar; ni motivo ni lesión |
| Dónde | Pestaña Inicio nueva en lugar de Sesión |
| Cuándo | Ahora, con el aviso de privacidad incluido |
