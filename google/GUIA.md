# Guía: dejar andando inscripción y documentación en Google

Para quien instala (Tomás o coordinación). Pasos numerados, sin saber programar. Qué hace cada cosa y por qué: `docs/superpowers/specs/2026-10-19-formularios-v2-design.md`. Para que **Claude en el navegador** lo arme todo, el prompt está en `google/PROMPT-NAVEGADOR.md`; esta guía es lo mismo, a mano.

**Todo se hace desde la cuenta de la Comisión Básquet** ("Club Atlético Newell's Old Boys Comisión Básquet"), en **Mi unidad**, no desde una cuenta personal. Los DNIs, las fotos y la ficha médica **no salen de esa cuenta**, y **nada se publica en la web** (nunca *Publicar en la web*).

**No se toca nada de lo que ya existe.** Los formularios y planillas viejos (los de la cuenta newells.basquet, la planilla "Base de Datos Básquet NOB 2026", la carpeta de fotos del desfile) **no se mueven, no se copian, no se editan y no se les cambian los permisos**. Lo nuevo se crea aparte. Si algo viejo parece un riesgo, se anota para decidirlo después; no se arregla acá.

Piezas: una carpeta `Inscripción y documentación` con adentro las carpetas de Drive · cinco formularios · una planilla "Tablero" · dos planillas para Semillero · dos scripts (uno mueve cada archivo a la carpeta del chico; otro lee las respuestas de 2026).

---

## 1. Primera temporada: los datos de 2026 cuentan

El formulario "Base de Datos Básquet NOB 2026" ya tiene la ficha de este año (unos 100 chicos). **No se importan sus respuestas a mano ni se toca el formulario.** Un script del Tablero (punto 5) **lee** esas respuestas y arma la hoja `Inscripción 2026`. A quien contesta "Sí, ya completé la ficha en 2026" en la Inscripción nueva **no se le piden de nuevo** nacionalidad, socio, grupo sanguíneo, perfil deportivo ni alturas de los padres. Lo que sí se pide a todos: fotos (nadie las subió en 2026, así que esta temporada las 6 son obligatorias), contacto y emergencia, escuela, fecha de nacimiento y autorizaciones.

## 2. Crear carpetas

En Drive, con la cuenta de la Comisión, en **Mi unidad**:
1. Carpeta **`Inscripción y documentación`**. Todo lo nuevo vive adentro.
2. Adentro, carpeta **`Formularios con archivos`**. Van los formularios que suben archivos: Inscripción, Comprobante de pago y la Plantilla (y las copias de la plantilla).
3. Adentro, carpeta **`Jugadores`**. El script crea adentro una carpeta por chico: `APELLIDO, Nombre — DNI`, con sus DNIs, fotos y comprobantes.
4. **Compartir las carpetas sólo con coordinación.** Nada de "cualquiera con el link".
5. Anotar los **IDs** de `Formularios con archivos` y de `Jugadores`: abrirlas y copiar lo que va después de `folders/` en la barra de direcciones.

## 3. Crear los formularios y el Tablero

1. Armar los formularios **nuevos** según `google/formularios/FORMULARIOS.md`: Quiero jugar en Newell's, Inscripción, Comprobante de pago, Plantilla y Quiero colaborar. Cada uno, dentro de su carpeta (Inscripción, Comprobante y Plantilla en `Formularios con archivos`; Quiero jugar y Quiero colaborar en `Inscripción y documentación`).
2. Armar la planilla **Tablero** con `google/sheets/TABLERO.md` (también dentro de `Inscripción y documentación`) y vincular sólo Inscripción y Comprobante de pago.
3. Los otros dos formularios van a **planillas propias** (*Respuestas → Vincular con Hojas → Crear una hoja nueva*), nunca al Tablero.
4. Crear aparte **"Para Semillero 2026"** y **"Emergencias para Semillero 2026"** (punto 9 de `TABLERO.md`).

## 4. Instalar el script de carpetas

Mueve cada archivo que sube una familia a la carpeta del chico.

