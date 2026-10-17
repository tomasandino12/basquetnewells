# Finanzas del básquet (carga interna) — spec

Fecha: 16/10/2026. Origen: prompt 07. Plan: `docs/superpowers/plans/2026-10-16-finanzas.md`.

## Objetivo

El coordinador registra ingresos y egresos del básquet (patrocinios, alquiler de cancha, arbitrajes, material) y ve, por mes, ingresos, egresos, resultado y totales por rubro. Sólo carga y vista interna; la publicación a familias es otro módulo (ver al final cómo encaja).

## Lo que ya hay y en qué se apoya

- El rol está modelado como se esperaba: `miembro_club.es_coordinador` (0017), y `es_coordinador_de(club_id)` (security definer, `search_path = ''`) ya se usa en el `with check` de `material` (0026). **No hace falta otra función de permisos ni tocar ninguna policy de lo deportivo.**
- Patrón de tabla escrita sólo por coordinación: `0026_material.sql` (revoke all, grant por columna, trigger de sellado).
- Patrón de verificación de RLS: `tests/verificarCoordinacion.sql` (usuarios sintéticos, impersonación con `request.jwt.claims`, todo se deshace al final, una fila OK/FALLA por caso). Rollbacks: `tests/rollback00NN.sql`.

## Decisiones (las del prompt, bajadas al modelo)

1. **Quién**: lee y escribe `es_coordinador_de(club_id)`, tenga o no también el rol de entrenador. Un entrenador sin rol de coordinador recibe **cero filas** de las tres tablas. Jugadores: cero filas, como en todo.
2. **Tablas** (migración `0054_finanzas.sql`):
   - `rubro`: `id`, `club_id`, `nombre`, `tipo` (`check in ('ingreso','egreso')`), `activo` (default true), autoría y fechas. Único por `(club_id, lower(nombre))`. Grant de insert `(club_id, nombre, tipo)`, de update sólo `(nombre, activo)`: **el tipo no cambia** después de creado, porque cambiaría el signo de todos los movimientos viejos. Sin delete: un rubro que no se usa más se desactiva (no aparece al cargar, sí en los totales de meses viejos).
   - `movimiento`: `id`, `club_id`, `rubro_id`, `fecha` (date), `monto numeric(12,2) check (monto > 0)`, `descripcion`, `comprobante_url` (opcional, `https://`), `creado_por/en`, `actualizado_por/en`, `borrado_por/en`. FK compuesta `(club_id, rubro_id) → rubro(club_id, id)`: un movimiento no puede apuntar a un rubro de otro club. Grant de insert `(club_id, rubro_id, fecha, monto, descripcion, comprobante_url)`; de update esas mismas menos `club_id`, más `borrado_en`. Sin delete.
   - `movimiento_cambio`: el rastro. `id`, `movimiento_id`, `club_id`, `accion` (`'edicion'|'baja'`), `antes jsonb` (la fila como estaba), `cambiado_por`, `cambiado_en`. La escribe **sólo** un trigger `after update` de `movimiento` (función security definer); el cliente no tiene ningún grant de escritura. La lee coordinación.
3. **Signo**: el monto siempre es positivo; el signo sale de `rubro.tipo`. En pantalla, ingreso = "+ $ 1.234,50" con la palabra "Ingreso"; egreso = "− $ 1.234,50" con "Egreso". El color acompaña, nunca es la única señal.
4. **Plata**: `numeric(12,2)` (tope 9.999.999.999,99). En JS se trabaja en **centavos enteros**: nunca se suman decimales en coma flotante. `montoDesdeTexto` (pura, en `src/data/finanzas.js`) acepta formato argentino:
   - `1234,50`, `1.234,50`, `1234`, `1.234` → 1234,50 / 1234,50 / 1234 / 1234 (punto = miles **sólo** si separa grupos de tres).
   - Rechaza con mensaje: vacío, cero o negativo, más de dos decimales, `12.5` (punto ambiguo: "Usá coma para los centavos"), letras, notación científica, más del tope.
   - Devuelve `{ centavos }` o `{ error: 'texto para mostrar' }`. Al repo le llega el texto `"1234.50"` armado desde los centavos, no un float.
   - Es una excepción acotada a la regla "números tecleados con `decimalEstricto`": ésa no acepta separador de miles y acá el formato con puntos es el que la gente escribe. Mismo espíritu (una sola forma válida, nada de `Number(texto)`).
