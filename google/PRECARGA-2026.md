# Precarga del plantel 2026 y datos de emergencia

Contrato entre la inscripción en Google y Semillero. Spec: `docs/superpowers/specs/2026-10-19-datos-conectados-design.md` §2 y §3; la otra punta (el Tablero y su script) la arma la sesión de inscripción.

**No se toca nada de lo que ya existe.** Ni el formulario "Base de Datos Básquet NOB 2026" ni su planilla de respuestas se modifican: no se vincula una hoja nueva, no se editan columnas, no se cambian permisos. Las respuestas de 2026 se **leen**, y lo que sale va a planillas nuevas.

**Por qué dos planillas aparte:** en Sheets, *Descargar → Microsoft Excel* baja **todas** las pestañas, y la planilla de respuestas tiene DNI, domicilio y ficha médica. Por eso a Semillero sólo se sube un archivo armado aparte con `IMPORTRANGE`, con las columnas justas. Nunca se baja la planilla de respuestas ni el Tablero.

## Las dos planillas

**"Para Semillero"** (va a *Plantel → Importar inscriptos*). Encabezados exactos, en este orden:

```
Apellido | Nombre | Fecha de nacimiento | Categoría | Mail del responsable | Rama
```

- La **rama** es `Masculino` o `Femenino` (el importador acepta cualquier mayúscula). Importa en las categorías mixtas, como U13.
- Para un chico que sólo figura en 2026, el **mail del responsable queda vacío**: ese formulario no lo pedía. Entra a Semillero igual, sin vínculo de familia, que se crea cuando la familia se reinscriba.
- Apellido y nombre salen del campo "Apellido y Nombre" de la respuesta. Las filas dudosas (tres palabras o más, apellidos con "de", "del", "la") las revisa una persona antes de importar.
- Sin DNI, domicilio, teléfono ni datos de salud.

**"Emergencias para Semillero"** (va a *Plantel → Importar emergencias*). Encabezados exactos:

```
Apellido y nombre | Fecha de nacimiento | Teléfono del adulto | Contacto de urgencia | Afecciones | Alergias | Medicación | Indicación médica | Obra social
```

- Sólo filas con el **consentimiento de datos tildado** (el texto está en `docs/LEGAL-EMERGENCIAS.md`).
- `Afecciones` son las casillas del formulario separadas por coma: Desmayos, Taquicardia, Convulsiones, Epilepsia, Meningitis, Diabetes, Pérdida de conocimiento traumática, Asma. Lo que no esté en esa lista no se guarda.
- Sin DNI, número de afiliado, grupo sanguíneo, domicilio, cirugías ni altura.

## Paso a paso para quien importa

1. Abrí **"Para Semillero"** (la planilla aparte, no el Tablero ni las respuestas). Si dice "Permitir acceso", tocalo.
2. Archivo → Descargar → Microsoft Excel (.xlsx).
3. En Semillero, entrá a **Plantel** de la categoría, tocá **Importar inscriptos** y elegí ese archivo. Repetilo en cada categoría: el importador muestra sólo los chicos de esa.
4. Revisá la lista antes de confirmar. Los chicos de U13 anotados sin rama aparecen destildados: tildá a los varones.
5. Para las emergencias, lo mismo con **"Emergencias para Semillero"** y **Importar emergencias**. Hacelo después de importar a los chicos: sólo se cargan los que ya están en el plantel.
6. Compartí esas dos planillas **sólo con quien importa**. Nunca "cualquiera con el link", nunca *Publicar en la web*.

Para importar hace falta ser profe de esa categoría: la coordinación lee las emergencias pero no las carga.

## Si el script no está listo

Plan B para los ~100 chicos de 2026, sin tocar el formulario: en el formulario, pestaña Respuestas, **Descargar respuestas (.csv)**. Es un archivo con datos sensibles: se abre en una planilla **nueva**, se arman las dos pestañas de arriba con fórmulas y se borra el .csv de la computadora al terminar. Nunca "Vincular con Hojas".
