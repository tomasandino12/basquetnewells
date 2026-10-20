# Tablero de documentación y pagos (planilla de Google)

Spec: `docs/superpowers/specs/2026-10-18-inscripcion-google-design.md`. Todo son fórmulas: no hay script ni permiso de Sheets.

> **Estas fórmulas no se pudieron probar en Google desde acá.** Se escribieron contra el modelo de las pestañas de Forms. La prueba manual de `google/GUIA.md` (sección 5) es la que las valida; si una da error, el punto 8 de este archivo dice dónde mirar.

## 0. Antes de empezar

1. Crear la planilla **"Tablero <temporada>"** en la cuenta del básquet (no en la tuya personal).
2. *Archivo → Configuración*: **configuración regional = Argentina**. Con eso las fórmulas de acá andan tal cual están escritas: argumentos separados por `;` y, dentro de `{ }`, columnas separadas por `\` y filas por `;`. (Si la planilla queda en otra región, no funcionan.)
3. Vincular cada formulario con esta planilla (*Respuestas → Vincular con Hojas → Seleccionar hoja de cálculo existente*). Forms crea una pestaña por formulario y le pone "Respuestas de formulario 1". **Renombrarlas** exactamente así (con tilde): `Inscripción` y `Comprobantes`. Renombrar no rompe el vínculo.
4. **No escribir nunca sobre esas pestañas**: Forms las reescribe cuando se cambian preguntas. Lo que se anota a mano va en `Entregas a mano` y `Pagos verificados`.
5. Las fórmulas leen las pestañas por **letra de columna**, así que el orden de las preguntas de los formularios importa. El orden está en `google/formularios/FORMULARIOS.md` y tiene que coincidir con este mapa (un test lo comprueba):

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

Crear estas hojas, con estos nombres, además de las 3 pestañas de respuestas: `Config`, `Base`, `Tablero`, `Pagos`, `Pagos verificados`, `Entregas a mano`, `Faltan reinscribir`, `Revisar`, `Buscar`, `Salida Semillero`. `Base` se puede ocultar.

## 2. Config

| Celda | Contenido |
|---|---|
| `A1` / `B1` | `Temporada` / `2026` |
| `A2` / `B2` | `Inicio de temporada` / una fecha, ej. `01/01/2026`. Los chicos que cuentan este año son los que mandaron algo **desde** esa fecha |
| `A3` / `B3` | `Inicio de la temporada anterior` / `=FECHA.MES(B2; -12)` |
| `A12` | `Conceptos de pago activos` |
| `A13:A22` | Hasta 10 conceptos, uno por celda, **idénticos** a las opciones del desplegable `Concepto` del formulario de aranceles (ej. `Arancel octubre 2026`, `Abono CABB 2026`) |

## 3. Base (hoja auxiliar)

Apila inscripciones y reinscripciones en una sola tabla, ordenada por fecha. Encabezados (fila 1, a mano): `Fecha | DNI | Apellido | Nombre | Categoría | Rama | Mail | Nacimiento | Alta`. En `Base!A2`:

```
=ARRAYFORMULA(QUERY({
'Inscripción'!A2:A \ 'Inscripción'!C2:C&"" \ 'Inscripción'!D2:D \ 'Inscripción'!E2:E \ 'Inscripción'!I2:I \ 'Inscripción'!J2:J \ 'Inscripción'!B2:B \ 'Inscripción'!G2:G \ SI('Inscripción'!A2:A=""; ""; "Nueva");
'Reinscripción'!A2:A \ 'Reinscripción'!C2:C&"" \ 'Reinscripción'!D2:D \ 'Reinscripción'!E2:E \ 'Reinscripción'!F2:F \ 'Reinscripción'!G2:G \ 'Reinscripción'!B2:B \ "" \ SI('Reinscripción'!A2:A=""; ""; "Reinscripción")
}; "select * where Col1 is not null order by Col1"; 0))
```

El DNI se guarda como texto (`&""`) para que todo compare igual aunque Forms lo haya guardado como número. Los reinscriptos no traen fecha de nacimiento: sale de su inscripción completa (columna `Nacimiento` sólo en las filas `Nueva`).

## 4. Tablero (una fila por chico de la temporada)

Encabezados de la fila 1, escritos a mano y en este orden. **Los de las columnas G a L tienen que ser idénticos al título de la pregunta** (las fórmulas los usan para saber qué documento es):

`A DNI | B Apellido | C Nombre | D Categoría | E Mail del adulto | F Alta | G DNI jugador - frente | H DNI jugador - dorso | I DNI adulto - frente | J DNI adulto - dorso | K Foto del jugador | L Foto del adulto | M Completo | N Carpeta`

Fórmulas en la **fila 2** (una sola por columna; se esparcen solas hacia abajo):

**A2 — padrón** (DNIs únicos con inscripción o reinscripción desde el inicio de temporada):
```
=SIERROR(UNICOS(FILTRO(Base!$B$2:$B; Base!$A$2:$A>=Config!$B$2)); "")
```

**B2, C2, D2, E2 — datos de su última respuesta** (cada una apunta a otra columna de `Base`: B→`C`, C→`D`, D→`E`, E→`G`). B2:
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; BUSCARX($A$2:$A; Base!$B$2:$B; Base!$C$2:$C; ""; 0; -1)))
```
Para C2 cambiar `Base!$C$2:$C` por `Base!$D$2:$D`; para D2 por `Base!$E$2:$E`; para E2 por `Base!$G$2:$G`.

