# Panel de papeles y pagos (coordinación) — diseño

Fecha: 19/10/2026 · Migración: **0060** · Estado: **aprobada por Tomás, opción (a)** (19/10, vía la coordinadora)

## 1. Qué se pide

"En el dashboard del coordinador una sección donde revise fácilmente el estado de estas sheets, si pagó o no." El coordinador ve, por chico, si tiene los documentos y qué conceptos pagó, filtra por categoría / "debe algo" / "le falta documentación", y desde ahí abre la carpeta de Drive del chico para **bajarla entera** (Drive → *Descargar* arma un .zip) y cargarla en la CAB, en vez de pedir fotos por WhatsApp.

**Restricción dura:** a Semillero llega sólo **estado** (documento ✅/❌, pago por concepto ❌/📎/✅, cuándo cambió). Nunca archivos, DNIs, links con DNI ni datos médicos. Los archivos siguen en el Drive del club, detrás de los permisos de Google. Sólo el coordinador ve el panel.

## 2. Cómo llega el estado: tres caminos

| | (a) El script empuja | (b) Bajar e importar | (c) Sólo un link a "Buscar" |
|---|---|---|---|
| Frescura | ≤ 15 min, sola | La del último que importó (en la práctica, días) | En vivo |
| Trabajo del coordinador | Ninguno | Bajar un .xlsx e importarlo cada vez | Buscar chico por chico en el celular |
| Filtros y contadores en la app | Sí | Sí | No (es la hoja de Google) |
| Costo | Alto: migración con token, RPC, script nuevo, scopes nuevos | Medio: parser + planilla nueva por IMPORTRANGE | Casi nulo |
| Riesgo | Primer escritor externo de la base (ver §4) | Bajo: lo sube un usuario logueado | Nulo para la base |

**Recomiendo (a)**, con (c) como botón fijo "Abrir el tablero" arriba del panel. (b) cumple la letra pero no el pedido: un panel que depende de que alguien importe queda viejo y deja de mirarse. El riesgo de (a) se acota bien porque el token sólo puede **escribir estado de su club** y no lee nada (§4).

Las dos opciones (a) y (b) leen las mismas columnas, así que si (a) se cae o se posterga, (b) se arma encima del mismo contrato sin rediseñar.

## 3. Qué se manda (contrato con el tablero)

El script lee **sólo columnas sin DNI**, todas alineadas fila a fila con `Tablero!A` (así las arma `TABLERO.md`):

- `Salida Semillero!A:F` → apellido, nombre, fecha de nacimiento, categoría (texto del desplegable), rama.
- `Tablero!G:M` y las columnas de temporada a la derecha de `Carpeta` → un mapa `{ "DNI jugador - frente": true, … }` y `completo` (columna M). Entra como documento **sólo** una columna cuyos valores son todos ✅/❌/vacío: `Carpeta` (que lleva el DNI en la URL) y cualquier otra queda afuera sola.
- `Pagos!C:L` → `{ "Arancel octubre 2026": "verificado" | "subido" | "falta" }`. Los conceptos salen de los encabezados: **un concepto nuevo en Config aparece solo** en el panel.

**Link a su fila del tablero** (pedido de Tomás, 19/10: "que pueda linkearse a su columna del sheet… para que la revisión sea rápida"). Cada fila lleva su **número de fila** (entero) y cada envío, la URL de la planilla y el `gid` de las hojas `Tablero` y `Pagos`. La app arma `…/edit#gid=<gid>&range=A<n>:Z<n>`, que abre la planilla con la fila del chico seleccionada. Elegí esto y no la hoja `Buscar` con el DNI precargado porque (1) Sheets no permite precargar una celda desde la URL, así que igual habría que tipear el DNI, y (2) para eso Semillero tendría que conocer el DNI. El número de fila no dice nada fuera de la planilla, y la fila se ve sólo con permiso de Google. Las filas del Tablero cambian de lugar si se toca `Config!B2`: como el script manda el número en cada envío, el link se corrige solo en ≤ 15 min. La fila tiene además la columna `Carpeta` del tablero, que busca por DNI: si el link por nombre (abajo) falla, ése no.

**Link a la carpeta, sin mandar nada:** la app arma `drive.google.com/drive/search?q=APELLIDO Nombre` con datos que ya tiene. La carpeta se llama `APELLIDO, Nombre — DNI`, así que la búsqueda la encuentra y, si hay homónimos, el DNI del nombre los distingue (lo ve sólo quien tiene acceso al Drive). Si la carpeta quedó con el apellido mal escrito, no aparece: el panel lo avisa ("¿No aparece? Buscala por DNI en Drive").

## 4. Seguridad del camino (a)

- **Token por club**: 32 bytes al azar, generado por la base (`gen_random_bytes`), mostrado **una sola vez** al coordinador para pegarlo en *Script Properties* (`SEMILLERO_TOKEN`). En la base queda sólo `sha256` en `conexion_google(club_id, token_hash, creado_en, creado_por, ultimo_envio_en, tablero_url, gid_tablero, gid_pagos)`. Nunca en el código ni en git.
- **Rotar** = generar uno nuevo: el anterior deja de servir en el acto (un token activo por club). **Desconectar** = borrar el token **y** todo el estado del club.
- **RPC `empujar_estado_google(p_token text, p_filas jsonb)`**, `security definer`, `search_path = ''`, ejecutable por `anon` (el script usa la clave pública, que ya está en el front). Antes de mirar nada: largo del token exacto o `TOKEN_INVALIDO`; después busca el club por hash. Sólo hace **reemplazo del estado de ese club** (upsert + borrar lo que ya no vino); no recibe `club_id`, no devuelve datos (sólo cuántas filas guardó).
- **Límites**: ≤ 1500 filas, payload ≤ 1 MB, ≤ 25 documentos y ≤ 25 conceptos, claves ≤ 60 caracteres, nombres ≤ 80, rama ∈ {Masculino, Femenino, vacía}, pagos ∈ {falta, subido, verificado}, un envío por minuto por club (`ENVIO_MUY_SEGUIDO`). **Ningún texto puede tener 7–8 dígitos seguidos** (`PARECE_DNI`): si alguien cambia el tablero y se cuela un DNI, el envío entero se rechaza.
- **Si el token se filtra**, lo peor que pasa es estado falso en el panel de ese club hasta que se rota; no se lee ni se toca nada más. El panel muestra "Último envío: hace X" y avisa si pasaron más de 2 h.
- Scopes nuevos del script: `spreadsheets.readonly` y `script.external_request`. Hay que volver a autorizar una vez con la cuenta del básquet.

