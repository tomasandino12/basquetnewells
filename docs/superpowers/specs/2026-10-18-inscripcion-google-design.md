# Inscripción y documentación en Google — diseño

**Fecha:** 18/10/2026 · **Rama:** `claude/inscripcion-google-41cf4e` · **Tag previo:** `pre-inscripcion-google`
**Prompt:** 05 de Tomás, más sus agregados del 18/10 (login, reinscripción, formularios nuevos sin código, aranceles, buscador, ayuda para familias). No toca el código de la app: Apps Script + Forms + Sheets, versionado en `google/`.

## Qué resuelve
Hoy los DNIs y fotos de los chicos llegan por WhatsApp a celulares de profes. Pasa a: el adulto completa formularios de la cuenta de Google del básquet → un script deja cada archivo en **la carpeta del chico** con nombre legible → una planilla tablero muestra por chico qué está y qué falta. Ahí quedan sus DNIs, aranceles, pase, rifas y lo que se pida después. Ningún archivo ni DNI pasa por Semillero ni Supabase.

## Lo que encontré en el formulario actual (insumo en `docs/insumos/`, gitignoreado)
- "Ficha Individual del Deportista - Temporada 2026": 5 secciones, 32 preguntas, **ninguna con validación** y **ninguna de subir archivo**.
- **"Apellido y Nombre" es un solo campo** → no se puede armar `APELLIDO, Nombre` confiable. Se parte en dos preguntas.
- **"DNI / Pasaporte"** → choca con `^\d{7,8}$`. Un chico extranjero con DNI argentino (9x.xxx.xxx) pasa igual; uno con sólo pasaporte no. El DNI queda obligatorio con la validación, y la descripción dice "si todavía no tiene DNI argentino, escribinos por WhatsApp" (caso a mano, raro).
- Tiene ficha médica (datos sensibles): no la rediseño, pero refuerza que las planillas se compartan sólo con coordinación.

## Carpeta por chico, no por temporada
Tomás quiere que en la carpeta del chico esté todo: DNIs, aranceles, pase, rifas. Con la reinscripción, los DNIs **no se vuelven a pedir**, así que una carpeta por temporada los dejaría en la del año anterior. Entonces:

`Jugadores/<APELLIDO, Nombre — DNI>/` — una carpeta para siempre. La temporada se ve en la fecha del nombre de cada archivo.

Esto cambia el `Inscripciones <temporada>/…` del objetivo 1 del prompt. **Lo tiene que aprobar Tomás.** Consecuencia: los DNIs de un chico quedan guardados mientras juegue en el club, no sólo hasta el fichaje. El vaciado sigue siendo manual (decisión 8); la guía propone vaciar la carpeta de quien se va del club. **Pregunta para Tomás:** ¿la CABB pide las fotos del DNI de nuevo cada temporada? Si sí, la reinscripción las pide y conviene vaciar después de cada fichaje.

## Clave común y formulario estándar
En todos los formularios, tres preguntas con **título exacto** (el script las busca por título):
- `DNI del jugador (sin puntos)` — respuesta corta, obligatoria, validación por expresión regular `^\d{7,8}$`, mensaje "Sólo números, sin puntos (7 u 8 dígitos)".
- `Apellido del jugador` y `Nombre del jugador` — respuesta corta, obligatorias (sirven para nombrar la carpeta si es el primer envío de ese chico).

Para no tipearlas cada vez, queda un **formulario plantilla** ("Plantilla — formulario con archivos") con esas tres preguntas listas: el coordinador hace *Hacer una copia* y suma lo suyo.

Todos piden login (los que tienen subidas lo exigen igual) y **recopilan el mail verificado**. Nunca se mandan links prellenados con datos del chico: quedan en historiales y se reenvían.