1. En **script.google.com**, con la cuenta de la Comisión: **Nuevo proyecto**. Nombre: `Organizar archivos de formularios`.
2. En *Configuración del proyecto* (la ruedita) tildar **"Mostrar el archivo de manifiesto appsscript.json"**.
3. Pegar cada archivo de `google/apps-script/`: `nombres.gs`, `organizar.gs`, `config.gs` (archivos nuevos con **+ → Script**) y el contenido de `appsscript.json` en el manifiesto.
4. En `config.gs`, reemplazar los dos `PEGAR_ID_…` por los IDs del punto 2.5.
5. En el desplegable de funciones elegir **`instalar`** → **Ejecutar**.
6. Google pide permisos (*Revisar permisos → elegir la cuenta de la Comisión → Avanzado → Ir a … → Permitir*). Esta pantalla "no verificada" es normal: es un script propio. **Los acepta Tomás.**

| Permiso | Para qué |
|---|---|
| Ver y administrar tus formularios | Abrir los formularios de la carpeta y leer qué archivos subió cada familia |
| Ver, editar, crear y borrar **todos** tus archivos de Drive | Listar la carpeta, crear las carpetas de los chicos, mover y renombrar. Tiene que ser el permiso amplio: los archivos los crea Forms, no el script. **El script no borra nada** |
| Permitir que el script se ejecute cuando vos no estás | Crear el disparador que revisa cada 10 minutos |

No pide Sheets ni Gmail. Si más adelante Google pide un permiso nuevo, no aceptarlo sin revisar por qué.

7. Correr `instalar` otra vez no duplica el disparador. Para forzar un barrido sin esperar: ejecutar `barrerAhora`. Los errores se ven en *Ejecuciones*.

## 5. Instalar el script del Tablero (los datos de 2026)

Es **otro proyecto**, atado a la planilla Tablero, así el de carpetas no gana permisos. Lee las respuestas del formulario 2026 y arma las hojas `Inscripción 2026`, `Semillero 2026`, `Emergencias 2026` y `Revisar 2026` (qué tiene cada una: `TABLERO.md`, punto 13).

1. Abrir el **Tablero** → *Extensiones → Apps Script*. Tildar **"Mostrar el archivo de manifiesto appsscript.json"**.
2. Pegar `config.gs`, `fila2026.gs` e `importar2026.gs` de `google/apps-script-tablero/` y el contenido de su `appsscript.json` en el manifiesto.
3. En `config.gs`, reemplazar `PEGAR_ID_DEL_FORMULARIO_2026` por el ID del formulario "Base de Datos Básquet NOB 2026": está en la URL del editor, entre `/forms/d/` y `/edit`. Para eso hace falta tener acceso de lectura al formulario (se lo da su dueño); **no hay que editarlo**.
4. Elegir **`actualizar2026`** → **Ejecutar**. Google pide permisos; **los acepta Tomás**:

| Permiso | Para qué |
|---|---|
| Ver y administrar tus formularios | Leer las respuestas del formulario 2026. Google no ofrece un permiso "sólo leer" para formularios; el código sólo lee y un test lo controla |
| Ver y administrar **esta** hoja de cálculo | Escribir sólo en el Tablero. No puede abrir ninguna otra planilla |

No usa Drive ni mail, y los datos no salen de la cuenta de la Comisión. Se corre **a mano**, sin disparador, las veces que haga falta.
5. Mirar *Ejecuciones*: el registro dice sólo cantidades (respuestas, chicos, salteadas, con emergencias, a revisar), nunca nombres ni DNIs. Las filas con el apellido y el nombre dudosos aparecen en `Revisar 2026`; se corrigen en `Correcciones 2026` y se vuelve a correr.

## 5b. Instalar el script de envío a Semillero (el panel de papeles y pagos)

Hace que el coordinador vea en Semillero (Coordinación → Familias → **Papeles y pagos**) quién tiene los documentos y quién pagó, sin abrir la planilla. Es un **tercer proyecto**, **propio** (no atado a la planilla: el Tablero ya tiene el script de la sección 5, y una planilla admite uno solo). Lee el Tablero y le manda a Semillero **sólo el estado**: documento ✅/❌, pago por concepto (falta / comprobante subido / verificado), el número de fila y la fecha en que cambió. **Nunca** DNIs, archivos, mails, links ni datos médicos: el script ni siquiera lee la columna DNI.

