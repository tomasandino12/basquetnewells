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
| p-ejercicio | Ficha de ejercicio | Ver: pizarra animada, variaciones, notas de uso, enlace, material. Editar, borrar con confirmación y agregar notas/variaciones | Dentro de Recursos (`Recursos.tsx`, `RecursosEscritura.tsx`): cargar, editar y borrar con confirmación; notas y variaciones (editar y borrar sólo lo propio). El dibujo de la pizarra del ejercicio sigue en la app de siempre | ✅ | `web/src/pantallas/RecursosEscritura.test.tsx::Recursos: editar y borrar un ejercicio`, `web/src/pantallas/RecursosEscritura.test.tsx::Recursos: notas y variaciones` | 1 |
| p-jugada | Ficha de jugada | Ver la jugada animada y a qué planteles está asignada; asignar planteles; borrar | `/recursos` (pestaña Jugadas): ver y animar, asignar a planteles, duplicar, imprimir, editar (lleva al editor) y borrar con confirmación; lo de otro profe no ofrece editar ni borrar | ✅ | `web/src/pantallas/Recursos.test.tsx::borra una jugada propia sólo después de confirmar` | 1 y 3 |
| p-jugada-editor | Editor de jugadas (pizarra táctica) | Fichas, pasos, acciones, pelota, aviso de salida sin guardar | `/recursos/jugadas/:jugadaId/editar` (`EditorDeJugada.tsx`, `pizarra-editable.tsx`): alta desde Recursos (nombre, tipo, formación), fichas, pasos con indicaciones, acciones de dos toques, pelota, arrastre con asas, deshacer/rehacer, guardar, renombrar, aviso de salir sin guardar (router y navegador). La pizarra de un ejercicio queda en la sesión de ejercicios | ✅ | `web/src/pantallas/EditorDeJugada.test.tsx::con cambios sin guardar, volver pide confirmación` | 3 |
| p-plan-fisico | Plan físico desde .xlsx | Leer la planilla, validar, guardar todo o nada | `/fisico/cargar-plan` (`CargarPlanFisico.tsx`), enlazada desde Físico. Lector de planillas pedido recién al elegir el archivo; resumen, videos opcionales (elegir de la biblioteca o cargar link) y guardado todo o nada | ✅ | `web/src/pantallas/importar/CargarPlanFisico.test.tsx::Cargar plan de fuerza` | 2 |
| p-fisico | Físico | Lista de planes, plan visible, otros planes | `/fisico` | 🔎 | | |
| p-fisico-sesion | Sesión de Físico | Ejercicios de la sesión, videos | `/fisico/plan/:planId/sesion/:sesionId` | 🔎 | | |
| p-fisico-escalones | Escalones de fuerza | Peso por chico y ejercicio, escalón + y − | `…/ejercicio/:lineaId` | 🔎 | | |
| p-recursos | Recursos | Ejercicios, jugadas, videos para jugadores; crear, editar y borrar | `/recursos` (ver y ofrecer; jugadas: crear, editar y borrar ya están; ejercicios: falta crear, editar y borrar, tanda 3) | 🔎 | | 3 |
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
| p-fam-chicos | Familia: mis chicos | Sólo lectura: los hijos vinculados con categoría y club, cómo anotarlos si no aparecen, volver a mirar | `/familia` (`pantallas/familia/Familia.tsx`): marco propio sin menú; `Entrada` manda ahí a quien sólo es familia | ✅ | `web/src/pantallas/familia/Familia.test.tsx::Portal de familias` | |

## Funciones que no son una `p-*` del registro

Lo que vive en otros archivos de la vieja y también hay que mudar antes de borrarla.

