# Inscripción y documentación en Google — diseño

**Fecha:** 18/10/2026 · **Rama:** `claude/inscripcion-google-41cf4e` · **Tag previo:** `pre-inscripcion-google`
**Prompt:** 05 de Tomás. No toca el código de la app: Apps Script + Forms + Sheets, versionado en `google/`.

## Qué resuelve
Hoy los DNIs y fotos de los chicos llegan por WhatsApp a celulares de profes. Pasa a: el padre completa formularios de la cuenta de Google del básquet → un script deja cada archivo en `Inscripciones <temporada>/<APELLIDO, Nombre — DNI>/` con nombre legible → una planilla tablero muestra por chico qué está y qué falta. Nada pasa por Semillero ni Supabase.

## Lo que encontré en el formulario actual (insumo en `docs/insumos/`, gitignoreado)
- "Ficha Individual del Deportista - Temporada 2026": 5 secciones, 32 preguntas, **ninguna con validación** y **ninguna de subir archivo**.
- **"Apellido y Nombre" es un solo campo** → no se puede armar `APELLIDO, Nombre` confiable. Se parte en dos preguntas.
- **"DNI / Pasaporte"** → choca con `^\d{7,8}$`. Un chico extranjero con DNI argentino de extranjero (9x.xxx.xxx) pasa igual; uno con sólo pasaporte no. Propuesta: el DNI queda obligatorio con la validación, y la descripción dice "si todavía no tiene DNI argentino, escribinos por WhatsApp" (caso a mano, raro).
- Tiene datos de salud (ficha médica): datos sensibles. No lo rediseño (fuera de scope), pero refuerza que la planilla se comparta sólo con coordinación.

## Formularios y clave común
Clave en todos: **DNI del jugador**, respuesta corta, sin puntos, validación por expresión regular `^\d{7,8}$` con mensaje "Sólo números, sin puntos (7 u 8 dígitos)". Además cada formulario pide **Apellido** y **Nombre** del jugador (para nombrar la carpeta si es el primero en llegar).

| Formulario | Qué sube | ¿Existe? |
|---|---|---|
| Inscripción (el actual, pasa a pedir login) | DNI jugador frente / dorso, DNI adulto frente / dorso, foto del jugador, foto del adulto | sí, falta sumar |
| Pase (de otro club) | constancia de pase | **a confirmar** |
| Aranceles | comprobante de pago | **a confirmar** |

Una pregunta de subida por documento (no "frente y dorso" juntos): así el nombre del archivo dice cuál es y el tablero puede marcar cada uno. Límite por pregunta: 1 archivo, imágenes o PDF, 10 MB.

## Login: decidido que sí (Tomás, 18/10)
En Forms, una sola pregunta de subir archivo hace que **todo el formulario** exija entrar con una cuenta de Google. Tomás prefiere que el adulto entre logueado: queda identificado y sirve para vincularlo con el chico más adelante. Entonces:
- **Un solo formulario de inscripción** con datos + las 6 subidas (no se separa).
- Configuración: **"Recopilar direcciones de correo electrónico: Verificado"**. Cada respuesta guarda el mail de la cuenta de Google del adulto, que Google verificó (no lo tipea). Es la clave para vincular adulto ↔ DNI del chico en el futuro; un adulto con dos chicos manda dos respuestas con el mismo mail.
- La vinculación con Semillero **no** entra acá (decisión 1 y scope): sólo dejamos el dato listo y lo anotamos como pendiente.
- **Riesgo que queda:** familias sin cuenta de Google. Mitigación: (a) **se puede crear una cuenta de Google con el mail que ya tienen** (Hotmail, Yahoo…), sin abrir un Gmail; la guía para padres lo explica en 3 pasos. (b) Si igual no pueden, entregan las fotos al coordinador, que las sube a la carpeta del chico y lo anota en la hoja **"Entregas a mano"** del tablero (DNI + documento); el tablero lo cuenta como entregado.