**F2 — Alta** (`Nueva` si esta temporada hizo la inscripción completa; `Reinscripción` si vino por la corta):
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; SI(CONTAR.SI.CONJUNTO(Base!$B:$B; $A$2:$A; Base!$I:$I; "Nueva"; Base!$A:$A; ">="&Config!$B$2)>0; "Nueva"; "Reinscripción")))
```

**G2 — un documento** (ejemplo: `DNI jugador - frente`, columnas `AH` en Inscripción y `AA` en Reinscripción). Cuenta ✅ si **alguna respuesta de cualquier temporada** con ese DNI tiene la subida, o si hay una fila en `Entregas a mano`:
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; SI(
  CONTAR.SI.CONJUNTO('Inscripción'!$C:$C; $A$2:$A; 'Inscripción'!$AH:$AH; "<>")
  + CONTAR.SI.CONJUNTO('Reinscripción'!$C:$C; $A$2:$A; 'Reinscripción'!$AA:$AA; "<>")
  + CONTAR.SI.CONJUNTO('Entregas a mano'!$A:$A; $A$2:$A; 'Entregas a mano'!$B:$B; G$1) > 0;
  "✅"; "❌")))
```
Para cada columna G a L se cambian las letras según esta tabla (la columna de la planilla que copia es la del encabezado):

| Columna del Tablero | Documento | Letra en `Inscripción` | Letra en `Reinscripción` |
|---|---|---|---|
| G | DNI jugador - frente | AH | AA |
| H | DNI jugador - dorso | AI | AB |
| I | DNI adulto - frente | AJ | (no se pide) |
| J | DNI adulto - dorso | AK | (no se pide) |
| K | Foto del jugador | AL | (no se pide) |
| L | Foto del adulto | AM | (no se pide) |

Donde dice "no se pide", **borrar la línea de `Reinscripción`** (y el `+` que le sigue) de la fórmula.

