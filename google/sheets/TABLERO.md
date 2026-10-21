# Tablero de documentación y pagos (planilla de Google)

Spec: `docs/superpowers/specs/2026-10-19-formularios-v2-design.md` (parte de la `2026-10-18-inscripcion-google-design.md`). Todo son fórmulas, salvo las hojas de 2026, que escribe el script del Tablero (`google/apps-script-tablero/`, punto 13).

> **Nombres de funciones.** En Sheets con regional Argentina `UNIQUE`, `FILTER`, `QUERY`, `ARRAYFORMULA` e `IMPORTRANGE` se escriben en inglés, y el "si error" es `SI.ERROR`; el resto (`SI`, `BUSCARX`, `CONTAR.SI.CONJUNTO`, `TRANSPONER`, `HIPERVINCULO`, `FECHA.MES`, `MINUSC`, `HALLAR`, `ESNUMERO`, `FILAS`) está en español. **Si Sheets no reconoce un nombre, el agente del navegador lo verifica (autocompletado de la celda) y avisa antes de cambiarlo.** Los más dudosos: `BUSCARX`, `TRANSPONER`, `HIPERVINCULO`, `FECHA.MES`.

> **Estas fórmulas no se pudieron probar en Google desde acá.** Se escribieron contra el modelo de las pestañas de Forms. La prueba manual de `google/GUIA.md` es la que las valida; si una da error, el punto 12 de este archivo dice dónde mirar.

## 0. Antes de empezar