**Quién hace qué.** El proyecto lo arma quien instala (puede ser Claude en el navegador). El **token** lo genera el coordinador en Semillero y lo pega **Tomás**: el agente del navegador nunca lo ve ni lo escribe.

1. En script.google.com (con la cuenta de la Comisión): **Nuevo proyecto** `Enviar estado a Semillero`. Tildar "Mostrar el archivo de manifiesto appsscript.json".
2. Pegar `config.gs`, `estado.gs` y `semillero.gs` de `google/apps-script-semillero/` y el contenido de su `appsscript.json`.
3. En `config.gs`, reemplazar `PEGAR_ID_DEL_TABLERO` por el ID del Tablero (en su URL, entre `/d/` y `/edit`). **No cambiar nada más.** Los otros dos datos (`SEMILLERO_URL` y la clave pública) ya están puestos: son públicos y sin el token no sirven.
4. **Token (lo hace Tomás con el coordinador).** En Semillero: *Coordinación → Familias → Papeles y pagos → Conectar con Google*. Aparece un token **una sola vez**: copiarlo. En el proyecto: *Configuración del proyecto → Propiedades del script → Agregar propiedad* `SEMILLERO_TOKEN` = el token. Cerrar la hoja de Semillero. Si el token se pierde o se filtra: *Cambiar el token* (el anterior deja de servir en el acto) o *Desconectar* (borra también todo el estado).
5. Elegir **`instalarEnvio`** → **Ejecutar**. Google pide permisos; **los acepta Tomás**:

| Permiso | Para qué |
|---|---|
| Ver tus hojas de cálculo | Leer el Tablero, `Pagos` y `Salida Semillero`. Es de **sólo lectura** pero de **todas** las planillas de la cuenta (Google no ofrece uno por planilla fuera de un script atado). El código abre una sola, por su ID, y un test lo controla |
| Conectarse a un servicio externo | Mandar el estado a Semillero. El manifiesto (`urlFetchWhitelist`) hace que Google **bloquee cualquier otra dirección**: sólo puede llamar a la función de Semillero |
| Ejecutar cuando no estás | El disparador, cada 15 minutos |

No pide Drive, formularios ni mail. Si Google pide algo más, no aceptarlo sin revisar por qué.
6. Elegir **`enviarEstadoAhora`** → Ejecutar. En *Ejecuciones* el registro dice sólo cantidades (`Enviado. filas: …`), nunca nombres ni el token. Si dice `TOKEN_INVALIDO`, el token no está bien pegado o ya se cambió. Si dice `El Tablero no tiene chicos legibles`, hay una fórmula rota y **no se manda nada** (a propósito: Semillero reemplaza todo el estado y borraría lo que tiene).
7. En *Activadores* tiene que haber **un solo** disparador de `enviarEstado` (cada 15 minutos).
8. Mirar el panel en Semillero (Coordinación → Familias → Papeles y pagos): "Último envío hace unos minutos" y los chicos del Tablero. Los chicos con ficha en Semillero que no están en el Tablero aparecen en "No figuran en el tablero"; los del Tablero sin ficha, en "En Google, no en Semillero".

Los **conceptos de pago nuevos** (un encabezado más en `Pagos`) aparecen solos en el panel en el siguiente envío. Si el panel dice que hace más de 2 horas que Google no manda nada, revisar *Ejecuciones* del proyecto.

## 6. Sumar un formulario o un pago nuevo

**Un pago nuevo y simple** (ej. "Pantalón de entrenamiento") **no necesita formulario**: sumar la opción al desplegable `Concepto` del Comprobante de pago y una fila en `Config` del Tablero (`A13:A22`). Nada más.

