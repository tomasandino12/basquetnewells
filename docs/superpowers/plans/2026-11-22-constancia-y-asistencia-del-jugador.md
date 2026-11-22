# Plan — Constancia y asistencia del jugador (B-31)

Spec: `docs/superpowers/specs/2026-11-22-constancia-y-asistencia-del-jugador-design.md` (leerlo entero antes de cada task: las reglas de cada día de asistencia, el borrado y los conteos del profe están ahí y no se repiten acá).

**Reglas para quien ejecuta.** Una task por commit, directo en `main` (`web/` no se despliega todavía; la migración no se aplica sola). Antes de commitear: `npm run test:q`, y si la task toca `web/`, también `npm --prefix web test` y `npm --prefix web run check`. Sin `db push`: lo hace Tomás en la task 8. No instalar paquetes. No tocar archivos de otras tareas que aparezcan modificados en `git status` (hay otras sesiones en la carpeta): `git add` sólo de los archivos de la task. Mensajes de commit en español, cortos, como los de `git log`.

## Estado

| Task | Qué | Estado |
|---|---|---|
| 1 | Refactor: rachas a `src/data/constancia.js` | hecha |
| 2 | Lógica pura de la semana y las vistas | hecha |
| 3 | Migración: tabla, funciones, borrado, verificación | hecha (0068; sin aplicar: la aplica la task 8) |
| 4 | Repos y consultas de `web/` | hecha |
| 5 | Pantalla Inicio del jugador | hecha (ojo: `mis_recursos()` no devuelve `tipo` ni `frecuencia_semanal`; ver nota en el commit) |
| 6 | Conteo de prácticas en la pantalla del profe | pendiente |
| 7 | Privacidad, `VERSION_LEGAL` y PRD | pendiente |
| 8 | Backup, `db push` y verificación SQL (Tomás) | pendiente |

## Task 1 — Refactor: las rachas salen del laboratorio

- **Archivos:** nuevo `src/data/constancia.js` con `asistenciaSeguida` y `mejorRacha` movidas tal cual (con sus comentarios) desde `web/src/interacciones/logica.ts`; `logica.ts` deja de definirlas; `Constancia.tsx` y quien más las use las importan de `@datos/constancia.js`. Sus casos de `web/src/interacciones/logica.test.ts` pasan a `tests/constancia.test.js`.
- **Acepta:** misma conducta, cero cambios de UI; `tests/arquitectura.test.js` en verde (módulo puro).
- **Tests:** `asistenciaSeguida: un día sin tomar no suma ni corta`, `asistenciaSeguida: una falta corta`, `mejorRacha: la más larga de la lista`.
- Commit `Refactor: …` (sin feature en el mismo commit).

## Task 2 — Lógica pura de la semana y de las vistas

- **Archivos:** `src/data/constancia.js`, `tests/constancia.test.js`.
- **Qué agrega:**
  - `TIPOS_DE_PRACTICA` (`['recurso', 'fisico']`, para el contrato con SQL).
  - `semanaDePracticas(marcas, hoy)`: lunes a domingo de la semana de `hoy`, cada día con `hecho`, `esHoy` y `futuro`.
  - `vecesEnLaSemana(marcas, recursoId, hoy)`.
  - `recursosPracticables(recursos)`: saca los de tipo `lectura`.
  - `vistaDeAsistencia(dias, vista, hoy)`: `vista` es `ultimos` (10 entrenamientos), `mes` o `anio`; devuelve los días del período, vino, tomadas, racha actual y mejor racha.
  - Las fechas son `YYYY-MM-DD` de Argentina, como `fechaLocal`.
- **Acepta:** puras, sin `Date` implícito (reciben `hoy`), `null` nunca es `false`.
- **Tests:** `semanaDePracticas: arranca el lunes y marca futuros`, `semanaDePracticas: dos prácticas el mismo día son un bloque`, `vecesEnLaSemana: cuenta sólo esta semana`, `recursosPracticables: sin lectura`, `vistaDeAsistencia: ultimos son los 10 últimos tomados o no`, `vistaDeAsistencia: mes y anio cortan por fecha`, `vistaDeAsistencia: null no cuenta como tomada`.

## Task 3 — Migración (la más delicada: seguir el spec al pie de la letra)

- **Antes:** `npx supabase migration list --remote` para confirmar el número (se espera `0068`). Leer de modelo `0026_material.sql`, `0034_apertura_recurso.sql` (tabla cerrada, `registrar_apertura`, `resumen_recursos` con mínimo 3) y `0059_temporada_y_emergencia.sql` (`borrar_emergencia_sin_plantel`). Skill `/nueva-migracion`.
- **Archivos:** `supabase/migrations/0068_constancia_jugador.sql`, `tests/verificarConstancia.sql`, `tests/rollback0068.sql`, `tests/contratoConstancia.test.js`, `src/data/accesoJugador.js` y `tests/contratoAccesoJugador.test.js`.
- **Contenido de la migración:**
  - La tabla `practica_jugador`: sin grant ni policy, `on delete set null (recurso_id)` y los índices únicos parciales por tipo.
  - `marcar_practica`, `mis_practicas`, `mi_asistencia` y `practicas_del_plantel`, todas `security definer` y `set search_path = ''`. El grant es `to authenticated`, con `revoke` de `public` y `anon`.
  - Los disparadores de borrado: al quedar sin pertenencia vigente y al cerrarse `cuenta_jugador`.
  - El encabezado dice «antes de aplicar: `npm run backup`».
