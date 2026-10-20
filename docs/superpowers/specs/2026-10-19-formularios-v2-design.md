# Formularios v2 — diseño

**Fecha:** 19/10/2026 · **Rama:** `feat/formularios-v2` · **Estado:** aprobada por Tomás el 19/10, salvo el cambio de la "Primera temporada" (datos de 2026), que falta confirmar.
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
La primera pregunta es **"¿Ya completó la ficha del básquet la temporada pasada (2026)?"**. Forms no deja repetir una pregunta en dos caminos (quedarían dos columnas con el mismo título). Por eso todo lo común va en secciones compartidas y los caminos sólo cambian lo propio de cada uno:

```
S1  Jugador (todos): ¿Ya completó la ficha en 2026? · DNI · Apellido · Nombre ·
    Fecha de nacimiento (Fecha, obligatoria) · Categoría (con sus años) · Rama
      ├─ No → S2 Datos que se piden una sola vez (nacionalidad, socio, grupo
      │        sanguíneo, perfil deportivo, alturas de los padres)
      │      → S3 Documentación (6 fotos, obligatorias) → S6
      └─ Sí → S4 Documentación de reinscripción (6 fotos; ver abajo)
             → S5 ¿Cambió algo de salud desde 2026?   Sí → S6   No → S7
S6  Salud (completa)                                                  → S7
S7  Contacto y emergencia (todos) → S8 Escuela (todos) → S9 Autorizaciones (todos)
```
- Forms aplica el salto al tocar *Siguiente*. Por eso la pregunta que decide puede ir primera y compartir sección con el DNI.
- El script de carpetas no cambia: lee sólo las preguntas respondidas, y cada título aparece una sola vez. Las 6 fotos de S4 llevan otro título (`DNI jugador - frente (reinscripción)`), caen en la misma carpeta y el tablero las suma a la misma columna que las de S3.
- **Fotos en la reinscripción.** Forms no puede mirar la carpeta del chico mientras la familia completa el formulario. Pero en 2026 nadie subió fotos, así que **en esta primera temporada a todos les faltan**: las 6 de S4 son **obligatorias**. Desde la temporada siguiente pasan a opcionales, con la ayuda "subilas sólo si cambió el DNI o si te lo pidió tu profe", y el tablero marca con ❌ a quien le falte alguna.
- **Fecha de nacimiento** siempre (también en la reinscripción). Las opciones de **Categoría** llevan sus años, como hoy, sin el año de temporada en el título: coordinación las actualiza al empezar cada temporada. En `Revisar`, el tablero marca una categoría que no incluye el año de nacimiento del chico.
- **Consentimiento de datos obligatorio**, en los dos caminos. Uso de imagen y avisos de recaudación siguen opcionales y sin premarcar.
- **Casilla "Emergencias en Semillero"**, al lado del consentimiento, en S9 (los dos caminos), opcional y sin premarcar. Texto de `docs/LEGAL-EMERGENCIAS.md` (rama de datos conectados):
  > Autorizo al club a cargar en la aplicación Semillero el teléfono del adulto responsable, el contacto de urgencia, las afecciones médicas marcadas, las alergias, la medicación, la indicación médica especial y la obra social de mi hijo/a. Los verán sólo el profe de su categoría y la coordinación del club, y se usarán únicamente para actuar ante una emergencia. Puedo pedir que se corrijan o se borren en cualquier momento. Más información: política de privacidad de Semillero.

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
- **Alertas médicas obligatorias, con la opción "Ninguna":** así un casillero vacío no se confunde con "no tiene nada".
- Regla para quien lea esto (la sesión de Semillero): **la salud vigente es la de la última respuesta que pasó por S6; si no hay, la de `Inscripción 2026`**. El contacto vigente es el de la última respuesta.

## Las dos planillas para Semillero (contrato con datos conectados, `google/PRECARGA-2026.md`)
Son planillas **aparte**, armadas con `IMPORTRANGE` desde hojas de salida del Tablero. Así cubren las respuestas nuevas **y** las de 2026 (`Inscripción 2026`), y no hace falta otra planilla para la precarga.
- **Para Semillero:** las 6 columnas de siempre (`Apellido | Nombre | Fecha de nacimiento | Categoría | Mail del responsable | Rama`). Para un chico que sólo está en 2026, el mail queda vacío (ese formulario no lo pedía).
- **Emergencias para Semillero:** `Apellido y nombre | Fecha de nacimiento | Teléfono del adulto | Contacto de urgencia | Afecciones | Alergias | Medicación | Indicación médica | Obra social`. Sólo pasan las filas cuya **última inscripción** tiene tildada la casilla "Emergencias en Semillero". Los chicos que sólo están en 2026 no tienen esa casilla (su consentimiento viejo no nombra a Semillero): **los de 2026 pasan si tienen tildado el "Consentimiento de Datos" de ese formulario** (Tomás, 19/10); la casilla nueva rige para las inscripciones nuevas. Salud vigente: la de la última respuesta que pasó por S6 o, si no hay, la de 2026. Contacto: el de la última respuesta.
- De dónde sale cada columna de Emergencias en el formulario nuevo: Teléfono del adulto = `Adulto responsable - WhatsApp`; Contacto de urgencia = nombre y vínculo + teléfono; Afecciones = `Alertas médicas`; Alergias y Medicación = la respuesta Sí/No + el detalle; Indicación médica = la indicación especial + "tiene que tener a mano"; Obra social = la obra social. Sin DNI, afiliado, grupo sanguíneo ni domicilio.

