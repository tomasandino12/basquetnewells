# Panel de papeles y pagos — plan

**Spec:** `docs/superpowers/specs/2026-10-19-panel-docs-pagos-design.md` (opción (a), aprobada 19/10).
**Ejecución:** en esta sesión, sin subagentes. Un commit por task con `npm run test:q` verde. No mergear ni pushear.

## Reglas para todas las tasks
- Nunca entra a Semillero un DNI, un archivo, un link con DNI ni un dato médico. El script descarta columnas y la RPC rechaza textos con 7–8 dígitos seguidos (`PARECE_DNI`).
- El coordinador ve filas por chico **sólo** en este panel (nombre, categoría, estado), igual que en `vinculos_familia_del_club` (0057). Nada de fecha de nacimiento hacia el cliente.
- Base local compartida: verificar con `docker exec -i supabase_db_modelo-datos-supabase psql -U postgres` dentro de `begin; … rollback;`. Nada de `db reset`.
- El link a la carpeta de Drive lo define la sesión *datos conectados* en `src/data/enlacesGoogle.js` (`linkCarpetaEnDrive(nombreLimpio)`, 0059): el panel lo importa, no define otro. Si su rama no llegó, esperar o avisar a la coordinadora.
- `google/` no se toca hasta que la coordinadora confirme que inscripción cerró `feat/formularios-v2` (task 6).

## Estado
| Task | Estado |
|---|---|
| 1 Migración 0060 | hecha (local, en transacción) |
| 2 Módulo puro | hecha |
| 3 Repo | hecha (mapper en el módulo puro, como misiones) |
| 4 Panel (lectura) | hecha (verificada en navegador con cliente simulado) |
| 5 Conexión con Google (token) | pendiente |
| 6 Script del club | bloqueada: esperar a inscripción |
| 7 db push | bloqueada: avisar a la coordinadora + backup |

---

### Task 1 — Migración 0060 y contrato
**Archivos:** `supabase/migrations/0060_estado_inscripcion.sql`, `src/data/estadoInscripcion.js` (sólo constantes en esta task), `tests/contratoEstadoInscripcion.test.js`, `supabase/ESQUEMA.md`.

**Contenido de la migración** (patrón 0026, cabecera con link a la spec):
- `conexion_google`: `club_id` pk → club, `token_hash text` (64 hex, único), `creado_en`, `creado_por` (default `auth.uid()`), `ultimo_envio_en`, `tablero_url` (check `^https://docs\.google\.com/spreadsheets/d/[A-Za-z0-9_-]+`), `gid_tablero`/`gid_pagos` (bigint ≥ 0), `documentos_orden text[]`, `conceptos_orden text[]`.
- `estado_inscripcion`: `id`, `club_id`, `apellido`/`nombre` (≤ 80, `check` en línea), `clave`, `fecha_nacimiento date null`, `categoria_texto` (≤ 80), `rama` (`Masculino`/`Femenino`/null), `fila int` (2–5000), `documentos jsonb`, `completo bool null`, `pagos jsonb`, `cambio_en`. Único `(club_id, clave, fecha_nacimiento) nulls not distinct`.
- `clave_inscripcion(text)` immutable: `upper` + `translate` de vocales con tilde/diéresis, `ñ`, `ç` + sin comas + espacios colapsados. Equivale a `clavearNombre` (parserCabb.js).
- Las dos tablas: RLS activa sin políticas, `revoke all from anon, authenticated`, sin grants. Trigger de sellado: `club_id`, `creado_*` no cambian en update.
- `rotar_conexion_google(p_club_id) returns text`: `es_coordinador_de`; token = `encode(gen_random_bytes(32),'base64')` sin relleno y url-safe (43 caracteres); guarda el sha256, devuelve el token una vez.
- `desconectar_google(p_club_id)`: borra la conexión y todo `estado_inscripcion` del club.
- `empujar_estado_google(p_token text, p_envio jsonb) returns int`: largo ≠ 43 → `TOKEN_INVALIDO` sin consultar; club por hash; `octet_length(p_envio::text)` ≤ 1 MB; ≤ 1500 filas; ≤ 25 documentos y conceptos, claves ≤ 60; pagos ∈ {falta, subido, verificado}; `PARECE_DNI` en todo texto (`~ '\d{7,8}'`, incluidas claves); `ENVIO_MUY_SEGUIDO` si el último fue hace < 60 s. Upsert por clave; `cambio_en` sólo si cambió documentos/completo/pagos; borra las filas del club que no vinieron; actualiza `ultimo_envio_en`, URL, gids y órdenes.
- `estado_inscripcion_del_club(p_club_id)`: `es_coordinador_de`; une estado con jugadores de plantel vigente (`temporada_vigente_de`, `pertenencia.hasta is null`) por `nombre_clave` + fecha con las reglas de `cruzarConPadron`; devuelve `nombre, apellido, nombre_pila, categoria_codigo, categoria_texto, rama, emparejamiento ('ok'|'homonimo'|'sin_ficha'|'sin_tablero'), fila, documentos, completo, pagos, cambio_en`. Sin fecha.
- `conexion_google_del_club(p_club_id)`: `conectado, ultimo_envio_en, tablero_url, gid_tablero, gid_pagos, documentos_orden, conceptos_orden`.
- Execute: `empujar_estado_google` sólo a `anon` y `authenticated`; el resto sólo a `authenticated`; `revoke … from public` en todas.

**Constantes JS:** `LIMITES_ESTADO` (nombre 80, clave 60, filas 1500, claves 25, fila 5000, bytes 1048576), `ESTADOS_PAGO`, `EMPAREJAMIENTOS`.

