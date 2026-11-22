# Constancia y asistencia en la vista del jugador — diseño

22/11. Llevar a `web/src/pantallas/jugador/` dos piezas del laboratorio (`web/src/interacciones/Constancia.tsx`, aprobadas por Tomás) que hoy usan datos inventados: el check **«Hice mi rutina de hoy»** con la constancia semanal, y la tarjeta de **asistencia continuada**. La mano caliente del tiro ya está en uso y no se toca.

**Datos de menores.** Lo que ya rige y no cambia: la cuenta de jugador no tiene `select` sobre ninguna tabla; lee lo suyo sólo por funciones `security definer` que arrancan con `mi_jugador()` (0030), y `src/data/accesoJugador.js` declara cada una (`tests/contratoAccesoJugador.test.js`). No existe cuenta profe y jugador a la vez (0032 cierra la de jugador). **Las familias no tienen cuenta (PRD, 17/11)**: no se les abre nada nuevo, y B-09/B-10 cierran lo de 0057.

## 1. «Hice mi rutina de hoy» — dato nuevo

**Qué dato, dónde y quién lo ve.** Un día marcado por el propio jugador: «hice mi rutina». Nada más: ni cuánto, ni qué, ni texto libre. Vive en Supabase. **Lo ve sólo él** (como dice la UI). Ni el profe, ni el coordinador, ni una familia, ni siquiera en agregado.

**Tabla `rutina_jugador`** (migración nueva, la próxima según `npx supabase migration list --remote`; hoy la última local es 0067). Columnas: `jugador_id`, `club_id`, `fecha date`, `marcado_en timestamptz` sellado. PK `(jugador_id, fecha)`: una marca por día, reintentar no duplica. Desmarcar **borra la fila** (equivocarse no deja rastro). Patrón de `0026_material.sql` con una diferencia a propósito: `revoke all` **sin ningún `grant` ni policy**. RLS activada y sin policies = nadie la lee ni la escribe directo, tampoco el profe. Todo pasa por dos funciones:

- `marcar_mi_rutina(p_hecho boolean)`: `security definer`, arranca con `mi_jugador()` y, si es null, error `SIN_CUENTA`. La **fecha la pone el servidor** (hoy en `America/Argentina/Buenos_Aires`, como `mi_plan`): el cliente no manda fecha, así que no hay forma de marcar mañana ni de rellenar el mes. `true` inserta (`on conflict do nothing`) y `false` borra. Devuelve lo mismo que `mi_rutina()`.
- `mi_rutina()`: las fechas marcadas de las últimas 8 semanas. La semana (lunes a domingo), «hoy» y los días que todavía no llegaron los arma lógica pura del lado del cliente.

Es **la primera escritura** que hace una cuenta de jugador. Por eso `accesoJugador.js` suma una lista nueva (`ESCRITURA_DEL_JUGADOR`) y el test de contrato se extiende a la migración nueva: hoy lee sólo 0029 y 0030, así que un grant en 0068 no lo vería. El test también tiene que exigir que las dos funciones pasen por `mi_jugador()`.

**Profe y coordinador:** no ven nada. No hay función para ellos, y la tabla no tiene policy. Si algún día se quiere que el profe vea algo, eso es otro spec: sólo agregado del plantel, cambiando antes el texto de la UI, y **nunca con lo que se marcó bajo «sólo lo ves vos»**.
**Familia:** una cuenta de familia no tiene `cuenta_jugador`, así que `mi_jugador()` le da null: `mi_rutina()` le devuelve null y `marcar_mi_rutina` le da error. `mis_chicos()` no se toca.
**Quién más puede verlo:** quien administra la base y los backups, o sea el encargado del tratamiento. La política de privacidad tiene que contarlo (ver §4).

**Pantalla:** **Físico** (`JugadorFisico.tsx`). Una tarjeta «Tu semana» arriba de «Hoy / Próxima sesión», con `CheckDeRutina` y `Semana`, que se mudan del laboratorio. La rutina es del plan físico, y Físico es la pestaña donde el jugador ya va a mirarlo.

## 2. Asistencia continuada — datos que ya existen

**No hace falta tabla nueva.** `entrenamiento` y `asistencia` (0064/0066) ya tienen todo. Lo que falta es un camino de lectura: el jugador no lee esas tablas (sus policies son `puede_ver_plantel`).

