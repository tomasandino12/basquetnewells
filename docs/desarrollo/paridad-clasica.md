# Paridad: app de siempre → app nueva (React)

Lista de lo que hace la app vieja (`src/ui/`, en `/app/clasica`) y dónde queda en la nueva (`web/`).
La vieja **sólo se borra** cuando todas las filas están en ✅. `tests/paridadClasica.test.js` lo vigila.

**Estados**
- ✅ Está en la nueva y una prueba lo cubre (columna «Prueba»: `archivo::texto que tiene que aparecer en él`). El test falla si el archivo o el texto no existen: la marca no se pone a ojo.
- 🔎 Está en la nueva, pero todavía nadie la comparó función por función con la vieja. Hay que verificarla y pasarla a ✅.
- ⬜ Falta mudar (tanda 1 a 4).

**Tandas:** 1 lectura simple (metas, inventario, ver ejercicios y jugadas) · 2 planillas .xlsx (plan de fuerza, planilla del área) · 3 editores (jugadas, ejercicios) · 4 entrar (cuenta, mails, nueva clave, política, alta).

## Pantallas registradas en `src/ui/pantallas/registro.js`

Una fila por cada `p-*` registrada. Cada `p-*` del registro tiene que figurar acá.

| id | pantalla vieja | qué hace (botones, filtros, roles) | en la nueva | estado | prueba | tanda |
|---|---|---|---|---|---|---|
| p-metas | Metas | Una meta (0–100 %) por cada una de las 6 zonas del arco; muestra el % actual de la última batería de tiro («sin medir» si no hay); campo vacío saca la meta; 0 es válido y distinto de vacío; rechaza texto, negativos, más de 100 y notación científica; guarda las 6 juntas (todo o nada); Cancelar vuelve sin guardar; sólo el cuerpo técnico (la coordinación sola no la ve) | `/metas` (`Metas.tsx`), enlazada desde Hoy | ✅ | `web/src/pantallas/Metas.test.tsx::Metas: ver y editar` | 1 |
| p-inventario | Inventario (lectura, el profe desde Físico) | Lista agrupada Con peso / Sin peso / Otros, ordenada por peso, con unidades y «último cambio: quién, cuándo»; vacío distinto para el profe; sin ningún botón de cambio | `/fisico/inventario` (`Inventario.tsx`, `InventarioLectura`), enlazada desde Físico | ✅ | `web/src/pantallas/Inventario.test.tsx::Inventario: la lista` | 1 |
| p-coord-inventario | Inventario (coordinación) | Lo anterior más: agregar (tipo, peso en kg, nombre en «Otro», cantidad con − que no baja de 1), «ya está cargado» ofrece editar esa fila en vez de duplicar, editar, quitar con confirmación, error de permiso y de fila repetida (23505) | `/coordinacion/inventario` (`CoordInventario`), con pestaña propia en la barra de coordinación | ✅ | `web/src/pantallas/Inventario.test.tsx::Inventario: editar y quitar` | 1 |
| p-ejercicio | Ficha de ejercicio | Ver: pizarra animada, variaciones, notas de uso, enlace, material. Editar, borrar con confirmación y agregar notas/variaciones | Ver: dentro de Recursos. Editar y borrar: falta | ⬜ | | 1 (ver) y 3 (editar) |
| p-jugada | Ficha de jugada | Ver la jugada animada y a qué planteles está asignada; asignar planteles; borrar | Ver: dentro de Recursos. Asignar y borrar: falta verificar | ⬜ | | 1 (ver) y 3 (editar) |
| p-jugada-editor | Editor de jugadas (pizarra táctica) | Fichas, pasos, acciones, pelota, aviso de salida sin guardar | Falta (`crearJugada` y `crearPaso` ya están en el repositorio nuevo) | ⬜ | | 3 |
| p-plan-fisico | Plan físico desde .xlsx | Leer la planilla, validar, guardar todo o nada | Falta; la nueva sólo muestra el plan ya guardado (Físico) | ⬜ | | 2 |
| p-fisico | Físico | Lista de planes, plan visible, otros planes | `/fisico` | 🔎 | | |
| p-fisico-sesion | Sesión de Físico | Ejercicios de la sesión, videos | `/fisico/plan/:planId/sesion/:sesionId` | 🔎 | | |
| p-fisico-escalones | Escalones de fuerza | Peso por chico y ejercicio, escalón + y − | `…/ejercicio/:lineaId` | 🔎 | | |
| p-recursos | Recursos | Ejercicios, jugadas, videos para jugadores; crear, editar y borrar | `/recursos` (ver y ofrecer; crear/editar/borrar ejercicios y jugadas falta: tanda 3) | 🔎 | | 3 |
| p-hoy | Hoy | Tiro, metas, altura y peso, misiones, accesos | `/hoy` | 🔎 | | |
| p-plantel | Plantel | Lista, alta manual, pedidos de entrada, categoría | `/plantel` | 🔎 | | |
| p-ficha | Ficha del jugador | Datos, asistencia, lesiones, físico, tiro | `/plantel/:jugador` | 🔎 | | |
| p-datos | Datos | Partidos, tiro, físico, asistencia, gráficos | `/datos` | 🔎 | | |
| p-confirmacion | Cargar partido (confirmar) | Leer .xlsx de la CABB, equipo, fecha, jugadores | `/datos/cargar-partido` | 🔎 | | |
| p-resultado | Cargar partido (resultado) | Guardar y avisar | `/datos/cargar-partido` | 🔎 | | |
| p-medir | Medir | Lista de pruebas | `/medir` | 🔎 | | |
| p-medir-bateria | Batería de tiro | Cronómetro, 10 intentos por zona | `/medir/tiro` | 🔎 | | |
| p-medir-salto | Salto | Video, marcador | `/medir/salto` | 🔎 | | |
| p-medir-sprint | Sprint | Cronómetro, parciales | `/medir/sprint` | 🔎 | | |
| p-medir-yoyo | Yo-Yo | Pitidos, salida confirmada | `/medir/yoyo` | 🔎 | | |
| p-previa | Misiones (armar) | Armar y corregir la previa | `/misiones/armar` | 🔎 | | |
| p-misiones-partido | Evaluar misiones | Marcar logrado / en proceso / no logrado | `/misiones/:previaId` | 🔎 | | |
| p-asistencia | Asistencia | Toma del día, ausentes con aviso, lesión, salir sin guardar | `/plantel/asistencia` | 🔎 | | |
| p-asistencia-historial | Historial de asistencia | Por día, bajar planilla | `/plantel/asistencia/historial` | 🔎 | | |
| p-coord-panorama | Panorama | Agregados por categoría | `/coordinacion` | 🔎 | | |
| p-coord-profes | Profes | Asignar profes a categorías | `/coordinacion/profes` | 🔎 | | |
| p-coord-familias | Familias | Papeles, pagos, cuentas | `/coordinacion/familias` | 🔎 | | |
| p-coord-temporada | Cambio de temporada | Pases | `/coordinacion/temporada` | 🔎 | | |
| p-coord-finanzas | Finanzas | Ingresos y egresos por rubro | `/coordinacion/finanzas` | 🔎 | | |
| p-coord-rubros | Rubros | Alta, edición, desactivar | `/coordinacion/rubros` | 🔎 | | |
| p-coord-formularios | Formularios | Formularios del portal | `/coordinacion/formularios` | 🔎 | | |
| p-mi-perfil | Mi perfil | Nombre, interruptores, salir, legal | `/perfil` | 🔎 | | |
| p-jug-recursos | Jugador: recursos | Sólo lectura | `/jugador/recursos` | 🔎 | | |
| p-jug-fisico | Jugador: físico | Sólo lectura | `/jugador/fisico` | 🔎 | | |
| p-jug-sesion | Jugador: sesión | Sólo lectura | `/jugador/sesion` | 🔎 | | |
| p-jug-progreso | Jugador: mi progreso | Sólo lectura | `/jugador/progreso` | 🔎 | | |
| p-jug-jugadas | Jugador: jugadas | Sólo lectura | `/jugador/jugadas` | 🔎 | | |
| p-fam-chicos | Familia: mis chicos | Sólo lectura | Vista de familia | 🔎 | | |