**M2 — Completo** (los 6 documentos de G a L):
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; SI((G$2:G="✅")*(H$2:H="✅")*(I$2:I="✅")*(J$2:J="✅")*(K$2:K="✅")*(L$2:L="✅")=1; "✅"; "❌")))
```

**N2 — carpeta del chico** (abre la búsqueda de Drive por DNI, que encuentra la carpeta `APELLIDO, Nombre — DNI`; así el script no necesita permiso de Sheets):
```
=ARRAYFORMULA(SI($A$2:$A=""; ""; HIPERVINCULO("https://drive.google.com/drive/search?q="&$A$2:$A; "Abrir")))
```

**Formato condicional** (*Formato → Formato condicional*, rango `F2:M`, regla "El texto es exactamente"): `✅` fondo verde claro, `❌` fondo rojo claro. Congelar la fila 1 y las columnas A a C.

**Un documento de una temporada** (rifa, pase): igual que G2 pero con la pestaña y la columna de ese formulario y una condición más, `'<Pestaña>'!$A:$A; ">="&Config!$B$2`, para que cuente sólo desde el inicio de temporada. Va **a la derecha de `Carpeta`**: no entra en "Completo".

## 5. Pagos (❌ no hay comprobante · 📎 comprobante subido sin verificar · ✅ verificado)

Un comprobante subido **no** es un pago verificado: el coordinador lo verifica anotando una fila en `Pagos verificados` (columnas `DNI | Concepto | Fecha | Quién verificó`; el concepto idéntico al de Config).

- `Pagos!A1` = `DNI`, `B1` = `Chico`, y en `C1` a `L1`, uno por concepto: `=SI(Config!A13=""; ""; Config!A13)`, `=SI(Config!A14=""; ""; Config!A14)`, … hasta `Config!A22`.
- `Pagos!A2`: `=ARRAYFORMULA(SI(Tablero!$A$2:$A=""; ""; Tablero!$A$2:$A))`
- `Pagos!B2`: `=ARRAYFORMULA(SI($A$2:$A=""; ""; Tablero!$B$2:$B&", "&Tablero!$C$2:$C))`
- `Pagos!C2` (copiar a la derecha hasta `L2`; se ajusta sola la `C$1`):
```
=SI(C$1=""; ""; ARRAYFORMULA(SI($A$2:$A=""; "";
  SI(CONTAR.SI.CONJUNTO('Pagos verificados'!$A:$A; $A$2:$A; 'Pagos verificados'!$B:$B; C$1) > 0; "✅";
  SI(CONTAR.SI.CONJUNTO(Aranceles!$C:$C; $A$2:$A; Aranceles!$F:$F; C$1; Aranceles!$G:$G; "<>"; Aranceles!$A:$A; ">="&Config!$B$2) > 0; "📎"; "❌")))))