## 5. Base (0060, patrón 0026)

- `estado_inscripcion`: `club_id`, `apellido`, `nombre`, `clave` (normalizada), `fecha_nacimiento` (null si no vino), `categoria_texto`, `rama`, `fila` (número de fila en el tablero), `documentos jsonb`, `completo bool`, `pagos jsonb`, `cambio_en` (cuándo cambió **su** estado, no cada envío). Único por `(club_id, clave, fecha_nacimiento)`.
- Las dos tablas: `revoke all`, **ningún grant a `anon` ni `authenticated`** (todo pasa por RPC), RLS activa sin políticas, trigger de sellado (`club_id` y `creado_*` no cambian), `check` de largos y de forma del jsonb.
- **Lectura**: `estado_inscripcion_del_club(p_club_id)` (`security definer`, `es_coordinador_de`) devuelve una fila por chico ya emparejada (§6), sin fecha de nacimiento. `conexion_google_del_club` devuelve sólo `conectado`, `ultimo_envio_en`, `tablero_url` y los dos `gid`.
- Verificación y rollback en local dentro de una transacción (`begin … rollback`). **Nada de `db reset`**: la base local es compartida.

## 6. Emparejamiento sin DNI

El mismo criterio que `cruzarConPadron` (importador de inscriptos): **apellido + nombre + fecha de nacimiento dentro del club**, con la clave de `clavearNombre` (mayúsculas, sin tildes, sin comas). Se empareja **al leer**, en la RPC, contra todas las fichas del club (un chico de la temporada pasada sigue siendo él; la categoría sale del plantel vigente si tiene); así un chico importado después aparece emparejado sin esperar otro envío. La normalización vive en SQL y en JS: lleva test de contrato.

| Caso | Qué se ve |
|---|---|
| Misma clave y misma fecha (o una sola ficha sin fecha) | Fila normal, con la categoría de Semillero |
| Misma clave, otra fecha | "Posible homónimo": aparece, con la categoría del tablero, sin unirlo a nadie |
| No hay ficha en Semillero | "En Google, no en Semillero", con la categoría del tablero mapeada (`mapearCategoria`). Ayuda: "Importalo desde Plantel → Importar inscriptos" |
| Ficha en Semillero sin fila en el tablero | "No se inscribió": cuenta como **debe todo y le falta todo** |

Nada se descarta en silencio: lo que no empareja tiene su bloque con contador.

## 7. El panel

En **Coordinación → Familias**, con pestañas internas (`.pestanas`): **Papeles y pagos** (primera) y **Cuentas** (lo que hoy es Familias). No suma ítems a la barra de abajo. En Panorama, una tarjeta tocable de una línea ("9 deben algo · 14 sin papeles completos") lleva al panel.

- Arriba: "Último envío hace 12 min" (o el aviso de desconexión), botón **Abrir el tablero** (el script manda la URL de su planilla en cada envío; la RPC sólo acepta `https://docs.google.com/spreadsheets/…`) y, si no hay conexión, **Conectar con Google**.
- **Contadores por concepto** en mono: `Arancel octubre · ✅ 41 · 📎 6 · ❌ 12`, y `Documentación completa 48/62`.
- **Filtros**: chips de categoría, "Debe algo" (algún concepto ❌), "📎 Por verificar", "Le falta documentación". Se combinan.
- **Fila por chico**: nombre, categoría, chips de estado (`.chip.sube` ✅, `.chip.baja` ❌, `.chip.sin` 📎) y botón **Carpeta**. Al tocarla, el detalle: cada documento y cada concepto, "cambió el 17/10" y tres links de un toque: **Ver en el tablero** (su fila en `Tablero`), **Ver pagos** (su fila en `Pagos`) y **Carpeta** (Drive). Los chicos sin fila en el tablero no llevan los dos primeros.
- Sólo lectura: **verificar un pago se sigue haciendo en el tablero** (`Pagos verificados`). Una sola fuente de verdad.
- Estética interna clara de `DESIGN.md`; HTML con `html\`\``; filtros, contadores y emparejamiento de categoría en un módulo puro `src/data/estadoInscripcion.js` con test; acceso por `repos/coordinacion.js`.

## 8. Fuera de alcance

Verificar pagos o marcar entregas desde Semillero; mostrar estado a profes o familias; montos; el modo (b). Los cambios en `google/` esperan a que inscripción cierre `feat/formularios-v2` (lo confirma la coordinadora): el script y el contrato de columnas se ajustan a lo que quede.

## 9. Pruebas

Contrato de normalización SQL↔JS; contrato de límites (`limites.js` ↔ `check`); módulo puro (filtros, contadores, conceptos nuevos, link de carpeta sin dígitos); funciones puras del script con node (armar filas, descartar columnas que no son ✅/❌, rechazar un DNI); en local, `begin … rollback` con token válido, token viejo tras rotar, `anon` sin acceso a las tablas y un no-coordinador sin lectura.
