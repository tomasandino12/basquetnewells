# Plan: datos conectados (categoría por año, precarga 2026, emergencias)

Spec: `docs/superpowers/specs/2026-10-19-datos-conectados-design.md`. Migración 0059. Un commit por task con `npm run test:q` verde. Sin merge ni push: avisar a la coordinadora.

## Estado

| Task | Estado |
|---|---|
| 1 Categoría por año | pendiente |
| 2 Importador: U13 sin rama y aviso por año | pendiente |
| 3 Prompt de precarga | pendiente |
| 4 Migración 0059 | pendiente |
| 5 Pases de temporada: lógica y repo | pendiente |
| 6 Asistente de temporada (pantalla) | pendiente |
| 7 Emergencias: parser y lógica | pendiente |
| 8 Emergencias: pantallas | pendiente |
| 9 Docs y aviso legal | pendiente |

## Task 1 — `categoriaPorNacimiento`
- Archivos: `src/data/categorias.js` (nuevo, puro), `tests/categorias.test.js`.
- Exporta `categoriaPorNacimiento(fecha, temporada, rama)` → `{ grupo, codigo, motivo? }`, `ramaDeCodigos(codigos)` → `'M' | 'F' | null`, `temporadaComoAnio(nombre)`.
- Acepta: la tabla 2026 de la spec completa (un caso por borde de cada grupo), U21 de cuatro años, 2027 corre todo un año, F sin plantel salvo Mayores, sin fecha/rama/año → `codigo null` con motivo, rama mixta en `ramaDeCodigos` → null.
- Tests: `grupos 2026 por año`, `U21 abarca cuatro años`, `codigo de Semillero por rama`, `categorias que no existen dan null con motivo`, `temporada que no es año`, `rama desde los planteles vigentes`.

## Task 2 — Importador de inscriptos
- Archivos: `src/data/inscriptos.js`, `src/ui/pantallas/importarInscriptos.js`, `tests/inscriptos.test.js`.
- `inscriptosDelPlantel` en U13M devuelve las "U13 mixto sin rama" como `estado: 'sinRama'` (destildadas, con la pregunta); sumar `avisoPorAnio` por chico usando Task 1 con la temporada del plantel.
- Acepta: fila sin mail entra con `mails: []` y sin advertencia; sinRama sólo en U13M; aviso cuando el código por año ≠ el del formulario.
- Tests: `fila sin mail entra sin vínculo`, `U13 mixto sin rama se ofrece destildado en U13M`, `U13 sin rama no aparece en otros planteles`, `aviso si la categoría no coincide con el año`.

## Task 3 — Prompt de precarga para Claude en el navegador
- Archivos: `google/PRECARGA-2026.md`, `tests/contratoPrecarga.test.js`.
- El prompt: crear hoja nueva vinculada al Form, pestaña "Para Semillero" (6 columnas exactas de `COLUMNAS` + "Revisar") y pestaña "Emergencias para Semillero", ambas **sólo con fórmulas**, sin abrir ni leer respuestas, sin DNI. Pasos para Tomás después (revisar, bajar .xlsx, importar por plantel) en voseo.
- Acepta: el test lee el .md y compara los encabezados con `COLUMNAS` del parser de inscriptos y con los del parser de emergencias (Task 7; hasta entonces sólo el primero).
- Tests: `la precarga usa los encabezados del importador`, `el prompt no menciona columnas de DNI`.

## Task 4 — Migración 0059 (Opus)
- Archivos: `supabase/migrations/0059_temporada_y_emergencia.sql`, `src/data/limites.js`, `src/data/emergencias.js` (sólo la lista `AFECCIONES`), `tests/contratoTemporada.test.js`, `tests/contratoEmergencia.test.js`, `tests/contratoLimites.test.js` (si hace falta registrar columnas).
- Contenido: `abrir_temporada`, `pases_de_temporada`, `confirmar_pases` (definer, `es_coordinador_de`, `search_path = ''`); tabla `emergencia_jugador` patrón 0026 (revoke all, grant select + insert/update por columna, RLS: ver = profe con plantel vigente del chico o coordinador del club; escribir = `puede_escribir_plantel`), checks de largo, `alertas <@ array[...]`, columna `indicacion` (300), trigger de sellado de `actualizado_*`, trigger en `pertenencia` que borra la emergencia si no queda ninguna vigente; `importar_emergencias(payload)` invoker; revoke/grant de execute.
- Acepta: probado en local dentro de `begin … rollback` (sin `db reset`): coordinador abre 2027 y pasa chicos; profe de otro plantel y familia leen 0 filas de emergencia; jugador sin pertenencia vigente pierde la fila; `confirmar_pases` no la borra. Script de rollback de 0059 probado igual.
- Tests: `afecciones iguales en SQL y JS`, `limites de emergencia iguales`, `confirmar_pases inserta antes de cerrar`, `funciones nuevas sin execute para anon`, `emergencia sin grant de delete`.
- **No** `db push`: avisar a la coordinadora (backup).

