# Datos conectados del chico: categoría por año, precarga 2026 y datos de emergencia

Fecha: 19/10/2026 · Migración: **0059** · Rama `claude/datos-conectados-85d8e3`

Premisa: lo que la familia ya escribió en el formulario del club no se vuelve a cargar. DNI, domicilio, fotos y documentos nunca entran a Semillero.

## 1. Categoría por año de nacimiento y cambio de temporada

**Regla (formularios 2026).** `Uxx` = nacidos en `T−xx` y `T−xx+1`; U21 abarca cuatro años (`T−21`…`T−18`); Escuelita = `T−7` en adelante; Mayores = `T−22` y antes. Para 2026: Escuelita 2019+, U9 2017–18, U11 2015–16, U13 2013–14, U15 2011–12, U17 2009–10, U21 2005–08.

**Función pura** `categoriaPorNacimiento(fecha, temporada, rama)` en `src/data/categorias.js` → `{ grupo, codigo }`. `grupo` es siempre el de la regla (`'U15'`, `'ESCUELITA'`…); `codigo` es el de Semillero o `null`:

| Grupo | M | F |
|---|---|---|
| Escuelita, U9, U11 | null | null |
| U13 | `U13M` | null |
| U15 / U17 / U21 | `U15M` / `U17M` / `U21M` | null |
| Mayores | `MAY_M` | `MAY_F` |

Sin fecha, sin rama o temporada que no sea un año → `codigo: null` con `motivo`. **Las categorías que no existen no se inventan**: el chico queda "sin plantel en Semillero" y el coordinador decide (otro plantel o ninguno). Crear U15F u otras sigue siendo por SQL, como hoy.

**La rama no se guarda**: `jugador` no tiene sexo y no hace falta sumarlo. Sale de los planteles vigentes del chico (`…M` → M, `…F` → F); en la precarga, de la columna Rama.

**Asistente de cambio de temporada** (Coordinación → "Temporada nueva"), tres pasos:
1. **Abrir 2027**: crea la temporada y copia los planteles de la vigente (misma categoría y `codigo_cabb`). Aviso: desde ese momento el panel de coordinación muestra 2027.
2. **Profes**: muestra qué planteles nuevos no tienen profe y lleva a Coordinación → Profes. Va antes que los chicos a propósito: al confirmar los pases se cierran las pertenencias 2026 y, sin profe asignado en 2027, nadie ve a esos chicos.
3. **Chicos**: uno por fila, agrupados por plantel propuesto. Cada fila: nombre, año de nacimiento, categoría 2026 → propuesta 2027, y un selector con los planteles 2027 + "No sigue" + "Decidir después". Los que no tienen fecha o caen en una categoría inexistente arrancan en "Decidir después" y resaltados. Confirmar es una sola RPC transaccional; se puede volver a entrar y confirmar los que quedaron.

Por qué el coordinador escribe acá (0018 dice que controla, no decide el entrenamiento): armar quién está en qué plantel es estructura del club, como asignar profes, no contenido técnico. Al coordinador se le expone **el año** de nacimiento, no la fecha completa.

**Base.** `abrir_temporada(club, nombre)` y `confirmar_pases(club, filas)`: `security definer` con `es_coordinador_de`. `confirmar_pases` primero inserta la pertenencia nueva (`desde` = hoy) y después cierra las vigentes de temporadas anteriores (el trigger `pertenencia_sellar_cierre` sella `hasta` y `cerrado_por`). Nada se borra: la historia del jugador (0056) ya lee pertenencias cerradas por temporada. `pases_de_temporada(club)` devuelve `jugador_id, nombre_limpio, anio_nacimiento, codigos[]`.

## 2. Precarga del plantel 2026

Lo que ya está: `importar_inscriptos` acepta filas sin mail (el chico entra sin vínculo de familia). Se suma un test que lo fije.

**Camino**: un prompt para Claude en el navegador (`google/PRECARGA-2026.md`) que, en la cuenta del club:
1. Desde el formulario "Base de Datos Básquet NOB 2026" → Respuestas → **crea una hoja de cálculo nueva** vinculada (trae las 101 respuestas sin las ediciones a mano de la planilla vieja).
2. Le agrega una pestaña "Para Semillero" **sólo con fórmulas** (Claude no lee las respuestas): Apellido = primera palabra de "Apellido y Nombre", Nombre = el resto; fecha; categoría tal cual; mail vacío (el formulario no pide el del responsable, y el "Email del Deportista" no sirve para vincular familia); Rama = MASCULINO/FEMENINO si la categoría lo dice, vacía en las mixtas; una columna "Revisar" que marca nombres de 3 palabras o más y apellidos con partícula (de, del, di, la…). Sin DNI ni salud.
3. Tomás corrige a mano los "Revisar", baja la pestaña como .xlsx y la importa por plantel.