```
- Mismo formato condicional que el Tablero, con `📎` en amarillo.

## 6. Entregas a mano

Para quien no pudo subir los archivos y los entregó en papel: el coordinador los sube a la carpeta del chico y anota **una fila por documento**: `DNI | Documento | Fecha | Quién lo recibió`. En la columna `Documento`, *Datos → Validación de datos → Menú desplegable (de un intervalo)* = `Tablero!G1:L1`. El Tablero lo cuenta como ✅.

## 7. Listas de control

**`Faltan reinscribir`** (estaban la temporada pasada y todavía no vinieron). Encabezados: `A DNI | B Apellido | C Nombre | D Mail del adulto | F (auxiliar)`.
- `F2` (auxiliar, DNIs de la temporada pasada): `=SIERROR(UNICOS(FILTRO(Base!$B$2:$B; Base!$A$2:$A>=Config!$B$3; Base!$A$2:$A<Config!$B$2)); "")`
- `A2`: `=SIERROR(FILTRO($F$2:$F; ARRAYFORMULA(CONTAR.SI(Tablero!$A$2:$A; $F$2:$F)=0)); "")`
- `B2`, `C2`, `D2`: `=ARRAYFORMULA(SI($A$2:$A=""; ""; BUSCARX($A$2:$A; Base!$B$2:$B; Base!$C$2:$C; ""; 0; -1)))` cambiando la columna de `Base` (B→`C`, C→`D`, D→`G`).

**`Revisar`** — dos listas:
- `A1` `Reinscripciones sin inscripción anterior (probablemente les tocaba la completa)`. `A2`:
  `=SIERROR(ARRAYFORMULA(FILTRO('Reinscripción'!$C$2:$C&""; 'Reinscripción'!$C$2:$C<>""; CONTAR.SI('Inscripción'!$C:$C; 'Reinscripción'!$C$2:$C)=0)); "")`
- `C1` `Pagos de un DNI que no está en el padrón de esta temporada`. `C2`:
  `=SIERROR(ARRAYFORMULA(FILTRO(Aranceles!$C$2:$C&""; Aranceles!$C$2:$C<>""; CONTAR.SI(Tablero!$A$2:$A; Aranceles!$C$2:$C&"")=0)); "")`
  Para otros formularios con DNI (rifas, pase) se suma una lista igual en la columna siguiente.

## 8. Buscar (pensada para el celular)

Se escribe un apellido, un nombre o un DNI y se ve el chico **en vertical** (una fila por dato). Si coinciden varios, aparece la lista con el DNI para escribirlo. No muestra la ficha médica (esa nunca llega al tablero: sólo se leen las columnas del mapa). La búsqueda no distingue mayúsculas pero sí tildes: `Sanchez` no encuentra `Sánchez`.

- `A1` `Escribí apellido, nombre o DNI:` · `B1`: celda de entrada (fondo amarillo, letra grande).
- `A3` `Coinciden:` · `B3`:
```
=SI(B1=""; 0; CONTARA(FILTRO(Tablero!$A$2:$A; ESNUMERO(HALLAR(B1; Tablero!$B$2:$B&" "&Tablero!$C$2:$C&" "&Tablero!$A$2:$A)))))
```
  (Si da error con 0 resultados, envolverla en `SIERROR( … ; 0)`.)
- `A5` (una lista con DNI si hay varios; las etiquetas del chico si hay uno solo):
```
=SI($B$3=1; TRANSPONER(Tablero!$A$1:$M$1);
 SI($B$3>1; FILTRO(Tablero!$B$2:$B&", "&Tablero!$C$2:$C&" — DNI "&Tablero!$A$2:$A&" — "&Tablero!$D$2:$D;
  ESNUMERO(HALLAR($B$1; Tablero!$B$2:$B&" "&Tablero!$C$2:$C&" "&Tablero!$A$2:$A))); ""))
```
- `B5` (los datos, sólo si hay uno):
```
=SI($B$3=1; TRANSPONER(FILTRO(Tablero!$A$2:$M;
  ESNUMERO(HALLAR($B$1; Tablero!$B$2:$B&" "&Tablero!$C$2:$C&" "&Tablero!$A$2:$A)))); "")
```
- `A19` `Carpeta` · `B19`: `=SI($B$3=1; HIPERVINCULO("https://drive.google.com/drive/search?q="&$B$5; "Abrir carpeta"); "")`
- `A21` (etiquetas de pagos): `=SI($B$3=1; TRANSPONER(Pagos!$B$1:$L$1); "")` · `B21` (valores): `=SI($B$3=1; TRANSPONER(FILTRO(Pagos!$B$2:$L; Pagos!$A$2:$A=$B$5)); "")`

Para usarla desde el celular: abrir la planilla con la app de Hojas, ir a `Buscar` y tocar `B1`.

## 9. Salida Semillero y la planilla "Para Semillero"

**Por qué una planilla aparte:** en Sheets, *Descargar → Microsoft Excel* baja **todas** las pestañas, y el Tablero tiene DNIs y los datos de salud de las respuestas. Por eso lo que va a Semillero es otra planilla con 6 columnas, sin DNI ni salud.

**En el Tablero**, hoja `Salida Semillero`, encabezados exactos (fila 1):

### Encabezados exactos

```
Apellido | Nombre | Fecha de nacimiento | Categoría | Mail del responsable | Rama
```

Fórmulas en la fila 2 (una por columna; una fila por chico del padrón, nuevos y reinscriptos, con sus datos de la última respuesta; el DNI no se muestra):

- `A2` Apellido: `=ARRAYFORMULA(SI(Tablero!$A$2:$A=""; ""; Tablero!$B$2:$B))`
- `B2` Nombre: `=ARRAYFORMULA(SI(Tablero!$A$2:$A=""; ""; Tablero!$C$2:$C))`
- `C2` Fecha de nacimiento (la de su última inscripción **completa**; formato *Fecha* `dd/mm/aaaa`):
  `=ARRAYFORMULA(SI(Tablero!$A$2:$A=""; ""; BUSCARX(Tablero!$A$2:$A; FILTRO(Base!$B$2:$B; Base!$I$2:$I="Nueva"); FILTRO(Base!$H$2:$H; Base!$I$2:$I="Nueva"); ""; 0; -1)))`
- `D2` Categoría (texto exacto del desplegable, ej. `U13 - MIXTO (2014 y 2013)`): `=ARRAYFORMULA(SI(Tablero!$A$2:$A=""; ""; Tablero!$D$2:$D))`
- `E2` Mail del responsable (el verificado por Google, en minúsculas): `=ARRAYFORMULA(SI(Tablero!$A$2:$A=""; ""; MINUSC(Tablero!$E$2:$E)))`
- `F2` Rama (`Masculino` / `Femenino`; de la categoría si lo dice, si no de la pregunta "Rama"):
```
=ARRAYFORMULA(SI(Tablero!$A$2:$A=""; "";
  SI(ESNUMERO(HALLAR("FEMENINO"; Tablero!$D$2:$D)); "Femenino";
  SI(ESNUMERO(HALLAR("MASCULINO"; Tablero!$D$2:$D)); "Masculino";
  BUSCARX(Tablero!$A$2:$A; Base!$B$2:$B; Base!$F$2:$F; ""; 0; -1)))))