## Task 5 — Pases de temporada: lógica y repo
- Archivos: `src/data/pasesDeTemporada.js` (puro), `src/data/repos/temporadas.js` (nuevo) + línea en `repositorio.js`, `tests/pasesDeTemporada.test.js`.
- `proponerPases(chicos, plantelesNuevos, anio)` → filas con `propuesto` (plantelId | null) y `motivo`; `filasParaConfirmar(elecciones)` descarta "Decidir después".
- Repo: `abrirTemporada`, `obtenerPasesDeTemporada`, `confirmarPases`, mappers camelCase.
- Tests: `sube de categoria al cambiar de año`, `segundo año se queda`, `sin fecha queda para decidir`, `categoria inexistente queda para decidir`, `decidir despues no se manda`, `no sigue manda plantel null`.

## Task 6 — Asistente de temporada (pantalla)
- Archivos: `src/ui/pantallas/coordTemporada.js`, registro en `main.js`, acceso desde Coordinación, CSS si hace falta (leer `DESIGN.md`).
- Tres pasos de la spec, `html\`\``, errores con `ui/errores.js`. Textos paso a paso en voseo.
- Acepta: verificado en el navegador con seeds ZZTEST (abrir, profes sin asignar, confirmar en dos tandas); `arquitectura.test.js` verde.

## Task 7 — Emergencias: parser y lógica
- Archivos: `src/parser/parserEmergencias.js`, `src/data/emergencias.js`, `tests/parserEmergencias.test.js`, `tests/emergencias.test.js`, fixture sintético en `tests/fixtures/sintetico/`.
- Parser: 9 encabezados de la spec (con "Indicación médica"); reusa `leerFecha` de `parserInscriptos.js`. Lógica: `leerAfecciones(texto)` (lo que escribe Forms, separado por comas; desconocidas → aviso), `recortar(texto, limite)` con aviso, `cruzarEmergencias(filas, jugadores)` por palabras sin orden + fecha.
- Tests: `afecciones de Forms a la lista cerrada`, `afeccion desconocida avisa`, `cruza aunque el nombre venga invertido`, `misma persona con otra fecha no cruza`, `texto largo se recorta con aviso`, `fila sin fecha se saltea`.

## Task 8 — Emergencias: pantallas
- Archivos: `src/data/repos/jugadores.js` (o `repos/emergencias.js` + fachada), `src/ui/pantallas/importarEmergencias.js`, `emergencias.js` (lista del plantel), botón en la cabecera de `fichaJugador.js`, entrada en `plantel.js` y en Coordinación.
- Se pide al abrir, nada en `localStorage` (Tomás eligió en memoria); `tel:` en teléfonos; alertas arriba. "Ver ficha completa en Google" en la ficha y en la vista de emergencia con `linkCarpetaEnDrive` (`src/data/enlacesGoogle.js` + `tests/enlacesGoogle.test.js`, compartido con 0060).
- Acepta: verificado en el navegador como profe asignado, profe de otro plantel (no ve nada) y coordinador; `grep localStorage` no toca emergencias.

## Task 9 — Docs y aviso legal
- Archivos: `supabase/ESQUEMA.md` (0059), `docs/COORDINACION.md` (cambio de temporada), guía corta para profes.
- Nota en la carpeta compartida para la coordinadora: texto propuesto para `privacidad.html` y el consentimiento del formulario. Esta rama no toca `public/legal/`.
