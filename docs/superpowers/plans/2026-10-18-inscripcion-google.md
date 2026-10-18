# Plan — Inscripción y documentación en Google

Spec: `docs/superpowers/specs/2026-10-18-inscripcion-google-design.md`. Una task por commit, en esta sesión, sin subagentes. Sin merge ni push: al final aviso a la sesión coordinadora.

## Estado
| # | Task | Estado |
|---|---|---|
| 0 | Tag, insumo del formulario, `.gitignore` (`docs/insumos/`) y `.vercelignore` (`google/`), spec y plan | hecho |
| 1 | Funciones puras del script + test | pendiente |
| 2 | Script de barrido y `appsscript.json` | pendiente |
| 3 | Tablero, Pagos, Buscar y planilla "Para Semillero" (fórmulas) | pendiente |
| 4 | Formularios: inscripción, reinscripción, aranceles, plantilla, guía para padres | pendiente |
| 5 | Guía de instalación, de formularios nuevos y de prueba | pendiente |

## Task 1 — Funciones puras
- **Archivos:** `google/apps-script/nombres.gs`, `tests/appsScriptNombres.test.js`.
- **Qué:** `normalizarDni`, `dniValido`, `nombreCarpeta(apellido, nombre, dni)`, `nombreArchivo(titulo, concepto, apellido, fecha, ext)` (concepto opcional), `limpiarParaNombre(texto)` (saca `/`, `\` y caracteres de control; recorta largo), `dniDeCarpeta(nombre)`. JS compatible con Apps Script (V8, sin `import`); el test lo carga con `vm`.
- **Tests:** `normaliza DNI con puntos y espacios`, `rechaza DNI de 6 y de 9 dígitos y con letras`, `arma nombre de carpeta con el apellido en mayúsculas`, `nombre de archivo usa el título de la pregunta y la fecha`, `suma el concepto cuando hay`, `dos fechas distintas dan nombres distintos`, `limpia barras del título`, `encuentra el DNI al final del nombre de carpeta`, `no confunde 1234567 con 11234567`.
- **Acepta:** `npm run test:q` verde.

## Task 2 — Script de barrido
- **Archivos:** `google/apps-script/organizar.gs`, `google/apps-script/config.gs` (IDs de las carpetas `Formularios con archivos` y `Jugadores`, títulos de las preguntas estándar), `google/apps-script/appsscript.json`.
- **Qué:** `barrer()` según la spec (formularios de la carpeta, respuestas nuevas por formulario con la última hora en `PropertiesService`, carpeta por DNI, mover y renombrar, saltear lo ya movido, nunca borrar, `LockService`); `instalar()` que crea el disparador cada 10 minutos sin duplicar; `oauthScopes` fijos.
- **Tests:** `tests/appsScriptScopes.test.js`: `appsscript.json pide sólo forms, drive y script.scriptapp`.
- **Acepta:** test verde; grep sin `setTrashed`, `removeFile`, `MailApp`, `GmailApp`, `SpreadsheetApp`.

## Task 3 — Tablero y "Para Semillero"
- **Archivo:** `google/sheets/TABLERO.md`.
- **Qué:** hojas Config (temporada, inicio, conceptos activos), Tablero (padrón de la temporada, columna Alta, una columna por documento, Completo, link), Pagos (❌/📎/✅ por concepto), Pagos verificados, Buscar (vertical, para celular), Entregas a mano, Faltan reinscribir, Revisar; planilla aparte "Para Semillero" con `IMPORTRANGE` y los 6 encabezados exactos. Fórmulas listas para pegar con `;`; formato condicional; cómo compartir (sólo coordinación, nunca "Publicar en la web"); cómo sumar la columna de un formulario nuevo.
- **Acepta:** cada columna de la spec tiene fórmula; `;` y nombres en español (`CONTAR.SI.CONJUNTO`, `UNICOS`, `FILTRO`, `HIPERVINCULO`, `IMPORTRANGE`); encabezados de "Para Semillero" idénticos a la spec (test `tests/appsScriptParaSemillero.test.js` que los compara).

## Task 4 — Formularios
- **Archivo:** `google/formularios/FORMULARIOS.md`.
- **Qué:** en todos, arranque de 2–3 líneas (para qué es, qué tener a mano, qué pasa después) y ayuda en cada pregunta de archivo. Cambios a Inscripción (3 preguntas estándar, Rama, sección Documentación con las 6 subidas, mail verificado, texto de privacidad `[VALIDAR CON COORDINACIÓN]`, casilla de recaudación no premarcada); formularios Reinscripción, Comprobante de aranceles (con `Concepto`) y Plantilla completos. Además `google/formularios/PADRES.md`: el texto de la guía para padres, en lenguaje simple, para pegar en un Google Doc.
- **Campos:** los oficiales de la spec (formulario actual + 6 fotos); reinscripción con la tabla de qué se repite. Autorizaciones y email del deportista según lo que decida Tomás.
- **Acepta:** los títulos de las preguntas estándar coinciden con `config.gs` (test `tests/appsScriptTitulos.test.js`).

## Task 5 — Guía
- **Archivo:** `google/GUIA.md`.
- **Qué:** (1) mover el formulario actual a la cuenta del básquet (transferir propiedad o hacer una copia, y re-vincular la planilla; qué se pierde en cada caso); (2) crear las carpetas y las planillas; (3) pegar el script, completar config, correr `instalar`, aceptar permisos (tabla de scopes y por qué); (4) sumar un formulario nuevo (los 5 pasos de la spec); (5) **prueba manual** con DNIs inventados: mismo DNI desde dos formularios → misma carpeta; reenvío → dos archivos; formulario nuevo sin tocar código → archivo en la carpeta; reinscripción → Alta = Reinscripción; comprobante de arancel → 📎, y ✅ al anotarlo en Pagos verificados; Buscar con un DNI y con un apellido repetido, mirado desde el celular; tablero ✅/❌ correcto, incluida una entrega a mano; DNI con puntos rechazado; (6) guía corta para padres sin cuenta de Google; (7) vaciado manual.
- **Acepta:** cubre los criterios de aceptación del prompt y los agregados; `npm run test:q` verde; aviso a la coordinadora.