| id | qué hace | en la nueva | estado | prueba | tanda |
|---|---|---|---|---|---|
| x-entrar | Entrar con mail y clave (un mail sin confirmar lo dice), con Google, clave olvidada; sin sesión, toda pantalla con datos lleva a `/entrar` | `/entrar` (`Entrar.tsx`) | ✅ | `web/src/pantallas/Entrar.test.tsx::Entrar: cuenta` | 4 |
| x-crear-cuenta | Crear cuenta (profe, jugador), confirmar mail, nombre obligatorio, aceptar la política (con fecha de versión), pantalla «falta el acceso» con pedido de jugador | `Entrar.tsx` (crear, con la versión de la política a la vista) y, ya con sesión, `pantallas/cuenta/` (`PasosDeCuenta`: nombre → Términos y Política de `VERSION_LEGAL` → acceso; `SinClub`: pedido de jugador, pedido pendiente con código, rechazo y «pedir de nuevo», reintentar) | ✅ | `web/src/pantallas/cuenta/PasosDeCuenta.test.tsx::Cuenta: aceptar la política`, `web/src/pantallas/cuenta/PasosDeCuenta.test.tsx::Cuenta: todavía sin acceso` | 4 |
| x-vuelta-de-mails | Vuelta de un mail de confirmación, de nueva clave o de Google: abre la sesión y sigue por los pasos de la cuenta; un link vencido se explica en Entrar | Resuelta en esta app: `clasica.ts` ya no reenvía ninguna vuelta (ni con el interruptor apagado); `cuenta/vuelta.ts` guarda el error de un link vencido | ✅ | `web/src/cuenta/vuelta.test.ts::no pasa por la app de siempre`, `web/src/pantallas/Entrar.test.tsx::volver de un link vencido` | 4 |
| x-nueva-clave | Pantalla de elegir una nueva clave: la vuelta del mail abre sesión, no deja pasar a la app hasta elegirla (8+ caracteres, repetida), link vencido lleva a entrar | `/nueva-clave` (`NuevaClave.tsx`; el aviso PASSWORD_RECOVERY lo marca `cuenta/recuperacion.ts`). La vuelta de recuperación ya no se reenvía a la de siempre | ✅ | `web/src/pantallas/NuevaClave.test.tsx::Nueva clave` | 4 |
| x-alta-jugador | Alta de jugador / pedido de entrada con código, aprobar solicitud | Plantel (alta manual y pedidos); el pedido del propio jugador está en `SinClub` (ver x-crear-cuenta) | 🔎 | | 4 |
| x-planilla-area | Planilla del área desde .xlsx | «Bajar planilla» en el historial de asistencia (`AsistenciaHistorial.tsx`, `asistencia/planilla.ts`): una hoja por categoría del profe, armada en el dispositivo; el lector se pide recién al bajar | ✅ | `web/src/pantallas/AsistenciaHistorial.test.tsx::baja la planilla del área` | 2 |
| x-portada | Portada de quien llega sin cuenta (landing animada): escudo con el nombre girando, tarjetas con demos (planilla, línea de tiempo, curva y salto que cuenta, jugada animada), dos puertas, legales | `/entrar` (`Portada.tsx`, `PizarraDeLaPortada`): sin menú de la app; las animaciones corren al entrar en pantalla y se repiten al tocar | ✅ | `web/src/pantallas/Entrar.test.tsx::Entrar: portada` | 4 |
| x-guias | Intro de primer uso por modo (entrenar, coordinar, jugar, familia) y pistas de una vez (Medir, editor de jugadas) | `guia/GuiaDePrimerUso.tsx` (misma clave guardada que la vieja) | ✅ | `web/src/pantallas/familia/Familia.test.tsx::la intro de primer uso` | |
| x-pwa | App instalable (service worker `public/sw.js`, manifest) | `web/src/pwa.ts`, registrado en `main.tsx` | ✅ | `tests/contratoMudanzaReact.test.js::la vuelta del login llega a /app` | |
| x-reporte-errores | Errores que nadie atrapó: aviso al usuario y registro depurado en la base | `errores/reporte.tsx` (con `PantallaRota` para una pantalla que se rompe al dibujarse) | ✅ | `web/src/errores/reporte.test.tsx::Errores que nadie atrapó` | |
| x-recursos-ofrecer | Ofrecer un recurso a los jugadores, enviarlo a quienes faltan, borrarlo y «Mandar un recurso» por zona desde Hoy | `/recursos` pestaña Videos (`RecursosOfrecer.tsx`): «Ofrecer un recurso» (título, instrucciones, link sólo web, tipo, veces por semana, minutos, a quién; un id por formulario abierto para que un reintento no duplique), «Enviar a los que faltan» (sólo quienes no lo recibieron), borrar lo propio con confirmación. «Mandar un recurso» de Hoy abre esa pestaña (`/recursos?pestana=videos`), como hacía la de siempre | ✅ | `web/src/pantallas/RecursosOfrecer.test.tsx::Recursos: ofrecer un recurso`, `::Recursos: enviar a los que faltan`, `::Recursos: borrar un recurso`, `::Hoy: mandar un recurso por zona` | 3 |

## Qué se borra al final (sólo con todo en ✅ y backup confirmado)

`src/ui/` (main, nav, pantallas, componentes), `public/index.html` de la vieja, la ruta `/app/clasica` en `vercel.json`, `src/ui/pantallaNueva.js`, `interruptorNueva.js`, `web/src/clasica.ts`, los enlaces «app anterior» y el interruptor de Mi perfil; y sus pruebas viejas.