**Función `mi_asistencia()`** (`security definer`, arranca con `mi_jugador()`, una entrada en `LECTURA_DEL_JUGADOR`). Por cada entrenamiento con `hubo = true` de los planteles donde tiene pertenencia, en el período a decidir (pregunta 8), devuelve **sólo** `fecha`, `plantelId`, `categoria` y `vino`: `true` si está presente, `false` si es una falta, `null` si no se lo tomó. Los días sin práctica (`hubo = false`) no se devuelven. **No devuelve** el motivo (0066 puede decir «enfermo»), ni si avisó, ni la lesión, ni quién marcó, ni nada de otro chico, ni cuántos vinieron. Va en una función aparte y no en `mi_progreso()` para no volver a copiar las ~150 líneas de esa función (ya se copió entera cinco veces) por un solo dato.

Las reglas de racha ya están en `asistenciaSeguida` y `mejorRacha` (`web/src/interacciones/logica.ts`). Un `null` no suma ni corta. Se mudan tal cual a `src/data/constancia.js` con su `tests/constancia.test.js`, y `web/` las importa por `@datos/…`. Ese movimiento es un refactor y va en su propio commit. La regla de la lesión (pregunta 6) se resuelve **en la función**: el día de falta estando lesionado sale como `null`, sin decir por qué.

**Profe:** nada cambia. Ya ve la asistencia de su plantel en su pantalla y no ve rachas. El texto de la tarjeta **no** dice «sólo lo ves vos», porque la asistencia la toma el profe.
**Coordinador:** nada cambia (sigue con `asistencia_del_club`, sólo el %).
**Familia:** igual que en §1, null.

**Pantalla:** **Progreso** (`JugadorProgreso.tsx`). Una sección «Tu asistencia» arriba de todo, con `AsistenciaContinuada`, que se muda del laboratorio. Queda junto a la mano caliente: las dos son «vos contra vos».

## 3. Lo que hay que verificar

- `tests/verificarConstancia.sql` (modelo `verificarCuentasFamilia.sql`). El jugador A no lee ni marca nada del jugador B. Un profe, un coordinador y una cuenta de familia reciben null o `SIN_CUENTA` en las tres funciones. Nadie hace `select` sobre `rutina_jugador`. `mi_asistencia()` no trae motivos ni días de otro plantel.
- Contrato `accesoJugador` extendido a la migración nueva. Tests de `src/data/constancia.js`. Pruebas de las dos tarjetas en `Jugador.test.tsx`.
- Antes del `db push`: `npm run backup`.

## 4. Fuera de este spec

- Política de privacidad y `VERSION_LEGAL`: hay que sumar «registro personal de rutina» y «el jugador ve su propia asistencia». Va con B-14 o en una tarea aparte (pregunta 11).
- Corregir el PRD, cuya tabla de datos dice que asistencia y lesiones las ven sólo los profes, y el spec de 0064, que dice que los jugadores no ven nada.

## 5. Preguntas para Tomás (antes de implementar)

1. **Rutina libre o atada al plan:** ¿se puede marcar cualquier día, como en el laboratorio, o sólo los días que tienen sesión del plan físico? *Recomiendo: cualquier día.*
2. **Días pasados:** ¿puede marcar ayer si se olvidó, o sólo hoy? *Recomiendo: sólo hoy (y desmarcar hoy).*
3. **El profe y la rutina:** ¿confirmás que el profe no ve nada, ni siquiera cuántos del plantel la marcan? *Recomiendo: nada, como promete la UI.*
4. **Al irse:** cuando se cierra la cuenta del jugador o deja el club, ¿se borran sus marcas de rutina? *Recomiendo: sí, no le sirven a nadie más.*
5. **Falta con aviso:** ¿una justificada corta la racha o cuenta como día sin tomar? *En el % es falta (como la planilla).*
6. **Lesionado:** ¿un día en que faltó estando lesionado corta la racha? *Recomiendo: no, cuenta como día sin tomar.*
7. **Dos categorías:** ¿una sola racha por día (vino a alguna) o una por categoría?
8. **Período:** ¿la temporada vigente, o los últimos N entrenamientos? (la tira del laboratorio muestra 10)
9. **Qué ve de cada falta:** ¿sólo vino / faltó / sin tomar, sin motivo ni lesión? *Recomiendo: sí, sólo eso.*
10. **Ubicación:** rutina en Físico y asistencia en Progreso, ¿te parece bien?
11. **Backlog y privacidad:** ¿entran al BACKLOG.md (antes o después de la línea del MVP), y el texto legal va con B-14 o aparte?