1. Crear la planilla **"Tablero <temporada>"** en la **cuenta de la Comisión Básquet**, dentro de la carpeta `Inscripción y documentación` (no en una cuenta personal).
2. *Archivo → Configuración*: **configuración regional = Argentina**. Con eso las fórmulas de acá andan tal cual están escritas: argumentos separados por `;` y, dentro de `{ }`, columnas separadas por `\` y filas por `;`. (Si la planilla queda en otra región, no funcionan.)
3. Vincular **sólo estos dos formularios** con esta planilla (*Respuestas → Vincular con Hojas → Seleccionar hoja de cálculo existente*): Inscripción y Comprobante de pago. Forms crea una pestaña por formulario y le pone "Respuestas de formulario 1". **Renombrarlas** exactamente así (con tilde): `Inscripción` y `Comprobantes`. Renombrar no rompe el vínculo. Los formularios sin login (Quiero jugar, Quiero colaborar) van a **planillas propias**, no a esta.
4. **No escribir nunca sobre esas pestañas**: Forms las reescribe cuando se cambian preguntas. Lo que se anota a mano va en `Entregas a mano`, `Pagos verificados` y `Correcciones 2026`.
5. Las fórmulas leen las pestañas por **letra de columna**, así que el orden de las preguntas de los formularios importa. El orden está en `google/formularios/FORMULARIOS.md` y tiene que coincidir con este mapa (un test lo comprueba). Sólo se mapean las columnas que se usan; la ficha médica se lee únicamente para armar `Salida Emergencias` (punto 9.2).

### Mapa de columnas

En toda pestaña de respuestas: **A** = Marca temporal y **B** = Dirección de correo electrónico (el mail verificado).

| Pestaña | Columna | Título de la pregunta |
|---|---|---|
| Inscripción | C | ¿Ya completó la ficha del básquet la temporada pasada (2026)? |
| Inscripción | D | DNI del jugador (sin puntos) |
| Inscripción | E | Apellido del jugador |
| Inscripción | F | Nombre del jugador |
| Inscripción | G | Fecha de Nacimiento |
| Inscripción | H | Categoría |
| Inscripción | I | Rama |
| Inscripción | S | DNI jugador - frente |
| Inscripción | T | DNI jugador - dorso |
| Inscripción | U | DNI adulto - frente |
| Inscripción | V | DNI adulto - dorso |
| Inscripción | W | Foto del jugador |
| Inscripción | X | Foto del adulto |
| Inscripción | Y | DNI jugador - frente (reinscripción) |
| Inscripción | Z | DNI jugador - dorso (reinscripción) |
| Inscripción | AA | DNI adulto - frente (reinscripción) |
| Inscripción | AB | DNI adulto - dorso (reinscripción) |
| Inscripción | AC | Foto del jugador (reinscripción) |
| Inscripción | AD | Foto del adulto (reinscripción) |
| Inscripción | AE | ¿Cambió algo de salud desde 2026? |
| Inscripción | AF | Obra Social / Prepaga / Seguro Médico |
| Inscripción | AH | Alertas médicas |
| Inscripción | AI | ¿Tiene alguna alergia? |
| Inscripción | AJ | Alergia: a qué y qué hacer |
| Inscripción | AK | ¿Toma medicación habitual? |
| Inscripción | AL | Medicación: cuál y dosis |
| Inscripción | AM | ¿Tiene que tener algo a mano? |
| Inscripción | AO | ¿Es propenso a alguna enfermedad o tiene una indicación médica especial? |
| Inscripción | AP | Adulto responsable - nombre y apellido |
| Inscripción | AQ | Adulto responsable - WhatsApp |
| Inscripción | AR | Contacto de urgencia - nombre y vínculo |
| Inscripción | AS | Contacto de urgencia - teléfono |
| Inscripción | BA | Consentimiento de Datos |
| Inscripción | BB | Emergencias en Semillero |
| Comprobantes | C | DNI del jugador (sin puntos) |
| Comprobantes | F | Concepto |
| Comprobantes | G | Comprobante de pago |

## 1. Hojas

Crear estas hojas, con estos nombres, además de las 2 pestañas de respuestas: `Config`, `Base`, `Tablero`, `Pagos`, `Pagos verificados`, `Entregas a mano`, `Faltan reinscribir`, `Revisar`, `Buscar`, `Salida Semillero`, `Aux emergencias`, `Salida Emergencias`, `Correcciones 2026`. El script (punto 13) crea solo `Inscripción 2026`, `Semillero 2026`, `Emergencias 2026` y `Revisar 2026`. `Base` y `Aux emergencias` se pueden ocultar.

## 2. Config

| Celda | Contenido |
|---|---|
| `A1` / `B1` | `Temporada` / `2026` |
| `A2` / `B2` | `Inicio de temporada` / una fecha, ej. `01/01/2026`. Los chicos que cuentan este año son los que mandaron algo **desde** esa fecha |
| `A3` / `B3` | `Inicio de la temporada anterior` / `=FECHA.MES(B2; -12)` |
| `A12` | `Conceptos de pago activos` |
| `A13:A22` | Hasta 10 conceptos, uno por celda, **idénticos** a las opciones del desplegable `Concepto` del formulario Comprobante de pago (ej. `Arancel octubre 2026`, `Abono CABB 2026`). Un pago nuevo y simple se suma acá y en el desplegable, sin formulario nuevo |

## 3. Base (hoja auxiliar)

Toma la pestaña `Inscripción` (una sola: ya no hay Reinscripción aparte) y la ordena por fecha. Encabezados (fila 1, a mano): `Fecha | DNI | Apellido | Nombre | Categoría | Rama | Mail | Nacimiento | Alta | Teléfono adulto | Contacto de urgencia | Emergencias Semillero | Afecciones | Alergias | Medicación | Indicación | Obra social`. En `Base!A2`:

```
=SI.ERROR(ARRAYFORMULA(QUERY({
'Inscripción'!A2:A \ 'Inscripción'!D2:D&"" \ MAYUSC(ESPACIOS('Inscripción'!E2:E)) \ NOMPROPIO(ESPACIOS('Inscripción'!F2:F)) \ 'Inscripción'!H2:H \ 'Inscripción'!I2:I \ 'Inscripción'!B2:B \ 'Inscripción'!G2:G \
SI('Inscripción'!A2:A=""; ""; SI('Inscripción'!C2:C="Sí"; "Reinscripción"; "Nueva")) \
'Inscripción'!AQ2:AQ&"" \ SI('Inscripción'!AR2:AR=""; ""; 'Inscripción'!AR2:AR&" - "&'Inscripción'!AS2:AS&"") \ SI('Inscripción'!BB2:BB<>""; "Sí"; "") \
'Inscripción'!AH2:AH \
SI('Inscripción'!AI2:AI="Sí"; "Sí: "&'Inscripción'!AJ2:AJ; SI('Inscripción'!AI2:AI="No"; "No"; "")) \
SI('Inscripción'!AK2:AK="Sí"; "Sí: "&'Inscripción'!AL2:AL; SI('Inscripción'!AK2:AK="No"; "No"; "")) \
SI('Inscripción'!AM2:AM=""; 'Inscripción'!AO2:AO; SI('Inscripción'!AO2:AO=""; ""; 'Inscripción'!AO2:AO&" · ")&"A mano: "&'Inscripción'!AM2:AM) \
'Inscripción'!AF2:AF
}; "select * where Col1 is not null order by Col1"; 0)); "")
```

- **Nombres normalizados.** El apellido va en `MAYUSC` y el nombre en `NOMPROPIO`, los dos con `ESPACIOS` (sin espacios de más). Las respuestas crudas de la pestaña `Inscripción` no se tocan: la normalización vive sólo acá y se propaga al Tablero, a `Salida Semillero` y a `Salida Emergencias`. Limitación: `NOMPROPIO` pone mayúscula después de cualquier espacio (`De La Torre`); no lo arregla, es sólo estética.
- **Reenvíos:** si una familia manda el formulario dos veces, vale **la última respuesta por DNI** (`BUSCARX` con `-1` busca de abajo hacia arriba). Las respuestas viejas quedan en la pestaña.
- **Alta** sale de la primera pregunta: `Sí` ("ya completó la ficha en 2026") es `Reinscripción`; `No` es `Nueva`.
- El DNI se guarda como texto (`&""`) para que todo compare igual aunque Forms lo haya guardado como número.
- La fecha de nacimiento y la categoría vienen en **todas** las filas (también las de reinscripción). Las columnas de salud (`Afecciones` a `Obra social`) quedan vacías en las respuestas que no pasaron por la sección Salud: así se sabe cuál es la última con salud.

## 4. Tablero (una fila por chico de la temporada)

Encabezados de la fila 1, escritos a mano y en este orden. **Los de las columnas G a L tienen que ser idénticos al título de la pregunta** (las fórmulas los usan para saber qué documento es):

`A DNI | B Apellido | C Nombre | D Categoría | E Mail del adulto | F Alta | G DNI jugador - frente | H DNI jugador - dorso | I DNI adulto - frente | J DNI adulto - dorso | K Foto del jugador | L Foto del adulto | M Completo | N Carpeta`

Fórmulas en la **fila 2** (una sola por columna; se esparcen solas hacia abajo):

**A2 — padrón** (DNIs únicos con inscripción desde el inicio de temporada):
```
=SI.ERROR(UNIQUE(FILTER(Base!$B$2:$B; Base!$A$2:$A>=Config!$B$2)); "")
```

**B2, C2, D2, E2 — datos de su última respuesta** (cada una apunta a otra columna de `Base`: B→`C`, C→`D`, D→`E`, E→`G`). B2:
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; BUSCARX($A$2:$A; Base!$B$2:$B; Base!$C$2:$C; ""; 0; -1)))
```
Para C2 cambiar `Base!$C$2:$C` por `Base!$D$2:$D`; para D2 por `Base!$E$2:$E`; para E2 por `Base!$G$2:$G`.

