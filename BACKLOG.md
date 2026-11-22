# BACKLOG — Semillero y el portal

> Sale de `PRD.md` (aprobado el 17/11/2026). Ordenado por importancia: arriba lo primero. Sprints de 2 o 3 tareas, uno a la vez; las ideas nuevas entran acá, no se construyen en el momento.
> Estado: **aprobado por Tomás el 17/11/2026.** El MVP es casi todo **revisar, pulir y probar lo que ya está hecho**, no construir cosas nuevas.
>
> **Regla fija:** toda tarea que toque datos de menores dice **qué dato**, **dónde** se guarda y **quién** lo ve (línea *Menores*).
> Tipo: **código** (lo hace Claude), **config** (panel de Supabase o Vercel), **Google** (formularios y planillas), **club** (lo hacen Tomás y el club), **prueba** (se recorre y se anota lo que falla).
> Lo de seguridad se nombra en general a propósito: el repo es público y el detalle está en `docs/privado/`.

## Por hacer

### B-04 · Probar el alta de jugador con Google — prueba
- **Qué:** un chico de prueba crea su cuenta con Google, pide acceso, el profe lo aprueba con el código y el chico ve sólo lo suyo.
- **Menores:** cuenta de prueba, sin datos reales. En la base queda la solicitud (cuenta, plantel, estado) y el vínculo con la ficha; lo ven el profe de esa categoría y el propio chico.
- **Listo cuando:** el recorrido sale entero sin ayuda, o el error quedó anotado como tarea nueva.

### B-05 · Prueba guiada con profes — prueba
- **Qué:** con 1 o 2 profes y sus categorías reales, recorrer las pruebas A1–A7 del PRD (cuenta, asistencia, lesión, medir, partido CABB, plan físico). Anotar errores y pedidos acá, como tareas nuevas.
- **Menores:** se cargan datos reales de su plantel (asistencia, lesiones, mediciones, partidos) en Supabase; los ven sólo los profes de esa categoría (y el jugador, lo suyo). Antes, B-02 hecho.
- **Listo cuando:** cada prueba A1–A7 tiene "anda" o una tarea nueva con lo que falló.

### B-06 · Demo al coordinador — club
- **Qué:** mostrarle Panorama, Profes (habilitar, asignar, temporada), Familias (papeles y pagos), Formularios, Inventario y Finanzas. Anotar lo que pida.
- **Listo cuando:** el coordinador habilitó a un profe y abrió un formulario del portal él solo; lo que pidió está en el backlog.

### B-07 · Entender el circuito de Google — código (documento)
- **Qué:** una página corta con un dibujo: formulario → planilla → carpeta de Drive → script → panel de Semillero. Qué hace cada pieza, qué pasa cuando una familia llena algo y qué hay que tocar a mano.
- **Listo cuando:** Tomás lo lee y puede explicarle a otro dónde queda el DNI y dónde el estado de un pago.

### B-08 · Ordenar las planillas de Google — Google
- **Qué:** formato legible en el Tablero y en Pagos (encabezados fijos, colores de ❌📎✅, anchos), ocultar las hojas auxiliares y dejar visibles sólo las que usa la coordinación. Sin cambiar fórmulas ni columnas que lee el script.
- **Menores:** las planillas tienen DNI, nombres y salud. Siguen en la cuenta de la Comisión; las ve sólo coordinación. No se copian ni se comparten.
- **Listo cuando:** el coordinador encuentra en menos de un minuto qué le falta a un chico, y el panel de Semillero sigue recibiendo el estado.

### B-09 · Sacar la cuenta de familia de la interfaz — código
- **Qué:** quitar la pantalla `/familia`, la entrada de familia al iniciar sesión y la sección "Cuentas" de Coordinación → Familias (y lo mismo en `/app/clasica`). Quien entre con un mail de familia ve el aviso de "sin acceso" de siempre.
- **Menores:** deja de mostrarse nombre y categoría del chico a la cuenta del adulto. No se borra nada de la base en esta tarea.
- **Listo cuando:** una cuenta de familia de prueba entra y no ve ningún chico; tests en verde.