## Funciones que no son una `p-*` del registro

Lo que vive en otros archivos de la vieja y también hay que mudar antes de borrarla.

| id | qué hace | en la nueva | estado | prueba | tanda |
|---|---|---|---|---|---|
| x-entrar | Entrar con mail y clave, con Google, clave olvidada | `Entrar.tsx` (básico: la vuelta de mails la resuelve la vieja) | 🔎 | | 4 |
| x-crear-cuenta | Crear cuenta (profe, jugador), confirmar mail, aceptar la política (con fecha de versión) | Falta | ⬜ | | 4 |
| x-vuelta-de-mails | Vuelta de un mail de confirmación o de nueva clave | Falta (`clasica.ts` reenvía) | ⬜ | | 4 |
| x-nueva-clave | Pantalla de elegir una nueva clave: la vuelta del mail abre sesión, no deja pasar a la app hasta elegirla (8+ caracteres, repetida), link vencido lleva a entrar | `/nueva-clave` (`NuevaClave.tsx`; el aviso PASSWORD_RECOVERY lo marca `cuenta/recuperacion.ts`). La vuelta de recuperación ya no se reenvía a la de siempre | ✅ | `web/src/pantallas/NuevaClave.test.tsx::Nueva clave` | 4 |
| x-alta-jugador | Alta de jugador / pedido de entrada con código, aprobar solicitud | Plantel (alta manual y pedidos) | 🔎 | | 4 |
| x-planilla-area | Planilla del área desde .xlsx | Falta | ⬜ | | 2 |

## Qué se borra al final (sólo con todo en ✅ y backup confirmado)

`src/ui/` (main, nav, pantallas, componentes), `public/index.html` de la vieja, la ruta `/app/clasica` en `vercel.json`, `src/ui/pantallaNueva.js`, `interruptorNueva.js`, `web/src/clasica.ts`, los enlaces «app anterior» y el interruptor de Mi perfil; y sus pruebas viejas.
