# Cuentas de familia — diseño

Estado: **esperando aprobación de Tomás** (v2, 18/10). Prompt 08 con dos
decisiones de Tomás del 18/10: el vínculo no lo aprueba el coordinador antes,
y **los datos que el padre carga en el formulario de Inscripción alimentan
tanto el plantel de Semillero como el vínculo**. Tag `pre-cuentas-familia`.
Migración `0057_cuentas_familia.sql` (reservada por la coordinadora).

## 1. Qué entra

- El padre llena una sola vez el formulario de Inscripción (Google; con o
  sin login, ver §2), que ya pide su mail.
- El profe de la categoría importa los inscriptos a su plantel en Semillero,
  sin cargarlos a mano. Así cada chico queda con el mail de su adulto
  responsable.
- El padre entra a Semillero con ese mail desde el botón de padres del portal
  (Google o mail confirmado) y **queda vinculado solo**, sin tipear nada.
- Ve **"Mis chicos"**: nombre y categoría de cada hijo vinculado. Nada más.
- Varios familiares por chico (un mail por fila) y varios chicos por
  familiar.
- El coordinador ve todos los vínculos (quién, qué chico, cuándo, por qué
  vía) y puede dar de baja cualquiera.

Fuera: que la familia edite datos de la app, mensajería, estadísticas,
mediciones, misiones, cuentas de jugador, aranceles, asistencia y calendario.
El vínculo es con el **jugador**, no con la categoría: cuando el chico cambia
de categoría el vínculo sigue, y un módulo de calendario futuro va a poder
mostrar los partidos de su categoría actual.

## 2. Con qué dato engancha la app al padre

| Opción | Seguridad | Costo |
|---|---|---|
| A. DNI + nacimiento contra un hash | Falsa: ~10⁸ DNIs casi correlativos, el hash se revierte en segundos. Es guardar el DNI con otro nombre (choca con el prompt 05). | Alto. |
| B. Código por chico que reparte el club | Fuerte. | El club reparte ~120 códigos; choca con "el padre carga y queda linkeado". |
| C. Categoría + nombre + fecha, tipeados en la app | Débil: nombre y categoría salen de la CABB y la fecha se adivina en ~365 intentos. | Bajo, pero el padre carga dos veces. |
| **D1. Mail tipeado en el formulario** (Inscripción sin login) | Buena del lado de la app: para vincularse hay que entrar con ese mail, verificado por Google o Supabase. Débil del lado del formulario: cualquiera tipea cualquier mail. | Un import por plantel, que igual hacía falta para no cargar chicos a mano. |
| **D2. Mail verificado de la cuenta de Google del formulario** (Inscripción con login obligatorio, según la spec actual de inscripción) | La mejor: ese mail lo pone Google, no lo escribe el padre. Se vincula sólo quien llenó el formulario. Dos hijos son dos respuestas con el mismo mail. | El mismo import que D1. A las familias sin cuenta de Google les suma un paso: crearla con su mail de siempre (la guía de inscripción lo explica). |

**Recomendación: D, sin C, y D2 si la Inscripción queda con login de
Google.** Elige Tomás entre D1 y D2: en la app es el mismo código, sólo cambia
de qué columna sale el mail. El padre no tipea nada en la app. Si entró con
otro mail, el coordinador corrige el mail en la ficha del chico, y no queda
ninguna puerta para adivinar. B queda como escalón por si el resguardo 3 lo
pide.

**Riesgo que queda** (aceptado por Tomás con su razón: nadie llena el
formulario entero de un chico que no es suyo). Alguien podría inscribir al
chico de otro. Con D1 lo haría con cualquier mail. Con D2 sólo con su propia
cuenta de Google, que queda registrada. Lo frenan tres cosas:
- El import marca cuando un chico ya existente llega con un mail nuevo.
- El profe confirma cada fila.
- La lista del coordinador muestra todos los vínculos.

No hace falta service role key, función de servidor ni conexión
Apps Script → Supabase: el puente es un archivo que baja el profe y la base
nunca recibe un DNI.

## 3. El puente: pestaña "Para Semillero"

En el tablero de inscripción (sesión de inscripción, prompt 05) se suma una
pestaña armada con fórmulas: **apellido, nombre, fecha de nacimiento,
categoría y mail del responsable**. Sin DNI, sin datos médicos. Se baja como
`.xlsx` (Archivo → Descargar), y el `xlsx` vendorizado ya lo lee. Nombres de
columna fijos, con un test de contrato contra un fixture sintético.

En Semillero, el plantel suma **"Importar inscriptos"** (entrenador asignado,
como el import CABB):
- Toma sólo las filas de la categoría de ese plantel.
- Propone para cada fila "es este jugador" (reusa el dedup del import CABB,
  `jugadores_del_club_para_dedup`) o "ficha nueva".
- El profe confirma y una RPC `security invoker` hace todo en una
  transacción, con verificación de rollback: crea la ficha y la pertenencia
  si hace falta, completa `fecha_nacimiento` si estaba vacía y anota el mail.