**F2 — Alta** (`Nueva` si esta temporada hizo la inscripción por el camino "No"; `Reinscripción` si fue por el "Sí"):
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; SI(CONTAR.SI.CONJUNTO(Base!$B:$B; $A$2:$A; Base!$I:$I; "Nueva"; Base!$A:$A; ">="&Config!$B$2)>0; "Nueva"; "Reinscripción")))
```

**G2 — un documento** (ejemplo: `DNI jugador - frente`, columnas `S` y `Y`). Cuenta ✅ si **alguna respuesta de cualquier temporada** con ese DNI tiene la subida —sea la de primera vez o la de reinscripción, que suman a la misma columna—, o si hay una fila en `Entregas a mano`:
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; SI(
  CONTAR.SI.CONJUNTO('Inscripción'!$D:$D; $A$2:$A; 'Inscripción'!$S:$S; "<>")
  + CONTAR.SI.CONJUNTO('Inscripción'!$D:$D; $A$2:$A; 'Inscripción'!$Y:$Y; "<>")
  + CONTAR.SI.CONJUNTO('Entregas a mano'!$A:$A; $A$2:$A; 'Entregas a mano'!$B:$B; G$1) > 0;
  "✅"; "❌")))
```
Para cada columna G a L se cambian las letras según esta tabla (la columna de la planilla que copia es la del encabezado):

| Columna del Tablero | Documento | Letra (primera vez) | Letra (reinscripción) |
|---|---|---|---|
| G | DNI jugador - frente | S | Y |
| H | DNI jugador - dorso | T | Z |
| I | DNI adulto - frente | U | AA |
| J | DNI adulto - dorso | V | AB |
| K | Foto del jugador | W | AC |
| L | Foto del adulto | X | AD |

En la primera temporada las fotos de la reinscripción son obligatorias, así que quien se reinscribió queda ✅ apenas las manda. Desde la temporada siguiente serán opcionales: el que no las mande (porque ya las dio) sigue ✅ por las de antes y el que nunca las dio queda ❌.

**M2 — Completo** (los 6 documentos de G a L):
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; SI((G$2:G="✅")*(H$2:H="✅")*(I$2:I="✅")*(J$2:J="✅")*(K$2:K="✅")*(L$2:L="✅")=1; "✅"; "❌")))
```

**N2 — carpeta del chico** (abre la búsqueda de Drive por DNI, que encuentra la carpeta `APELLIDO, Nombre — DNI`; así el tablero no necesita permisos de Drive):
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; HIPERVINCULO("https://drive.google.com/drive/search?q="&$A$2:$A; "Abrir")))
```

**Formato condicional** (*Formato → Formato condicional*, rango `F2:M`, regla "El texto es exactamente"): `✅` fondo verde claro, `❌` fondo rojo claro. Congelar la fila 1 y las columnas A a C.

## 5. Pagos (❌ no hay comprobante · 📎 comprobante subido sin verificar · ✅ verificado)

Un comprobante subido **no** es un pago verificado: el coordinador lo verifica anotando una fila en `Pagos verificados` (columnas `DNI | Concepto | Fecha | Quién verificó`; el concepto idéntico al de Config, o al encabezado de la columna si es un pago con formulario propio).

Hay **dos tipos de columna**:

**a) Conceptos del desplegable** (`Comprobantes`), columnas `C` a `L`:
- `Pagos!A1` = `DNI`, `B1` = `Chico`, y en `C1` a `L1`, uno por concepto: `=SI(Config!A13=""; ""; Config!A13)`, `=SI(Config!A14=""; ""; Config!A14)`, … hasta `Config!A22`.
- `Pagos!A2`: `=ARRAYFORMULA(SI(Tablero!$A$2:$A=""; ""; Tablero!$A$2:$A))`
- `Pagos!B2`: `=ARRAYFORMULA(SI($A$2:$A=""; ""; Tablero!$B$2:$B&", "&Tablero!$C$2:$C))`
- `Pagos!C2` (copiar a la derecha hasta `L2`; se ajusta sola la `C$1`):
```
=SI(C$1=""; ""; ARRAYFORMULA(SI($A$2:$A=""; "";
  SI(CONTAR.SI.CONJUNTO('Pagos verificados'!$A:$A; $A$2:$A; 'Pagos verificados'!$B:$B; C$1) > 0; "✅";
  SI(CONTAR.SI.CONJUNTO(Comprobantes!$C:$C; $A$2:$A; Comprobantes!$F:$F; C$1; Comprobantes!$G:$G; "<>"; Comprobantes!$A:$A; ">="&Config!$B$2) > 0; "📎"; "❌")))))
```