**Un pago que pide algo más** (talle, cantidad de rifas) o un trámite (pase):
1. En `Formularios con archivos`, **Hacer una copia** de la Plantilla y ponerle nombre (ej. "Rifa día del niño 2026").
2. Sumar las preguntas con el título que se quiere ver en el nombre del archivo (ej. "Comprobante rifa"). Con una pregunta titulada exactamente `Concepto`, su respuesta se suma al nombre.
3. *Respuestas → Vincular con Hojas* → la planilla Tablero (queda una pestaña nueva; renombrarla).
4. En el Tablero: si es un pago, una columna nueva en `Pagos` ("pago con formulario propio", `TABLERO.md` punto 5b); si es un documento, una columna al lado de `Carpeta` (punto 11).
5. Probarlo con un DNI inventado y esperar 10 minutos.

## 7. Bajar la carpeta de un chico (para la CAB)

Todo lo del chico queda en `Jugadores/APELLIDO, Nombre — DNI`: DNIs, fotos y comprobantes, sin pasar por WhatsApp.

- **En la compu (lo más fácil):** abrir `Jugadores` en Drive → clic derecho sobre la carpeta del chico → **Descargar**. Baja un archivo `.zip` con todo adentro.
- **En el celular:** la app de Drive **no baja carpetas enteras**, sólo archivos sueltos. Conviene hacerlo en la compu, o bajar de a uno los archivos que la CAB pide.

Esa carpeta no se comparte con nadie fuera de coordinación: se baja y se manda directo a quien la pide.

## 8. Prueba manual (antes de abrir a las familias)

**Usar sólo DNIs inventados (`11111111`, `22222222`) y formularios de prueba (copias).** Nunca datos reales. Anotar ✔ o ✘ en cada paso. Tras cada envío, esperar hasta 10 minutos o correr `barrerAhora`.

Preparación: copiar los formularios Inscripción y Comprobante de pago como pruebas dentro de `Formularios con archivos`, vincularlos al Tablero. En `Config` poner el inicio de temporada anterior a hoy y un concepto activo (ej. `Arancel prueba`, que también esté en el desplegable). Usar una foto cualquiera para las subidas. En `Inscripción 2026`, anotar a mano una fila de prueba con el DNI `22222222` (para el paso 4); se borra al terminar.

