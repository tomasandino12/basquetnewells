# Formularios de Google (v2)

Spec: `docs/superpowers/specs/2026-10-19-formularios-v2-design.md` (parte de la `2026-10-18-inscripcion-google-design.md`). Son **cinco** formularios para las familias y el público, más los que arme coordinación con la plantilla. Todo se crea **en la cuenta de la Comisión Básquet**, en Mi unidad, dentro de la carpeta `Inscripción y documentación`. **No se toca nada de lo que ya existe** (formularios, planillas ni permisos viejos). Los títulos de las preguntas estándar tienen que ser **idénticos** a los de `google/apps-script/config.gs`; el orden de las columnas, idéntico al Mapa de `google/sheets/TABLERO.md` (un test lo comprueba).

| Formulario | Para quién | Login | ¿Va en `Formularios con archivos`? |
|---|---|---|---|
| **Quiero jugar en Newell's** | Cualquiera: es el destino del QR | No | No |
| **Inscripción** (uno solo, con dos caminos) | Familias de jugadores | Sí (por las subidas) | Sí |
| **Comprobante de pago** | Familias | Sí | Sí |
| **Plantilla** (para un pago puntual: rifa, pantalón…) | Se copia; la copia es de las familias | Sí | Sí |
| **Quiero colaborar** | Adultos, empresas | No | No |

La columna `Col` es la letra que va a tener la pregunta en la pestaña de respuestas. En los formularios **con login** la `A` es la marca temporal y la `B`, el mail verificado, así que la primera pregunta es la `C`. En los **sin login** no hay mail: la primera pregunta es la `B`. Las filas "Sección" no cuentan.

Ajustes del formulario (en los que tienen login):
- *Configuración → Respuestas → Recopilar direcciones de correo electrónico*: **Verificado**.
- *Configuración → Respuestas*: **no** limitar a una respuesta (un adulto con dos chicos manda dos) y **no** permitir editar después de enviar.
- Las preguntas de subir archivo hacen que pida iniciar sesión con Google; es lo esperado.
- **Nunca** mandar links prellenados con datos del chico.
- Vincular con la planilla del tablero y renombrar la pestaña (ver `google/sheets/TABLERO.md`).
- Dejar el formulario dentro de la carpeta `Formularios con archivos`.

Los dos formularios sin login se vinculan a **su propia planilla** (nunca al Tablero) y la comparte sólo quien las lee.

## Cómo se escribe para las familias
No suponemos que saben usar la compu. En cada formulario: un **arranque** (qué es, qué tener a mano, qué pasa después) y una **ayuda en cada pregunta de archivo**, en voseo y con frases cortas. La guía para las familias, para pegar en un Google Doc, está en `google/formularios/PADRES.md`.

## Quiero jugar en Newell's

Sin login, sin subidas, sin DNI, domicilio ni salud. Sale de copiar la *estructura* de "Inscripciones Básquet NOB 2026" (el original no se toca): una sección informativa con el cronograma por categoría y después estas preguntas. **No es la inscripción**: la confirmación lleva a la persona al link del formulario Inscripción.

**Arranque:**
> Este formulario es para **consultar o anotarse para arrancar** en el básquet de Newell's. Lo completa un adulto. No hace falta ningún documento: te vamos a escribir por WhatsApp.
> Tarda 2 minutos. Para inscribir al chico de verdad, después te pasamos otro formulario.

| Col | Título (exacto) | Tipo | Obligatoria | Ayuda / opciones |
|---|---|---|---|---|
| B | Apellido y nombre del jugador/a | Respuesta corta | sí |  |
| C | Año de nacimiento | Desplegable | sí | Los años de las categorías, del más grande al más chico. |
| D | WhatsApp de un adulto responsable | Respuesta corta | sí | Validación: expresión regular `^\d{8,15}$`, mensaje "Sólo números, sin espacios ni guiones". Ayuda: "Con el código de área, sin 0 ni 15. Ejemplo: 3415551234." |
| E | ¿Qué querés hacer? | Opción múltiple | sí | Inscribirme y arrancar / Tengo una consulta |
| F | Tu consulta | Párrafo | no | Ayuda: "Sólo si tenés una consulta." |