| Formulario | Qué sube |
|---|---|
| Inscripción (el actual, chicos nuevos) | DNI jugador frente / dorso, DNI adulto frente / dorso, foto del jugador, foto del adulto |
| Reinscripción (nuevo, ver abajo) | nada obligatorio |
| Comprobante de aranceles (nuevo, ver abajo) | comprobante de pago |
| Los que sume coordinación (pase, rifas…) | lo que pida cada uno |

Una pregunta de subida por documento, 1 archivo, imágenes o PDF, 10 MB. **El título de la pregunta es el tipo de documento**: la pregunta "Comprobante rifa" deja `Comprobante rifa - SANCHEZ - 2026-10-18 14.30.jpg` en `Jugadores/SANCHEZ, Pedro — 11111111/`. Si el formulario tiene una pregunta titulada exactamente `Concepto`, su respuesta se suma al nombre: `Comprobante de pago - Arancel octubre 2026 - SANCHEZ - 2026-10-18 14.30.jpg`.

## Que las familias entiendan qué hacer
No suponemos que saben de computadoras. En todos los formularios (y en la plantilla, para que los nuevos lo hereden):
- **Arranque de 2 o 3 líneas:** para qué es, qué tener a mano antes de empezar ("el DNI del chico y el tuyo, para sacarles foto de frente y de dorso") y qué pasa después ("el coordinador lo revisa; si falta algo te avisa tu profe").
- **Cada pregunta de archivo con una ayuda corta:** "Sacale una foto con el celular al frente del DNI, sobre una mesa y con luz, que se lean los números".
- **Guía para padres** en lenguaje simple (un Google Doc del básquet, enlazable desde la página pública): cómo entrar con Google, cómo crear una cuenta de Google con el mail de siempre sin abrir un Gmail, cómo sacar y subir las fotos desde el celular, qué formulario usar en cada caso (inscripción la primera vez, reinscripción los años siguientes, aranceles cada vez que pagan).

## Login (decidido por Tomás, 18/10)
Una pregunta de subir archivo hace que todo el formulario pida cuenta de Google. Tomás lo prefiere: el adulto queda identificado y su **mail verificado** es el vínculo con el chico (lo usa cuentas-familia). Un adulto con dos chicos manda dos respuestas con el mismo mail.
**Riesgo:** familias sin cuenta de Google. Mitigación: (a) **se crea una cuenta de Google con el mail que ya tienen** (Hotmail, Yahoo…), sin abrir un Gmail; la guía para padres lo explica en 3 pasos. (b) Si igual no pueden, entregan los papeles al coordinador, que los sube a la carpeta del chico y lo anota en la hoja **"Entregas a mano"** (DNI + documento); el tablero lo cuenta.
Descartado: web app con subida anónima (endpoint público que escribe en el Drive del club).

## Reinscripción
Formulario aparte para chicos que ya se inscribieron alguna vez. Pide las 3 preguntas estándar y **sólo lo que cambia**:

| Se repite cada año | No se repite (sale de su última inscripción completa) |
|---|---|
| Categoría y Rama · Altura actual · Domicilio · Teléfono del deportista y del familiar a cargo · Email del deportista · Adulto responsable · Institución, año y turno · Obra social y número de afiliado · "¿Cambió algo de salud desde la última inscripción?" (Sí / No; si sí, sección con afecciones, alergias, cirugías, indicaciones y medicación) · En caso de urgencia llamar a · Autorizaciones y casilla de recaudación (se renuevan cada año) | DNI (sólo la clave) · Nacionalidad · Fecha de nacimiento · Número de socio · Grupo sanguíneo · Altura del padre y de la madre · Lateralidad · Club de procedencia · Fotos de DNI y fotos |

Si la CABB pide las fotos de DNI cada temporada (decisión 3 de abajo), pasan a la columna de la izquierda.
- Si el DNI no aparece en ninguna inscripción anterior, el chico sale en la hoja **"Revisar"** del tablero: probablemente le tocaba la inscripción completa.
- Los datos que no cambian (fecha de nacimiento, grupo sanguíneo, DNIs) se toman de su última inscripción, por DNI.