1. **Mismo DNI desde dos formularios → misma carpeta.** Enviar la Inscripción con "No", DNI `11111111`, apellido `Prueba`, nombre `Uno`, subiendo las 6 fotos. Después enviar el comprobante con el mismo DNI. En `Jugadores/` tiene que haber **una sola** carpeta `PRUEBA, Uno — 11111111` con los archivos, con nombres tipo `DNI jugador - frente - PRUEBA - 2026-10-18 14.30.jpg`.
2. **Reenvío → dos archivos.** Volver a enviar la Inscripción con el mismo DNI y la misma pregunta. Quedan **los dos** archivos (fechas distintas), no se pisan ni se borra nada.
3. **Formulario nuevo sin tocar código.** Copiar la plantilla, sumar una pregunta de archivo "Comprobante prueba", ponerla en `Formularios con archivos`, enviar con el DNI `11111111`. Aparece el archivo en la misma carpeta, sin editar el script.
4. **Dos caminos de la Inscripción.** Enviar con "Sí" y DNI `22222222` (el que está en `Inscripción 2026`): el formulario **no pide** nacionalidad ni socio, **sí pide** las 6 fotos y la fecha de nacimiento, y pregunta si cambió algo de salud. En el Tablero tiene **Alta = Reinscripción**. Enviar con "Sí" y un DNI que no está en 2026 (ej. `33333333`): aparece en la hoja `Revisar`.
5. **Alertas médicas obligatorias.** En un camino con la sección Salud, intentar enviar sin marcar nada en *Alertas médicas*: el formulario **no deja**. Marcar **Ninguna** y sigue.
6. **Comprobante de pago → 📎, y ✅ al verificarlo.** Enviar el comprobante con `11111111` y concepto `Arancel prueba`. En `Pagos` aparece **📎**. Anotar en `Pagos verificados` una fila (`11111111`, `Arancel prueba`, fecha, quién). Pasa a **✅**. Repetir con el formulario propio del paso 3 (columna "pago con formulario propio").
7. **Buscar con DNI y con un apellido repetido.** Cargar un segundo chico `Prueba, Dos` (DNI `22222222`). Desde el **celular**, en `Buscar`: escribir `11111111` → se ve **un** chico en vertical, con documentos, pagos y el botón "Abrir carpeta". Escribir `Prueba` → aparece la **lista** de los dos con su DNI; escribir el DNI de uno → vuelve el detalle.
8. **Tablero ✅/❌ correcto, incluida una entrega a mano.** Para `11111111`: ✅ en lo que se subió, ❌ en el resto; **Completo** ❌ si falta algo. En `Entregas a mano` anotar una fila (`11111111`, un documento que falte, hoy, tu nombre): esa columna pasa a ✅.
9. **DNI con puntos rechazado.** En el formulario, escribir `11.111.111`: **no deja enviar** y muestra "Sólo números, sin puntos (7 u 8 dígitos)".
10. **Para Semillero y Emergencias.** En "Para Semillero": encabezados `Apellido | Nombre | Fecha de nacimiento | Categoría | Mail del responsable | Rama`, sin DNI ni salud, fecha `dd/mm/aaaa`. En "Emergencias para Semillero": los 9 encabezados de `TABLERO.md` 9.2, sin DNI. Sólo aparece quien tildó **Emergencias en Semillero** (o, de 2026, quien dio el consentimiento).
11. **Quiero jugar y Quiero colaborar sin login.** Abrir los dos con una ventana privada: se completan sin entrar con Google, y sus respuestas van a su propia planilla, no al Tablero.
12. **Script del Tablero.** Correr `actualizar2026`: `Inscripción 2026` tiene una fila por DNI, sin duplicados. El formulario 2026 **no cambió** (sin respuestas nuevas ni preguntas modificadas).
13. **Nada público.** Con la sesión cerrada (ventana privada), abrir el link de una carpeta, del Tablero y de las planillas de Semillero: tiene que pedir permiso, no mostrar nada.
14. **Envío a Semillero.** Con el script de la sección 5b instalado: en el panel *Papeles y pagos*, `11111111` aparece con ✅ en los documentos que se subieron y el concepto `Arancel prueba` en 📎 o ✅ según el paso 6. Cambiar el token en Semillero: el siguiente envío falla con `TOKEN_INVALIDO` hasta pegar el nuevo. **Desconectar** al terminar la prueba, para que la fila de prueba no quede en el panel.
15. Si algo falló: *Ejecuciones* del script (errores) y el punto 12 de `TABLERO.md`.

Al terminar: **borrar los formularios de prueba, las respuestas de prueba, las filas de prueba de `Inscripción 2026` y las carpetas `PRUEBA…` y `…Dos`** (vaciado manual, punto 10).

## 9. Guía corta para padres sin cuenta de Google

El texto completo, para pegar en un Google Doc de la Comisión, está en `google/formularios/PADRES.md`. En una frase: **se crea una cuenta de Google con el mail que ya tienen (Hotmail, Yahoo…), sin abrir un Gmail**; si no pueden, entregan los papeles al coordinador, que los sube a la carpeta del chico y lo anota en `Entregas a mano`. Pegar el link del Doc en la descripción de cada formulario y pedirle a portal que lo enlace desde la página pública (eso no se hace acá).

## 10. Vaciado manual

El script nunca borra. Los DNIs de un chico quedan en su carpeta mientras juegue en el club. Cuando se va:
1. Abrir `Jugadores/<APELLIDO, Nombre — DNI>` y **eliminar la carpeta** (y vaciar la papelera de Drive).
2. En las pestañas de respuestas, borrar a mano las filas de ese DNI (las pestañas son de sólo lectura para el tablero; borrar filas es lo único que se les hace). También en `Correcciones 2026`.
3. Quitar sus filas de `Entregas a mano` y `Pagos verificados`.

Es una tarea de coordinación, hecha a mano y a conciencia: no hay borrado automático a propósito.

## 11. Fuera de esta guía (anotado para después)

Cerrar la carpeta pública de fotos del desfile, despublicar los formularios viejos y revisar los permisos de la cuenta newells.basquet. El relevamiento de la cuenta los marca como riesgo; Tomás decidió no tocar nada existente todavía.