**b) Pago con formulario propio** (rifa, pantalón con talle…), columnas `M` en adelante, una por pago. El **encabezado es el nombre del pago** (también lo que se anota en `Pagos verificados`). La fórmula apunta a la pestaña del formulario y a la letra de su pregunta de subida (en el ejemplo, pestaña `Rifa`, DNI en `C`, comprobante en `G`):
```
=ARRAYFORMULA(SI($A$2:$A=""; "";
  SI(CONTAR.SI.CONJUNTO('Pagos verificados'!$A:$A; $A$2:$A; 'Pagos verificados'!$B:$B; M$1) > 0; "✅";
  SI(CONTAR.SI.CONJUNTO(Rifa!$C:$C; $A$2:$A; Rifa!$G:$G; "<>"; Rifa!$A:$A; ">="&Config!$B$2) > 0; "📎"; "❌"))))
```
Así un formulario propio muestra 📎/✅ como cualquier otro pago, sin ser una columna suelta.

Mismo formato condicional que el Tablero, con `📎` en amarillo.

## 6. Entregas a mano

Para quien no pudo subir los archivos y los entregó en papel: el coordinador los sube a la carpeta del chico y anota **una fila por documento**: `DNI | Documento | Fecha | Quién lo recibió`. En la columna `Documento`, *Datos → Validación de datos → Menú desplegable (de un intervalo)* = `Tablero!G1:L1`. El Tablero lo cuenta como ✅.

## 7. Listas de control

**`Faltan reinscribir`** (estaban en 2026 —o la temporada pasada— y todavía no vinieron). Es útil desde el primer día: toma a los chicos de `Inscripción 2026` y les suma los de la temporada anterior que haya en `Base`. Encabezados: `A DNI | B Apellido | C Nombre | D Mail del adulto | F (auxiliar)`.
- `F2` (auxiliar, DNIs de la temporada pasada):
  `=SI.ERROR(ARRAYFORMULA(UNIQUE({'Inscripción 2026'!$A$2:$A&""; SI.ERROR(FILTER(Base!$B$2:$B; Base!$A$2:$A>=Config!$B$3; Base!$A$2:$A<Config!$B$2); "")})); "")`
  (Sin `ARRAYFORMULA`, el `&""` toma sólo el primer DNI. El `SI.ERROR` de adentro evita que una temporada pasada vacía en `Base` borre a los de 2026.)
- `A2`: `=SI.ERROR(FILTER($F$2:$F; $F$2:$F<>""; ARRAYFORMULA(CONTAR.SI(Tablero!$A$2:$A; $F$2:$F)=0)); "")`
- `B2` (primero busca en 2026, después en `Base`):
  `=ARRAYFORMULA(SI($A$2:$A=""; ""; SI.ERROR(BUSCARX($A$2:$A; 'Inscripción 2026'!$A$2:$A&""; 'Inscripción 2026'!$B$2:$B); BUSCARX($A$2:$A; Base!$B$2:$B; Base!$C$2:$C; ""; 0; -1))))`
  Para `C2` cambiar `'Inscripción 2026'!$B$2:$B` por `$C$2:$C` y `Base!$C$2:$C` por `Base!$D$2:$D`.
- `D2` (el mail sólo está en `Base`; para los de 2026 queda vacío): `=ARRAYFORMULA(SI($A$2:$A=""; ""; SI.ERROR(BUSCARX($A$2:$A; Base!$B$2:$B; Base!$G$2:$G; ""; 0; -1); "")))`

**`Revisar`** — cinco listas (cada una dice qué hacer):
- `A1` `Dijeron que ya completaron la ficha, pero no aparecen en 2026 ni en una inscripción nueva (les tocaba la completa)`. `A2`:
  `=SI.ERROR(ARRAYFORMULA(FILTER('Inscripción'!$D$2:$D&""; 'Inscripción'!$C$2:$C="Sí"; CONTAR.SI('Inscripción 2026'!$A:$A; 'Inscripción'!$D$2:$D&"")=0; CONTAR.SI.CONJUNTO('Inscripción'!$D:$D; 'Inscripción'!$D$2:$D&""; 'Inscripción'!$C:$C; "No")=0)); "")`
  A esa familia la coordinación le pide que complete otra vez eligiendo "No".
- `C1` `La categoría no incluye el año de nacimiento`. `C2` (las categorías sin años, como `ESCUELITA` y `MAYORES`, no se controlan):
  `=SI.ERROR(ARRAYFORMULA(FILTER('Inscripción'!$D$2:$D&""; 'Inscripción'!$G$2:$G<>""; ESNUMERO(HALLAR("("; 'Inscripción'!$H$2:$H)); NO(ESNUMERO(HALLAR(AÑO('Inscripción'!$G$2:$G); 'Inscripción'!$H$2:$H))))); "")`
- `E1` `Pagos de un DNI que no está en el padrón de esta temporada`. `E2`:
  `=SI.ERROR(ARRAYFORMULA(FILTER(Comprobantes!$C$2:$C&""; Comprobantes!$C$2:$C<>""; CONTAR.SI(Tablero!$A$2:$A; Comprobantes!$C$2:$C&"")=0)); "")`
  Para cada formulario propio con DNI (rifa, pase) se suma una lista igual en la columna `K`, `M`…, cambiando `Comprobantes` por su pestaña.
  **Qué hacer:** probablemente el DNI está mal tipeado: avisarle a la familia y, si manda el comprobante de nuevo con el DNI correcto, listo.
