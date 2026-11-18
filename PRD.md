# PRD — Semillero y el portal del básquet de Newell's

> Describe lo que el sistema **ya hace** (leído del código al 17/11/2026, `main` en `cc319bb`), las reglas de los casos incómodos y qué falta para decir que está listo. Lo que no salía del código lo decidió Tomás el 17/11 (marcado **[T 17/11]**).
> Estado: **aprobado por Tomás el 17/11/2026.**

## 1. Qué es y para quién

Dos caras de un mismo sistema, pensado para clubes formadores de básquet (piloto: Newell's; la base ya separa todo por club):

| Pieza | Dirección | Para quién | Qué resuelve |
|---|---|---|---|
| **Portal** | `basquetnewells.com.ar` | Familias y público, sin cuenta | Inscribir, mandar comprobantes, ver categorías, horarios, agenda y formularios. |
| **Semillero** | `/app` (React; la versión vieja sigue en `/app/clasica`) | Profes, coordinación y jugadores, con cuenta | El trabajo diario del cuerpo técnico y el control de la coordinación. |
| **Google** (Forms, Drive y una planilla "Tablero") | Cuenta de la Comisión Básquet | Coordinación | Guarda DNIs, fotos, ficha médica completa y comprobantes. A Semillero sólo le manda **estados** (✅ 📎 ❌), nunca un DNI ni un archivo. |

Escala prevista: unos 100–120 chicos y sus profes. **Hay datos de menores**: la seguridad la impone la base (RLS), no la pantalla.

**Meta [T 17/11]:** uso real en la temporada 2027, con las dos cosas andando: la inscripción con familias reales y los profes usándola a diario. Antes, una prueba con profes y una demo al coordinador para juntar errores y opiniones.

## 2. Qué puede hacer cada rol

### Familias (sin cuenta)
**[T 17/11] Las familias no tienen cuenta.** Sólo usan el portal: miran la información y completan los formularios de Google desde ahí. Semillero no es para ellas.
- **Inscribir a su hijo** (botón grande arriba). Abre el formulario de Inscripción de Google, con login de Google: así queda el mail verificado. Un formulario por chico. Si el chico ya tenía ficha en 2026, el formulario es más corto.
- **Pagar**: el portal muestra el alias para copiar y el botón **Enviar comprobante** (formulario con la foto o el PDF del pago). Sólo transferencia **[T 17/11]**.
- **"Quiero jugar en Newell's"** (consultas, sin login): también lo abre el QR impreso (`/consultas`).
- Ver categorías por año de nacimiento con su horario y lugar, la agenda del club (Google Calendar), el mapa, otros formularios (rifas, pases…), eventos de recaudación, sponsors, preguntas frecuentes y el WhatsApp del coordinador.
- Si un formulario no está abierto, su botón dice que abre con la temporada: la coordinación abre y cierra la inscripción desde Semillero.

> Nota: en el código quedó una cuenta de familia de una idea anterior (migración 0057, pantalla `/familia`). Sobra: sacarla es una tarea del backlog.

### Jugadores (cuenta propia, sólo lectura)
- Pide acceso eligiendo club y categoría; **un profe de esa categoría lo aprueba** vinculándolo a su ficha. Sin aprobación no ve nada.
- Ve: su **plan físico** (sesión de hoy y las demás), **Mi progreso** (tiro, salto, sprint, Yo-Yo, pesos; sólo contra sí mismo, sin rankings ni compañeros), las **jugadas** de su plantel y los **recursos** que le mandó el profe.
- El profe le puede cerrar el acceso; queda el rastro de quién lo dio y quién lo sacó.

### Entrenadores (sólo sus categorías asignadas)
- **Alta**: crea la cuenta (mail o Google), acepta los términos y espera a que la coordinación lo habilite y le asigne categorías.
- **Hoy**: cómo viene el tiro en la última batería, qué zona está floja y a dónde seguir.
- **Plantel**: lista de chicos, **asistencia** del día (presente, ausente con o sin aviso, motivo), **lesiones** (zona, lado y tipo de listas cerradas, con alta), ficha de cada chico con su historia por temporadas, editar fecha de nacimiento, **datos de emergencia** (importados de la planilla "Emergencias para Semillero"), importar inscriptos, aprobar cuentas de jugadores, sacar a un chico del plantel.
- **Medir**: tiro (batería por zonas), salto, sprint, Yo-Yo y mediciones corporales; una sesión sin terminar se retoma.
- **Físico**: cargar el plan de fuerza desde xlsx, ver sesiones y escalones de carga, inventario del club (lectura).
- **Recursos**: biblioteca de ejercicios del club (con variaciones y pizarra), editor de jugadas, videos; mandar un recurso a jugadores y ver **cuántos** lo abrieron (nunca quién).
- **Datos**: importar las planillas de partidos de la CABB, estadísticas del plantel, tiro, asistencia, físico, metas por zona y **misiones del partido**.

### Coordinación (el club entero, en agregado)
- **Panorama**: números agregados por categoría (partidos, tiro, % de asistencia general). **No ve datos individuales de menores**, salvo las emergencias en sólo lectura **(decisión 03/11)**.
- **Profes**: habilitar cuentas, asignar y quitar categorías, dar de baja; **cambio de temporada** (abre la temporada, copia planteles, asigna profes y propone los pases por año de nacimiento); **datos de emergencia** de todo el club en lectura.
- **Familias**: **Papeles y pagos** (lo que manda el script de Google, una fila por chico, emparejada con las fichas del club) y el token de conexión con Google.
- **Formularios del portal**: sumar, ordenar, ocultar y marcar cuál es inscripción, comprobante, consultas, colaboradores o recaudación (uno por tipo).
- **Inventario** del material y **Finanzas** del club (rubros, ingresos y egresos por mes; no se publica a familias).
- Quien es profe **y** coordinador cambia de modo con un botón.

## 3. Datos de menores: qué se guarda, dónde y quién lo ve

| Dato | Dónde | Quién lo ve |
|---|---|---|
| DNI, fotos del chico y del adulto, ficha médica completa, comprobantes | Google Drive de la Comisión (carpeta por chico) y el Tablero | Sólo coordinación, con permisos de Google. **Nunca entra a Semillero** (la base rechaza 7+ dígitos seguidos). |
| Nombre, fecha de nacimiento, categoría | Semillero (Supabase, São Paulo) | Profes de su categoría; el propio jugador; coordinación sólo en agregado. |
| Mail del adulto responsable | Semillero | Profes de su categoría. |
| Teléfonos, contacto de urgencia, alertas médicas, alergias, medicación, obra social | Semillero, **sólo si la familia tildó "Emergencias en Semillero"** | Profes de su categoría (ven, importan, corrigen) y coordinación (sólo lectura). No se guarda en el celular. Se borra si el chico deja el club. |
| Asistencia y lesiones | Semillero | Profes de su categoría. Coordinación: sólo % general por categoría. |
| Estadísticas de partidos, mediciones, plan físico, misiones | Semillero | Profes de su categoría y el propio jugador (lo suyo). |
| Estado de papeles y pagos (✅ 📎 ❌) | Semillero | Sólo coordinación. |

El club es el responsable de los datos y Tomás el encargado (Ley 25.326); los pedidos de acceso o borrado van al club.

## 4. Casos incómodos: las reglas

### Inscripción duplicada
- **La familia manda la Inscripción dos veces**: vale la **última respuesta por DNI**; las viejas quedan en la planilla.
- **El mismo chico con dos DNI distintos** (casi siempre uno mal tipeado): aparece en la lista "Posible chico duplicado" del Tablero para que la coordinación lo resuelva.
- **DNI mal escrito**: la respuesta va a una cola de revisión y llega un aviso por mail (sin nombre ni DNI, sólo el id de la respuesta).
- **Dos responsables inscriben al mismo chico**: al importarlo a Semillero son un solo chico con los dos mails.
- **Al importar inscriptos**, el chico se reconoce por apellido + nombre + fecha de nacimiento dentro del club: si coincide, se le suma el plantel nuevo (no se duplica la ficha); si el nombre existe con **otra** fecha, queda sin tildar hasta que el profe decida si es otro chico. El sistema nunca decide solo que dos fichas son la misma.
- **Google manda dos filas iguales** (mismo nombre y fecha): se usa la primera y se cuenta la repetida.
- **Un jugador pide acceso dos veces**: sólo puede haber una solicitud pendiente por cuenta.

### Pago a medio hacer
- **Un comprobante subido no es un pago**: queda en 📎. **[T 17/11]** Entre 📎 y ✅ la coordinación mira si el pago es correcto (monto y que haya entrado); recién ahí lo marca verificado. Si pagó de menos o en partes, sigue en 📎 hasta completar. **El sistema no guarda montos.**
- **Transfirió y no mandó el comprobante**: sigue en ❌. Si la coordinación ve la plata, puede anotarlo verificado a mano igual (✅).
- **Comprobante con un DNI que no está en el padrón**: aparece en la lista "Pagos de un DNI que no está en el padrón".
- **Comprobante viejo** (anterior al inicio de la temporada en el Tablero): no cuenta.
- **Google deja de mandar el estado**: el panel avisa si pasaron más de 2 horas sin envío.
- **Un movimiento de Finanzas borrado** deja de sumar pero queda guardado con quién y cuándo; cada edición guarda cómo estaba antes.

### Datos faltantes
- **`NULL` es "no se sabe", nunca 0**: un tiro sin intentos no es 0 %, una fecha que falta no se inventa.
- **Inscripto sin mail o con mail ilegible**: entra igual, sin mail de responsable.
- **Inscripto sin fecha de nacimiento**: entra; el profe la completa desde la ficha.
- **La categoría elegida no coincide con el año**: el profe ve un aviso antes de confirmar y decide. Si Semillero no tiene esa categoría, se saltea con aviso.
- **"Ya completé la ficha 2026" pero no se encuentra**: el profe le pide a la familia que la complete de nuevo eligiendo "No".
- **Familia sin cuenta de Google**: puede crear una con su mail de siempre, o llevarle los papeles al coordinador.
- **La familia no autorizó emergencias en Semillero**: ese chico no tiene datos de emergencia en la app (están sólo en Google).
- **Profe sin categorías asignadas**: ve "Pedile a la coordinación que te asigne una categoría".
- **Pocos datos para un porcentaje**: se muestra con sus intentos y un aviso de "pocos datos".
- **Sin conexión a mitad de una medición**: la sesión queda como borrador en el celular y se retoma.

### Otros
- **Profe dado de baja**: conserva su fila pero pierde todo acceso; no ve un club vacío como si fuera staff.
- **Chico que deja el club**: pierde los datos de emergencia; su historia queda.
- **Lo que no se hace desde la app a propósito**: crear un coordinador, darle rol de profe a un coordinador (ni a uno mismo), sacar a alguien del club entero.

## 5. Por ahora no
- **Cuentas de familia** **[T 17/11: nunca]**: la familia no entra a Semillero ni ve papeles, pagos, asistencia o estadísticas desde ninguna cuenta.
- **Pagos online**, montos, saldos, cuotas en efectivo o descuentos: sólo transferencia + comprobante **[T 17/11]**.
- DNIs, fotos o archivos dentro de Semillero.
- Coordinación viendo datos individuales de los chicos (fuera de emergencias).
- Uso **sin conexión** completo (más allá del borrador de mediciones).
- Un segundo club en uso real (la base ya lo soporta).
- Mails o notificaciones automáticas desde Semillero.
- Asistente con IA para profes, "cromos" de jugadores.
- Finanzas visibles para las familias.

## 6. Cómo sé que está lista

Cada punto es algo que Tomás puede probar con el celular. Todo con datos reales sólo después del backup.

**A. Antes de la prueba con profes y la demo al coordinador**
1. Un profe nuevo crea su cuenta desde el portal (botón Semillero), y no ve nada hasta que la coordinación lo habilita y le asigna su categoría.
2. Ese profe, desde el celular: toma la asistencia del día, carga una lesión, mide una batería de tiro y ve el resultado en Hoy y en Datos.
3. Importa una planilla de partido de la CABB y ve las estadísticas del plantel.
4. Carga un plan de fuerza y un jugador de su categoría lo ve en su Físico.
5. Un jugador pide acceso, el profe lo aprueba y el jugador ve sólo lo suyo.
6. El coordinador ve el Panorama y los Profes, y **no puede** abrir la ficha de un chico (salvo emergencias).
7. Los errores que encuentren los profes quedan registrados (reporte de errores) o anotados en el backlog.

**B. Inscripción 2027 con familias reales**
8. Desde Semillero, la coordinación marca el formulario de inscripción y el de comprobante: los dos botones del portal se prenden; al ocultarlos, dicen que abren con la temporada.
9. Una familia de prueba inscribe a un chico desde el celular en menos de 10 minutos; sus archivos quedan en su carpeta de Drive.
10. La misma familia inscribe dos veces: el Tablero muestra una sola fila con la última respuesta.
11. Manda un comprobante: en Papeles y pagos aparece 📎; la coordinación lo verifica en el Tablero y pasa a ✅.
12. El profe importa los inscriptos a su plantel: el chico que ya existía no se duplica y el homónimo queda sin tildar.
13. Si la familia autorizó emergencias, el profe las ve en la ficha; si no, no aparecen.

**C. Privacidad (sin esto no se lanza)**
14. Un profe no ve chicos de una categoría que no tiene asignada (probar con dos cuentas).
15. En Semillero no aparece ningún DNI ni foto de documento.
16. Un chico que deja el club pierde sus datos de emergencia en el cambio de temporada.
17. `npm run test:q` en verde y las verificaciones SQL del área (`tests/verificar*.sql`) todas `OK`.

## 7. Preguntas abiertas
- Fecha concreta de la prueba con profes y de la demo al coordinador.