Cambios en el importador: (a) en el plantel U13M, las filas "U13 mixto sin rama" aparecen **destildadas** con la pregunta "¿Es de U13 masculino?" en vez de saltearse; (b) si la categoría elegida no coincide con la del año de nacimiento, aviso en la revisión ("dice U15, por año es U17"). Duplicados del formulario (mismo nombre y fecha) ya se juntan.

Ojo: importar exige profe con el plantel asignado; el coordinador no puede. Tomás tiene que estar asignado a cada plantel o importar cada profe el suyo.

## 3. Datos de emergencia para el profe

**Qué se guarda** (tabla `emergencia_jugador`, 1 a 1 con `jugador`): teléfono del adulto (30), contacto de urgencia nombre y teléfono (80), alertas como lista cerrada (`desmayos, taquicardia, convulsiones, epilepsia, meningitis, diabetes, perdida_conocimiento, asma`; `{}` = "ninguna marcada en la inscripción"), alergias (300), medicación (300), obra social (60), `actualizado_en/por` sellados. NULL = no se sabe. Afuera a propósito: grupo sanguíneo (en la guardia lo testean), número de afiliado (lo trae la familia), cirugías.

**Quién lo ve (RLS)**: el profe con asignación vigente a un plantel donde el chico tiene pertenencia vigente, y el coordinador de su club. Ni el jugador, ni la familia (ninguna función de 0029/0057 lo devuelve), ni un profe de otro plantel. Escribe sólo la importación (`importar_emergencias`, `security invoker`, `puede_escribir_plantel`), que pisa lo anterior. **Se borra solo**: un trigger borra la fila cuando el chico se queda sin ninguna pertenencia vigente (por eso `confirmar_pases` inserta antes de cerrar).

**Dónde**: botón "Emergencia" en la cabecera de la ficha y "Emergencias" en Plantel (lista del plantel). El coordinador, en Coordinación, por categoría y de sólo lectura. Teléfonos con `tel:` para llamar con un toque; alertas en rojo y arriba. Se piden al abrir (no viajan con la ficha). Ninguna marca de salud aparece fuera de esa vista.

**Sin señal (recomendación)**: se queda **en memoria**: si el profe la abre antes de arrancar, sigue en pantalla aunque se corte la señal, mientras no recargue. No se guarda nada en el celular. Por qué: el service worker de portal-pwa no guarda `/src` a propósito, así que sin red la app ni arranca en frío; una copia en el celular sólo serviría con otro trabajo de offline y dejaría salud de menores en un aparato que se pierde. Alternativa, si Tomás la prefiere: "Llevar a la cancha", copia del plantel en el celular por 12 h, borrada al salir de la cuenta o al vencer; necesita además que el SW guarde la app.

**Cómo llega**: la inscripción suma una pestaña "Emergencias para Semillero" (Apellido y nombre | Fecha de nacimiento | Teléfono del adulto | Urgencia | Afecciones | Alergias | Medicación | Obra social), sólo con las filas con el consentimiento de datos tildado. Plantel → "Importar emergencias": cruza por nombre **sin importar el orden** de las palabras + fecha contra los chicos del plantel; no crea jugadores. Texto más largo que el límite: se recorta y avisa "revisalo en la planilla". Para 2026 el mismo prompt del punto 2 arma esa pestaña desde las respuestas.

**Alternativa: no guardarlo y abrir la planilla de Google.** A favor: Semillero no toca salud ni cambia la política. En contra: cada profe necesitaría acceso a toda la planilla (DNI, domicilio y ficha médica de **todas** las categorías), la búsqueda en Sheets en el celular es lenta justo cuando apura, y no caduca cuando el profe deja el plantel. **Recomiendo guardar el mínimo en Semillero**: expone menos datos, a menos gente y por menos tiempo.

**Legal (bloqueante para publicar)**: `privacidad.html` hoy dice que la app **no guarda teléfono ni diagnósticos médicos**. Hay que cambiarlo (salud = dato sensible, Ley 25.326 art. 7: consentimiento expreso, finalidad, quién accede, cuándo se borra) y el formulario tiene que nombrar a Semillero en el consentimiento. Lo coordina la sesión coordinadora junto con los cambios legales del portal; esta rama no toca `public/legal/`, y la pantalla de emergencias no se publica antes que la política.

## Decisiones para Tomás
1. Sin señal: ¿en memoria (recomendado) o "Llevar a la cancha" por 12 h?
2. ¿Sumamos "Indicación médica especial" (texto corto) a la emergencia? El formulario la pide aparte.
3. ¿El coordinador ve la emergencia de todo el club? Es una excepción a 0018 (hoy no ve filas de chicos).