- `G1` `Posible nombre y apellido invertidos (el mismo DNI figura con los dos cruzados en 2026 o en una respuesta anterior)`. `G2` (compara sin importar mayúsculas ni cómo se parta el apellido; contra `Inscripción 2026` y contra la **primera** respuesta de ese DNI en `Base`):
  `=SI.ERROR(ARRAYFORMULA(FILTER(Tablero!$A$2:$A&" — "&Tablero!$B$2:$B&", "&Tablero!$C$2:$C; Tablero!$A$2:$A<>""; (MAYUSC(Tablero!$C$2:$C&" "&Tablero!$B$2:$B)=SI.ERROR(BUSCARX(Tablero!$A$2:$A; 'Inscripción 2026'!$A$2:$A&""; MAYUSC('Inscripción 2026'!$B$2:$B&" "&'Inscripción 2026'!$C$2:$C)); "x")) + (MAYUSC(Tablero!$C$2:$C&" "&Tablero!$B$2:$B)=SI.ERROR(BUSCARX(Tablero!$A$2:$A; Base!$B$2:$B; MAYUSC(Base!$C$2:$C&" "&Base!$D$2:$D); "x"; 0; 1); "x")) > 0)); "")`
  **Qué hacer:** mirar cuál está bien. Si la última respuesta es la equivocada, anotar el apellido y el nombre correctos en `Correcciones 2026` (`DNI`, `Apellido`, `Nombre`) —sirve para los de 2026— o pedirle a la familia que vuelva a mandar el formulario bien (vale el último envío).
- `I1` `Posible chico duplicado (mismo apellido, nombre y fecha de nacimiento con otro DNI)`. Casi siempre es un DNI mal tipeado. `I2` (la fecha se muestra con `TEXTO`; si tu Sheets no reconoce `dd/mm/aaaa`, probar `dd/mm/yyyy`):
  `=SI.ERROR(ARRAYFORMULA(UNIQUE(FILTER(Base!$C$2:$C&", "&Base!$D$2:$D&" — nac. "&TEXTO(Base!$H$2:$H; "dd/mm/aaaa")&" — DNI "&Base!$B$2:$B; Base!$B$2:$B<>""; Base!$H$2:$H<>""; CONTAR.SI.CONJUNTO(Base!$C$2:$C; Base!$C$2:$C; Base!$D$2:$D; Base!$D$2:$D; Base!$H$2:$H; Base!$H$2:$H; Base!$B$2:$B; "<>"&Base!$B$2:$B)>0))); "")`
  **Qué hacer:** avisarle a la familia para confirmar el DNI correcto; si ya mandó dos formularios, el que tiene el DNI equivocado se deja como está y se borra a mano (vaciado manual, `google/GUIA.md`) cuando la familia confirme.

## 8. Buscar (pensada para el celular)

Se escribe un apellido, un nombre o un DNI y se ve el chico **en vertical** (una fila por dato). Si coinciden varios, aparece la lista con el DNI para escribirlo. No muestra la ficha médica (la salud está en `Base`, pero `Buscar` sólo lee `Tablero` y `Pagos`). La búsqueda no distingue mayúsculas pero sí tildes: `Sanchez` no encuentra `Sánchez`.

- `A1` `Escribí apellido, nombre o DNI:` · `B1`: celda de entrada (fondo amarillo, letra grande).
- `A3` `Coinciden:` · `B3`:
```
=SI(B1=""; 0; SI.ERROR(FILAS(FILTER(Tablero!$A$2:$A; ESNUMERO(HALLAR(B1; Tablero!$B$2:$B&" "&Tablero!$C$2:$C&" "&Tablero!$A$2:$A)))); 0))
```
  (`FILAS` y no `CONTARA`: con cero resultados `CONTARA` da 1 y rompe la hoja.)
- `A5` (una lista con DNI si hay varios; las etiquetas del chico si hay uno solo):
```
=SI($B$3=1; TRANSPONER(Tablero!$A$1:$M$1);
 SI($B$3>1; FILTER(Tablero!$B$2:$B&", "&Tablero!$C$2:$C&" — DNI "&Tablero!$A$2:$A&" — "&Tablero!$D$2:$D;
  ESNUMERO(HALLAR($B$1; Tablero!$B$2:$B&" "&Tablero!$C$2:$C&" "&Tablero!$A$2:$A))); ""))
```
- `B5` (los datos, sólo si hay uno):
```
=SI($B$3=1; TRANSPONER(FILTER(Tablero!$A$2:$M;
  ESNUMERO(HALLAR($B$1; Tablero!$B$2:$B&" "&Tablero!$C$2:$C&" "&Tablero!$A$2:$A)))); "")
```
- `A19` `Carpeta` · `B19`: `=SI($B$3=1; HIPERVINCULO("https://drive.google.com/drive/search?q="&$B$5; "Abrir carpeta"); "")`
- `A21` (etiquetas de **todas** las columnas de `Pagos`, las de conceptos y las de formulario propio): `=SI($B$3=1; TRANSPONER(Pagos!$B$1:$Z$1); "")` · `B21` (valores): `=SI($B$3=1; TRANSPONER(FILTER(Pagos!$B$2:$Z; Pagos!$A$2:$A=$B$5)); "")`