Descartado: web app de Apps Script con subida anónima (endpoint público que escribe en el Drive del club) y separar inscripción y documentación (Tomás quiere un solo paso, logueado).

## Panel del coordinador
Es la **planilla tablero** (abajo), en la cuenta del básquet: abre en compu y celu, se comparte sólo con coordinación, y desde cada fila se llega a la carpeta del chico. Un panel **dentro de Semillero** implicaría que Semillero lea Drive/Sheets, que este prompt deja afuera; si se quiere más adelante, sería un prompt aparte y sólo con ✅/❌, nunca los archivos.

## Script de organización (`google/apps-script/`)
- Un proyecto **standalone** en la cuenta del básquet, con un disparador instalable "al enviar formulario" **por cada formulario** (inscripción, pase, aranceles). Config arriba del archivo: temporada, ID de la carpeta raíz, mapa `título de pregunta → tipo de documento`.
- Al recibir una respuesta: normaliza el DNI (saca puntos y espacios), busca en `Inscripciones <temporada>` una carpeta cuyo nombre termine en `— <DNI>`; si no hay, la crea como `APELLIDO, Nombre — DNI`. **El nombre de una carpeta existente no se toca.**
- Por cada archivo subido: lo mueve a esa carpeta y lo renombra `<tipo> - <APELLIDO> - <AAAA-MM-DD HH.MM>.<ext>`. La fecha va siempre: un reenvío da otro nombre y conviven los dos. **No borra nada nunca.**
- `LockService` para que dos envíos simultáneos del mismo DNI no creen dos carpetas.
- Si algo falla (DNI inválido, carpeta raíz no encontrada), el archivo queda donde lo dejó Forms y el error queda en el registro de ejecuciones. Sin mails automáticos.
- Funciones puras (normalizar DNI, nombre de carpeta, nombre de archivo, detectar carpeta por DNI) en un archivo aparte, con test en `node --test` (cargándolo con `vm`).

**Permisos (scopes)** — sólo Drive y Forms de la cuenta del básquet:
| Scope | Para qué |
|---|---|
| `forms` (`FormApp`) | leer las respuestas y los IDs de archivos del envío; instalar el disparador por formulario |
| `drive` (`DriveApp`) | crear carpetas, mover y renombrar los archivos. Tiene que ser el amplio: los archivos los creó Forms, no el script, así que `drive.file` no alcanza |
| `script.scriptapp` | crear los disparadores |

No pide Sheets ni Gmail. Lo fijamos en `appsscript.json` (`oauthScopes`) para que no crezca solo.

## Tablero (planilla, sólo fórmulas)
Una planilla de la cuenta del básquet donde cada formulario vuelca sus respuestas en su propia pestaña. Hoja **Tablero**:
- Padrón: DNIs únicos de la pestaña de Inscripción (`=UNICOS(...)`), con apellido, nombre, categoría y mail del adulto (`BUSCARV`).
- Una columna por documento: ✅ si hay al menos una respuesta con ese DNI y esa subida no vacía en la pestaña que corresponde, o una fila en "Entregas a mano"; si no ❌ (`CONTAR.SI.CONJUNTO`, separador `;`). Columna "Completo" y formato condicional.
- Link a la carpeta: `=HIPERVINCULO("https://drive.google.com/drive/search?q=" & DNI; "Abrir")`, que abre la búsqueda de Drive y muestra la carpeta del chico. Así el script no necesita permiso de Sheets. (Si Tomás prefiere el link directo, el script escribe el ID en una hoja y suma el scope `spreadsheets`: hay que decidirlo.)
- Quien envió documentación pero no está en Inscripción aparece en una hoja "Sin inscripción" (`FILTRO` + `CONTAR.SI`).

## Agregado: planilla "Para Semillero" (pedido de cuentas-familia, prompt 08)
**Excepción aprobada por Tomás** al aprobar la spec de cuentas-familia (commit a1b7d1b de `claude/cuentas-familia-c6c955`). Los datos de la inscripción alimentan el plantel de Semillero y el vínculo con el padre sale de su mail. Acá sólo se arma la planilla; el importador es de cuentas-familia.

