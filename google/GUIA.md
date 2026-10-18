# Guía: dejar andando inscripción y documentación en Google

Para quien instala (Tomás o coordinación). Pasos numerados, sin saber programar. Qué hace cada cosa y por qué: `docs/superpowers/specs/2026-10-18-inscripcion-google-design.md`.

**Todo se hace desde la cuenta de Google del básquet**, no desde una personal. Los DNIs, las fotos y la ficha médica **no salen de esa cuenta**, y **nada se publica en la web** (nunca *Publicar en la web*).

Piezas: carpetas de Drive · formularios · una planilla "Tablero" · un script que mueve cada archivo a la carpeta del chico · una planilla aparte "Para Semillero".

---

## 1. Mover el formulario actual a la cuenta del básquet

Hoy el formulario "Ficha Individual del Deportista - Temporada 2026" no está en la cuenta del básquet. Hay dos caminos; **recomiendo la copia**.

**A. Hacer una copia (recomendado).**
1. Abrir el formulario actual → los tres puntitos (⋮) → **Hacer una copia**.
2. Si lo abrís con la cuenta personal, la copia queda en esa cuenta. Entonces: abrir la copia → ⋮ → **Agregar colaboradores** → invitar a la cuenta del básquet como **editor** → entrar con la cuenta del básquet y hacer **otra copia** desde ahí.
3. Se pierde: el **link público viejo** (la copia tiene otro) y las **respuestas viejas** (no se copian). Se conserva todo lo demás.
4. Las respuestas viejas siguen en la planilla vieja. Si se necesitan en el tablero, copiar y pegar esas filas a la pestaña `Inscripción` **respetando el orden de columnas** de `google/formularios/FORMULARIOS.md` — o dejarlas fuera: el tablero sólo mira esta temporada.

**B. Transferir la propiedad.** Desde la cuenta actual: Drive → clic derecho en el formulario → **Compartir** → agregar la cuenta del básquet como editor → ⋮ junto a su nombre → **Transferir propiedad**. La cuenta del básquet tiene que aceptar. Se conserva el link y las respuestas. Se pierde: la planilla vinculada puede seguir en la cuenta vieja; en el formulario nuevo: **Respuestas → Vincular con Hojas → Crear una nueva hoja** y trabajar con la nueva.

Después de cualquiera de las dos, **aplicar los cambios** de `google/formularios/FORMULARIOS.md` (sección Inscripción).

## 2. Crear carpetas y planillas

En Drive, con la cuenta del básquet:
1. Carpeta **`Formularios con archivos`**. Adentro van todos los formularios que suben archivos.
2. Carpeta **`Jugadores`**. El script crea adentro una carpeta por chico: `APELLIDO, Nombre — DNI`.
3. **Compartir las dos carpetas sólo con coordinación.** Nada de "cualquiera con el link".
4. Mover a `Formularios con archivos`: Inscripción, Reinscripción y Comprobante de aranceles (armarlos según `google/formularios/FORMULARIOS.md`), y el formulario **Plantilla**.
5. Anotar los **IDs** de las dos carpetas: abrirlas y copiar lo que va después de `folders/` en la barra de direcciones.
6. Crear la planilla **Tablero** y armarla con `google/sheets/TABLERO.md`. Crear aparte **"Para Semillero 2026"** (punto 9 de ese archivo).

## 3. Instalar el script

1. En **script.google.com**, con la cuenta del básquet: **Nuevo proyecto**. Nombre: `Organizar archivos de formularios`.
2. En *Configuración del proyecto* (la ruedita) tildar **"Mostrar el archivo de manifiesto appsscript.json"**.
3. Pegar cada archivo de `google/apps-script/`: `nombres.gs`, `organizar.gs`, `config.gs` (archivos nuevos con **+ → Script**) y el contenido de `appsscript.json` en el manifiesto.
4. En `config.gs`, reemplazar los dos `PEGAR_ID_…` por los IDs del punto 2.5.
5. En el desplegable de funciones elegir **`instalar`** → **Ejecutar**.
6. Google pide permisos (*Revisar permisos → elegir la cuenta del básquet → Avanzado → Ir a … → Permitir*). Esta pantalla "no verificada" es normal: es un script propio.

| Permiso | Para qué |
|---|---|
| Ver y administrar tus formularios | Abrir los formularios de la carpeta y leer qué archivos subió cada familia |
| Ver, editar, crear y borrar **todos** tus archivos de Drive | Listar la carpeta, crear las carpetas de los chicos, mover y renombrar. Tiene que ser el permiso amplio: los archivos los crea Forms, no el script. **El script no borra nada** |
| Permitir que el script se ejecute cuando vos no estás | Crear el disparador que revisa cada 10 minutos |

No pide Sheets ni Gmail. Si más adelante Google pide un permiso nuevo, no aceptarlo sin revisar por qué.

7. Correr `instalar` otra vez no duplica el disparador. Para forzar un barrido sin esperar: ejecutar `barrerAhora`. Los errores se ven en *Ejecuciones*.

## 4. Sumar un formulario nuevo (sin tocar código)

1. En `Formularios con archivos`, **Hacer una copia** de la plantilla y ponerle nombre (ej. "Rifa día del niño 2026").
2. Sumar las preguntas de subir archivo con el título que se quiere ver en el nombre del archivo (ej. "Comprobante rifa"). Con una pregunta titulada exactamente `Concepto`, su respuesta se suma al nombre.
3. En *Respuestas*, vincular con la planilla Tablero (queda una pestaña nueva; renombrarla).
4. En el Tablero, copiar una columna de documento y cambiarle la pestaña y la letra (`TABLERO.md`, punto 11).
5. Probarlo con un DNI inventado y esperar 10 minutos.

