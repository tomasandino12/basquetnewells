# Prompt para Claude en el navegador: armar inscripción y documentación en Google

**Para Tomás (esto no es parte del prompt).**

1. Abrí Chrome con la sesión de la **cuenta de la Comisión Básquet** ("Club Atlético Newell's Old Boys Comisión Básquet") y abrí Claude en el navegador. Si hay otra cuenta abierta, cambiá a la de la Comisión antes de empezar.
2. Tené a mano estos archivos de este repo para **pegárselos cuando te los pida** (no hace falta que se los des todos de entrada): `google/formularios/FORMULARIOS.md`, `google/sheets/TABLERO.md`, `google/GUIA.md`, y los de `google/apps-script/`, `google/apps-script-tablero/` y `google/apps-script-semillero/` (`.gs` y `appsscript.json`). Para la etapa 5b hace falta el **token** de Semillero: lo generás vos con el coordinador (*Coordinación → Familias → Papeles y pagos → Conectar con Google*) y lo pegás **vos** en las Propiedades del script; no se lo des a Claude. Tené también a mano: el **link del formulario "Base de Datos Básquet NOB 2026"**, los **mails de coordinación** con quienes se comparten las carpetas y las planillas, y una **foto cualquiera** (no de un chico real) para las pruebas.
3. Copiá todo lo que está **debajo de la línea** y pegalo como primer mensaje. Claude va a ir por etapas y te va a pedir cosas. Los permisos de los scripts los aceptás **vos**.

Qué hace cada pieza y por qué: `docs/superpowers/specs/2026-10-19-formularios-v2-design.md`.

---

Sos mi asistente en el navegador. Vas a armar, **en Google**, el sistema de inscripción y documentación del básquet de Newell's. Trabajamos juntos, por etapas, y **en cada etapa verificás lo que hiciste antes de pasar a la siguiente**. Hay datos de menores en juego: la privacidad no es opcional.

## Reglas (valen en todas las etapas)

1. **Sólo la cuenta de la Comisión Básquet.** Antes de empezar, mirá qué cuenta está abierta en Drive. Tiene que ser "Club Atlético Newell's Old Boys Comisión Básquet". Si no, pará y avisame. No cambies de cuenta por tu cuenta, no inicies sesión con ninguna otra y no uses contraseñas: si hay que iniciar sesión, lo hago yo.
2. **Sólo lo pedido.** Si una etapa no dice que hagas algo, no lo hagas. No "mejores", no ordenes, no limpies nada que no hayas creado vos en esta sesión.
3. **No toques nada de lo que ya existe.** Hay formularios, planillas y carpetas viejos (de esta cuenta y de otras). No los muevas, no los copies, no los edites, no los renombres, no los borres y **no cambies sus permisos**. Si algo viejo te parece un riesgo (por ejemplo una carpeta pública), no lo arregles: anotalo para el informe final.
4. **Nunca abras ni copies datos de menores.** No abras la pestaña de respuestas de ningún formulario o planilla existente. Si por accidente ves nombres, DNIs o datos de salud, no los copies, no los repitas en el chat y no los uses. Tampoco los pegues en ningún lado. Cuando uses ejemplos o pruebas, usá **sólo DNIs inventados** (`11111111`, `22222222`, `33333333`) y nombres de mentira (`PRUEBA, Uno`).
5. **Nunca publiques nada en la web.** No uses *Archivo → Compartir → Publicar en la web* en ninguna planilla ni formulario, no pongas ninguna carpeta ni planilla en "cualquiera con el link" y no mandes invitaciones ni mails. Las carpetas y planillas se comparten **sólo con las personas de coordinación cuyos mails te dé yo**. Si no te los doy, las dejás privadas.
6. **Los permisos de los scripts los acepto yo.** Cuando Google muestre una pantalla de "Revisar permisos" o "Google no verificó esta aplicación", pará, leé en voz alta qué permisos pide y esperá a que yo toque los botones. Compará lo que pide con la tabla de la etapa y avisame si pide algo de más.
7. **Nada de borrar de verdad.** No vacíes papeleras ni elimines nada de forma definitiva. Para la limpieza final (etapa 7) me vas a pedir permiso por cada cosa.
8. **Ante cualquier duda, pará y preguntame.** Eso incluye: algo que no existe en Google, una fórmula que da error y no sabés por qué, un permiso inesperado, un texto que no coincide con los archivos o cualquier cosa que no figure acá. No inventes una alternativa.
9. **Los textos son los de los archivos, tal cual.** Los títulos de las preguntas tienen que ser **idénticos** a los de `FORMULARIOS.md` (mayúsculas, tildes, paréntesis y espacios). Un título distinto rompe las planillas y el script.
10. **No copies al chat datos sensibles.** Tampoco un token: si aparece alguno en pantalla, no lo repitas. Cuando verifiques, mostrame cantidades y estados (✅/❌, "7 preguntas", "sin errores"), no contenido de respuestas.