**Tests (`contratoEstadoInscripcion.test.js`):** `los límites del SQL coinciden con LIMITES_ESTADO` · `los estados de pago son los mismos` · `clave_inscripcion traduce cada letra igual que clavearNombre` (lee los dos argumentos del `translate` y compara letra por letra) · `ninguna tabla nueva tiene grant a anon ni authenticated` · `empujar_estado_google es la única ejecutable por anon`.

**Verificación local (en transacción):** token válido guarda; token tras rotar → `TOKEN_INVALIDO`; DNI en un nombre → `PARECE_DNI`; dos envíos seguidos → `ENVIO_MUY_SEGUIDO`; `anon` y un entrenador no leen las tablas ni la RPC de lectura; emparejamientos ok/homónimo/sin_ficha/sin_tablero con jugadores de prueba. Resumen en el mensaje del commit.

**Aceptación:** test:q verde, verificación local ok, ESQUEMA.md con las dos tablas.

### Task 2 — Módulo puro `src/data/estadoInscripcion.js`
**Archivos:** el módulo, `tests/estadoInscripcion.test.js`.
**Funciones:** `debeAlgo(chico)` (algún pago `falta` o `sin_tablero`), `faltaDocumentacion(chico)` (`completo !== true`), `porVerificar(chico)`, `filtrar(chicos, { categoria, debe, faltaDoc, verificar })`, `contadores(chicos, conceptosOrden)` → `[{ concepto, verificado, subido, falta }]` + documentación completa n/total (conceptos que no están en el orden van al final: aparecen solos), `categoriaDeChico(chico)` (código de Semillero o `mapearCategoria` del texto), `linkFila(conexion, hoja, fila)` (null sin conexión o sin fila), `resumenPanorama(chicos)`.
**Tests:** `un concepto nuevo aparece en los contadores` · `sin_tablero debe todo y le falta todo` · `los filtros se combinan` · `linkFila arma #gid y range de la fila` · `linkFila es null sin conexión` · `categoría de un sin_ficha sale del texto del tablero`.

### Task 3 — Repo
**Archivos:** `src/data/repos/coordinacion.js`, `tests/estadoInscripcion.test.js` (mapper).
**Funciones:** `obtenerEstadoInscripcion(clubId)` (RPC + `chicoDesdeFila`, camelCase), `obtenerConexionGoogle(clubId)`, `rotarConexionGoogle(clubId)` → token, `desconectarGoogle(clubId)`.
**Tests:** `chicoDesdeFila pasa a camelCase y deja null lo que falta`. `arquitectura.test.js` sigue verde.

### Task 4 — Panel (lectura)
**Archivos:** `src/ui/pantallas/coordPapeles.js` (nueva), `src/ui/pantallas/coordFamilias.js` (pestañas internas `.pestanas`: "Papeles y pagos" primero, "Cuentas"), `src/ui/pantallas/coordPanorama.js` (tarjeta tocable de resumen), CSS sólo si falta una pieza (leer DESIGN.md antes).
**Qué hace:** último envío (aviso si > 2 h), botón "Abrir el tablero", contadores, chips de filtro (categoría, Debe algo, 📎 Por verificar, Le falta documentación), una fila por chico con chips ✅/📎/❌, detalle con documentos, conceptos, "cambió el …" y los links Ver en el tablero / Ver pagos / Carpeta; bloques "Posible homónimo", "En Google, no en Semillero" (ayuda: importarlo desde Plantel) y "No se inscribió". Todo con `html\`\``, errores con `avisoDeError`.
**Aceptación:** probado en el navegador con datos sembrados en local (dentro de una transacción no se ve: sembrar con un club de prueba y borrar al final, avisando a la coordinadora), a 375 px sin scroll horizontal. test:q verde.

### Task 5 — Conectar con Google
**Archivos:** `coordPapeles.js`, ayuda en `src/data/guias.js` o `PISTAS` si hace falta.
**Qué hace:** sin conexión, "Conectar con Google" explica en 3 pasos y genera el token; se muestra una vez con botón Copiar y aviso de que no se vuelve a ver. Con conexión: "Cambiar el token" (confirmación: el script deja de mandar hasta pegar el nuevo) y "Desconectar" (borra el estado; `confirmarEnHoja`).
**Aceptación:** rotar invalida el anterior (probado con la RPC en local); test:q verde.

### Task 6 — Script del club (esperar OK de la coordinadora)
**Archivos:** `google/apps-script/estado.gs` (puro: armar el envío desde las tres hojas), `google/apps-script/semillero.gs` (leer hojas, `UrlFetchApp`, disparador cada 15 min, `enviarEstadoAhora`), `config.gs` (`TABLERO_ID`, `SEMILLERO_URL`, `SEMILLERO_CLAVE_PUBLICA`), `appsscript.json` (+ `spreadsheets.readonly`, `script.external_request`), `google/GUIA.md` (instalar, pegar el token en Script Properties `SEMILLERO_TOKEN`, rotarlo), `docs/SEGURIDAD-LANZAMIENTO.md` (primer escritor externo).
**Reglas:** lee sólo `Salida Semillero!A:F`, `Tablero!G:` (columnas con sólo ✅/❌/vacío) y `Pagos!C:L`; nunca `Tablero!A` ni `Carpeta`; descarta antes de enviar todo texto con 7–8 dígitos; el token nunca en el código ni en el log.
**Tests (`tests/appsScriptEstado.test.js`):** `arma una fila por chico con su número de fila` · `descarta la columna Carpeta y cualquier columna que no sea ✅/❌` · `los conceptos salen de los encabezados de Pagos` · `una fila con un DNI en el nombre no se manda` · `fecha ilegible queda null`.

### Task 7 — db push
Avisar a la coordinadora (puede haber 0059 pendiente). Preguntar a Tomás por el backup del día (`docs/BACKUP.md`) y pedir confirmación antes de `npx supabase db push`.
