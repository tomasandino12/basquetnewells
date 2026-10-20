# Plan — Formularios v2

Spec: `docs/superpowers/specs/2026-10-19-formularios-v2-design.md`. Una task por commit, `npm run test:q` en verde en cada una. Sin merge ni push. No se toca el código de la app ni el script.

## Estado
| # | Task | Estado |
|---|---|---|
| 0 | Rama `feat/formularios-v2`, spec y plan | hecho (aprobados 19/10) |
| 1 | `FORMULARIOS.md` v2: los 5 formularios y la plantilla | hecho (el Mapa de columnas de `TABLERO.md` se adelantó acá para que el test siga en verde) |
| 2 | `TABLERO.md` v2: Base con la pestaña única, Pagos con formulario propio, Revisar categoría/año | hecho |
| 3 | `GUIA.md` y `PADRES.md` v2 | hecho |
| 4 | Script del Tablero: importar las respuestas 2026 (se hace primero) | hecho |
| 5 | `PROMPT-NAVEGADOR.md` para Claude en el navegador | pendiente |

## Task 1 — Formularios
- **Archivos:** `google/formularios/FORMULARIOS.md`, `tests/appsScriptTitulos.test.js`.
- **Qué:** Quiero jugar, Inscripción (S1–S9 con saltos; columnas calculadas por posición), Comprobante de pago, Plantilla, Quiero colaborar. Campos de emergencia de la spec. Arranque y ayuda en cada subida.
- **Tests:** los de la v1 adaptados (`Inscripción` en vez de Inscripción + Reinscripción); nuevos: `cada título aparece una sola vez en Inscripción`, `consentimiento y alertas médicas son obligatorias`, `Quiero jugar y Quiero colaborar no tienen subidas ni DNI`.
- **Acepta:** test verde; la tabla de saltos de la Inscripción cubre las 9 secciones.

## Task 2 — Tablero
- **Archivos:** `google/sheets/TABLERO.md`, `tests/appsScriptParaSemillero.test.js`, `tests/appsScriptTitulos.test.js` (mapa).
- **Qué:** Base desde una sola pestaña (Alta = respuesta a la primera pregunta); documentos de DNI suman foto vieja y nueva; Pagos con columnas de "pago con formulario propio"; Buscar con todas las columnas de Pagos; Revisar: categoría sin el año de nacimiento, pagos de DNI fuera del padrón; Para Semillero igual (6 columnas).
- **Tests:** `el mapa del tablero coincide con los formularios`; los de Para Semillero siguen igual.

## Task 3 — Guías
- **Archivos:** `google/GUIA.md`, `google/formularios/PADRES.md`.
- **Qué:** cuenta de la Comisión y "no tocar lo viejo"; carpeta `Inscripción y documentación`; bajar la carpeta de un chico (compu y celular); pago nuevo simple vs. formulario propio; primera temporada; prueba manual actualizada. PADRES: un solo formulario de inscripción y qué contestar en la primera pregunta.

## Task 4 — Importar 2026
- **Archivos:** `google/apps-script-tablero/importar2026.gs`, `google/apps-script-tablero/fila2026.gs` (funciones puras), `google/apps-script-tablero/appsscript.json`, `tests/appsScriptImportar2026.test.js`.
- **Qué:** menú "Actualizar datos 2026"; lee las respuestas del formulario 2026 por título (ID en una constante); una fila por DNI (la última); reescribe sólo la hoja `Inscripción 2026`. Saltea un DNI inválido y lo cuenta.
- **Tests:** `normaliza el DNI con puntos`, `se queda con la última respuesta de cada DNI`, `saltea pasaportes y DNIs inválidos`, `appsscript.json pide sólo forms y spreadsheets.currentonly`, `el código no llama a métodos que modifican formularios`.

## Task 5 — Prompt para el navegador
- **Archivo:** `google/PROMPT-NAVEGADOR.md`.
- **Qué:** un prompt autocontenido, por etapas con chequeo: carpetas → formularios → tablero → script (Tomás acepta permisos) → prueba con DNIs inventados → informe. Reglas: sólo cuenta Comisión, sólo lo pedido, no abrir respuestas viejas ni copiar datos de menores, no cambiar permisos, nunca publicar en la web, parar y preguntar ante cualquier duda.
- **Acepta:** test `el prompt cita las reglas` (cuenta Comisión, no publicar, permisos los acepta Tomás).
