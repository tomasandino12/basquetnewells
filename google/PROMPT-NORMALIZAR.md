# Prompt para Claude en el navegador: normalizar nombres y detectar errores de carga

**Para Tomás (no es parte del prompt).** Con la sesión de la cuenta de la Comisión abierta, abrí Claude en el navegador y pegá todo lo que está debajo de la línea. Tené a mano para pegar cuando te lo pida: `google/sheets/TABLERO.md` (sección 3 Base y sección 7 Revisar), `google/formularios/FORMULARIOS.md` (Inscripción, Comprobante de pago y Plantilla), `google/apps-script/nombres.gs` y `google/apps-script-tablero/fila2026.gs`. Los permisos de los scripts no cambian: si Google pide uno nuevo, avisale a Claude y no lo aceptes sin leerlo.

---

Sos mi asistente en el navegador, en la **cuenta de la Comisión Básquet**. Ya existen el Tablero, los formularios nuevos y los dos scripts. Hay que hacer **cuatro cambios chicos y nada más**, verificando cada uno antes de pasar al siguiente.

## Reglas
1. Sólo la cuenta de la Comisión Básquet. Si la cuenta abierta es otra, pará y avisame.
2. **Los formularios viejos no se tocan** (los de la cuenta newells.basquet, "Base de Datos Básquet NOB 2026", "Inscripciones Básquet NOB 2026"). Tampoco sus planillas ni sus permisos. Sólo los formularios nuevos de la carpeta `Inscripción y documentación`.
3. **No abras ni copies datos de menores.** Verificá con cantidades y estados, no con contenido de respuestas. Para probar usá DNIs inventados (`11111111`, `22222222`) y nombres de mentira.
4. No publiques nada en la web, no cambies permisos de compartir y no mandes mails.
5. Los permisos de los scripts los acepto yo. Ante cualquier duda o error que no entiendas, pará y preguntame.
6. Los textos y las fórmulas se pegan **tal cual** desde los archivos que te pase. Si una función no se reconoce en Sheets, verificá el nombre con el autocompletado y avisame antes de cambiarlo.

## Cambio 1 — Base: nombres normalizados
Pedime `google/sheets/TABLERO.md` (punto 3). En la hoja `Base`, reemplazá la fórmula de `A2` por la nueva: el apellido pasa por `MAYUSC(ESPACIOS(...))` y el nombre por `NOMPROPIO(ESPACIOS(...))`. No toques la pestaña `Inscripción` (respuestas crudas).
**Chequeo:** `Base` sin errores `#NAME?` ni `#REF!`; el Tablero, `Salida Semillero` y `Salida Emergencias` siguen mostrando datos (no hace falta cambiarles nada). Decime cuántas filas tiene `Base`, sin leer nombres.

## Cambio 2 — Revisar: dos listas nuevas
Pedime el punto 7 de `TABLERO.md`. En `Revisar` agregá, con sus títulos y fórmulas tal cual: `G1`/`G2` (posible nombre y apellido invertidos) e `I1`/`I2` (posible chico duplicado). Si el formato de fecha `dd/mm/aaaa` de `TEXTO` da error, probá `dd/mm/yyyy` y avisame. Si ya había una lista de pagos de otros formularios en `G` o `I`, movela a `K`.
**Chequeo:** las dos listas aparecen sin error. Con datos de prueba (DNIs inventados), cargá en una respuesta de prueba el mismo DNI con apellido y nombre cruzados y confirmá que aparece en `G`; cargá dos DNIs distintos con igual nombre y fecha y confirmá que aparece en `I`. Después sacá lo de prueba (con mi OK, a la papelera).

## Cambio 3 — Formularios: ayudas, validación y confirmación
Pedime `google/formularios/FORMULARIOS.md`. En **Inscripción**, **Comprobante de pago** y **Plantilla** (y en las copias de la plantilla que ya existan):
1. `Apellido del jugador`: texto de ayuda `Ej.: GONZÁLEZ`; validación de expresión regular `^[^0-9]+$` con el mensaje `Escribí sólo letras, sin números`.
2. `Nombre del jugador`: ayuda `Ej.: Juan Martín (sin el apellido)`; misma validación.
3. *Configuración → Presentación → Mensaje de confirmación*: el de Inscripción y el de Comprobante, exactos como están en el archivo ("¿Te equivocaste en algo? Volvé a mandar el formulario: tomamos el último…").
No cambies el título, el orden ni el tipo de ninguna pregunta.
**Chequeo:** en *Vista previa*, un número en Apellido es rechazado con el mensaje; los títulos siguen idénticos.

## Cambio 4 — Scripts: pegar los archivos nuevos
1. Pedime `google/apps-script/nombres.gs`. En el proyecto `Organizar archivos de formularios`, reemplazá el contenido de `nombres.gs` (el resto no se toca; los `PEGAR_ID` de `config.gs` ya están puestos). Guardá.
2. Pedime `google/apps-script-tablero/fila2026.gs`. En el proyecto del Tablero, reemplazá `fila2026.gs`. Guardá, elegí `actualizar2026` y ejecutá. Los permisos no deberían cambiar: si piden algo nuevo, pará.
**Chequeo:** *Ejecuciones* sin errores; el registro sólo tiene cantidades. Leeme los números, no nombres.

## Al terminar
Un mensaje corto: ✔/✘ por cambio, qué no pudiste hacer y por qué, y todo lo que tocaste, para que yo revise que no hiciste nada de más.