## La carpeta del chico, para la CAB
Todo lo del chico queda en `Jugadores/APELLIDO, Nombre — DNI`: DNIs, fotos y comprobantes, sin pasar por WhatsApp. La guía explica cómo bajarla entera: en la compu, *clic derecho → Descargar* baja un .zip. En el celular, la app de Drive no baja carpetas, sólo archivos sueltos, así que conviene hacerlo en la compu.

## Primera temporada: los datos de 2026 cuentan como inscripción anterior
Tomás (19/10): el formulario "Base de Datos Básquet NOB 2026" ya tiene la ficha de este año (101 respuestas). Ahí sí está el DNI, aunque la planilla vinculada lo perdió. Así que el que contesta "Sí" en la primera pregunta **no repite** lo que ya dio en 2026.
- **De dónde se lee:** de las respuestas **dentro del formulario 2026**, no de su planilla editada a mano. El formulario no se modifica: sólo se leen sus respuestas.
- **Cómo:** un script chico, **atado a la planilla Tablero** (*Extensiones → Apps Script* desde el Tablero), con una función `actualizar2026` que se corre a mano desde el editor (sin menú: un menú pediría un permiso más). Arma la hoja `Inscripción 2026` del Tablero con una fila por DNI (la última respuesta) y sólo las columnas que la reinscripción no vuelve a pedir: DNI normalizado, apellido y nombre, fecha de nacimiento, nacionalidad, socio, grupo sanguíneo, salud y obra social. Se corre a mano, sin disparador. Es otro script, separado del de carpetas: el de carpetas no gana permisos.
- **Permisos nuevos que pide** (los acepta Tomás):

| Permiso | Para qué |
|---|---|
| `forms` | leer las respuestas del formulario 2026. Google no ofrece un permiso "sólo leer" para formularios; el código sólo lee, y el test lo controla |
| `spreadsheets.currentonly` | escribir **sólo en esta planilla** (el Tablero). No puede abrir ninguna otra |

  No usa Drive ni mail, y los datos no salen de la cuenta de la Comisión ni van a nada público. La hoja `Inscripción 2026` tiene datos de salud, igual que el resto del Tablero: el Tablero se comparte sólo con coordinación.
- **Emparejamiento:** el tablero cruza por DNI la reinscripción con `Inscripción 2026` y con las inscripciones nuevas. Si el DNI no está en ninguna de las dos, el chico va a `Revisar` con el aviso "le tocaba la ficha completa". Forms no puede comprobarlo en el momento. La coordinación le pide que la complete otra vez eligiendo "No".
- **Faltan reinscribir** pasa a ser útil desde el día uno: lista quién está en 2026 y todavía no se reinscribió.

## Cómo se arma
Lo arma **Claude en el navegador**, con un prompt que prepara esta sesión (`google/PROMPT-NAVEGADOR.md`), siguiendo `FORMULARIOS.md`, `TABLERO.md` y `GUIA.md`:
- Trabaja sólo en la cuenta de la Comisión y sólo hace lo pedido.
- No abre ni copia respuestas viejas, ni datos de menores.
- No cambia permisos de nada existente y no publica nada en la web.
- Los permisos del script los acepta Tomás, no Claude.
- Termina con una prueba con DNIs inventados.
- El formulario lo arma Tomás corriendo ese prompt: esta sesión prepara el diseño y el prompt.

## Fuera de scope
- Cerrar la carpeta pública de fotos del desfile y despublicar los formularios viejos. El relevamiento los marca como riesgo, pero Tomás no quiere tocar lo existente todavía. Queda anotado para cuando lo decida.
- El QR nuevo y los links en el portal (los resuelve portal).
- Cómo llegan las emergencias a la app (otra sesión).

## Decisiones de Tomás (19/10)
1. Primera temporada: los datos del formulario 2026 cuentan como inscripción anterior (sección de arriba). Confirmado el 19/10 ("los datos de este año cuentan como inscripción"). Para las emergencias de 2026 alcanza el "Consentimiento de Datos" que dieron en ese formulario: pasan sólo las filas que lo tienen tildado.
2. Consultas sin login como hoy: sí.
3. Alertas médicas obligatorias con "Ninguna": sí.
