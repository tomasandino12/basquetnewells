# Asistencia y lesiones — diseño

29/10. El profe toma asistencia desde el celular, marca lesiones como un período con alta, y la app arma sola la planilla que pide el área polideportiva (una copia de referencia está en `docs/privado/`, fuera de git).

## 1. Qué resuelve

- La planilla de hoy se llena a mano con códigos (`P`, `A`, `SE`, `L`, `J` y combinados como `L, A`). Las fórmulas buscan `LA` y se tipea `L, A`: hay chicos con más de 100 %. En la app el profe toca botones y la cuenta sale bien.
- La lesión queda guardada con zona, lado y tipo, para después poder analizarla (partidos perdidos, zonas que más se lesionan, prevención). **Esta versión sólo guarda y muestra**; los análisis van en otro spec.

## 2. Modelo (migración 0064)

Tres tablas nuevas, con el patrón de `0026_material.sql` (`revoke all`, `grant` mínimo por columna, RLS, trigger de sellado de `club_id`/creador/fechas).

**`entrenamiento`**: un día de práctica de un plantel.
`id`, `club_id`, `plantel_id`, `fecha date`, `hubo boolean not null default true`, `creado_por`, `creado_en`. `unique (plantel_id, fecha)`: un entrenamiento por día y plantel. `hubo = false` es el `SE` de la planilla: se marca para el día entero, no por chico.

**`asistencia`**: un chico en un entrenamiento.
`entrenamiento_id`, `jugador_id`, `estado` ∈ `presente | ausente | justificada`, `club_id`. PK `(entrenamiento_id, jugador_id)`. Sólo existe si `hubo = true` (trigger). Sin fila = no se tomó a ese chico ese día (`NULL`, no "ausente").

**`lesion`**: un período del jugador, no del plantel (si está en dos categorías, aparece lesionado en las dos).
`id`, `club_id`, `jugador_id`, `desde date not null`, `hasta date` (`NULL` = sigue lesionado), `zona`, `lado`, `tipo`, `creado_por`. `check (hasta is null or hasta >= desde)`. A lo sumo una lesión abierta por jugador (índice único parcial `where hasta is null`).
- `zona` ∈ tobillo, pie, rodilla, pantorrilla, muslo, cadera, espalda, hombro, muñeca/mano, cabeza, otra.
- `lado` ∈ izquierdo, derecho, no aplica.
- `tipo` ∈ torcedura, golpe, sobrecarga/dolor, otro.
- Los tres admiten `NULL` ("no se sabe"). **Sin texto libre ni diagnóstico**: es dato de salud de un menor (dato sensible de la ley 25.326) y la zona alcanza para los análisis futuros.
- Las listas viven en SQL y en `src/data/asistencia.js`: test de contrato `tests/contratoAsistencia.test.js` (modelo `contratoMaterial`).

**Permisos (RLS).** Leer y escribir `entrenamiento` y `asistencia`: `puede_ver_plantel` / `puede_escribir_plantel` del plantel. `lesion`: el profe que tiene al jugador en un plantel suyo con pertenencia vigente. El profe puede corregir días pasados (una falta pasa a justificada cuando la familia avisa). Familias y jugadores no ven nada en esta versión.

**Coordinador.** Desde 0018 el coordinador ve sólo agregados, nunca filas de un chico. Se mantiene en la app: una función `asistencia_del_club(club, desde, hasta)` (`security definer`) devuelve por categoría el % de asistencia, la cantidad de alertas y la cantidad de lesionados hoy, sin nombres. **A confirmar en la revisión:** la planilla del club entero que pide el área lleva nombres. Propuesta: una segunda función `planilla_asistencia_del_club`, sólo para coordinador, que devuelve las filas por chico únicamente para exportar, y queda registrada como excepción explícita a 0018. La otra opción es que cada profe exporte la suya y el coordinador las junte.

## 3. Lógica pura (`src/data/asistencia.js`)

- `codigoDelDia(estado, lesionado, hubo)` → `P`, `A`, `J, A`, `L, P`, `L, A` o `SE`, como en la planilla.
- `resumenDeAsistencia(dias)` → total de entrenamientos, asistidos, días sin entrenamiento, justificadas, días de lesión, % de lesión y % de asistencia = presentes / días con entrenamiento (nunca más de 100).
- `semaforo(pct)` → `alerta` (< 70 %), `regular` (< 85 %), `excelente`, o `sin datos` si no hay días.
- `lesionadoEn(lesiones, fecha)`.
- `filasDePlanilla(...)` → la matriz de la hoja: Jugador, DNI, SOCIO NUM, % Asistencia, Estado, una columna por fecha (`d/m`) y al final las seis columnas de totales, con los mismos encabezados que el original. **DNI y SOCIO NUM salen vacíos**: la app no guarda DNI a propósito (ver 0060).

## 4. Pantallas

- **Plantel → "Tomar asistencia"** (también como acceso en Hoy). Es la del prototipo `docs/prototipos/semillero-patron.html`: un toque alterna presente o ausente. Un menú chico en cada tarjeta ofrece: justificada, se lesionó (abre la hoja de zona/lado/tipo, todo opcional) y dar el alta. El lesionado aparece marcado de entrada y sólo se elige si vino. Arriba va el botón "No hubo entrenamiento". "Guardar" manda todo en una sola llamada (RPC `guardar_asistencia`).
- **Historial del plantel**: lista de días con presentes sobre total; tocar uno lo abre para corregir.
- **Ficha del jugador**: % con semáforo, faltas justificadas y "Lesionado desde el 12/10 · tobillo derecho". La asistencia entra en la historia del jugador como una fuente más (`FUENTES` en `historiaJugador.js`).
- **Panorama del coordinador**: % y alertas por categoría.
- **Exportar**: "Bajar planilla" arma el `.xlsx` en el navegador con el `xlsx` ya vendorizado. Una hoja por categoría, con el mismo nombre de hoja ("U15 - MASCULINO (2012 y 2011)").

## 5. Fuera de esta versión

Familias viendo la asistencia, análisis de lesiones, sugerencia de ejercicios por zona, horarios fijos de entrenamiento y notificaciones.

## 6. Pendientes aparte

Mencionar el dato de lesión en la política de privacidad y en el consentimiento (anotado en `docs/privado/`). Antes del `db push` de 0064: backup.

## 7. Pruebas

- `tests/asistencia.test.js`: códigos, resumen, el caso de la planilla que daba más de 100 %, semáforo en los bordes 70 y 85, lesión que cruza fechas, y que la planilla tenga los encabezados del original.
- `tests/contratoAsistencia.test.js`: las listas de la migración contra las de JS.
- `tests/arquitectura.test.js` pasa (repo nuevo `repos/asistencia.js` + una línea en la fachada).
- Verificación en el navegador con datos inventados.