## Comprobante de aranceles
Hoy llegan por WhatsApp y no se puede controlar quién pagó qué. Formulario hecho con la plantilla: las 3 preguntas estándar, `Concepto` (desplegable que el coordinador actualiza con los conceptos vigentes: "Arancel octubre 2026", "Cuota anual 2026"…) y `Comprobante de pago` (archivo). El archivo cae en la carpeta del chico con el concepto en el nombre.
**Un comprobante subido no es un pago verificado** (decisión del prompt 09). El tablero distingue tres estados por concepto: ❌ no hay comprobante · 📎 comprobante subido, sin verificar · ✅ verificado. El coordinador verifica anotando una fila en la hoja **"Pagos verificados"** (DNI, concepto, fecha, quién verificó); no se escribe sobre las pestañas de respuestas, porque Forms las reescribe al cambiar preguntas.

## Script de organización (`google/apps-script/`)
- Proyecto **standalone** en la cuenta del básquet. Mira los formularios que están dentro de una carpeta de Drive: **`Formularios con archivos`**. Ésa es toda la configuración: un formulario que el coordinador mete en esa carpeta queda incluido; uno que saca, deja de procesarse. **No hay que tocar código ni el editor.**
- **Cómo procesa: un barrido cada 10 minutos** (disparador por tiempo), no un disparador por formulario. Razón: Apps Script permite hasta 20 disparadores por usuario y script, y con varios formularios por temporada el límite llega; además, con el barrido un formulario nuevo queda andando sin que nadie corra nada, y un envío que falló se reintenta solo. Costo: el archivo aparece en la carpeta del chico hasta 10 minutos después. Es un cambio a la decisión 4 ("al enviar formulario"): **lo tiene que aprobar Tomás.**
- En cada barrido, por formulario de la carpeta: si no tiene la pregunta `DNI del jugador (sin puntos)`, lo saltea y lo anota en el registro. Si la tiene, toma las respuestas nuevas (guarda la última hora procesada por formulario en las propiedades del script). Por cada respuesta: normaliza el DNI, busca en `Jugadores/` la carpeta que termine en `— <DNI>` o la crea como `APELLIDO, Nombre — DNI` (**el nombre de una carpeta existente no se toca**), y por cada pregunta de subida mueve el archivo ahí y lo renombra `<título de la pregunta> - <APELLIDO> - <AAAA-MM-DD HH.MM>.<ext>`.
- Reenvío: otro nombre por la fecha, conviven los dos. **No borra nada nunca.** Si un archivo ya está en la carpeta del chico, no lo toca (procesar dos veces no rompe nada).
- `LockService` para que dos barridos no se pisen.
- Si algo falla, el archivo queda donde lo dejó Forms, el error queda en el registro de ejecuciones y el próximo barrido lo reintenta. Sin mails automáticos.
- Funciones puras (normalizar DNI, nombres de carpeta y archivo, DNI de una carpeta, limpiar un título para nombre de archivo) en un archivo aparte, con test en `node --test` (cargándolo con `vm`).

**Permisos (scopes)** — sólo Drive y Forms de la cuenta del básquet, fijados en `appsscript.json` (`oauthScopes`):
| Scope | Para qué |
|---|---|
| `forms` | abrir los formularios de la carpeta y leer sus respuestas y los IDs de los archivos subidos |
| `drive` | listar la carpeta de formularios, crear carpetas, mover y renombrar archivos. Tiene que ser el amplio: los archivos los creó Forms, no el script, así que `drive.file` no alcanza |
| `script.scriptapp` | crear el disparador del barrido |

No pide Sheets ni Gmail. Por eso la configuración es una carpeta de Drive y no una hoja: leer una hoja sumaría el scope `spreadsheets`.