### B-10 · Cerrar la cuenta de familia en la base — código (migración)
- **Qué:** migración nueva que saca los permisos de las funciones de familia (vincular por mail, ver mis chicos) y decide qué pasa con el mail del responsable: si ya no vincula cuentas, ¿se sigue guardando?
- **Menores:** dato = mail del adulto responsable y su vínculo con el chico, en Supabase. Después: nadie lo usa para entrar; si se guarda, lo ven sólo los profes de su categoría. Backup antes del `db push`.
- **Listo cuando:** la verificación SQL dice que una cuenta de familia recibe "sin permiso" en todo, y el PRD queda al día.

### B-11 · Spec corta: menos importaciones — código (diseño)
- **Qué:** hoy el profe baja la planilla "Para Semillero" e importa a mano. Diseñar que los inscriptos lleguen solos (el script de Google ya manda el estado de papeles y pagos) y qué sigue revisando el profe (homónimos, categoría que no coincide).
- **Menores:** la spec tiene que decir qué datos viajan (apellido, nombre, fecha de nacimiento, categoría, rama; ¿mail?), por dónde, y que nunca viaja un DNI.
- **Listo cuando:** spec de 1–2 páginas aprobada por Tomás.

### B-12 · Inscriptos que llegan solos — código
- **Qué:** lo que diga B-11. Puede partirse en dos tareas al aprobar la spec.
- **Menores:** según B-11. Lo ven los profes de la categoría; la coordinación, sólo en agregado.
- **Listo cuando:** un inscripto de prueba aparece en el plantel de su profe sin importar nada a mano, y un homónimo queda esperando la decisión del profe.

### B-13 · Consentimiento en el formulario de inscripción — Google
- **Qué:** sumar el texto de consentimiento (también datos de emergencia, asistencia y lesiones) a la Inscripción, como casilla obligatoria.
- **Menores:** la casilla queda en la respuesta del formulario (planilla de la Comisión); la ve coordinación.
- **Listo cuando:** el formulario no se puede mandar sin tildarla.

### B-14 · Privacidad: sumar asistencia y lesiones — código
- **Qué:** la política de privacidad y los términos cuentan que se guarda asistencia y lesiones (dato de salud), para qué y quién lo ve; subir `VERSION_LEGAL` para que todos vuelvan a aceptar.
- **Menores:** dato = asistencia y lesión (zona, lado, tipo, alta), en Supabase; lo ven los profes de la categoría, la coordinación sólo el % general.
- **Listo cuando:** `/privacidad` lo dice y una cuenta de prueba tiene que aceptar de nuevo al entrar.

### B-15 · Acuerdo de datos con el club — club
- **Qué:** reunión con el coordinador (o quien firme por el club) para firmar el acuerdo de datos: el club es el responsable de los datos y Tomás el encargado. Acordar quién atiende los pedidos de las familias.
- **Listo cuando:** hay dos copias firmadas y un nombre para los pedidos de las familias.

### B-16 · Registrar la base en la AAIP — club
- **Qué:** la AAIP (Agencia de Acceso a la Información Pública) lleva el registro nacional de bases de datos personales. El club, como responsable, inscribe la base de Semillero.
- **Listo cuando:** el club tiene el comprobante de inscripción.

### B-17 · Inscripción de punta a punta — prueba
- **Qué:** con una familia de prueba, recorrer las pruebas B8–B13 del PRD (abrir y cerrar formularios, inscribir, inscribir dos veces, comprobante 📎 → ✅, importar o recibir al chico, emergencias sí/no).
- **Menores:** datos inventados. Se borran de Google y de Semillero al terminar.
- **Listo cuando:** las seis pruebas dicen "anda" o tienen su tarea nueva.

### B-18 · Revisión de privacidad antes de abrir — prueba
- **Qué:** pruebas C14–C17 del PRD con dos cuentas de profe y una de coordinación, y las verificaciones SQL del área.
- **Menores:** sólo se mira quién ve qué; no se carga nada nuevo.
- **Listo cuando:** las cuatro pruebas dan bien y `npm run test:q` está en verde.

---
### ──────── Hasta acá llega el MVP (18 tareas) ────────
---

### B-19 · Emergencias que llegan solas — código
- **Qué:** como B-12, para la planilla de emergencias. Necesita su propia spec: es dato de salud.
- **Menores:** teléfonos, contacto de urgencia, alertas médicas, alergias, medicación y obra social, en Supabase, sólo si la familia lo autorizó; lo ven los profes de la categoría y la coordinación en lectura.

