# Asistencia y lesiones: plan

> Ejecutar en la sesión, sin subagentes (CLAUDE.md). Una task es un commit. Al terminar cada task, correr `npm run test:q` y commitear sin preguntar.

**Spec:** `docs/superpowers/specs/2026-10-29-asistencia-lesiones-design.md`. Leerlo entero antes de la task 1.
**Rama:** `feat/asistencia`, creada desde `main`.
**Modelo:** Opus para la task 2 (migración, RLS, RPC). Sonnet para el resto.

## Restricciones globales
- Capas: pantalla → `repositorio.js` → `repos/asistencia.js` → `cliente.js`. Lógica pura en `src/data/`, sin red ni DOM.
- HTML nuevo con `html\`...\`` de `ui/html.js`. `$` viene de `ui/dom.js`. Los errores, con `ui/errores.js`.
- `NULL` es "no se sabe". Una asistencia sin fila no es "ausente".
- Lesión: listas cerradas de zona, lado y tipo. **Sin texto libre ni diagnóstico.**
- El coordinador ve sólo el % general por categoría. Nunca filas de un chico (0018).
- Datos de prueba inventados. No abrir `docs/privado/BASQUET - ASISTENCIAS.xlsx` ni los `.xlsx` de `tests/fixtures/`.
- UI y comentarios en voseo. Los comentarios dicen el porqué.
- Antes de `npx supabase db push`: pedir confirmación y preguntar si se corrió `npm run backup`.

## Estado
| Task | Estado | Commit |
|---|---|---|
| 1 Lógica pura | hecha | feat(asistencia): lógica pura |
| 2 Migración 0064 | hecha; probada en la base local (11 casos, tests/verificarAsistencia.sql), sin aplicar a la real | feat(asistencia): migración 0064 |
| 3 Repo | hecha | feat(asistencia): repo y verificación SQL |
| 4 Tomar asistencia | pendiente | |
| 5 Lesiones en la toma | pendiente | |
| 6 Historial y planilla | pendiente | |
| 7 Ficha del jugador | pendiente | |
| 8 Panorama del coordinador | pendiente | |
| 9 db push y verificación | pendiente | |

---

### Task 1: lógica pura de asistencia
**Archivos:** crear `src/data/asistencia.js` y `tests/asistencia.test.js`.
**Produce:**
- `ESTADOS = ['presente','ausente','justificada']`
- `ZONAS = ['tobillo','pie','rodilla','pantorrilla','muslo','cadera','espalda','hombro','muneca_mano','cabeza','otra']`
- `LADOS = ['izquierdo','derecho','no_aplica']`
- `TIPOS = ['torcedura','golpe','sobrecarga_dolor','otro']`
- `ETIQUETAS` (clave → texto, por ejemplo `muneca_mano` → "Muñeca o mano")
- `lesionadoEn(lesiones, fecha)` → boolean. `lesiones = [{ desde, hasta }]` con fechas ISO.
- `codigoDelDia({ hubo, estado, lesionado })` → `'SE' | 'P' | 'A' | 'J, A' | 'L, P' | 'L, A' | ''`.
- `resumenDeAsistencia(dias)` → `{ total, asistidos, sinEntrenamiento, justificadas, diasLesion, pctAsistencia, pctLesion }`. `dias = [{ hubo, estado, lesionado }]`. `pct*` es `null` si no hubo ningún entrenamiento.
- `semaforo(pct)` → `'sin_datos' | 'alerta' | 'regular' | 'excelente'`.
- `textoDeLesion({ desde, zona, lado })` → "Lesionado desde el 12/10 · tobillo derecho". Sin zona: "Lesionado desde el 12/10".

**Aceptación:**
- `SE` no cuenta en el total.
- Una justificada cuenta como falta, igual que en la planilla.
- `L, P` cuenta como asistido.
- El % nunca pasa de 100.
- El semáforo sigue estos cortes: < 70 alerta, < 85 regular, ≥ 85 excelente.

**Tests:** `codigoDelDia cubre los seis códigos`, `resumen ignora los días sin entrenamiento`, `la falta justificada no suma asistencia`, `lesionado que vino cuenta como asistido`, `el porcentaje nunca supera 100 (caso de la planilla)`, `semáforo en 69.9, 70, 84.9 y 85`, `sin entrenamientos el porcentaje es null`, `lesionadoEn con alta abierta y con alta el mismo día`, `textoDeLesion sin zona y con lado no_aplica`.