```

**La planilla "Para Semillero <temporada>"** (otra planilla, otro archivo, en la misma cuenta del básquet):
1. En `A1`: `=IMPORTRANGE("<link del Tablero>"; "Salida Semillero!A:F")`.
2. La primera vez aparece "Permitir acceso": tocarlo.
3. Formato de la columna C: *Formato → Número → Fecha* (`dd/mm/aaaa`).
4. Se comparte **sólo con quien importa** en Semillero (y es esa persona la que baja el `.xlsx`). El importador de Semillero lo hace el equipo de cuentas-familia; acá sólo se arma la planilla.

## 10. Cómo se comparte, y qué no hacer nunca

- El Tablero: **sólo coordinación**. Nada de "cualquiera con el link".
- **Nunca *Archivo → Compartir → Publicar en la web*** (ni la planilla, ni una pestaña, ni las respuestas de un formulario).
- No descargar el Tablero como Excel/PDF: lleva las respuestas completas.
- No se publica ni se enlaza nada en la web pública: esto es de uso interno.

## 11. Sumar la columna de un formulario nuevo (rifa, pase…)

1. En el formulario nuevo, que las 3 preguntas estándar vayan **primero** (la plantilla ya las trae): así DNI = `C` en su pestaña.
2. Vincularlo a esta planilla y renombrar su pestaña (ej. `Rifa`).
3. En el Tablero, a la derecha de `Carpeta`, copiar la columna `G` y pegarla. En el encabezado, el título de la pregunta de archivo. En la fórmula, cambiar `'Inscripción'` por `'Rifa'` y `AH` por la letra de esa pregunta en la pestaña nueva, y **borrar la línea de `Reinscripción`**; agregar la condición de temporada (ver punto 4).
4. Probar con un DNI inventado y esperar 10 minutos al script.

## 12. Si algo da error

| Qué se ve | Qué mirar |
|---|---|
| `#NAME?` o "Fórmula con error" al pegar | La configuración regional no es Argentina (punto 0) |
| `#REF!` en `Base` | Falta una pestaña (`Inscripción` o `Reinscripción`) o tiene otro nombre. Vincular el formulario aunque tenga cero respuestas |
| Todos los documentos salen ❌ | La letra de columna no coincide con la pestaña: comparar con el Mapa de columnas |
| El DNI de un chico no aparece | No es de esta temporada (Config `B2`) o el formulario no lo mandó |
| Tablero vacío pero hay respuestas | Marca temporal anterior a `Config!B2` |