Para usarla desde el celular: abrir la planilla con la app de Hojas, ir a `Buscar` y tocar `B1`.

## 9. Salidas para Semillero: dos planillas aparte

**Por qué planillas aparte:** en Sheets, *Descargar → Microsoft Excel* baja **todas** las pestañas, y el Tablero tiene DNIs y los datos de salud de las respuestas. Por eso lo que va a Semillero son otras planillas, con las columnas justas, sin DNI. El contrato con el importador está en `google/PRECARGA-2026.md`.

Las dos hojas de salida cubren **a los chicos nuevos y a los de 2026**: los de la temporada 2026 que todavía no se inscribieron este año salen de `Inscripción 2026` y `Emergencias 2026` (las escribe el script, punto 13).

### 9.1 Salida Semillero

Hoja `Salida Semillero`, encabezados exactos (fila 1):

### Encabezados exactos

```
Apellido | Nombre | Fecha de nacimiento | Categoría | Mail del responsable | Rama
```

Fórmulas en la fila 2 (una por columna). Cada una apila dos bloques: **el padrón** (los chicos de esta temporada, con los datos de su última respuesta; el DNI no se muestra) y **los de 2026 que no están en el padrón** (`Inscripción 2026`). Para un chico que sólo está en 2026, el mail queda vacío (ese formulario no lo pedía). La condición "no está en el padrón" es, en las seis columnas, `ARRAYFORMULA(CONTAR.SI(Tablero!$A$2:$A; 'Inscripción 2026'!$A$2:$A&"")=0)`. Los dos bloques van envueltos en `SI.ERROR(…; "")`: sin inscripciones de esta temporada el del padrón da `#N/A`, y así queda una fila en blanco que el importador saltea.

- `A2` Apellido:
```
={SI.ERROR(FILTER(Tablero!$B$2:$B; Tablero!$A$2:$A<>""); ""); SI.ERROR(FILTER('Inscripción 2026'!$B$2:$B; 'Inscripción 2026'!$A$2:$A<>""; ARRAYFORMULA(CONTAR.SI(Tablero!$A$2:$A; 'Inscripción 2026'!$A$2:$A&"")=0)); "")}
```
- `B2` Nombre: igual, con `Tablero!$C$2:$C` y `'Inscripción 2026'!$C$2:$C`.
- `C2` Fecha de nacimiento (formato *Fecha* `dd/mm/aaaa`; la del padrón sale de su última respuesta):
```
={SI.ERROR(ARRAYFORMULA(BUSCARX(FILTER(Tablero!$A$2:$A; Tablero!$A$2:$A<>""); Base!$B$2:$B; Base!$H$2:$H; ""; 0; -1)); ""); SI.ERROR(FILTER('Inscripción 2026'!$D$2:$D; 'Inscripción 2026'!$A$2:$A<>""; ARRAYFORMULA(CONTAR.SI(Tablero!$A$2:$A; 'Inscripción 2026'!$A$2:$A&"")=0)); "")}
```
- `D2` Categoría (texto exacto del desplegable, ej. `U13 - MIXTO (2014 y 2013)`): igual que `A2` con `Tablero!$D$2:$D` y `'Inscripción 2026'!$E$2:$E`.
- `E2` Mail del responsable (el verificado por Google, en minúsculas; vacío para los de 2026):
```
={SI.ERROR(FILTER(MINUSC(Tablero!$E$2:$E); Tablero!$A$2:$A<>""); ""); SI.ERROR(FILTER(ARRAYFORMULA(SI('Inscripción 2026'!$A$2:$A=""; ""; "")); 'Inscripción 2026'!$A$2:$A<>""; ARRAYFORMULA(CONTAR.SI(Tablero!$A$2:$A; 'Inscripción 2026'!$A$2:$A&"")=0)); "")}
```
- `F2` Rama (`Masculino` / `Femenino`). En el padrón: de la categoría si lo dice y, si es mixta (ej. U13), de la pregunta "Rama" (`Base!F`). En 2026: sólo de la categoría; si es mixta queda vacía y la persona que importa la completa (ver `PRECARGA-2026.md`):
```
={SI.ERROR(ARRAYFORMULA(SI(ESNUMERO(HALLAR("FEMENINO"; FILTER(Tablero!$D$2:$D; Tablero!$A$2:$A<>""))); "Femenino";
   SI(ESNUMERO(HALLAR("MASCULINO"; FILTER(Tablero!$D$2:$D; Tablero!$A$2:$A<>""))); "Masculino";
   BUSCARX(FILTER(Tablero!$A$2:$A; Tablero!$A$2:$A<>""); Base!$B$2:$B; Base!$F$2:$F; ""; 0; -1)))); "");
 SI.ERROR(FILTER(ARRAYFORMULA(SI(ESNUMERO(HALLAR("FEMENINO"; 'Inscripción 2026'!$E$2:$E)); "Femenino"; SI(ESNUMERO(HALLAR("MASCULINO"; 'Inscripción 2026'!$E$2:$E)); "Masculino"; "")));
   'Inscripción 2026'!$A$2:$A<>""; ARRAYFORMULA(CONTAR.SI(Tablero!$A$2:$A; 'Inscripción 2026'!$A$2:$A&"")=0)); "")}
```

### 9.2 Salida Emergencias