- **Planilla aparte**, "Para Semillero <temporada>", no una pestaña del tablero. Razón: en Sheets, *Descargar → Microsoft Excel* baja **todas** las pestañas; si estuviera en el tablero, el .xlsx llevaría DNIs, ficha médica y links. La planilla aparte trae los datos con `IMPORTRANGE` desde la de respuestas (no necesita script ni scopes nuevos) y se comparte sólo con quien importa.
- Una fila por chico (la última respuesta de cada DNI). El DNI se usa para quitar duplicados pero **no se muestra**.
- Columnas, en este orden y con estos encabezados exactos en la fila 1:

| Columna | Contenido |
|---|---|
| `Apellido` | como lo escribió el adulto, sin cambios |
| `Nombre` | ídem |
| `Fecha de nacimiento` | celda de fecha, formato `dd/mm/aaaa` |
| `Categoría` | texto exacto de la opción del desplegable, ej. `U13 - MIXTO (2014 y 2013)` |
| `Mail del responsable` | el verificado por Google, en minúsculas |
| `Rama` | `Masculino` o `Femenino`. Sale de la categoría si dice MASCULINO o FEMENINO; si es MIXTO (Escuelita, U9, U11, U13), de la pregunta "Rama" |

- **Cómo queda la decisión 1:** se mantiene para lo que protege, que es la custodia de documentos: archivos, DNIs y ficha médica nunca salen de la cuenta del básquet. Lo que va a Semillero son 5 datos que el profe ya carga hoy a mano, sin DNI ni salud. No hay conexión: una persona descarga y sube el archivo. Es una **excepción a la decisión 1 tal como estaba escrita**, aprobada por Tomás, y el texto de privacidad del formulario dice que nombre, fecha de nacimiento, categoría y mail se cargan en la app del club.

## Formulario: lo que se suma (y nada más)
- Pregunta **"Rama"** (opción múltiple, obligatoria: Masculino / Femenino), después de la categoría (la pide "Para Semillero"). Las categorías mixtas no la traen y Semillero separa por rama. Si contradice a la categoría, manda la categoría.
- Partir "Apellido y Nombre" en dos; validación del DNI; las 6 preguntas de subida (sección nueva "Documentación"); recopilar mail verificado.
- Texto de **para qué se usan los datos y quién los ve** (borrador marcado `[VALIDAR CON COORDINACIÓN]`): lo ve sólo la coordinación del básquet; se usa para fichar en la CABB y la ficha de emergencia; queda en la cuenta del club; se borra la documentación después del fichaje.
- Casilla **no premarcada** de mails de recaudación, con el texto del checklist de `00-orden-de-trabajo.md` (con `[material, viajes, …]` a completar con Javier).
- Los campos de la CABB que falten. **Bloqueado: falta la lista de campos de la CABB.**

## Fuera de scope
Conexión de Semillero con Sheets/Drive, borrado automático, mails a padres, rediseñar el formulario, `clasp`.

## Reglas que no se negocian
Nunca "Publicar en la web" planilla ni respuestas; se comparten sólo con coordinación. El vaciado de Drive después del fichaje es manual. La prueba se hace con un formulario de prueba y DNIs inventados (ej. `11111111`, `22222222`), nunca reales.

## Decisiones
- ~~¿Separar inscripción y documentación?~~ No: un solo formulario, con login y mail verificado (Tomás, 18/10).
- Link a la carpeta: ¿búsqueda de Drive (sin permiso de Sheets) o link directo (suma scope `spreadsheets`)? Recomendado: búsqueda. **Pendiente.**
- ¿Existen ya los formularios de pase y de aranceles, o los armamos mínimos? **Pendiente.**
- **La lista de campos de la CABB** (para `docs/insumos/`). **Pendiente.**