## Sumar un formulario nuevo (lo hace coordinación, sin código)
1. En la carpeta `Formularios con archivos`, *Hacer una copia* de la plantilla y ponerle nombre (ej. "Rifa día del niño 2026").
2. Sumar las preguntas de subida con el título que se quiere ver en el archivo ("Comprobante rifa").
3. En *Respuestas*, vincularlo con la planilla de respuestas (queda en una pestaña nueva).
4. En el tablero, copiar una columna de documento y cambiarle la pestaña y la columna (la guía trae la fórmula con dónde tocar).
5. Probarlo con un DNI inventado y esperar 10 minutos.

## Tablero (planilla, sólo fórmulas)
Una planilla de respuestas en la cuenta del básquet: cada formulario vuelca en su pestaña y las respuestas se acumulan año tras año. Hoja **Config**: temporada y fecha de inicio de temporada. Hoja **Tablero**, una fila por chico de la temporada:
- Padrón: DNIs únicos con inscripción o reinscripción desde el inicio de temporada (`UNICOS` + `FILTRO`), con apellido, nombre, categoría y mail del adulto de su última respuesta.
- **Columna "Alta"**: `Nueva` si su inscripción de esta temporada es la completa, `Reinscripción` si vino por la corta. Ese es el modo de ver que se reinscribió esta temporada. Chicos que estaban la temporada pasada y todavía no se reinscribieron: hoja **"Faltan reinscribir"**.
- Una columna por documento: ✅ si alguna respuesta de **cualquier temporada** con ese DNI tiene esa subida, o hay una fila en "Entregas a mano"; si no ❌ (`CONTAR.SI.CONJUNTO`, separador `;`). Para aranceles y rifas, que son de una temporada, la fórmula cuenta sólo desde el inicio de temporada. Columna "Completo" y formato condicional.
- Link a la carpeta: `=HIPERVINCULO("https://drive.google.com/drive/search?q=" & DNI; "Abrir")`, que abre la búsqueda de Drive en la carpeta del chico. Así el script no necesita permiso de Sheets.
- Hoja **"Pagos"**: una fila por chico, una columna por concepto activo (la lista de conceptos está en Config), con ❌ / 📎 / ✅.
- Hoja **"Revisar"**: reinscripciones sin inscripción anterior, y envíos de otros formularios con un DNI que no está en el padrón.
- Ni Buscar ni "Para Semillero" muestran **nunca** la ficha médica.
- Hoja **"Buscar"**, pensada para el celular: el coordinador escribe nombre, apellido o DNI en una sola celda arriba. Si coincide un solo chico, se ve **en vertical** (una fila por dato, cómoda en pantalla angosta): nombre, categoría, alta, cada documento con ✅/❌, cada concepto de pago con ❌/📎/✅ y el link a su carpeta. Si coinciden varios (mismo apellido), muestra la lista con su DNI para que escriba el DNI. Fórmulas `FILTRO`, `ENCONTRAR` y `TRANSPONER`; sin script.

## Planilla "Para Semillero" (pedido de cuentas-familia, prompt 08)
**Excepción aprobada por Tomás** al aprobar la spec de cuentas-familia (commit a1b7d1b de `claude/cuentas-familia-c6c955`). Acá sólo se arma la planilla; el importador es de cuentas-familia.
- **Planilla aparte**, "Para Semillero <temporada>", no una pestaña del tablero: en Sheets, *Descargar → Microsoft Excel* baja **todas** las pestañas, y el .xlsx llevaría DNIs y ficha médica. Trae los datos con `IMPORTRANGE` (sin script ni scopes nuevos) y se comparte sólo con quien importa.
- Una fila por chico del padrón de la temporada (nuevos y reinscriptos), con su última respuesta. El DNI no se muestra.
- Encabezados exactos, en este orden:

| Columna | Contenido |
|---|---|
| `Apellido` | como lo escribió el adulto |
| `Nombre` | ídem |
| `Fecha de nacimiento` | celda de fecha `dd/mm/aaaa`; para reinscriptos, de su última inscripción completa |
| `Categoría` | texto exacto del desplegable, ej. `U13 - MIXTO (2014 y 2013)` |
| `Mail del responsable` | el verificado por Google, en minúsculas |
| `Rama` | `Masculino` o `Femenino`; de la categoría si lo dice, si no de la pregunta "Rama" |