### B-20 · Mails a colaboradores y eventos de recaudación — código
- **Qué:** mandar avisos por mail a quienes se anotaron en "Eventos de recaudación" o "Quiero colaborar" (requiere B-01). Son adultos, no menores.

### B-21 · Menos pruebas físicas — código
- **Qué:** con el coordinador, dejar una prueba de sprint, una de salto y una de Yo-Yo; sacar el resto de Medir.
- **Menores:** las mediciones ya cargadas de las pruebas que se sacan no se borran sin preguntarle a Tomás.

### B-23 · Salto con un iPhone real — prueba
- **Qué:** confirmar que un video elegido desde Safari conserva los cuadros por segundo. El video se analiza en el celular y no se sube.

### B-24 · Fotos reales por categoría en el portal — código
- **Menores:** fotos de chicos en una página pública: sólo con la autorización de uso de imagen del formulario, y sin nombres.

### B-25 · Escanear el QR de `/consultas` con un celular real — prueba

### B-26 · `supabase/ESQUEMA.md` al día — código (documento)

### B-27 · Paginación en un solo lugar (deuda) — código

### B-28 · Evaluar cerrar el registro público o sumar CAPTCHA — config

### B-29 · Pizarra por variación de ejercicio (fase 3) — código

### B-30 · Profe que además es jugador — código (diseño)

## En curso

### B-01 · Que lleguen los mails de Semillero — config
- **Qué:** probar con una cuenta nueva que llegan el mail de confirmar la cuenta y el de recuperar la clave. Si no llegan o tardan, conectar un servidor de mail propio (SMTP) en Supabase.
- **Listo cuando:** dos cuentas creadas seguidas reciben su mail en menos de 5 minutos, y el remitente dice algo reconocible (no "Supabase").

### B-02 · Backup al día y con lugar fijo — config
- **Qué:** `npm run backup` y guardar la copia fuera del repo (Drive de la Comisión o la compu de Tomás, no un worktree). Anotar cada cuánto se hace.
- **Menores:** la copia tiene **toda** la base (nombres, fechas, mediciones, emergencias, asistencia). Se guarda en una carpeta privada; la ve sólo Tomás.
- **Listo cuando:** hay un backup de esta semana en su carpeta y está escrito en `docs/guias/BACKUP.md` dónde va y cada cuánto.

### B-03 · Repasar la seguridad del panel de Supabase — config
- **Qué:** tildar uno por uno los puntos de "Lo que tiene que hacer una persona en el dashboard" de la lista privada de lanzamiento.
- **Listo cuando:** todos los puntos de esa sección están tildados o tienen escrita la razón de por qué no.

### B-31 · Constancia y asistencia del jugador — código (migración)
- **Qué:** pestaña Inicio del jugador (reemplaza Sesión) con «Hice mi rutina de hoy» (marca la práctica de un recurso, sólo hoy), la constancia semanal y su asistencia continuada (últimos 10, mes o año). El profe ve cuántos practicaron cada recurso. Spec: `docs/superpowers/specs/2026-11-22-constancia-y-asistencia-del-jugador-design.md`. Decidido por Tomás el 22/11: va ahora, no espera al MVP.
- **Menores:** dato nuevo = día y recurso que el chico dice haber practicado, en Supabase; lo ve él, y el profe sólo cuántos (nunca quién, nada con menos de 3 cuentas). Se borra cuando deja el club o se cierra su cuenta. Asistencia: el chico ve la suya (vino / faltó / sin tomar), sin motivo ni lesión. Aviso de privacidad y `VERSION_LEGAL` en la misma tarea. Backup antes del `db push`.
- **Avance (22/11):** tasks 1–8 hechas: 0068 y 0069 aplicadas en producción con backup antes, `verificarConstancia.sql` y `verificar0069.sql` en OK, aviso de privacidad con `VERSION_LEGAL` = 2026-11-22. Falta: probar Inicio con un jugador de prueba (marcar una práctica, ver la semana y la asistencia) y que el profe vea el conteo; después pasa a Terminado.
- **Listo cuando:** la verificación SQL pasa, un jugador de prueba marca una práctica y ve su semana y su asistencia, el profe ve el conteo, y los tests están en verde.

## Terminado

- **B-00 · PRD.md** — escrito y aprobado el 17/11/2026 (`8e68061`).
- **B-22 · Mudar Medir a React** — ya estaba hecho: todas las pantallas están en React (Tomás, 17/11). Lo que quede es detalle visual.
