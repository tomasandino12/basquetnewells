# Formularios de Google

Spec: `docs/superpowers/specs/2026-10-18-inscripcion-google-design.md`. Todos viven en la cuenta de Google del básquet y adentro de la carpeta `Formularios con archivos`. Los títulos de las preguntas estándar tienen que ser **idénticos** a los de `google/apps-script/config.gs`; el orden de las columnas, idéntico al Mapa de `google/sheets/TABLERO.md` (un test lo comprueba).

La columna `Col` es la letra que va a tener la pregunta en la pestaña de respuestas (la `A` es la marca temporal y la `B`, el mail verificado). Las filas "Sección" no cuentan.

Ajustes del formulario (en todos):
- *Configuración → Respuestas → Recopilar direcciones de correo electrónico*: **Verificado**.
- *Configuración → Respuestas*: **no** limitar a una respuesta (un adulto con dos chicos manda dos) y **no** permitir editar después de enviar.
- Las preguntas de subir archivo hacen que pida iniciar sesión con Google; es lo esperado.
- **Nunca** mandar links prellenados con datos del chico.
- Vincular con la planilla del tablero y renombrar la pestaña (ver `google/sheets/TABLERO.md`).
- Dejar el formulario dentro de la carpeta `Formularios con archivos`.

## Cómo se escribe para las familias
No suponemos que saben usar la compu. En cada formulario: un **arranque** (qué es, qué tener a mano, qué pasa después) y una **ayuda en cada pregunta de archivo**, en voseo y con frases cortas. La guía para las familias, para pegar en un Google Doc, está en `google/formularios/PADRES.md`.

## Inscripción (chicos nuevos)

Título: **Ficha Individual del Deportista - Temporada 2026** (es el formulario actual, con los cambios de abajo; **moverlo primero a la cuenta del básquet**, ver `google/GUIA.md`).

**Arranque (descripción del formulario):**
> Este formulario es para inscribir a un chico **por primera vez** en el club. Si ya jugó el año pasado, usá el de *Reinscripción*.
> Tené a mano: el DNI del chico y el tuyo (para sacarles una foto de frente y de atrás) y, si querés, una foto de cada uno. Tarda unos 10 minutos.
> Después, la coordinación lo revisa. Si falta algo, te avisa tu profe.

**Texto de privacidad (sección inicial) — `[VALIDAR CON COORDINACIÓN]`:**
> Estos datos los ve **sólo la coordinación del básquet**. Se usan para fichar al chico en la CABB, para la ficha de emergencia y para cargarlo en la app del club (apellido, nombre, fecha de nacimiento, categoría y tu mail). Los documentos y fotos quedan guardados en la cuenta del club y **no se publican**. La ficha médica no sale de acá.

