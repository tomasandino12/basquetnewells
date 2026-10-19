# Formularios v2 — diseño

**Fecha:** 19/10/2026 · **Rama:** `feat/formularios-v2` · **Estado:** borrador, falta que lo apruebe Tomás.
**Parte de:** `2026-10-18-inscripcion-google-design.md`, que sigue vigente salvo en lo que se cambia acá. No toca el código de la app ni el script de Apps Script.

## Qué cambió desde la v1
- Ya existe la cuenta de Google de la **Comisión Básquet**. El relevamiento del 19/10 (`documentos/`, gitignoreado) encontró 9 formularios viejos. Casi todo es de otra cuenta (newells.basquet) y las planillas de respuestas fueron editadas a mano: les faltan DNI, teléfonos y fechas.
- **Lo viejo no se toca.** No se cambian permisos, formularios ni planillas, y no se importan respuestas viejas. Todo lo nuevo (formularios, carpetas, tablero, script) se crea en la cuenta de la Comisión, en Mi unidad, dentro de una carpeta **`Inscripción y documentación`**.
- Tomás pidió menos formularios: 4 para las familias y el público, más los de pagos que arme coordinación.

## Mapa de formularios

| Formulario | Para quién | Login | Datos de menores | ¿Va en `Formularios con archivos`? |
|---|---|---|---|---|
| **Quiero jugar en Newell's** | Cualquiera: es el destino del QR | No | Mínimos: nombre y año de nacimiento | No |
| **Inscripción** (uno solo, con dos caminos) | Familias de jugadores | Sí, lo exigen las subidas | Sí: ficha completa, salud y fotos | Sí |
| **Comprobante de pago** (el desplegable de conceptos) | Familias | Sí | DNI (clave) | Sí |
| **Formularios de un pago puntual** (rifa, pantalón…), hechos con la plantilla | Familias | Sí | DNI (clave) | Sí |
| **Quiero colaborar / ser sponsor** | Adultos, empresas | No | Ninguno | No |

### 1. Quiero jugar en Newell's (consultas)
Sale de copiar la *estructura* de "Inscripciones Básquet NOB 2026": el original no se toca. Tiene una sección informativa con el cronograma por categoría y después estas preguntas: `Apellido y nombre del jugador/a` · `Año de nacimiento` (desplegable, como hoy) · `WhatsApp de un adulto responsable` · `¿Qué querés hacer?` (Inscribirme y arrancar / Tengo una consulta) · `Tu consulta` (opcional).
No tiene subidas, así que no pide login. Lo completa un adulto (lo dice el arranque). No pide DNI, domicilio ni salud. **No es la inscripción**: la confirmación lleva a la persona al link de Inscripción.

### 2. Inscripción (uno solo, con dos caminos)
La primera pregunta es **"¿Ya hizo esta inscripción en otra temporada?"**. Forms no deja repetir una pregunta en dos caminos (quedarían dos columnas con el mismo título). Por eso todo lo común va en una sola sección y los caminos sólo cambian lo propio de cada uno:

```
S1  Jugador (todos): ¿Ya hizo esta inscripción? · DNI · Apellido · Nombre ·
    Fecha de nacimiento (Fecha, obligatoria) · Categoría (con sus años) · Rama
      ├─ No → S2 Datos que se piden una sola vez (nacionalidad, socio, grupo
      │        sanguíneo, perfil deportivo, alturas de los padres)
      │      → S3 Documentación (las 6 fotos) → S6
      └─ Sí → S4 ¿Cambió el DNI?    Sí → S5 Fotos del DNI nuevo (2) → S4b
                                    No → S4b
             S4b ¿Cambió algo de salud?   Sí → S6   No → S7
S6  Salud (completa)                                               → S7
S7  Contacto y emergencia (todos) → S8 Escuela (todos) → S9 Autorizaciones (todos)
```
- Forms aplica el salto al tocar *Siguiente*. Por eso la pregunta que decide puede ir primera y compartir sección con el DNI.
- El script no cambia: lee sólo las preguntas respondidas, y cada título aparece una sola vez. Las fotos del DNI nuevo tienen otro título (`DNI jugador nuevo - frente`) y el tablero las suma a la misma columna.
- **Fecha de nacimiento** siempre (también en la reinscripción). Las opciones de **Categoría** llevan sus años, como hoy, sin el año de temporada en el título: coordinación las actualiza al empezar cada temporada. En `Revisar`, el tablero marca una categoría que no incluye el año de nacimiento del chico.
- **Consentimiento de datos obligatorio**, en los dos caminos. Uso de imagen y avisos de recaudación siguen opcionales y sin premarcar.