- **Acepta:**
  - `contratoConstancia` comprueba que la tabla no recibe ningún `grant` ni `policy`, que la lista de `tipo` es igual a `TIPOS_DE_PRACTICA` y que las tres funciones del jugador usan `mi_jugador()`. También, que `marcar_practica` no recibe fecha y que `practicas_del_plantel` no devuelve `jugador_id` y usa el mínimo de 3.
  - `accesoJugador.js` suma `mis_practicas` y `mi_asistencia` a la lectura y una lista `ESCRITURA_DEL_JUGADOR = ['marcar_practica']`; `contratoAccesoJugador` lee también 0068.
  - `verificarConstancia.sql` cubre todos los casos de §4 del spec, con `rollback` al final, como `verificarAperturaRecurso.sql`.
- **Tests:** `practica_jugador: cerrada a todos`, `tipos de práctica: SQL y JS iguales`, `funciones del jugador pasan por mi_jugador`, `marcar_practica: la fecha la pone el servidor`, `practicas_del_plantel: sin ids y con mínimo 3`.
- **No** hacer `db push`. Commit y avisar que la task 8 espera a Tomás.

## Task 4 — Repos y consultas de `web/`

- **Archivos:**
  - `src/data/repos/miCuenta.js`: `misPracticas`, `marcarPractica`, `miAsistencia`, con mappers `xDesdeFila` a camelCase.
  - `src/data/repos/recursos.js`: `practicasDelPlantel`.
  - `web/src/datos/repositorio.ts`: tipos e interfaz.
  - `web/src/datos/consultasJugador.ts`: `useMisPracticas`, `useMarcarPractica` (mutación que refresca `mis_practicas`) y `useMiAsistencia`.
  - `web/src/datos/consultasRecursos.ts`: `usePracticasDelPlantel`.
  - `web/src/datos/renderDePrueba.tsx`: las versiones inventadas.
- **Acepta:** todo pasa por `repositorio.js` (arquitectura en verde); los errores usan los helpers de siempre.
- **Tests:** donde ya haya tests de mappers de `miCuenta`/`recursos`, sumar `misPracticas mapea fecha y recursoId` y `practicasDelPlantel con null conserva el null`.

## Task 5 — Pantalla Inicio del jugador

- **Archivos:**
  - `web/src/interacciones/Constancia.tsx`: `CheckDeRutina`, `Semana` y `AsistenciaContinuada` pasan a recibir datos por props, y el laboratorio sigue con sus datos inventados.
  - Nuevo `web/src/pantallas/jugador/JugadorInicio.tsx`.
  - `MarcoJugador.tsx`: Inicio primero, sin Sesión.
  - `web/src/rutas.tsx`: `/jugador` y la puerta de entrada van a `/jugador/inicio`; `/jugador/sesion/:id` sigue.
  - La guía de primer uso, modo `jugar`.
  - `Jugador.test.tsx`.
- **Comportamiento:**
  - Orden de Inicio: la sesión de hoy o la próxima (enlace), «Tu semana» y «Tu asistencia».
  - El check abre la lista de recursos practicables. Con uno solo, marca directo; sin recursos, no aparece y hay un texto que explica por qué.
  - El texto del check es el del spec («tu profe ve cuántos…»). Se puede desmarcar hoy.
  - «2 de 3 esta semana» sale de `frecuencia_semanal`.
  - Selector «Últimos 10 / Mes / Año».
  - Tokens de `DESIGN.md` y `prefers-reduced-motion`, como el laboratorio.
- **Tests:** `Inicio: es la primera pestaña y /jugador abre ahí`, `Inicio: marcar elige el recurso y llama a marcarPractica`, `Inicio: con un solo recurso marca directo`, `Inicio: sin recursos no muestra el check`, `Inicio: el texto dice que el profe ve cuántos, nunca quién`, `Inicio: asistencia cambia entre últimos 10, mes y año`, `Inicio: no muestra motivo ni lesión`.

## Task 6 — Conteo de prácticas para el profe

- **Archivos:** `web/src/pantallas/RecursosVideos.tsx` y su test. Junto a «abrieron», mostrar «practicaron esta semana» y «alguna vez» por recurso. Con `null` (menos de 3 cuentas), el mismo aviso que ya usa para aperturas.
- **Tests:** `Recursos: muestra cuántos practicaron`, `Recursos: con menos de 3 cuentas no muestra el número`, `Recursos: ningún nombre de jugador en el conteo`.

## Task 7 — Privacidad y documentos

- **Archivos:** `public/legal/privacidad.html` (y `terminos.html` si nombra los datos), `src/data/legal.js` (subir `VERSION_LEGAL` a la fecha del día), `PRD.md` (tabla de datos) y `BACKLOG.md` (B-31: qué quedó hecho).
- **Acepta:** el aviso dice qué registra el jugador, que el profe ve sólo cuántos, que el jugador ve su asistencia sin motivos ni lesiones y que todo se borra al dejar el club. `contratoLegal` en verde.
- **Tests:** los que ya existen; si `contratoLegal` compara la versión entre archivos, mantenerlos iguales.

## Task 8 — Base real (la hace Tomás, con Claude al lado)

1. `npm run backup` (`docs/guias/BACKUP.md`). Vale uno de hoy sin pushes en el medio.
2. `npx supabase db push`, con confirmación de Tomás.
3. Correr `tests/verificarConstancia.sql` en el SQL Editor y anotar el resultado.
4. Actualizar la memoria de migraciones (próxima: 0069) y marcar B-31 como Terminado si la prueba con un jugador de prueba sale bien.