- La decisión 1 sigue valiendo para lo que protege: archivos, DNIs y ficha médica nunca salen de la cuenta del básquet. Van 6 datos sin DNI ni salud, y la descarga la hace una persona. El texto de privacidad del formulario lo dice.

## Formulario de inscripción: lo que se suma (y nada más)
- Las 3 preguntas estándar (parten "Apellido y Nombre" en dos y validan el DNI); pregunta **"Rama"** (Masculino / Femenino, obligatoria) después de la categoría; sección "Documentación" con las 6 subidas; recopilar mail verificado.
- Texto de **para qué se usan los datos y quién los ve** (borrador marcado `[VALIDAR CON COORDINACIÓN]`): lo ve sólo la coordinación del básquet; se usa para fichar en la CABB, la ficha de emergencia y cargar al chico en la app del club (nombre, fecha de nacimiento, categoría, mail); los documentos quedan en la cuenta del club.
- Casilla **no premarcada** de mails de recaudación, con el texto del checklist de `00-orden-de-trabajo.md` (`[material, viajes, …]` a completar con Javier).
- **Campos oficiales** (Tomás, 18/10): son exactamente los del formulario actual (5 secciones: identificación y contacto, perfil deportivo, académicos, ficha médica, autorizaciones) más las 6 fotos. Todos se capturan con Forms. Sobre esa lista sólo cambia: "Apellido y nombre del deportista" partido en dos, "DNI / Pasaporte" con la validación, "Rama" nueva y la sección de fotos.
- **Autorizaciones** (decisión de Tomás, abajo): recomiendo **"Consentimiento de datos" obligatoria** (sin él no corresponde guardar la ficha médica de un menor) y **"Uso de imagen" opcional**, casilla no premarcada que no bloquea la inscripción.
- **"Email del deportista"** es obligatorio y muchos chicos no tienen mail (Escuelita, U9, U11). Propuesta: opcional, con la ayuda "si es menor de 13, dejalo vacío o poné el tuyo". Decisión de Tomás.

## Fuera de scope
Conexión de Semillero con Sheets/Drive, borrado automático, mails a padres, links prellenados, rediseñar el formulario, `clasp`. El enlace de los formularios en la página pública lo resuelve portal.

**Siguiente paso (no se hace acá):** una vista dentro de Semillero con el estado de documentación y pagos de cada chico. Implica conectar Semillero con Sheets o Drive: es un prompt aparte, y mostraría sólo los estados, nunca los archivos ni el DNI.

## Reglas que no se negocian
Nunca "Publicar en la web" planillas ni respuestas. El vaciado de Drive es manual. La prueba se hace con formularios de prueba y DNIs inventados (`11111111`, `22222222`), nunca reales.

## Decisiones
- ~~¿Separar inscripción y documentación?~~ No: un solo formulario, con login y mail verificado (Tomás, 18/10).
- ~~¿Formularios de pase y aranceles?~~ Pase lo crea coordinación con la plantilla; aranceles lo dejamos armado (Tomás, 18/10).
- ~~Lista de campos de la CABB~~ Los del formulario actual + 6 fotos (Tomás, 18/10).
- **Pendientes de Tomás:**
  1. Carpeta por chico para siempre (`Jugadores/…`) en vez de una por temporada.
  2. Barrido cada 10 minutos en vez de disparador al enviar.
  3. ¿La CABB pide fotos del DNI cada temporada?
  4. Link a la carpeta por búsqueda de Drive (recomendado) o directo (suma scope `spreadsheets`).
  5. Consentimiento de datos obligatorio, uso de imagen opcional (recomendado).
  6. Email del deportista opcional para menores (recomendado) u obligatorio con el del adulto.
