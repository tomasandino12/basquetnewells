# Precarga del plantel 2026

Para cargar en Semillero a los ~100 chicos que ya completaron el formulario **Base de Datos Básquet NOB 2026**, sin cargar nada dos veces. Spec: `docs/superpowers/specs/2026-10-19-datos-conectados-design.md` §2 y §3.

**Por qué dos planillas aparte:** en Sheets, *Descargar → Microsoft Excel* baja **todas** las pestañas. La planilla de respuestas tiene DNI, domicilio y ficha médica. Por eso a Semillero sólo se sube un archivo que se arma aparte con `IMPORTRANGE`, con las columnas justas. Nunca se baja la planilla de respuestas.

## Paso a paso para Tomás

1. Entrá a Google con la cuenta del básquet y abrí el formulario **Base de Datos Básquet NOB 2026**.
2. Pegale a Claude en el navegador el prompt de abajo y dejalo trabajar. Te va a pedir confirmación antes de crear cada planilla.
3. Cuando termine, abrí la pestaña **Para Semillero** de la planilla de respuestas y mirá la columna **Revisar**: las filas marcadas son nombres que la fórmula no pudo separar bien (tres palabras o más, o apellido con "de", "del", "la"). Corregí apellido y nombre a mano en esas filas.
4. Abrí **Para Semillero 2026** (la planilla nueva, aparte). Debería mostrar las mismas filas, sin la columna Revisar. Si sale "Permitir acceso", tocalo.
5. Archivo → Descargar → Microsoft Excel (.xlsx). Es el archivo para **Plantel → Importar inscriptos**; lo repetís en cada plantel (el importador muestra sólo los chicos de esa categoría).
6. Las emergencias se suben aparte, en el paso de **Plantel → Importar emergencias**, con el archivo de **Emergencias para Semillero 2026**. Se baja igual que el anterior.
7. Compartí esas dos planillas **sólo con quien importa**. Nunca "cualquiera con el link", nunca *Publicar en la web*.

Los chicos entran sin mail del responsable: el formulario 2026 no lo pide, así que no se vinculan solos con la cuenta de la familia. Se vinculan cuando la familia se reinscriba.

## Prompt para Claude en el navegador

```
Estoy en la cuenta de Google del club de básquet. Necesito armar dos planillas
auxiliares a partir de las respuestas del formulario "Base de Datos Básquet NOB
2026". REGLAS: no leas, copies ni me muestres el contenido de ninguna respuesta
(hay datos de menores y de salud); trabajá sólo con los encabezados de la fila 1
y con fórmulas. No publiques nada en la web. No compartas ningún archivo con
nadie. Antes de crear cada planilla, pedime confirmación.

1. En el formulario, pestaña Respuestas, tocá "Vincular con Hojas" y creá una
   hoja de cálculo nueva llamada "Respuestas Base de Datos 2026". No uses la
   planilla vieja "Base de Datos".

2. En esa hoja nueva, agregá una pestaña "Para Semillero" con estos encabezados
   EXACTOS en la fila 1:

Apellido | Nombre | Fecha de nacimiento | Categoría | Mail del responsable | Rama | Revisar

   Todo con fórmulas que apunten a la pestaña de respuestas (ubicá cada columna
   por su encabezado):
   - Apellido: la primera palabra de "Apellido y Nombre del Deportista".
   - Nombre: el resto de esa celda.
   - Fecha de nacimiento: "Fecha de Nacimiento", tal cual.
   - Categoría: "Categoría 2026", tal cual.
   - Mail del responsable: vacío (el formulario no lo pide). NO uses "Email del
     Deportista".
   - Rama: "MASCULINO" si la categoría contiene MASCULINO; "FEMENINO" si
     contiene FEMENINO; vacía en las demás.
   - Revisar: "REVISAR" si el nombre tiene tres palabras o más, o si empieza
     con "de", "del", "di", "da", "la", "los", "van" o "san"; si no, vacía.
   Una fila por respuesta; las fórmulas deben cubrir las filas nuevas.

3. En la misma hoja, agregá una pestaña "Emergencias" con estos encabezados
   EXACTOS en la fila 1:

Apellido y nombre | Fecha de nacimiento | Teléfono del adulto | Contacto de urgencia | Afecciones | Alergias | Medicación | Indicación médica | Obra social

   Con fórmulas, sólo para las filas donde "Consentimiento de Datos" esté
   tildado (las otras quedan vacías):
   - Apellido y nombre: "Apellido y Nombre del Deportista".
   - Teléfono del adulto: "Teléfono de Familiar a Cargo (para grupos de WhatsApp)".
   - Contacto de urgencia: "EN CASO DE URGENCIA LLAMAR A (nombre y teléfono)".
   - Afecciones: "¿Ha sufrido alguna de estas afecciones?".
   - Alergias: "¿Es alérgico a algún medicamento, alimento o sustancia?".
   - Medicación: "¿Actualmente ingiere algún medicamento de forma regular?".
   - Indicación médica: "¿Es propenso a alguna enfermedad o tiene indicación médica especial?".
   - Obra social: "Obra Social / Prepaga / Seguro Médico".
   - Fecha de nacimiento: "Fecha de Nacimiento".
   NO incluyas DNI, número de afiliado, grupo sanguíneo, domicilio, cirugías,
   altura, colegio ni número de socio.

4. Creá una planilla NUEVA y aparte, "Para Semillero 2026", con una sola
   fórmula en A1: =IMPORTRANGE("<link de la hoja Respuestas Base de Datos 2026>";
   "Para Semillero!A:F"). Formato de la columna C: fecha dd/mm/aaaa. Tocá
   "Permitir acceso". No agregues otras pestañas.

5. Creá otra planilla NUEVA y aparte, "Emergencias para Semillero 2026", con
   =IMPORTRANGE("<link de la misma hoja>"; "Emergencias!A:I") en A1 y formato
   de fecha dd/mm/aaaa en la columna B. Tocá "Permitir acceso".

6. Al terminar, decime los nombres y links de las tres planillas, y que revise
   yo la columna Revisar. No me muestres datos de ningún chico.
```