**Mensaje de confirmación:** "Gracias, recibimos tus datos. Te escribimos por WhatsApp. Si querés anotar al chico ya, completá la inscripción acá: [LINK INSCRIPCIÓN]."

## Inscripción

Uno solo para todos. Título: **Inscripción Básquet Newell's**. Es un formulario nuevo, hecho a mano a partir de este archivo; **no se copia ni se mueve el viejo**.

**Arranque (descripción del formulario):**
> Este formulario es para inscribir a un chico en el básquet de Newell's, **sea la primera vez o ya haya jugado**. La primera pregunta te dice qué te toca completar.
> Tené a mano: el DNI del chico y el tuyo (para sacarles una foto de frente y de atrás) y, si querés, una foto de cada uno. Tarda unos 10 minutos si es la primera vez, y menos si ya jugó.
> Después, la coordinación lo revisa. Si falta algo, te avisa tu profe.

**Texto de privacidad (sección inicial) — `[VALIDAR CON COORDINACIÓN]`:**
> Estos datos los ve **sólo la coordinación del básquet**. Se usan para fichar al chico en la CABB, para la ficha de emergencia y para cargarlo en la app del club (apellido, nombre, fecha de nacimiento, categoría y tu mail). Los documentos y fotos quedan guardados en la cuenta del club y **no se publican**. La ficha médica no sale de acá.

**Los dos caminos.** Forms no deja repetir una pregunta en dos caminos (quedarían dos columnas con el mismo título), así que lo común va en secciones compartidas y cada camino sólo cambia lo propio:

| Sección | Quién la ve | Salto al tocar *Siguiente* |
|---|---|---|
| S1 Jugador | todos | **No** → S2 · **Sí** → S4 |
| S2 Datos que se piden una sola vez | "No" | → S3 |
| S3 Documentación (6 fotos) | "No" | → S6 |
| S4 Documentación de reinscripción (6 fotos) | "Sí" | → S5 |
| S5 ¿Cambió algo de salud? | "Sí" | **Sí** → S6 · **No** → S7 |
| S6 Salud | "No" (siempre) y "Sí" que contestó "cambió" | → S7 |
| S7 Contacto y emergencia | todos | → S8 |
| S8 Escuela | todos | → S9 |
| S9 Autorizaciones | todos | Enviar |

Notas:
- **Fotos en la reinscripción.** En 2026 nadie subió fotos, así que en esta primera temporada **a todos les faltan**: las 6 de S4 son **obligatorias**. Desde la temporada siguiente pasan a opcionales, con la ayuda "subilas sólo si cambió el DNI o si te lo pidió tu profe", y el tablero marca ❌ a quien le falte alguna. Los títulos de S4 llevan el sufijo ` (reinscripción)`; el script de carpetas las deja en la misma carpeta del chico y el tablero las suma a la misma columna que las de S3.
- **Fecha de nacimiento** siempre. Las opciones de **Categoría** llevan sus años y **no llevan el año de temporada en el título**: coordinación las actualiza al empezar cada temporada. En `Revisar`, el tablero marca una categoría que no incluye el año de nacimiento.
- **Consentimiento de datos obligatorio**, en los dos caminos. Uso de imagen y avisos de recaudación siguen opcionales y sin premarcar.
- **Casilla "Emergencias en Semillero"**, al lado del consentimiento, en S9 (los dos caminos), opcional y sin premarcar. Texto de `docs/LEGAL-EMERGENCIAS.md`, que se pega tal cual.
- **Alertas médicas son obligatorias, con la opción "Ninguna"**: así un casillero vacío no se confunde con "no tiene nada".
- **La salud vigente** es la de la última respuesta que pasó por S6; si no hay, la de la inscripción 2026. **El contacto vigente** es el de la última respuesta (S7 se completa siempre).
- Una respuesta "Sí" que no está en la inscripción 2026 ni en una inscripción nueva sale en `Revisar`: a esa familia la coordinación le pide que complete de nuevo eligiendo "No".