### 3. Pagos
- **Comprobante de pago**, con el desplegable `Concepto`, para lo que se repite (aranceles, cuotas). **Un pago nuevo y simple** (ej. "Pantalón de entrenamiento") **no necesita formulario**: basta sumar la opción al desplegable y a Config.
- **Formulario propio** sólo cuando el pago pide algo más (talle, cantidad de rifas). Lo arma coordinación con la plantilla, dentro de `Formularios con archivos`, y el comprobante cae en la carpeta del chico sin tocar código.
- **Hueco de la v1:** el tablero de la v1 mostraba en `Pagos` sólo los conceptos del desplegable. Un formulario propio quedaba como columna suelta del Tablero, sin 📎/✅. **Arreglo:** la hoja `Pagos` suma un segundo tipo de columna, "pago con formulario propio". El encabezado es el nombre del pago y la fórmula apunta a la pestaña y la letra de su subida: 📎 si hay comprobante desde el inicio de temporada, ✅ si está en `Pagos verificados` con ese mismo nombre. `Buscar` muestra todas las columnas de `Pagos`. `Revisar` lista los DNIs que mandaron un pago y no están en el padrón.

### 4. Quiero colaborar / ser sponsor
Sin login. Pide `Nombre y apellido` · `Empresa o comercio` (opcional) · `WhatsApp o mail` · `¿Cómo querés colaborar?` (casillas: sponsor, donar material, ayudar en eventos, otra) · `Mensaje`. Las respuestas van a una planilla propia, no al tablero.

## Emergencias: qué captura el formulario
Tomás quiere que, si un chico se golpea, el profe tenga a mano el teléfono del adulto, el contacto de urgencia y las alertas médicas. Cómo llega eso a la app lo diseña otra sesión. De este lado, los campos son **separados y estructurados** y quedan en la pestaña `Inscripción`:

| Pregunta | Tipo | Oblig. |
|---|---|---|
| Adulto responsable - nombre y apellido | Respuesta corta | sí |
| Adulto responsable - WhatsApp | Respuesta corta, sólo números | sí |
| Contacto de urgencia - nombre y vínculo | Respuesta corta | sí |
| Contacto de urgencia - teléfono | Respuesta corta, sólo números | sí |
| Alertas médicas | **Casillas**: Epilepsia o convulsiones · Asma · Diabetes · Problemas cardíacos o taquicardia · Desmayos · Alergia grave · Meningitis (antecedente) · Pérdida de conocimiento por golpe · **Ninguna** | **sí** (sin respuesta ≠ "Ninguna") |
| ¿Tiene alguna alergia? | Sí / No, y si es Sí: a qué y qué hacer | sí |
| ¿Toma medicación habitual? | Sí / No, y si es Sí: cuál y dosis | sí |
| ¿Tiene que tener algo a mano? | Casillas: inhalador · autoinyector de adrenalina · insulina · otro · nada | sí |
| Obra social y número de afiliado · Grupo sanguíneo | como hoy | sí |

- Contacto y adulto están en S7 y se actualizan en **cada** inscripción. La salud se actualiza cuando es la primera vez o cuando contestan "cambió algo".
- Regla para quien lea esto (la sesión de Semillero): **la salud vigente es la de la última respuesta que pasó por S6**; el contacto vigente es el de la última respuesta.

## La carpeta del chico, para la CAB
Todo lo del chico queda en `Jugadores/APELLIDO, Nombre — DNI`: DNIs, fotos y comprobantes, sin pasar por WhatsApp. La guía explica cómo bajarla entera: en la compu, *clic derecho → Descargar* baja un .zip. En el celular, la app de Drive no baja carpetas, sólo archivos sueltos, así que conviene hacerlo en la compu.

## Primera temporada
Las respuestas viejas no se importan. Entonces, **en la temporada de arranque nadie tiene una inscripción anterior en el sistema nuevo**, y un "Sí" dejaría al chico sin fotos ni datos fijos. Propuesta: **la primera temporada, las dos respuestas llevan a la ficha completa** (el salto del "Sí" apunta a S2), y desde la siguiente se activa el camino corto con un cambio de un clic. Lo decide Tomás.

## Cómo se arma
Lo arma **Claude en el navegador**, con un prompt que prepara esta sesión (`google/PROMPT-NAVEGADOR.md`), siguiendo `FORMULARIOS.md`, `TABLERO.md` y `GUIA.md`:
- Trabaja sólo en la cuenta de la Comisión y sólo hace lo pedido.
- No abre ni copia respuestas viejas, ni datos de menores.
- No cambia permisos de nada existente y no publica nada en la web.
- Los permisos del script los acepta Tomás, no Claude.
- Termina con una prueba con DNIs inventados.

## Fuera de scope
- Cerrar la carpeta pública de fotos del desfile y despublicar los formularios viejos. El relevamiento los marca como riesgo, pero Tomás no quiere tocar lo existente todavía. Queda anotado para cuando lo decida.
- El QR nuevo y los links en el portal (los resuelve portal).
- Cómo llegan las emergencias a la app (otra sesión).

## Para decidir (Tomás)
1. **Primera temporada:** ¿todos por la ficha completa? (recomiendo sí)
2. **Consultas sin login** con nombre y año de nacimiento del chico y el WhatsApp de un adulto, como hoy. ¿Ok?
3. **Alertas médicas obligatorias, con "Ninguna" como opción.** ¿Ok, o alguna otra alerta para sumar?