## Etapa 0 — Chequeo inicial

1. Mostrame la cuenta abierta y esperá mi confirmación.
2. Pedime los archivos que vayas a necesitar de a uno por etapa (te indico cuáles en cada una). Si no tengo uno, me lo decís y seguimos con lo que se pueda, sin inventar.
3. Armá un resumen de lo que vas a hacer y esperá mi OK.

## Etapa 1 — Carpetas

Pedime `google/GUIA.md`. En **Mi unidad** de la cuenta de la Comisión:
1. Creá la carpeta **`Inscripción y documentación`**.
2. Adentro, **`Formularios con archivos`** y **`Jugadores`**.
3. Compartilas **sólo con los mails de coordinación que te dé** (editor). Sin vínculo público.
4. Anotá el **ID** de `Formularios con archivos` y de `Jugadores` (lo que va después de `folders/` en la URL). Los vas a necesitar en la etapa 4.

**Chequeo:** abrí *Compartir* de cada carpeta y confirmá que el acceso general dice "Restringido". Las dos carpetas tienen que estar adentro de `Inscripción y documentación`.

## Etapa 2 — Formularios

Pedime `google/formularios/FORMULARIOS.md` y construí **cinco formularios** exactamente como dice, con todos sus ajustes:

| Formulario | Carpeta | Login |
|---|---|---|
| Comprobante de pago | `Formularios con archivos` | sí (mail verificado) |
| Inscripción | `Formularios con archivos` | sí |
| Plantilla | `Formularios con archivos` | sí |
| Quiero jugar en Newell's | `Inscripción y documentación` | no |
| Quiero colaborar | `Inscripción y documentación` | no |

Cosas a cuidar:
- **Orden de las preguntas = orden de la tabla.** La letra `Col` es la columna que va a tener en la planilla de respuestas; si el orden cambia, se rompe el Tablero.
- **Inscripción:** respetá las 9 secciones y los saltos de la tabla "Los dos caminos". En Forms el salto se configura en la pregunta de opción múltiple (*⋮ → Ir a la sección según la respuesta*) y se aplica al tocar *Siguiente*. Las 12 subidas de archivo (6 + 6) son **obligatorias** en esta primera temporada. *Alertas médicas* es obligatoria y trae la opción **Ninguna**. Las casillas de autorización (imagen, emergencias, recaudación) van **sin premarcar**.
- **Subir archivo:** 1 archivo, imagen o PDF, máximo 10 MB, con su texto de ayuda. Si Forms pregunta dónde guardar, dejá lo que propone por defecto; el script de la etapa 4 mueve los archivos.
- **Validación con expresión regular** donde la tabla la indica (DNI y teléfonos), con su mensaje.
- **Ajustes de los que tienen login:** *Configuración → Respuestas → Recopilar direcciones de correo electrónico = Verificado*; **no** limitar a una respuesta; **no** permitir editar después de enviar.
- **Nunca** generes links prellenados con datos de un chico.
- **Quiero jugar en Newell's:** armala con la tabla de `FORMULARIOS.md`. La sección informativa con el cronograma por categoría la copiás del texto que yo te pegue; **no abras ni copies nada del formulario "Inscripciones Básquet NOB 2026"**.
- **Textos legales:** en la sección de privacidad de la Inscripción hay una marca `[VALIDAR CON COORDINACIÓN]` y en la casilla de recaudación hay un texto entre corchetes (`[material, viajes, …]`). **No pegues esos corchetes tal cual.** Dejá esas preguntas con el texto, pero avisame y anotalo en el informe: son borradores que coordinación tiene que validar antes de repartir el link. La casilla *Emergencias en Semillero* se pega exacta, sin cambios.
- Dejá los formularios **sin vincular** a ninguna planilla todavía (eso es la etapa 3). No los publiques ni los envíes a nadie.

**Chequeo, formulario por formulario:** con *Vista previa*, recorré el formulario y confirmá: cantidad de preguntas por sección igual a la tabla, títulos idénticos, obligatorias correctas, saltos probados (en la Inscripción, probá "Sí" y "No" en la primera pregunta y mirá a qué sección va cada uno). Decime ✅/❌ por formulario. **No envíes respuestas todavía.**

## Etapa 3 — Planillas y Tablero

Pedime `google/sheets/TABLERO.md`.