| Col | Título (exacto) | Tipo | Obligatoria | Ayuda / opciones |
|---|---|---|---|---|
| — | **Sección: Jugador (la ven todos)** | | | La primera pregunta tiene el salto: "No" va a **Datos que se piden una sola vez**; "Sí" va a **Documentación de reinscripción**. Forms lo aplica al tocar *Siguiente*. |
| C | ¿Ya completó la ficha del básquet la temporada pasada (2026)? | Opción múltiple | sí | Sí / No. Ayuda: "Elegí **Sí** si ya completaste la ficha del básquet el año pasado (2026). Elegí **No** si es la primera vez o si no te acordás." |
| D | DNI del jugador (sin puntos) | Respuesta corta | sí | Validación: expresión regular `^\d{7,8}$`, mensaje "Sólo números, sin puntos (7 u 8 dígitos)". Ayuda: "Escribilo sin puntos ni espacios. Si todavía no tiene DNI argentino, escribinos por WhatsApp." |
| E | Apellido del jugador | Respuesta corta | sí |  |
| F | Nombre del jugador | Respuesta corta | sí |  |
| G | Fecha de Nacimiento | Fecha | sí | Se pide siempre, también a los que ya jugaron. |
| H | Categoría | Desplegable | sí | ESCUELITA - MIXTO / U9 - MIXTO (2017 y 2018) / U11 - MIXTO (2015 y 2016) / U13 - MIXTO (2014 y 2013) / U15 - MASCULINO (2012 y 2011) / U15 - FEMENINO (2012 y 2011) / U17 - MASCULINO (2010 y 2009) / U17 - FEMENINO (2010 y 2009) / U21 - MASCULINO (2008, 2007, 2006 y 2005) / U21 - FEMENINO (2008, 2007, 2006 y 2005) / MAYORES FEMENINO. Ayuda: "Elegí la que incluye el año en que nació." |
| I | Rama | Opción múltiple | sí | Masculino / Femenino. Ayuda: "Si la categoría dice MASCULINO o FEMENINO, elegí la misma." |
| — | **Sección: Datos que se piden una sola vez** | | | Sólo se ve si contestó "No". Después sigue a **Documentación**. |
| J | Nacionalidad | Respuesta corta | sí |  |
| K | Número de Socio | Respuesta corta | sí | Ayuda: "Si no sabés el número, escribí **No sé**." |
| L | Grupo Sanguíneo | Desplegable | sí | A+ / A- / B+ / B- / AB+ / AB- / O+ / O- |
| M | Altura Actual (en cm) | Respuesta corta | no |  |
| N | Lateralidad | Desplegable | no | Diestro / Zurdo / Ambidiestro |
| O | Años de experiencia en Básquet | Respuesta corta | no |  |
| P | Club de Procedencia (en caso siempre jugar en Newell's aclararlo) | Respuesta corta | no |  |
| Q | Altura del Padre (en cm) (Dato para proyección de talla) | Respuesta corta | no |  |
| R | Altura de la Madre (en cm) (Dato para proyección de talla) | Respuesta corta | no |  |
| — | **Sección: Documentación** | | | Arranque de la sección: "Ahora los documentos. Vas a necesitar el DNI del jugador y el tuyo (frente y atrás) y una foto de cada uno de los dos. Podés sacarlas ahora con el celular." Termina con salto a **Salud**. |
| S | DNI jugador - frente | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto al frente del DNI del jugador. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| T | DNI jugador - dorso | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto a la parte de atrás del DNI del jugador. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| U | DNI adulto - frente | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto al frente de tu DNI (el del adulto responsable). Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| V | DNI adulto - dorso | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto a la parte de atrás de tu DNI. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| W | Foto del jugador | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Una foto del jugador, de frente y con la cara bien visible (tipo carnet), con fondo liso si se puede. Una sola foto, hasta 10 MB. |
| X | Foto del adulto | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Una foto tuya, de frente y con la cara bien visible (tipo carnet). Una sola foto, hasta 10 MB. |
| — | **Sección: Documentación de reinscripción** | | | Sólo se ve si contestó "Sí". Después sigue a **¿Cambió algo de salud?**. Arranque: "Como el año pasado no se pidieron fotos, esta vez las necesitamos todas. Es una sola vez: el año que viene sólo vas a subirlas si cambió algo." Los títulos llevan el sufijo para no repetirse con los de arriba; los archivos caen en la misma carpeta del chico. |
| Y | DNI jugador - frente (reinscripción) | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto al frente del DNI del jugador. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| Z | DNI jugador - dorso (reinscripción) | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto a la parte de atrás del DNI del jugador. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| AA | DNI adulto - frente (reinscripción) | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto al frente de tu DNI (el del adulto responsable). Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| AB | DNI adulto - dorso (reinscripción) | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto a la parte de atrás de tu DNI. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| AC | Foto del jugador (reinscripción) | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Una foto del jugador, de frente y con la cara bien visible (tipo carnet), con fondo liso si se puede. Una sola foto, hasta 10 MB. |
| AD | Foto del adulto (reinscripción) | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Una foto tuya, de frente y con la cara bien visible (tipo carnet). Una sola foto, hasta 10 MB. |
| — | **Sección: ¿Cambió algo de salud?** | | | La pregunta de abajo tiene salto: "Sí" va a **Salud**; "No" salta a **Contacto y emergencia**. |
| AE | ¿Cambió algo de salud desde 2026? | Opción múltiple | sí | Sí / No. Ayuda: "Por ejemplo, una alergia nueva, una lesión importante o un remedio nuevo. Si no cambió nada, elegí No." |
| — | **Sección: Salud** | | | La ve quien es nuevo o quien contestó "Sí". Después sigue a **Contacto y emergencia**. |
| AF | Obra Social / Prepaga / Seguro Médico | Respuesta corta | sí | Ayuda: "Si no tiene, escribí **No tiene**." |
| AG | Número de Afiliado | Respuesta corta | sí | Ayuda: "Si no tiene, escribí **No tiene**." |
| AH | Alertas médicas | Casillas | sí | Epilepsia o convulsiones / Asma / Diabetes / Problemas cardíacos o taquicardia / Desmayos / Alergia grave / Meningitis (antecedente) / Pérdida de conocimiento por golpe / **Ninguna**. Ayuda: "Marcá todo lo que corresponda. Si no tiene nada de esto, marcá **Ninguna**. No se puede dejar vacía." |
| AI | ¿Tiene alguna alergia? | Opción múltiple | sí | Sí / No |
| AJ | Alergia: a qué y qué hacer | Párrafo | no | Ayuda: "Sólo si contestaste Sí: a qué es alérgico y qué hay que hacer si le pasa." |
| AK | ¿Toma medicación habitual? | Opción múltiple | sí | Sí / No |
| AL | Medicación: cuál y dosis | Párrafo | no | Ayuda: "Sólo si contestaste Sí: qué remedio toma y cuánto." |
| AM | ¿Tiene que tener algo a mano? | Casillas | sí | Inhalador / Autoinyector de adrenalina / Insulina / Otro / Nada. Ayuda: "Lo que el profe tendría que tener a mano en un entrenamiento o partido." |
| AN | ¿Fue sometido a alguna intervención quirúrgica? (Especificar cuál y hace cuánto) | Párrafo | no |  |
| AO | ¿Es propenso a alguna enfermedad o tiene una indicación médica especial? | Párrafo | no |  |
| — | **Sección: Contacto y emergencia (la ven todos)** | | | Se completa en **cada** inscripción. |
| AP | Adulto responsable - nombre y apellido | Respuesta corta | sí | Madre, padre o tutor. |
| AQ | Adulto responsable - WhatsApp | Respuesta corta | sí | Validación: expresión regular `^\d{8,15}$`, mensaje "Sólo números, sin espacios ni guiones". Ayuda: "Con el código de área, sin 0 ni 15. Ejemplo: 3415551234." |
| AR | Contacto de urgencia - nombre y vínculo | Respuesta corta | sí | Ayuda: "Alguien que no sea el adulto de arriba, por si no atiende. Ejemplo: Marta, abuela." |
| AS | Contacto de urgencia - teléfono | Respuesta corta | sí | Validación: expresión regular `^\d{8,15}$`, mensaje "Sólo números, sin espacios ni guiones". |
| AT | Domicilio Completo | Respuesta corta | sí | Ayuda: "Escribilo de nuevo aunque no haya cambiado." |
| AU | Teléfono del Deportista | Respuesta corta | sí |  |
| AV | Email del Deportista | Respuesta corta | no | Ayuda: "Si es menor de 13, dejalo vacío o poné el tuyo." |
| — | **Sección: Escuela (la ven todos)** | | |  |
| AW | Nombre de la Institución Educativa | Respuesta corta | no |  |
| AX | Año/Grado que cursa | Respuesta corta | no |  |
| AY | Turno Escolar/Facultad | Casillas | no | Mañana / Tarde / Doble Escolaridad/Cursada |
| — | **Sección: Autorizaciones (las ven todos, se renuevan cada año)** | | |  |
| AZ | Autorización de Uso de Imagen | Casillas | no | Autorizo al club a utilizar imágenes/videos del deportista con fines exclusivos de difusión institucional, redes sociales y scouting técnico. **Opcional; no bloquea la inscripción.** No premarcada. |
| BA | Consentimiento de Datos | Casillas | sí | Declaro que todos los datos vertidos en este formulario son veraces y me comprometo a informar cualquier cambio de salud o contacto de forma inmediata. **Obligatoria**: sin ella no corresponde guardar la ficha médica de un menor. |
| BB | Emergencias en Semillero | Casillas | no | Autorizo al club a cargar en la aplicación Semillero el teléfono del adulto responsable, el contacto de urgencia, las afecciones médicas marcadas, las alergias, la medicación, la indicación médica especial y la obra social de mi hijo/a. Los verán sólo el profe de su categoría y la coordinación del club, y se usarán únicamente para actuar ante una emergencia. Puedo pedir que se corrijan o se borren en cualquier momento. Más información: política de privacidad de Semillero. **Opcional. No premarcada.** |
| BC | Avisos de recaudación | Casillas | no | Texto de la casilla: "Quiero enterarme de los eventos para colaborar con el básquet (cenas, rifas, campus). Lo que se recauda se usa para [material, viajes, … — ajustar con Javier a dónde va la plata]. Solo mandamos mails de estos eventos, nunca de partidos, y te podés dar de baja cuando quieras." **No premarcada.** |

## Comprobante de pago

Hoy los comprobantes llegan por WhatsApp. Acá quedan en la carpeta del chico, con el concepto en el nombre del archivo: `Comprobante de pago - Arancel octubre 2026 - SANCHEZ - 2026-10-18 14.30.jpg`. **Un comprobante subido no es un pago verificado**: lo verifica la coordinación en la hoja `Pagos verificados`.

**Un pago nuevo y simple** (ej. "Pantalón de entrenamiento") **no necesita formulario nuevo**: se suma como opción del desplegable `Concepto` y como fila en `Config` del tablero. Un formulario propio (Plantilla, abajo) sólo hace falta cuando el pago pide algo más: talle, cantidad de rifas.

**Arranque:**
> Con este formulario nos mandás el comprobante de lo que pagaste. Elegí qué estás pagando y sacale una foto al comprobante.
> Lo tenés que completar **cada vez que pagás**. Si tenés dos chicos, completalo dos veces.
> Después, la coordinación lo verifica.

| Col | Título (exacto) | Tipo | Obligatoria | Ayuda / opciones |
|---|---|---|---|---|
| C | DNI del jugador (sin puntos) | Respuesta corta | sí | Validación: expresión regular `^\d{7,8}$`, mensaje "Sólo números, sin puntos (7 u 8 dígitos)". Ayuda: "Escribilo sin puntos ni espacios. Si todavía no tiene DNI argentino, escribinos por WhatsApp." |
| D | Apellido del jugador | Respuesta corta | sí |  |
| E | Nombre del jugador | Respuesta corta | sí |  |
| F | Concepto | Desplegable | sí | Opciones = los conceptos activos de la hoja Config del tablero (ej. "Arancel octubre 2026", "Cuota anual 2026"). Se actualiza cada mes. Ayuda: "Elegí qué estás pagando." |
| G | Comprobante de pago | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto o una captura de pantalla al comprobante (la transferencia o el ticket), que se vea el monto y la fecha. Una sola foto o PDF, hasta 10 MB. |

## Plantilla

Para un pago o trámite que pide algo más (rifa, pase, pantalón con talle): *Hacer una copia*, ponerle nombre y sumar las preguntas. Las copias van dentro de `Formularios con archivos`: el comprobante cae en la carpeta del chico sin tocar código. Trae las 3 preguntas estándar **primero**, los ajustes de arriba y este arranque, que se edita:
> Este formulario es para [QUÉ ES]. Tené a mano [QUÉ HACE FALTA]. Después, [QUÉ PASA].

| Col | Título (exacto) | Tipo | Obligatoria | Ayuda / opciones |
|---|---|---|---|---|
| C | DNI del jugador (sin puntos) | Respuesta corta | sí | Validación: expresión regular `^\d{7,8}$`, mensaje "Sólo números, sin puntos (7 u 8 dígitos)". Ayuda: "Escribilo sin puntos ni espacios. Si todavía no tiene DNI argentino, escribinos por WhatsApp." |
| D | Apellido del jugador | Respuesta corta | sí |  |
| E | Nombre del jugador | Respuesta corta | sí |  |

Cada pregunta de archivo nueva lleva su ayuda corta, como las de arriba. El comprobante de ese pago se ve en la hoja `Pagos` del tablero como una columna "de formulario propio" (`google/sheets/TABLERO.md`, punto 5).

## Quiero colaborar

Sin login, sin subidas, sin datos de menores. Las respuestas van a una planilla propia, no al Tablero.

**Arranque:**
> Gracias por querer ayudar al básquet de Newell's. Contanos cómo y te escribimos. Tarda 2 minutos.

| Col | Título (exacto) | Tipo | Obligatoria | Ayuda / opciones |
|---|---|---|---|---|
| B | Nombre y apellido | Respuesta corta | sí |  |
| C | Empresa o comercio | Respuesta corta | no | Ayuda: "Si colaborás por tu negocio." |
| D | Tu mail | Respuesta corta | sí | Validación: *Texto → Correo electrónico*. Ayuda: "Te escribimos acá cuando haya un evento donde podés dar una mano (rifas, polladas, etc.)." |
| E | WhatsApp | Respuesta corta | no | Ayuda: "Si preferís que te escribamos por ahí." |
| F | ¿Cómo querés colaborar? | Casillas | sí | Ser sponsor / Donar material / Ayudar en eventos / Otra |
| G | ¿Querés que te avisemos de los eventos? | Opción múltiple | sí | Sí, avísenme por mail de las rifas, polladas y otros eventos para dar una mano / No, sólo quiero que me contacten por lo que puse arriba. **Sin opción premarcada.** Descripción: "Solo mandamos mails de estos eventos, nunca de partidos, y te podés dar de baja cuando quieras escribiéndonos." |
| H | Mensaje | Párrafo | no |  |

El mail y el permiso quedan **sólo en la planilla de respuestas de este formulario** (en Google): no se cargan en Semillero. Para avisar de un evento se filtra la columna G por el "Sí". El portal lo dice en la tarjeta: "Dejanos tu mail y te avisamos de los eventos".
