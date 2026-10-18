# Plan — Inscripción y documentación en Google

Spec: `docs/superpowers/specs/2026-10-18-inscripcion-google-design.md`. Una task por commit, en esta sesión, sin subagentes. Sin merge ni push: al final aviso a la sesión coordinadora.

## Estado
| # | Task | Estado |
|---|---|---|
| 0 | Tag, insumo del formulario, `.gitignore` (`docs/insumos/`) y `.vercelignore` (`google/`), spec y plan | hecho |
| 1 | Funciones puras del script + test | pendiente |
| 2 | Script de organización y `appsscript.json` | pendiente |
| 3 | Tablero (fórmulas) | pendiente |
| 4 | Cambios al formulario y formularios nuevos | bloqueada en parte: lista CABB |
| 5 | Guía de instalación y prueba manual | pendiente |

## Task 1 — Funciones puras
- **Archivos:** `google/apps-script/nombres.gs`, `tests/appsScriptNombres.test.js`.
- **Qué:** `normalizarDni`, `dniValido`, `nombreCarpeta(apellido, nombre, dni)` (`APELLIDO, Nombre — DNI`, sin caracteres que rompan Drive), `nombreArchivo(tipo, apellido, fecha, ext)`, `dniDeCarpeta(nombre)`. JS compatible con Apps Script (V8, sin `import`); el test lo carga con `vm`.
- **Tests:** `normaliza DNI con puntos y espacios`, `rechaza DNI de 6 y de 9 dígitos y con letras`, `arma nombre de carpeta en mayúsculas el apellido`, `nombre de archivo lleva la fecha`, `dos fechas distintas dan nombres distintos`, `encuentra el DNI al final del nombre de carpeta`, `no confunde 1234567 con 11234567`.
- **Acepta:** `npm run test:q` verde.

## Task 2 — Script de organización
- **Archivos:** `google/apps-script/organizar.gs`, `google/apps-script/config.gs`, `google/apps-script/appsscript.json`.
- **Qué:** `alEnviar(e)` según la spec (buscar o crear carpeta por DNI con `LockService`, mover y renombrar cada archivo, nunca borrar); `instalarDisparadores()` que crea uno por ID de formulario de la config sin duplicar; `oauthScopes` fijos (`forms`, `drive`, `script.scriptapp`).
- **Tests:** no corre en Node; un test chico `tests/appsScriptScopes.test.js` (`appsscript.json pide sólo forms, drive y scriptapp`) para que un scope nuevo no entre sin que nadie lo vea.
- **Acepta:** test verde; grep sin `setTrashed`, `removeFile`, `MailApp`, `GmailApp`, `SpreadsheetApp`.

## Task 3 — Tablero
- **Archivo:** `google/sheets/TABLERO.md`.
- **Qué:** pestañas (respuestas de cada formulario, Tablero, Entregas a mano, Sin inscripción), fórmulas listas para pegar con `;`, formato condicional, cómo compartir (sólo coordinación, nunca "Publicar en la web").
- **Además (si se aprueba el agregado):** planilla "Para Semillero" con `IMPORTRANGE`, una fila por DNI sin mostrarlo, encabezados exactos de la spec.
- **Acepta:** cada columna de documento de la spec tiene su fórmula; las fórmulas usan `;` y nombres en español (`CONTAR.SI.CONJUNTO`, `UNICOS`, `HIPERVINCULO`).

## Task 4 — Formularios
- **Archivo:** `google/formularios/CAMBIOS.md`.
- **Qué:** en Inscripción: partir Apellido/Nombre, validación del DNI, sección "Documentación" con las 6 subidas, mail verificado, texto de privacidad (borrador `[VALIDAR CON COORDINACIÓN]`), casilla de recaudación no premarcada, campos CABB faltantes. Formularios Pase / Aranceles: preguntas exactas, títulos de pregunta que usa el mapa de `config.gs`, límites de archivo.
- **Bloqueo:** los campos CABB esperan la lista; si alguno no se puede capturar con Forms, paro y aviso.
- **Acepta:** cada título de pregunta de subida coincide con una clave del mapa de `config.gs` (test `tests/appsScriptTitulos.test.js` que compara `CAMBIOS.md` con la config).

## Task 5 — Guía
- **Archivo:** `google/GUIA.md`.
- **Qué:** (1) mover el formulario actual a la cuenta del básquet (transferir propiedad o "Hacer una copia" desde la cuenta del básquet, y re-vincular la planilla; qué se pierde en cada caso); (2) crear carpeta raíz y planilla; (3) pegar el script, completar config, correr `instalarDisparadores`, aceptar permisos (tabla de scopes y por qué); (4) **prueba manual** con un formulario de prueba y DNIs inventados: mismo DNI desde dos formularios → misma carpeta; reenvío → dos archivos con fechas distintas; tablero ✅/❌ correcto, incluida una entrega a mano; DNI con puntos rechazado; (5) guía corta para padres sin cuenta de Google (crearla con su mail actual); (6) vaciado manual después del fichaje.
- **Acepta:** cubre los cinco criterios de aceptación del prompt; `npm run test:q` verde; aviso a la coordinadora.
