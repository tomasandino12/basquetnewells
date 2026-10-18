# Cuentas de familia — diseño

Estado: **esperando aprobación de Tomás**. Fecha: 2026-10-18. Prompt 08, con
el cambio de decisión del 18/10: el vínculo lo crea el padre, sin aprobación
previa. Tag de partida: `pre-cuentas-familia`. Migración: `0057` (a confirmar
con la coordinadora).

## 1. Qué entra

Un familiar se registra como cualquiera (mail o Google), se vincula él mismo
con su hijo y ve una pantalla **"Mis chicos"** con nombre y categoría de cada
hijo vinculado. Nada más. Varios familiares por chico y varios chicos por
familiar. El coordinador ve todos los vínculos (quién, a qué chico, cuándo) y
puede dar de baja cualquiera.

Fuera: que la familia edite datos de la app, mensajería, estadísticas,
mediciones, misiones, cuentas de jugador, aranceles y asistencia.

## 2. Con qué dato engancha la app al padre con el chico

El problema: la carga completa (grupo sanguíneo, condiciones médicas, DNI)
vive en Google Forms y **la app nunca la ve**. Así que "nadie carga tantos
campos para un chico que no es suyo" protege al formulario, no al vínculo: lo
único que la app puede comparar es lo que ya tiene en Supabase o lo que el
club le entregue.

| Opción | Qué pide | Seguridad | Costo |
|---|---|---|---|
| A. DNI + nacimiento contra un hash | el club carga en Supabase un hash del DNI de cada chico | **Falsa**: un DNI son ~10⁸ valores casi correlativos; el hash se revierte en segundos. Es guardar el DNI con otro nombre, contra la decisión del prompt 05. Un hash con "pimienta" secreta pide función de servidor. | Alto: proceso de carga de DNIs + servidor. |
| B. Código por chico que entrega el club | el padre tipea un código de 8 caracteres que el coordinador le pasa (impreso o por WhatsApp) | **Fuerte**: no se adivina, no sale de ninguna planilla. | Medio: el club reparte ~120 códigos; un padre sin código no puede vincularse. Choca con "el padre carga y queda linkeado". |
| C. Categoría + nombre y apellido + fecha de nacimiento | lo que el padre ya sabe, comparado con `jugador.fecha_nacimiento` (existe desde 0012) | **Débil**: nombre y categoría salen de las planillas CABB y la fecha se adivina en ~365 intentos. Lo frenan el límite de intentos y el control posterior. | Bajo: nada nuevo que guardar, nada que repartir. |

**Recomendación: C ahora, con B ya diseñada como escalón.** Lo que la familia
ve en este módulo (nombre y categoría de un chico que ya conoce) es lo mismo
que publica la CABB, así que un vínculo falso hoy no expone nada nuevo. Cuando
entre contenido sensible (resguardo 3), el vínculo pasa a exigir el código B:
es una columna y un parámetro más en la misma función, sin rehacer nada.

Reglas de C:
- El padre elige categoría de la temporada vigente (catálogo de
  `clubes_para_solicitar()`, 0029), escribe nombre y apellido y la fecha.
- Hay vínculo sólo si **exactamente un** jugador con pertenencia vigente a ese
  plantel tiene esa fecha **y** su `nombre_clave` contiene el apellido y el
  nombre normalizados (misma normalización que el import). Mellizos: cada uno
  con su nombre, dos vínculos.
- Cero coincidencias o más de una: el mismo mensaje genérico, sin decir qué
  campo falló: *"No encontramos a ese chico. Si recién se inscribió, puede que
  el club todavía no lo haya cargado: probá en unos días o consultalo con el
  coordinador."*
- **Chico que no está en el padrón** (o sin fecha cargada): no se crea nada,
  ni jugador ni solicitud pendiente. El padre vuelve a intentar cuando el
  club lo cargue (el coordinador completa la fecha desde la ficha, como hoy).
- **Otro club**: imposible por construcción; el plantel elegido fija el club y
  la búsqueda nunca sale de él.
- **Límite de intentos**: 5 fallidos por cuenta cada 24 h, y la función se
  niega a seguir. Se cuentan en una tabla propia, sin guardar lo tipeado.

Sin invitación por mail: **no hace falta service role key ni función de
servidor**. Todo es RLS y RPC en la base, como la cuenta de jugador.

## 3. Datos y frontera

`miembro_club` no se toca: una familia no es staff y su `check` sigue igual.
Igual que la cuenta de jugador (spec 2026-09-20 §3), **la familia no recibe
`select` sobre ninguna tabla de dominio**: sólo `execute` sobre sus funciones.
Así la exclusión de estadísticas, mediciones y misiones no depende de acordarse
de cada tabla: la familia no puede leer ninguna, y un test de contrato falla
si aparece un grant fuera de la lista declarada.