Sólo pasan chicos con **autorización**: los nuevos, los que tildaron **Emergencias en Semillero** en su última inscripción; los de 2026, los que tienen tildado el **Consentimiento de Datos** de ese formulario (es el que escribe la hoja `Emergencias 2026`). Un chico que ya se reinscribió se rige por la casilla nueva, no por la de 2026.

### Encabezados exactos de emergencias

```
Apellido y nombre | Fecha de nacimiento | Teléfono del adulto | Contacto de urgencia | Afecciones | Alergias | Medicación | Indicación médica | Obra social
```

Sin DNI, número de afiliado, grupo sanguíneo ni domicilio. **Salud vigente:** la de la última respuesta que pasó por la sección Salud (`Alertas médicas` no vacía); si no hay, la de `Emergencias 2026`. **Contacto vigente:** el de la última respuesta.

La hoja `Aux emergencias` (oculta) arma dos bloques lado a lado.

**Bloque de esta temporada** (una fila por chico autorizado). Encabezados `A DNI | B Apellido y nombre | C Nacimiento | D Teléfono | E Contacto | F Afecciones | G Alergias | H Medicación | I Indicación | J Obra social`:
- `A2`: `=SI.ERROR(FILTER(Tablero!$A$2:$A; Tablero!$A$2:$A<>""; ARRAYFORMULA(BUSCARX(Tablero!$A$2:$A; Base!$B$2:$B; Base!$L$2:$L; ""; 0; -1)="Sí")); "")`
- `B2`: `=ARRAYFORMULA(SI($A$2:$A=""; ""; BUSCARX($A$2:$A; Tablero!$A$2:$A; Tablero!$B$2:$B)&" "&BUSCARX($A$2:$A; Tablero!$A$2:$A; Tablero!$C$2:$C)))`
- `C2`, `D2`, `E2` (último dato de `Base`: nacimiento `H`, teléfono `J`, contacto `K`): `=ARRAYFORMULA(SI($A$2:$A=""; ""; BUSCARX($A$2:$A; Base!$B$2:$B; Base!$H$2:$H; ""; 0; -1)))`
- `F2` a `J2` (salud: la última respuesta con salud; si no hay, la de 2026 del bloque de al lado). Para `F2` (afecciones: `Base!M`, y en el bloque de 2026 la columna `Q`):
```
=ARRAYFORMULA(SI($A$2:$A=""; "";
  SI.ERROR(BUSCARX($A$2:$A; FILTER(Base!$B$2:$B; Base!$M$2:$M<>""); FILTER(Base!$M$2:$M; Base!$M$2:$M<>""); ; 0; -1);
  SI.ERROR(BUSCARX($A$2:$A; $L$2:$L; $Q$2:$Q); ""))))
```
  Las otras: `G2` alergias (`Base!N` / `R`), `H2` medicación (`Base!O` / `S`), `I2` indicación (`Base!P` / `T`), `J2` obra social (`Base!Q` / `U`).

**Bloque de 2026** (una fila por chico con consentimiento en el formulario 2026). Encabezados `L DNI 2026 | M a U` = los 9 de `Emergencias 2026`:
- `L2`: `=SI.ERROR(FILTER('Inscripción 2026'!$A$2:$A&""; 'Inscripción 2026'!$F$2:$F="Sí"); "")`. `Emergencias 2026` tiene una fila por cada chico con consentimiento, **en el mismo orden** que las filas de `Inscripción 2026` con `Consentimiento de datos = Sí`: por eso esta lista de DNI queda alineada con ella.
- `M2` (copiar a la derecha hasta `U2`): `=SI.ERROR(FILTER('Emergencias 2026'!A$2:A; 'Emergencias 2026'!$A$2:$A<>""); "")`

En `Salida Emergencias` (encabezados exactos de arriba, fila 1) cada columna apila dos bloques: los de esta temporada y los de 2026 que no están en el padrón. `A2` Apellido y nombre:
```
={SI.ERROR(FILTER('Aux emergencias'!$B$2:$B; 'Aux emergencias'!$A$2:$A<>""); ""); SI.ERROR(FILTER('Aux emergencias'!$M$2:$M; 'Aux emergencias'!$L$2:$L<>""; ARRAYFORMULA(CONTAR.SI(Tablero!$A$2:$A; 'Aux emergencias'!$L$2:$L)=0)); "")}
```
`B2` a `I2`: igual, con la columna de `Aux emergencias` que corresponde a cada encabezado: de esta temporada `C` a `J`, de 2026 `N` a `U`. La fecha de nacimiento, formato *Fecha* `dd/mm/aaaa`.

**Las `Afecciones` y el importador.** El importador de Semillero sólo guarda las afecciones de su lista (`PRECARGA-2026.md`). Las opciones nuevas de `Alertas médicas` que no estén en esa lista (`Alergia grave`, `Ninguna`, y los nombres cambiados) no las toma hasta que la sesión de Semillero actualice la lista; no se pierden en el Tablero.

### 9.3 Las planillas "Para Semillero <temporada>" y "Emergencias para Semillero <temporada>"

Otras dos planillas, otros archivos, en la misma cuenta de la Comisión:
1. En `A1` de "Para Semillero": `=IMPORTRANGE("<link del Tablero>"; "Salida Semillero!A:F")`. En `A1` de "Emergencias para Semillero": `=IMPORTRANGE("<link del Tablero>"; "Salida Emergencias!A:I")`.
2. La primera vez aparece "Permitir acceso": tocarlo.
3. Formato de la fecha de nacimiento: *Formato → Número → Fecha* (`dd/mm/aaaa`).
4. Se comparten **sólo con quien importa** en Semillero (y es esa persona la que baja el `.xlsx`). El importador de Semillero lo hace otra sesión; acá sólo se arman las planillas.