### Task 2: migración 0064 (Opus)
**Archivos:**
- Crear `supabase/migrations/0064_asistencia.sql` y `tests/contratoAsistencia.test.js`.
- Modificar `supabase/ESQUEMA.md`.
- Usar la skill `/nueva-migracion`. Copiar el patrón de `0026_material.sql`.

**Contenido:**
- Las tablas `entrenamiento`, `asistencia` y `lesion` del spec §2, cada una con `revoke all`, `grant` por columna, RLS y trigger de sellado.
- El trigger que impide asistencia en un entrenamiento con `hubo = false`. Al pasar un entrenamiento a `hubo = false` se borran sus asistencias.
- El índice único parcial de lesión abierta: `(jugador_id) where hasta is null`.
- Los `check` de las listas.
- **Policies:**
  - `entrenamiento` y `asistencia`: `puede_ver_plantel` para leer y `puede_escribir_plantel` para escribir.
  - `lesion`: leer y escribir si el jugador tiene una pertenencia vigente en un plantel con `puede_ver_plantel` o `puede_escribir_plantel`.
- RPC `guardar_asistencia(p_plantel_id uuid, p_fecha date, p_hubo boolean, p_filas jsonb)`, `security invoker`. Hace upsert del entrenamiento, reemplaza sus filas y devuelve el id.
- RPC `asistencia_del_club(p_club_id uuid, p_desde date, p_hasta date)`, `security definer`, sólo si `es_coordinador_de`. Devuelve `(plantel_id, categoria, entrenamientos int, pct numeric)` y nada más.

**Aceptación:**
- La migración no toca policies de otras tablas.
- Un profe sin asignación no lee nada.
- El coordinador no lee filas de `asistencia` ni de `lesion`.

**Tests (contrato):**
- `las listas de estado/zona/lado/tipo de la migración coinciden con src/data/asistencia.js`
- `asistencia_del_club no devuelve jugador_id ni nombres`
- `0064 no otorga nada a anon`
- `lesion no tiene columnas de texto libre`

### Task 3: repo de asistencia
**Archivos:**
- Crear `src/data/repos/asistencia.js`.
- Modificar `src/data/repositorio.js` (una línea `export *`).
- Si el mapeo pasa de 10 líneas, la lógica va a `src/data/asistencia.js`.

**Produce** (en camelCase, con mappers `entrenamientoDesdeFila`, `lesionDesdeFila`):
- `obtenerEntrenamientos(plantelId, desde, hasta)` → `[{ id, fecha, hubo, filas: [{ jugadorId, estado }] }]`
- `guardarAsistencia({ plantelId, fecha, hubo, filas })` → id
- `obtenerLesionesDelPlantel(plantelId)` → `[{ id, jugadorId, desde, hasta, zona, lado, tipo }]`
- `abrirLesion({ jugadorId, desde, zona, lado, tipo })`
- `darAlta(lesionId, hasta)`
- `obtenerAsistenciaDelClub(clubId, desde, hasta)` → `[{ plantelId, categoria, entrenamientos, pct }]`

**Aceptación:** `tests/arquitectura.test.js` pasa. El repo no calcula nada.

### Task 4: pantalla Tomar asistencia
**Archivos:**
- Crear `src/ui/pantallas/asistencia.js`.
- Modificar `src/ui/pantallas/registro.js` (`p-asistencia`), `plantel.js` (botón "Tomar asistencia"), `hoy.js` (acceso rápido al plantel elegido) y `public/css/componentes.css`.
- Usar la skill `/nueva-pantalla`. Leer `DESIGN.md`. La referencia visual es la vista Plantel con `?asis=1` de `docs/prototipos/semillero-patron.html`.

**Comportamiento:**
- Fecha de hoy, editable a días pasados.
- Grilla de tarjetas: un toque alterna presente o ausente.
- Botón "No hubo entrenamiento" para todo el día.
- Barra fija con el contador y "Guardar". Guarda con `guardarAsistencia`.
- Si ya hay asistencia para esa fecha, la abre para editar.
- Al salir sin guardar, pregunta.