- Así se cumple el resguardo 4: el padre no crea jugadores, el profe sí. Y
  como el plantel fija el club, nadie se vincula con un chico de otro club.
- Chico que no está en el padrón: no hay vínculo hasta que el profe lo
  importe. Al entrar, el padre ve *"Todavía no encontramos a tu hijo. El club
  lo suma cuando procesa la inscripción: volvé en unos días."*

## 4. Datos y frontera

`miembro_club` no se toca. Igual que la cuenta de jugador (spec 2026-09-20 §3),
**la familia no recibe `select` sobre ninguna tabla de dominio**, sólo
`execute` sobre sus funciones. Así la exclusión de estadísticas, mediciones y
misiones no depende de acordarse de cada tabla. Un test de contrato falla si
aparece un grant fuera de la lista declarada. Ninguna policy existente se
modifica: el import escribe `jugador` y `pertenencia` con los permisos que el
entrenador ya tiene.

- **`responsable_jugador`** `(id, club_id, jugador_id, email, cargado_por,
  cargado_en)`: el mail en minúsculas, único por `(jugador_id, email)`. Lo
  escribe y lo lee el staff del plantel (RLS por `puede_escribir_plantel`) y
  el coordinador lo corrige. Es dato del adulto, no del chico.
- **`vinculo_familia`** `(id, user_id, club_id, jugador_id, via, desde,
  hasta, cerrado_por)`, con `via` = `'mail'` hoy. Único parcial
  `(user_id, jugador_id) where hasta is null`. Sin insert ni delete del
  cliente. La baja es un cierre sellado por trigger, no un borrado: tiene que
  poder saberse quién estuvo vinculado a qué chico. Un vínculo cerrado por el
  coordinador no se vuelve a abrir solo.
- Patrón 0026: `revoke all`, grant por columna, RLS, trigger de sellado.

| Función | Quién | Qué hace |
|---|---|---|
| `importar_inscriptos(payload)` | entrenador del plantel | §3. `security invoker`. |
| `vincular_por_mail()` | autenticado, mail confirmado, sin staff ni cuenta de jugador | crea los vínculos que falten para su mail. `security definer`. |
| `mis_chicos()` | familia | nombre limpio, categoría vigente y club de cada vínculo abierto. |
| `vinculos_familia_del_club(club)` | coordinador | todos, con chico, categoría, fecha, vía, nombre de Auth y mail enmascarado. |
| `cerrar_vinculo_familia(id)` | coordinador del club | baja. |

Un profe que además es padre queda para después: anotado como límite.

## 5. Pantallas

- **"Todavía no tenés club"** (la puerta de entrada desde el portal): antes de
  mostrarse llama a `vincular_por_mail()`. Si hay vínculos, entra al shell
  familia; si no, suma el aviso de §3. Para el staff no agrega llamadas.
- Shell `modo = 'familia'` con una pantalla, **Mis chicos**.
- **Plantel → Importar inscriptos** (§3).
- **Coordinación → Familias**: la lista de vínculos y "Dar de baja".
- **Ficha del chico**: el staff ve y corrige los mails de responsables.
- Estética interna clara, mobile-first, áreas táctiles ≥44px.

Capas: repo nuevo `src/data/repos/familia.js` + línea en la fachada. Lógica
pura en `src/data/inscriptos.js`: leer la pestaña, filtrar por categoría,
normalizar mail, armar el payload. Largos en `limites.js` con su `check`.

## 6. Resguardos

1. La familia ve sólo lo no sensible de sus hijos vinculados, más lo público.
   Estadísticas, mediciones y misiones quedan fuera por construcción (§4).
2. Control posterior: el coordinador ve y da de baja.
3. **Cuando un módulo futuro sume contenido sensible para la familia
   (asistencia, prompt 04; aranceles, prompt 09), su spec revisa si el
   vínculo necesita aprobación del coordinador, o el código B, antes de
   mostrarlo.** La columna `via` existe para eso.
4. El padre no crea jugadores ni se vincula fuera de su club (§3).

## 7. Verificación

- Tests puros: `tests/inscriptos.test.js` (columnas, filtro por categoría,
  mail inválido o vacío, filas repetidas).
- Contratos: `tests/contratoAccesoFamilia.test.js` (grants exactos) y
  `tests/contratoLimites.test.js` (largos).
- `tests/verificarCuentasFamilia.sql`, con usuarios sintéticos y rollback:
  - la familia A no ve los chicos de B;
  - ninguna familia lee `jugador`, `estadistica_jugador_partido`, mediciones,
    misiones ni `responsable_jugador` por PostgREST;
  - sin vínculos o con el vínculo cerrado no ve nada;
  - un mail sin confirmar no vincula y un vínculo cerrado no se reabre;
  - el import de un profe en un plantel ajeno falla;
  - profe y coordinador ven lo mismo que antes.
- Más `tests/rollback0057.sql`.
- `grep` de `service_role` en el repo y en `public/` + `src/`: cero.
- `npm run test:q` en verde antes de cada commit.