1. Creá, en `Inscripción y documentación`, la planilla **`Tablero 2026`**. *Archivo → Configuración → Configuración regional = Argentina* (esto es imprescindible: las fórmulas están escritas en español, con `;`).
2. Vinculá **sólo** la Inscripción y el Comprobante de pago a esta planilla (*Respuestas → Vincular con Hojas → Seleccionar hoja de cálculo existente*). Renombrá las pestañas nuevas exactamente `Inscripción` y `Comprobantes`.
3. Vinculá Quiero jugar y Quiero colaborar a **planillas propias nuevas** (*Crear una hoja de cálculo nueva*), dentro de `Inscripción y documentación`. **Nunca al Tablero.**
4. Creá las hojas del Tablero que `TABLERO.md` lista en el punto 1 y pegá los encabezados y las fórmulas **tal cual**, **en este orden**: `Config`, `Base`, `Tablero`, `Pagos`, `Pagos verificados`, `Entregas a mano`, `Correcciones 2026`, `Buscar`. Todavía **no** pegues `Faltan reinscribir`, `Revisar`, `Salida Semillero`, `Aux emergencias` ni `Salida Emergencias`: dependen de la hoja `Inscripción 2026`, que crea el script de la etapa 5.
   - `Config!B2` (inicio de temporada): preguntame la fecha. `Config!A13:A22`: preguntame los conceptos de pago activos.
5. Compartí el Tablero **sólo con coordinación** (mismos mails). Sin vínculo público. Nunca *Publicar en la web*.

**Chequeo:** ninguna celda con `#NAME?`, `#REF!` ni `#ERROR!` (con las respuestas vacías, un `#N/A` o una hoja en blanco es normal; un error de nombre de función no). Si hay error de nombre, probablemente la regional no es Argentina. Revisá `Buscar` con un valor cualquiera: no tiene que romperse. Decime qué hojas quedaron OK.

## Etapa 4 — Script de carpetas (permisos: los acepto yo)

Pedime los archivos de `google/apps-script/` (`nombres.gs`, `organizar.gs`, `config.gs`, `appsscript.json`).
1. En script.google.com, **Nuevo proyecto** `Organizar archivos de formularios`. En *Configuración del proyecto*, tildá "Mostrar el archivo de manifiesto appsscript.json".
2. Pegá los cuatro archivos tal cual. En `config.gs`, reemplazá los dos `PEGAR_ID_…` por los IDs de la etapa 1. **No cambies nada más del código.**
3. Elegí `instalar` → Ejecutar. Cuando aparezca la pantalla de permisos, **pará y avisame**. Los permisos esperados son exactamente tres: formularios, Drive (todos los archivos) y "ejecutar cuando no estás". **Si pide Gmail, Calendar, Contactos o cualquier otra cosa, no sigas y avisame.** Yo los acepto.
4. Después de la instalación, abrí *Activadores* y confirmá que hay **un solo** disparador (cada 10 minutos).

## Etapa 5 — Script del Tablero (permisos: los acepto yo)

Pedime los archivos de `google/apps-script-tablero/` (`config.gs`, `fila2026.gs`, `importar2026.gs`, `appsscript.json`) y el **link del formulario "Base de Datos Básquet NOB 2026"**.
1. En el Tablero: *Extensiones → Apps Script*. Mostrá el manifiesto. Pegá los cuatro archivos tal cual.
2. En `config.gs`, reemplazá `PEGAR_ID_DEL_FORMULARIO_2026` por el ID del formulario (lo que va entre `/forms/d/` y `/edit` del link que te dé). **No abras el formulario 2026 ni sus respuestas; sólo necesitás el ID.**
3. Elegí `actualizar2026` → Ejecutar. Pará en la pantalla de permisos y avisame. Los permisos esperados son **dos**: formularios y "esta hoja de cálculo" (`spreadsheets.currentonly`). **Si pide Drive, Gmail u otra cosa, no sigas.** Yo los acepto.
4. Cuando termine, mirá *Ejecuciones*: el registro tiene que decir sólo cantidades. **Leeme los números (respuestas, chicos, salteadas, con emergencias, a revisar); no leas nombres ni DNIs.**
5. Verificá que el Tablero ahora tiene las hojas `Inscripción 2026`, `Semillero 2026`, `Emergencias 2026` y `Revisar 2026`, con la cantidad de filas del registro. **No abras filas ni leas su contenido**: sólo contá.
6. Ahora sí, creá y pegá las hojas que faltaban: `Faltan reinscribir`, `Revisar`, `Aux emergencias`, `Salida Semillero`, `Salida Emergencias`. Chequeo igual que en la etapa 3.
7. Creá las planillas aparte **`Para Semillero 2026`** y **`Emergencias para Semillero 2026`** (en `Inscripción y documentación`) con el `IMPORTRANGE` de `TABLERO.md` punto 9.3. Cuando aparezca "Permitir acceso", pará y avisame para que lo apruebe yo. Compartilas sólo con quien yo te diga.

**Chequeo:** los encabezados de las dos planillas son idénticos a los de `TABLERO.md` (6 y 9 columnas); no hay ninguna columna de DNI, domicilio, afiliado ni grupo sanguíneo; la columna de fecha tiene formato `dd/mm/aaaa`.