## 5. Prueba manual (antes de abrir a las familias)

**Usar sólo DNIs inventados (`11111111`, `22222222`) y formularios de prueba (copias).** Nunca datos reales. Anotar ✔ o ✘ en cada paso. Tras cada envío, esperar hasta 10 minutos o correr `barrerAhora`.

Preparación: copiar los formularios Inscripción, Reinscripción y Aranceles como pruebas dentro de `Formularios con archivos`, vincularlos al Tablero. En `Config` poner el inicio de temporada anterior a hoy y un concepto activo (ej. `Arancel prueba`, que también esté en el desplegable). Usar una foto cualquiera para las subidas.

1. **Mismo DNI desde dos formularios → misma carpeta.** Enviar la Inscripción con DNI `11111111`, apellido `Prueba`, nombre `Uno`, subiendo el DNI del jugador (frente). Después enviar el de aranceles con el mismo DNI. En `Jugadores/` tiene que haber **una sola** carpeta `PRUEBA, Uno — 11111111` con los dos archivos, con nombres tipo `DNI jugador - frente - PRUEBA - 2026-10-18 14.30.jpg`.
2. **Reenvío → dos archivos.** Volver a enviar la Inscripción con el mismo DNI y la misma pregunta. Quedan **los dos** archivos (fechas distintas), no se pisan ni se borra nada.
3. **Formulario nuevo sin tocar código.** Copiar la plantilla, sumar una pregunta de archivo "Comprobante prueba", ponerla en `Formularios con archivos`, enviar con el DNI `11111111`. Aparece el archivo en la misma carpeta, sin editar el script.
4. **Reinscripción → Alta = Reinscripción.** Enviar la Reinscripción con DNI `22222222` y, **antes**, una Inscripción con ese DNI de una fecha anterior al inicio de temporada (si no es posible, mover `Config!B2` un día adelante después de la inscripción). En el Tablero, `22222222` tiene **Alta = Reinscripción**. Un DNI que **nunca** se inscribió (ej. `33333333`) enviado por Reinscripción aparece en la hoja `Revisar`.
5. **Comprobante de arancel → 📎, y ✅ al verificarlo.** Enviar el de aranceles con `11111111` y concepto `Arancel prueba`. En `Pagos` aparece **📎**. Anotar en `Pagos verificados` una fila (`11111111`, `Arancel prueba`, fecha, quién). Pasa a **✅**.
6. **Buscar con DNI y con un apellido repetido.** Cargar un segundo chico `Prueba, Dos` (DNI `22222222`). Desde el **celular**, en `Buscar`: escribir `11111111` → se ve **un** chico en vertical, con documentos, pagos y el botón "Abrir carpeta". Escribir `Prueba` → aparece la **lista** de los dos con su DNI; escribir el DNI de uno → vuelve el detalle.
7. **Tablero ✅/❌ correcto, incluida una entrega a mano.** Para `11111111`: ✅ en lo que se subió, ❌ en el resto; **Completo** ❌. En `Entregas a mano` anotar una fila (`11111111`, un documento que falte, hoy, tu nombre): esa columna pasa a ✅. Repetir hasta completar los 6: **Completo** pasa a ✅.
8. **DNI con puntos rechazado.** En el formulario, escribir `11.111.111`: el formulario **no deja enviar** y muestra "Sólo números, sin puntos (7 u 8 dígitos)".
9. **Para Semillero.** En la planilla "Para Semillero", mirar que los encabezados sean `Apellido | Nombre | Fecha de nacimiento | Categoría | Mail del responsable | Rama`, que no haya DNI ni nada de salud, y que la fecha tenga formato `dd/mm/aaaa`.
10. **Nada público.** Con la sesión cerrada (ventana privada), abrir el link de una carpeta, del Tablero y de Para Semillero: tiene que pedir permiso, no mostrar nada.
11. Si algo falló: *Ejecuciones* del script (errores) y el punto 12 de `TABLERO.md`.

Al terminar: **borrar los formularios de prueba, las respuestas de prueba y las carpetas `PRUEBA…` y `…Dos`** (vaciado manual, punto 7).

## 6. Guía corta para padres sin cuenta de Google

El texto completo, para pegar en un Google Doc del básquet, está en `google/formularios/PADRES.md`. En una frase: **se crea una cuenta de Google con el mail que ya tienen (Hotmail, Yahoo…), sin abrir un Gmail**; si no pueden, entregan los papeles al coordinador, que los sube a la carpeta del chico y lo anota en `Entregas a mano`. Pegar el link del Doc en la descripción de cada formulario y pedirle a portal que lo enlace desde la página pública (eso no se hace acá).

## 7. Vaciado manual

El script nunca borra. Los DNIs de un chico quedan en su carpeta mientras juegue en el club. Cuando se va:
1. Abrir `Jugadores/<APELLIDO, Nombre — DNI>` y **eliminar la carpeta** (y vaciar la papelera de Drive).
2. En las pestañas de respuestas, borrar a mano las filas de ese DNI (las pestañas son de sólo lectura para el tablero; borrar filas es lo único que se les hace).
3. Quitar sus filas de `Entregas a mano` y `Pagos verificados`.

Es una tarea de coordinación, hecha a mano y a conciencia: no hay borrado automático a propósito.