## 10. Cómo se comparte, y qué no hacer nunca

- El Tablero: **sólo coordinación**. Nada de "cualquiera con el link".
- **Nunca *Archivo → Compartir → Publicar en la web*** (ni la planilla, ni una pestaña, ni las respuestas de un formulario).
- No descargar el Tablero como Excel/PDF: lleva las respuestas completas, con la ficha médica.
- No se publica ni se enlaza nada en la web pública: esto es de uso interno.

## 11. Sumar la columna de un formulario nuevo (rifa, pase, pago con formulario propio)

1. En el formulario nuevo, que las 3 preguntas estándar vayan **primero** (la plantilla ya las trae): así DNI = `C` en su pestaña.
2. Vincularlo a esta planilla y renombrar su pestaña (ej. `Rifa`).
3. Si es un **pago**: en `Pagos`, a la derecha de la última columna, escribir en el encabezado el nombre del pago y pegar la fórmula del punto 5b cambiando la pestaña (`Rifa`) y la letra de su pregunta de subida. Sumar la lista de `Revisar` del punto 7.
4. Si es un **documento** (pase, ficha extra): copiar la columna `G` del Tablero a la derecha de `Carpeta`, con el título de la pregunta de archivo en el encabezado; cambiar `'Inscripción'` por la pestaña nueva y `S` por la letra de esa pregunta, **borrar la línea de `Y`** y agregar la condición de temporada: `'<Pestaña>'!$A:$A; ">="&Config!$B$2`. No entra en "Completo".
5. Probar con un DNI inventado y esperar 10 minutos al script de carpetas.

## 12. Si algo da error

| Qué se ve | Qué mirar |
|---|---|
| `#NAME?` o "Fórmula con error" al pegar | La configuración regional no es Argentina (punto 0) |
| `#REF!` en `Base` | Falta la pestaña `Inscripción` o tiene otro nombre. Vincular el formulario aunque tenga cero respuestas |
| `#REF!` en `Faltan reinscribir` o `Salida Semillero` | Todavía no se corrió el script (`Inscripción 2026` no existe): correr `actualizar2026` |
| Todos los documentos salen ❌ | La letra de columna no coincide con la pestaña: comparar con el Mapa de columnas |
| El DNI de un chico no aparece | No es de esta temporada (Config `B2`) o el formulario no lo mandó |
| Tablero vacío pero hay respuestas | Marca temporal anterior a `Config!B2` |
| Un chico de 2026 con el apellido y el nombre cruzados | Está en `Revisar 2026`: anotarlo bien en `Correcciones 2026` (columnas DNI, Apellido y Nombre) y volver a correr `actualizar2026` |

## 13. El script del Tablero (`Inscripción 2026`)

Lo escribe `google/apps-script-tablero/` y se instala desde la planilla (*Extensiones → Apps Script*; los pasos y los permisos están en `google/GUIA.md`). Se corre **a mano**: en el editor, elegir `actualizar2026` → Ejecutar. **Lee** las respuestas del formulario 2026 (no lo modifica) y reescribe **sólo** estas hojas del Tablero:

| Hoja | Qué tiene |
|---|---|
| `Inscripción 2026` | Una fila por DNI (la última respuesta): DNI, Apellido, Nombre, Fecha de nacimiento, Categoría y Consentimiento de datos |
| `Semillero 2026` | Las 6 columnas de "Para Semillero", sin mail (todos los de 2026) |
| `Emergencias 2026` | Las 9 columnas de emergencias, sólo con el consentimiento tildado |
| `Revisar 2026` | Los que tienen el apellido y el nombre dudosos |

`Correcciones 2026` (columnas DNI, Apellido y Nombre) la completa una persona y el script la lee sin tocarla.

## 14. El script de envío a Semillero (el panel de papeles y pagos)

Lo escriben `estado.gs` y `semillero.gs` de `google/apps-script-tablero/`, en el mismo proyecto atado al Tablero que el del punto 13 (activación y permisos en `google/GUIA.md`, sección 5b). **Sólo lee**: el Tablero (columnas `B` a `D`, y `G` en adelante, **nunca la `A` ni la `N`**), `Pagos` (desde la `C`, nunca el DNI) y `Salida Semillero` (A a C y F). Para que el panel de Semillero funcione, esas hojas tienen que mantener:

- **Filas alineadas**: la fila `n` de `Pagos` es la del mismo chico que la fila `n` del Tablero, y las primeras filas de `Salida Semillero` van en el mismo orden que las del Tablero (los de 2026 que no están en el padrón van **después**). Si no coinciden, el script no manda la fecha de nacimiento ni la rama de esa fila.
- **Documentos**: las columnas de `G` en adelante cuyo contenido sea sólo ✅/❌ (también un documento de temporada a la derecha de `Carpeta`). `Completo` y `Carpeta` no son documentos.
- **Pagos**: las columnas de `Pagos` desde la `C` cuyo contenido sea sólo ✅/📎/❌. El encabezado es el nombre del concepto; uno nuevo aparece solo en el panel.
- Sin texto libre en esas columnas: lo que no sea ✅/📎/❌ no se manda.