- **`vinculo_familia`** `(id, user_id default auth.uid(), club_id, jugador_id,
  desde, hasta, cerrado_por)`. Único parcial `(user_id, jugador_id) where hasta
  is null`. Sin `delete` ni `insert` directo: alta por función, baja por cierre
  sellado con trigger (`hasta`, `cerrado_por`). Cerrar y no borrar: dentro de
  dos años tiene que poder saberse quién estuvo vinculado a qué chico.
- **`intento_vinculo_familia`** `(user_id, creado_en)`: sólo los fallidos. Sin
  grants al cliente; la escribe y la cuenta la función.
- Patrón 0026: `revoke all`, grant mínimo por columna, RLS, trigger de sellado.

| Función | Quién | Qué hace |
|---|---|---|
| `vincular_familia(plantel, nombre, fecha)` | autenticado que no es staff ni jugador | aplica §2 y crea el vínculo. `security definer`. |
| `mis_chicos()` | familia | nombre limpio, categoría y club de cada vínculo vigente. Es lo que arranca la app. |
| `desvincularme(vinculo)` | la propia familia | cierra un vínculo suyo. |
| `vinculos_familia_del_club(club)` | coordinador | todos, con chico, categoría, fecha, nombre de Auth y mail enmascarado (patrón `solicitudes_del_plantel`). |
| `cerrar_vinculo_familia(vinculo)` | coordinador del club | baja. Las policies de profes y coordinador no se modifican. |

Staff o cuenta de jugador que intenta vincularse: rechazo con mensaje claro.
Un profe que además es padre queda para después (anotado como límite).

## 4. Pantallas

- "Todavía no tenés club" suma **"Soy familiar de un jugador"**, al lado de
  "Soy jugador de un club" → formulario de §2. Es la entrada desde el botón de
  padres del portal.
- Shell `modo = 'familia'` con una sola pantalla, **Mis chicos**: tarjeta por
  hijo (nombre, categoría), botón "Sumar otro chico" y "Desvincular". El
  arranque de `main.js` consulta `mis_chicos()` sólo cuando no hay club ni
  ficha de jugador: para el staff no agrega llamadas.
- Coordinación suma **Familias**: lista de vínculos con fecha y quién, y
  "Dar de baja".
- Estética interna clara (feedback "dos estéticas"); mobile-first del prompt.

Capas: repo nuevo `src/data/repos/familia.js` + línea en la fachada; lógica
pura en `src/data/familia.js` (validar el formulario, normalizar nombre —
reusando la del import—). Límites de texto en `limites.js` con su `check`.

## 5. Resguardos (decisión de Tomás, 18/10)

1. La familia ve sólo lo no sensible de sus hijos vinculados, más lo público.
   Estadísticas, mediciones y misiones quedan fuera por construcción (§3).
2. Control posterior, no aprobación: el coordinador ve y da de baja.
3. **Cuando un módulo futuro sume contenido sensible para la familia
   (asistencia, prompt 04; aranceles, prompt 09), se revisa si el vínculo
   necesita aprobación del coordinador o el código B antes de mostrarlo.** Esa
   revisión es parte de la spec de ese módulo, no opcional.
4. Un padre no se vincula fuera de su club ni crea jugadores (§2).

Riesgo aceptado por Tomás: los datos de C no son secretos. Lo frenan el límite
de intentos, que un vínculo hoy no muestra nada nuevo y la lista del
coordinador. Se anota en `docs/SEGURIDAD-LANZAMIENTO.md`.

## 6. Verificación

- `tests/familia.test.js`: validación y normalización del formulario.
- `tests/contratoAccesoFamilia.test.js`: los grants a la familia en 0057 son
  exactamente los declarados.
- `tests/contratoLimites.test.js` cubre los largos nuevos.
- `tests/verificarCuentasFamilia.sql` (usuarios sintéticos, con rollback): la
  familia A no ve los chicos de B; ninguna familia lee `jugador`,
  `estadistica_jugador_partido`, mediciones ni misiones por PostgREST; sin
  vínculos no ve nada; vínculo cerrado no ve nada; datos equivocados no
  vinculan y no dicen qué falló; el sexto intento se rechaza; un plantel de
  otro club no se puede usar; un profe y un coordinador siguen viendo lo
  mismo que antes.
- `grep` de `service_role` en el repo y en `public/` + `src/`: cero.
- `npm run test:q` en verde antes de cada commit.