## Etapa 5b — Script de envío a Semillero (permisos y token: los pongo yo)

Pedime los archivos de `google/apps-script-semillero/` (`config.gs`, `estado.gs`, `semillero.gs`, `appsscript.json`) y el **link del Tablero**. Es un proyecto **aparte** de los otros dos (una planilla admite un solo script atado, y este no debe sumar permisos a los demás).
1. En script.google.com, **Nuevo proyecto** `Enviar estado a Semillero`. Mostrá el manifiesto. Pegá los cuatro archivos tal cual.
2. En `config.gs`, reemplazá `PEGAR_ID_DEL_TABLERO` por el ID del Tablero (lo que va entre `/d/` y `/edit`). **No cambies nada más**: la URL y la clave pública de Semillero ya están puestas.
3. **El token no lo ves ni lo escribís vos.** Lo genera el coordinador en Semillero y lo pego yo en *Propiedades del script* (`SEMILLERO_TOKEN`). Si en algún momento ves un token en pantalla, no lo copies ni lo repitas. Avisame cuando el proyecto esté listo y esperá a que te diga que ya lo pegué.
4. Elegí `instalarEnvio` → Ejecutar. Pará en la pantalla de permisos y avisame. Los permisos esperados son **tres**: ver tus hojas de cálculo (`spreadsheets.readonly`), conectarse a un servicio externo (`script.external_request`) y ejecutar cuando no estoy (`script.scriptapp`). **Si pide Drive, formularios, Gmail u otra cosa, no sigas.** Yo los acepto.
5. Cuando yo te diga que el token está pegado, elegí `enviarEstadoAhora` → Ejecutar y mirá *Ejecuciones*: tiene que decir `Enviado. filas: …` con cantidades. **Leeme el resumen; no leas nombres ni DNIs.** Si dice `TOKEN_INVALIDO` o `Faltan hojas`, avisame y no lo arregles por tu cuenta.
6. Abrí *Activadores* y confirmá que hay **un solo** disparador de `enviarEstado` (cada 15 minutos).

**Chequeo:** el proyecto no tiene ninguna propiedad con el token escrita por vos, los permisos fueron los tres esperados y el registro de la primera ejecución sólo tiene cantidades.

## Etapa 6 — Prueba con DNIs inventados

Pedime la sección 8 de `google/GUIA.md` ("Prueba manual") y seguila **paso por paso**, con estas condiciones:
- Sólo DNIs inventados y nombres de mentira. Las fotos de las subidas las pongo yo, con una imagen cualquiera (nada real); si no podés subir archivos desde el navegador, decímelo y esa parte la hago yo.
- Para enviar un formulario de prueba, **pedime confirmación cada vez**.
- Si el paso 4 requiere una fila de prueba en `Inscripción 2026`, anotala a mano con el DNI inventado y acordate de sacarla en la limpieza.
- Después de cada envío esperá hasta 10 minutos o corré `barrerAhora`.
- Anotá ✔/✘ por paso. Si un paso falla, parate y mostrame el error: no lo "arregles" por tu cuenta.

## Etapa 7 — Limpieza de lo de prueba (con mi permiso, cosa por cosa)

Hacé una **lista exacta** de lo que creó la prueba y nada más: las filas con DNI inventado en las pestañas de respuestas, en `Entregas a mano`, en `Pagos verificados` y en `Inscripción 2026`, las carpetas `PRUEBA, Uno — 11111111` y `PRUEBA, Dos — 22222222` y cualquier formulario de prueba que hayas copiado. Mostrame la lista y esperá mi OK. Para cada cosa: mandala a la **papelera** (no vacíes la papelera: eso lo hago yo). No toques nada que no esté en la lista.

## Etapa 8 — Informe final

Entregame **un mensaje** con:
1. **Links** (solo links, ningún dato de chicos): cada uno de los cinco formularios (el link para que las familias respondan, el de edición aparte), el Tablero, "Para Semillero 2026", "Emergencias para Semillero 2026", las dos planillas de respuestas propias (Quiero jugar y Quiero colaborar), la carpeta `Inscripción y documentación`, `Formularios con archivos` y `Jugadores`, y los tres proyectos de Apps Script.
2. **Los IDs** de las dos carpetas, del formulario 2026 y del Tablero que quedaron puestos en los `config.gs`.
3. **Resultado de la prueba**: ✔/✘ por paso de la guía.
4. **Pendientes**: los textos que quedaron en borrador (privacidad, recaudación), lo que no pudiste hacer y por qué.
5. **Riesgos que viste en cosas existentes** y no tocaste (por ejemplo carpetas públicas), para que decida yo.
6. **Todo lo que hiciste**, en una lista corta, para que yo pueda revisar que no hayas hecho nada de más.

Empezá por la Etapa 0.