5. **Comprobante**: link (Drive u otro) con `check (comprobante_url ~ '^https://')` y largo `LIMITE.enlace`. No se suben archivos.
6. **Rastro**: el trigger `before update` sella `actualizado_por/en`; si el cliente manda `borrado_en` (cualquier valor), el trigger lo pisa con `now()` y `auth.uid()` en `borrado_por` (mismo mecanismo que `asignacion_plantel.hasta`). Una fila borrada **no se puede editar ni "desborrar"** (el trigger rechaza). El `after update` copia la fila vieja a `movimiento_cambio`. Edición y rastro quedan en la misma sentencia: no es una escritura de varias filas desde el cliente, así que no hace falta RPC.
7. **Totales**: suma de movimientos no borrados con `fecha` dentro del mes elegido; ingresos, egresos, resultado (ingresos − egresos) y una línea por rubro con movimientos en el mes. Sin proyecciones, promedios ni comparaciones. El cálculo es puro (`resumenDelPeriodo`) y testeado; el repo sólo trae las filas del mes.
8. **Nombres genéricos**: la pantalla de rubros lo dice en una línea ("Sin nombres de personas: esto puede publicarse algún día"). No se valida por código (no hay forma confiable); queda como pauta visible.
9. **Largos** (`limites.js` + `check (char_length)` + `contratoLimites`): `rubro.nombre` 60, `movimiento.descripcion` 300, `movimiento.comprobante_url` 2048.

## Pantallas

- Pestaña nueva **Finanzas** en `TABS_COORDINACION` (cuarta). `p-coord-finanzas`:
  - Selector de mes (‹ octubre 2026 ›), arranca en el mes actual.
  - Tres totales: Ingresos (+), Egresos (−), Resultado (con signo y la palabra "a favor"/"en contra").
  - Totales por rubro, agrupados Ingresos / Egresos.
  - Lista de movimientos del mes (fecha, rubro, descripción, monto con signo, ícono de link si tiene comprobante). Tocar uno abre la edición.
  - Botón "Cargar movimiento" y acceso a "Rubros".
  - Estado vacío: sin rubros → invita a crear rubros primero; con rubros y sin movimientos → "Todavía no hay movimientos en octubre".
- Formulario de movimiento (alta y edición, en una hoja sobre `p-coord-finanzas`, como el inventario): fecha (hoy por defecto), rubro (sólo activos, agrupados por tipo), monto (`inputmode="decimal"`), descripción, link al comprobante. En edición, botón "Borrar" con confirmación ("Queda registrado quién lo borró").
- `p-coord-rubros`: lista por tipo; alta (nombre + tipo), renombrar y activar/desactivar en hojas.
- Mobile-first: base celular, en notebook (`min-width` en `layout.css`) totales en fila y lista más ancha. Áreas táctiles ≥ 44px, `hover` sólo dentro de `@media (hover: hover)`. HTML con `html\`\`` de `ui/html.js`, errores con `ui/errores.js`. Seguir `DESIGN.md`.

## Fuera de alcance

Publicación a familias, aranceles o pagos por familia, importar Excel, gráficos, pagos online, ver el historial de cambios en la interfaz (queda en la base, consultable por SQL; si hace falta verlo, es una pantalla chica después).

## Criterios de aceptación

- `tests/verificarFinanzas.sql` en el SQL Editor da todo OK: profe sin rol de coordinador → 0 filas en `rubro`, `movimiento` y `movimiento_cambio` y no puede insertar; coordinador de otro club → 0 filas; coordinador → lee y escribe; editar deja una fila en `movimiento_cambio`; borrar sella `borrado_por/en`, la fila sigue y no se puede editar ni desborrar; no se puede cambiar el `tipo` de un rubro ni el `club_id` de un movimiento.
- `montoDesdeTexto("1.234,50")` → 123450 centavos; los inválidos devuelven un mensaje claro (test).
- `resumenDelPeriodo` cuadra con datos de prueba, incluido un movimiento borrado que no suma (test).
- `npm run test:q` verde, incluido `arquitectura.test.js` (capas) y los contratos nuevos.

## Cómo se agregaría la publicación (no entra acá)

Una tabla nueva `resumen_publicado`: `club_id`, `periodo` (primer día del mes), `datos jsonb` (ingresos, egresos, resultado y totales por **nombre de rubro**, nada de movimientos ni descripciones), `publicado_por/en`. La crea una RPC que el coordinador llama eligiendo el mes: calcula los totales en ese momento y guarda la **foto fija**. Inmutable (sin update; para corregir se publica otra versión y la vigente es la más nueva). Las familias leerían sólo esa tabla (o una función que la devuelva), nunca `movimiento`. Nada del modelo de este módulo lo impide: los rubros son genéricos, los totales ya se calculan por rubro y mes, y las tablas internas siguen con RLS de coordinación.

## Notas de ejecución

1. `npm run backup` lo trae el módulo de backup (rama `feat/backup`); el push de 0054 espera a que esté en `main`.
2. El número 0054 también lo reservan los planes de historia del jugador y de misiones: el que se aplique segundo se renumera antes del push (archivo, `contratoFinanzas` y `contratoLimites`).
3. Hoy `componentes.css` tiene dos `@media` de ancho (`max-width:420px`, `min-width:64rem`) fuera de `layout.css`. Lo nuevo respeta la regla; esos dos no se tocan en este módulo.