| Col | Título (exacto) | Tipo | Obligatoria | Ayuda / opciones |
|---|---|---|---|---|
| C | DNI del jugador (sin puntos) | Respuesta corta | sí | Validación: expresión regular `^\d{7,8}$`, mensaje "Sólo números, sin puntos (7 u 8 dígitos)". Ayuda: "Escribilo sin puntos ni espacios. Si todavía no tiene DNI argentino, escribinos por WhatsApp." |
| D | Apellido del jugador | Respuesta corta | sí |  |
| E | Nombre del jugador | Respuesta corta | sí |  |
| F | Nacionalidad | Respuesta corta | sí |  |
| G | Fecha de Nacimiento | Fecha | sí |  |
| H | Número de Socio | Respuesta corta | sí |  |
| I | Categoría 2026 | Desplegable | sí | ESCUELITA - MIXTO / U9 - MIXTO (2017 y 2018) / U11 - MIXTO (2015 y 2016) / U13 - MIXTO (2014 y 2013) / U15 - MASCULINO (2012 y 2011) / U15 - FEMENINO (2012 y 2011) / U17 - MASCULINO (2010 y 2009) / U17 - FEMENINO (2010 y 2009) / U21 - MASCULINO (2008, 2007, 2006 y 2005) / U21 - FEMENINO (2008, 2007, 2006 y 2005) / MAYORES FEMENINO |
| J | Rama | Opción múltiple | sí | Masculino / Femenino. Ayuda: "Si la categoría dice MASCULINO o FEMENINO, elegí la misma." |
| K | Domicilio Completo | Respuesta corta | sí |  |
| L | Teléfono del Deportista | Respuesta corta | sí |  |
| M | Email del Deportista | Respuesta corta | no | Ayuda: "Si es menor de 13, dejalo vacío o poné el tuyo." |
| N | Nombre y Apellido del Adulto Responsable (Padre, Madre o Tutor) | Respuesta corta | sí |  |
| O | Teléfono de Familiar a Cargo (Para grupos de WhatsApp) | Respuesta corta | sí |  |
| — | **Sección: Perfil deportivo y proyección** | | |  |
| P | Altura Actual (en cm) | Respuesta corta | no |  |
| Q | Lateralidad | Desplegable | no | Diestro / Zurdo / Ambidiestro |
| R | Años de experiencia en Básquet | Respuesta corta | no |  |
| S | Club de Procedencia (en caso siempre jugar en Newell's aclararlo) | Respuesta corta | no |  |
| T | Altura del Padre (en cm) (Dato para proyección de talla) | Respuesta corta | no |  |
| U | Altura de la Madre (en cm) (Dato para proyección de talla) | Respuesta corta | no |  |
| — | **Sección: Datos académicos** | | |  |
| V | Nombre de la Institución Educativa | Respuesta corta | no |  |
| W | Año/Grado que cursa en 2026 | Respuesta corta | no |  |
| X | Turno Escolar/Facultad | Casillas | no | Mañana / Tarde / Doble Escolaridad/Cursada |
| — | **Sección: Ficha médica (confidencial)** | | |  |
| Y | Obra Social / Prepaga / Seguro Médico | Respuesta corta | sí |  |
| Z | Número de Afiliado | Respuesta corta | sí |  |
| AA | Grupo Sanguíneo | Desplegable | sí | A+ / A- / B+ / B- / AB+ / AB- / O+ / O- |
| AB | ¿Ha sufrido alguna de estas afecciones? | Casillas | no | Desmayos / Taquicardia / Convulsiones / Epilepsia / Meningitis / Diabetes / Pérdida de conocimiento traumática / Asma |
| AC | ¿Es alérgico a algún medicamento, alimento o sustancia? (Si es sí, especificar a qué) | Párrafo | no |  |
| AD | ¿Fue sometido a alguna intervención quirúrgica? (Especificar cuál y hace cuánto) | Párrafo | no |  |
| AE | ¿Es propenso a alguna enfermedad o tiene una indicación médica especial? | Párrafo | no |  |
| AF | ¿Actualmente ingiere algún medicamento de forma regular? (Especificar dosis y motivo) | Párrafo | no |  |
| AG | EN CASO DE URGENCIA LLAMAR A (Nombre y Teléfono) | Respuesta corta | sí |  |
| — | **Sección: Documentación** | | | Arranque de la sección: "Ahora los documentos. Vas a necesitar el DNI del jugador y el tuyo (frente y atrás) y una foto de cada uno de los dos. Podés sacarlas ahora con el celular." |
| AH | DNI jugador - frente | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto al frente del DNI del jugador. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| AI | DNI jugador - dorso | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto a la parte de atrás del DNI del jugador. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| AJ | DNI adulto - frente | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto al frente de tu DNI (el del adulto responsable). Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| AK | DNI adulto - dorso | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Sacale una foto a la parte de atrás de tu DNI. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| AL | Foto del jugador | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Una foto del jugador, de frente y con la cara bien visible (tipo carnet), con fondo liso si se puede. Una sola foto, hasta 10 MB. |
| AM | Foto del adulto | Subir archivo (1 archivo; imagen o PDF; 10 MB) | sí | Una foto tuya, de frente y con la cara bien visible (tipo carnet). Una sola foto, hasta 10 MB. |
| — | **Sección: Autorizaciones legales** | | |  |
| AN | Autorización de Uso de Imagen | Casillas | no | Autorizo al club a utilizar imágenes/videos del deportista con fines exclusivos de difusión institucional, redes sociales y scouting técnico. **Opcional; no bloquea la inscripción.** |
| AO | Consentimiento de Datos | Casillas | sí | Declaro que todos los datos vertidos en este formulario son veraces y me comprometo a informar cualquier cambio de salud o contacto de forma inmediata. **Obligatoria**: sin ella no corresponde guardar la ficha médica de un menor. |
| AP | Avisos de recaudación | Casillas | no | Texto de la casilla: "Quiero enterarme de los eventos para colaborar con el básquet (cenas, rifas, campus). Lo que se recauda se usa para [material, viajes, … — ajustar con Javier a dónde va la plata]. Solo mandamos mails de estos eventos, nunca de partidos, y te podés dar de baja cuando quieras." **No premarcada.** |

Cambios respecto del formulario actual (y nada más): "Apellido y Nombre del Deportista" partido en dos preguntas; "DNI / Pasaporte" pasa a "DNI del jugador (sin puntos)" con validación; pregunta **Rama** nueva; sección **Documentación** con las 6 subidas; "Email del Deportista" pasa a opcional; "Consentimiento de Datos" obligatoria; casilla de recaudación nueva.

## Reinscripción (chicos que ya se inscribieron alguna vez)

Pide las 3 preguntas estándar y **sólo lo que cambia**. No pide: nacionalidad, fecha de nacimiento, número de socio, grupo sanguíneo, altura del padre y de la madre, lateralidad, club de procedencia ni fotos. Esos datos salen de su última inscripción completa, por DNI. Si el DNI no aparece en ninguna inscripción anterior, el chico sale en la hoja `Revisar` del tablero.

**Arranque:**
> Este formulario es para chicos que **ya jugaron** en el club. Si es la primera vez, usá el de *Inscripción*.
> Tené a mano el DNI del chico (sólo hace falta la foto si cambió). Tarda unos 5 minutos.
> Después, la coordinación lo revisa. Si falta algo, te avisa tu profe.

| Col | Título (exacto) | Tipo | Obligatoria | Ayuda / opciones |
|---|---|---|---|---|
| C | DNI del jugador (sin puntos) | Respuesta corta | sí | Validación: expresión regular `^\d{7,8}$`, mensaje "Sólo números, sin puntos (7 u 8 dígitos)". Ayuda: "Escribilo sin puntos ni espacios. Si todavía no tiene DNI argentino, escribinos por WhatsApp." |
| D | Apellido del jugador | Respuesta corta | sí |  |
| E | Nombre del jugador | Respuesta corta | sí |  |
| F | Categoría 2026 | Desplegable | sí | ESCUELITA - MIXTO / U9 - MIXTO (2017 y 2018) / U11 - MIXTO (2015 y 2016) / U13 - MIXTO (2014 y 2013) / U15 - MASCULINO (2012 y 2011) / U15 - FEMENINO (2012 y 2011) / U17 - MASCULINO (2010 y 2009) / U17 - FEMENINO (2010 y 2009) / U21 - MASCULINO (2008, 2007, 2006 y 2005) / U21 - FEMENINO (2008, 2007, 2006 y 2005) / MAYORES FEMENINO |
| G | Rama | Opción múltiple | sí | Masculino / Femenino |
| H | Altura Actual (en cm) | Respuesta corta | no |  |
| I | Domicilio Completo | Respuesta corta | sí | Ayuda: "Escribilo de nuevo aunque no haya cambiado." |
| J | Teléfono del Deportista | Respuesta corta | sí |  |
| K | Teléfono de Familiar a Cargo (Para grupos de WhatsApp) | Respuesta corta | sí |  |
| L | Email del Deportista | Respuesta corta | no | Ayuda: "Si es menor de 13, dejalo vacío o poné el tuyo." |
| M | Nombre y Apellido del Adulto Responsable (Padre, Madre o Tutor) | Respuesta corta | sí |  |
| N | Nombre de la Institución Educativa | Respuesta corta | no |  |
| O | Año/Grado que cursa en 2026 | Respuesta corta | no |  |
| P | Turno Escolar/Facultad | Casillas | no | Mañana / Tarde / Doble Escolaridad/Cursada |
| Q | Obra Social / Prepaga / Seguro Médico | Respuesta corta | sí |  |
| R | Número de Afiliado | Respuesta corta | sí |  |
| — | **Sección: Salud** | | | La pregunta de abajo tiene salto: "Sí" va a la sección "Qué cambió en la salud"; "No" salta a "Urgencia y DNI". |
| S | ¿Cambió algo de salud desde la última inscripción? | Opción múltiple | sí | Sí / No |
| — | **Sección: Qué cambió en la salud** | | | Sólo se ve si contestó "Sí". Después sigue a "Urgencia y DNI". |
| T | ¿Ha sufrido alguna de estas afecciones? | Casillas | no | Las mismas opciones que la inscripción |
| U | ¿Es alérgico a algún medicamento, alimento o sustancia? (Si es sí, especificar a qué) | Párrafo | no |  |
| V | ¿Fue sometido a alguna intervención quirúrgica? (Especificar cuál y hace cuánto) | Párrafo | no |  |
| W | ¿Es propenso a alguna enfermedad o tiene una indicación médica especial? | Párrafo | no |  |
| X | ¿Actualmente ingiere algún medicamento de forma regular? (Especificar dosis y motivo) | Párrafo | no |  |
| — | **Sección: Urgencia y DNI** | | | La pregunta "¿Cambió el DNI del jugador?" tiene salto: "Sí" va a "Fotos del DNI nuevo"; "No" salta a "Autorizaciones". |
| Y | EN CASO DE URGENCIA LLAMAR A (Nombre y Teléfono) | Respuesta corta | sí |  |
| Z | ¿Cambió el DNI del jugador? | Opción múltiple | sí | Sí / No. Ayuda: "Por ejemplo, si lo renovó. Si no cambió, elegí No: no hace falta subir nada." |
| — | **Sección: Fotos del DNI nuevo** | | | Sólo se ve si contestó "Sí". |
| AA | DNI jugador - frente | Subir archivo (1 archivo; imagen o PDF; 10 MB) | no | Sacale una foto al frente del DNI nuevo. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| AB | DNI jugador - dorso | Subir archivo (1 archivo; imagen o PDF; 10 MB) | no | Sacale una foto a la parte de atrás del DNI nuevo. Sacale una foto con el celular, sobre una mesa y con luz, que se lean bien los números. Se sube desde la galería o la cámara. Una sola foto o un PDF, hasta 10 MB. |
| — | **Sección: Autorizaciones (se renuevan cada año)** | | |  |
| AC | Autorización de Uso de Imagen | Casillas | no | Mismo texto que la inscripción. Opcional. |
| AD | Consentimiento de Datos | Casillas | sí | Mismo texto que la inscripción. Obligatoria. |
| AE | Avisos de recaudación | Casillas | no | Mismo texto que la inscripción. No premarcada. |

## Comprobante de aranceles

Hoy los comprobantes llegan por WhatsApp. Acá quedan en la carpeta del chico, con el concepto en el nombre del archivo: `Comprobante de pago - Arancel octubre 2026 - SANCHEZ - 2026-10-18 14.30.jpg`. **Un comprobante subido no es un pago verificado**: lo verifica la coordinación en la hoja `Pagos verificados`.

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

## Plantilla — formulario con archivos

Para formularios nuevos (pase, rifas, lo que pida coordinación): *Hacer una copia*, ponerle nombre y sumar las preguntas de subida con el título que se quiere ver en el archivo. Trae las 3 preguntas estándar **primero**, los ajustes de arriba y este arranque, que se edita:
> Este formulario es para [QUÉ ES]. Tené a mano [QUÉ HACE FALTA]. Después, [QUÉ PASA].

| Col | Título (exacto) | Tipo | Obligatoria | Ayuda / opciones |
|---|---|---|---|---|
| C | DNI del jugador (sin puntos) | Respuesta corta | sí | Validación: expresión regular `^\d{7,8}$`, mensaje "Sólo números, sin puntos (7 u 8 dígitos)". Ayuda: "Escribilo sin puntos ni espacios. Si todavía no tiene DNI argentino, escribinos por WhatsApp." |
| D | Apellido del jugador | Respuesta corta | sí |  |
| E | Nombre del jugador | Respuesta corta | sí |  |

Cada pregunta de archivo nueva lleva su ayuda corta, como las de arriba.