**Aceptación:**
- Funciona en 375 px sin scroll horizontal.
- Toques ≥ 44 px.
- Sin conexión, muestra el error con `mensajeAlGuardar` y no pierde lo marcado.

**Tests:** si aparece lógica (por ejemplo, el estado inicial de cada tarjeta), va a `src/data/asistencia.js` como `estadoInicial(jugadores, filas, lesiones, fecha)` con el test `estado inicial: lesionado aparece marcado y sin fila queda sin tomar`.

### Task 5: justificada y lesiones en la toma
**Archivos:** `src/ui/pantallas/asistencia.js`, una hoja nueva `src/ui/componentes/hojaLesion.js` y `componentes.css`.

**Comportamiento:**
- Menú por tarjeta: Justificada, Se lesionó y Dar el alta.
- "Se lesionó" abre la hoja con zona, lado y tipo como chips, todo opcional, y guarda con `abrirLesion` (desde = fecha de la toma).
- "Dar el alta" llama a `darAlta` con la fecha de la toma.
- El lesionado aparece con su marca y sólo se elige si vino o no.

**Aceptación:** no hay ningún campo de texto en la hoja. Con una lesión ya abierta, "Se lesionó" no aparece.

### Task 6: historial del plantel y planilla para el área
**Archivos:**
- Crear `src/data/planillaAsistencia.js`, `tests/planillaAsistencia.test.js` y `src/ui/pantallas/asistenciaHistorial.js`.
- Modificar `registro.js` y `plantel.js` (enlace "Historial de asistencia").

**Produce:**
- `nombreDeHoja(plantel)` → "U15 - MASCULINO (2012 y 2011)", recortado a 31 caracteres (límite de Excel).
- `filasDePlanilla({ jugadores, entrenamientos, lesiones })` → matriz con los encabezados `Jugador, DNI, SOCIO NUM, % Asistencia, Estado`, las fechas `d/m` y al final `Total Entrenamientos, Entrenamientos Asistidos, Días Sin Entrenamiento, Faltas Justificadas (J), Días de Lesión (L), % LESION`. DNI y SOCIO NUM van vacíos. El estado sale con su emoji, como en el original.

**Pantalla:**
- Lista de días (fecha, presentes / total o "No hubo"). Tocar un día abre la toma de ese día.
- "Bajar planilla" arma el `.xlsx` con `xlsx` (writeFile), con una hoja por plantel asignado.

**Tests:** `encabezados iguales a la planilla del área`, `nombre de hoja recortado a 31`, `un día SE es columna con SE para todos`, `jugador que entró a mitad de año queda vacío antes`, `porcentaje con formato 61.70%`.

### Task 7: ficha del jugador
**Archivos:** `src/ui/pantallas/fichaJugador.js` (un bloque nuevo, con `html` si el bloque es nuevo) y `componentes.css`.
**Comportamiento:** % de asistencia de la temporada con chip de semáforo, faltas justificadas y `textoDeLesion` si hay una lesión abierta.
**Aceptación:** sin entrenamientos muestra "Sin asistencia tomada", no 0 %.

### Task 8: panorama del coordinador
**Archivos:** `src/ui/pantallas/coordPanorama.js` y `componentes.css`.
**Comportamiento:** una fila por categoría con el % general y la cantidad de entrenamientos de la temporada, usando `obtenerAsistenciaDelClub`.
**Aceptación:** no aparece ningún nombre ni lesión. Una categoría sin entrenamientos muestra "—".

### Task 9: db push y verificación
1. Preguntar a Tomás si hay un backup de hoy (`npm run backup`, ver `docs/guias/BACKUP.md`) y pedir el sí para `npx supabase db push`.
2. Con datos inventados en el navegador: tomar asistencia, marcar "no hubo", justificar, lesionar y dar el alta, corregir un día pasado, bajar la planilla y abrirla, y ver la ficha y el panorama.
3. Correr `npm run test:q` y `graphify update .`.
4. Actualizar la tabla de estado y la memoria del proyecto.
5. Antes de mergear, recordar el pendiente legal (`docs/privado/SEGURIDAD-LANZAMIENTO.md`, sección Asistencia).
