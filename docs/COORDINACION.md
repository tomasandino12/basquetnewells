# Coordinación: roles, asignaciones y despliegue

## Qué puede cada uno

| | Entrenador | Coordinador | Los dos roles |
|---|---|---|---|
| Jugadores, plantel, fichas, mediciones, partidos | sólo sus categorías asignadas | nada | sus categorías asignadas |
| Biblioteca de ejercicios y notas | todo el club | (no se muestra en su pantalla) | todo el club |
| Panorama agregado y Profes | no | sí | sí, con el botón **Coordinar** |
| Habilitar, asignar, quitar | nunca | a otros, en su club | a otros, en su club |
| Finanzas (rubros y movimientos, 0054) | nada | carga, edita y borra (borrado lógico, con rastro) | igual que el coordinador |

Todo esto lo hace cumplir la base (RLS), no la interfaz. Detalle en
`supabase/ESQUEMA.md`.

**Finanzas.** La pestaña FINANZAS muestra el mes elegido: ingresos, egresos,
resultado, totales por rubro y los movimientos. Los rubros (Patrocinios,
Arbitrajes…) se crean desde ahí y no se borran: se desactivan. Un movimiento
borrado deja de sumar pero queda en la base, con quién y cuándo; cada edición
guarda cómo estaba antes (`movimiento_cambio`). Verificación de permisos:
`tests/verificarFinanzas.sql` en el SQL Editor (todo `OK`). No se publica a las
familias: eso es otro módulo (ver la spec de finanzas).

Lo que **no** se hace desde la app, a propósito:
- Crear un coordinador.
- Darle el rol de entrenador a alguien que ya es coordinador (ni a uno mismo).
- Sacar a alguien del club entero.

## Estado de producción al 2026-09-13

Diagnóstico corrido antes de escribir 0017:

| Cuenta | Rol | Categorías |
|---|---|---|
| Nacho | entrenador | U13M |
| Tomás | coordinador | — |
| Cuenta de prueba | entrenador | U17M, U21M |

Ningún entrenador sin asignaciones: el backfill de 0017 no hace nada. Tomás es
coordinador puro a propósito; lo de entrenador se prueba con la cuenta de prueba.

## Desplegar

**En este orden.** Ningún paso se saltea.

### 1. Diagnóstico (sólo lectura)

Si pasó tiempo desde la tabla de arriba, repetirlo en el SQL Editor:

```sql
select u.email, m.club_id, m.rol,
       count(a.*) as asignaciones,
       string_agg(p.categoria, ', ' order by p.categoria) as categorias
from miembro_club m
join auth.users u on u.id = m.user_id
left join asignacion_plantel a
       on a.miembro_club_user_id = m.user_id and a.miembro_club_club_id = m.club_id
left join plantel p on p.id = a.plantel_id
group by u.email, m.club_id, m.rol
order by m.club_id, u.email;
```

(Después de 0017 la columna `rol` ya no existe: la consulta equivalente usa
`m.es_entrenador, m.es_coordinador`.)

### 2. Aplicar 0017 y 0019

`npx supabase db push` aplica lo que falte, cada migración en su transacción.
Conviene hacerlo cuando nadie esté usando la app.

0019 (nombre en los metadatos de Auth y las cuatro categorías que faltaban)
depende sólo de 0017, y **tiene que estar antes del deploy del frontend**: sin
ella la biblioteca no muestra autores y a las cuentas viejas sin nombre (Nacho)
se les pediría el nombre antes de entrar, en vez de dejarlas pasar.

Si `db push` quiere aplicar también 0018 en el mismo paso, aplicar 0017 y 0019
a mano desde el SQL Editor y dejar 0018 para el paso 7.

**0022 (tiro en partidos en el Panorama)** depende sólo de 0017 y también va
antes del frontend que la usa. Sin ella la pantalla no se rompe, pero en las
categorías con partidos dice "Ningún partido con triples intentados", que es
falso. Verificación: `tests/verificarCoordinacion.sql`, caso 9. Rollback:
`tests/rollback0022.sql`.

Correr `tests/verificarCoordinacion.sql` en el SQL Editor: todo `OK`, salvo los
casos 10 y 11 en `PENDIENTE`.

### 3. Primer coordinador

Ya existe (Tomás, `rol = 'coordinador'`): 0017 lo convierte solo en
`es_coordinador = true`. Para cualquier coordinador futuro, a mano:

```sql
insert into miembro_club (user_id, club_id, es_coordinador)
values ('<uuid de Authentication → Users>', '<uuid de la tabla club>', true)
on conflict (user_id, club_id) do update set es_coordinador = true;
```

### 4. Deploy del frontend

### 5. Revisar asignaciones de la migración

Entrar como coordinador → **Profes**. Las marcadas *"asignada al activar el
panel"* las creó la migración para que nadie perdiera acceso: quitar las que
no correspondan. (Al 2026-09-13 no debería haber ninguna.)

### 6. Si un coordinador también entrena

Antes del paso 7, o se queda sin sus datos. Hoy no aplica a nadie.

```sql
update miembro_club set es_entrenador = true
where user_id = '<uuid>' and club_id = '<uuid del club>';

insert into asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen)
select '<uuid>', club_id, id, 'manual' from plantel
where club_id = '<uuid del club>' and categoria in ('U13M');   -- sus categorías
```

### 7. Aplicar 0018

Aborta sola si hay un club con miembros y sin coordinador. Correr de nuevo
`tests/verificarCoordinacion.sql`: todo `OK`, nada `PENDIENTE`.

Y con credenciales reales (sólo lee, no escribe nada):

```bash
SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... \
VERIFICAR_EMAIL=<cuenta de prueba> VERIFICAR_PASSWORD=... \
VERIFICAR_COORD_EMAIL=<coordinador> VERIFICAR_COORD_PASSWORD=... \
node tests/verificarAccesoPorCategoria.js
```

## Volver atrás

- `tests/rollback0018.sql` — el coordinador vuelve a leer datos individuales.
- `tests/rollback0017.sql` — vuelve a la forma de 0016. Aborta si hay alguien
  con los dos roles o asignaciones cerradas, y dice cuáles.

## Consultar la historia

Quién estuvo a cargo de cada categoría, incluidas las cerradas:

```sql
select p.categoria, t.nombre as temporada, u.email,
       a.desde, a.hasta, a.origen,
       ua.email as asignado_por, uc.email as cerrado_por
from asignacion_plantel a
join plantel p     on p.id = a.plantel_id
join temporada t   on t.id = p.temporada_id
join auth.users u  on u.id = a.miembro_club_user_id
left join auth.users ua on ua.id = a.asignado_por
left join auth.users uc on uc.id = a.cerrado_por
order by t.nombre desc, p.categoria, a.desde;
```

## Familias (0057)

Las familias no son un rol de `miembro_club`: son cuentas sin club que se vinculan solas con el mail con el que inscribieron a su hijo (el profe importa la planilla en Plantel → Importar inscriptos). Coordinación las ve en **Familias**, con quién y cuándo, y puede dar de baja cualquier vínculo; la baja no se deshace sola si la familia vuelve a entrar. Un profe que además es padre no se vincula: queda pendiente si hace falta.

## Límite conocido: un solo club

La lista de **Esperando acceso** muestra todas las cuentas confirmadas sin club
de toda la plataforma: una cuenta recién creada no pertenece a ningún club y no
hay forma de saber a cuál va. Con Newell's solo, es exacta. Con un segundo
club, un coordinador vería los mails de quien se registró para el otro. Se
decidió probar primero con usuarios reales y pensarlo recién si hace falta más
de un club.

Desde la cuenta de jugador (0029) hay un límite equivalente, con el mismo
criterio: `clubes_para_solicitar()` le muestra a **cualquier cuenta sin club**
la lista de clubes y categorías de la plataforma, para armar el formulario
"Soy jugador de un club". Son nombres de club y de categoría, información
pública, y con un solo club es exacto. Con un segundo club habría que ofrecer
un código de invitación en vez de un catálogo abierto.

Esa lista de **Esperando acceso** no incluye a quien ya tiene una cuenta de
jugador vigente. Un chico que pidió acceso y todavía no fue aprobado sí puede
aparecer ahí: a un jugador se lo aprueba desde PLANTEL, no desde acá, y
habilitarlo como profe le daría acceso a los datos de otros menores.

## El portal del básquet (`/`) y los formularios de las familias

La página que se reparte a las familias es el **portal**, en la raíz del sitio
(`/`). Semillero, la aplicación de profes, coordinación y jugadores, vive en
`/app` y el portal tiene un botón que lleva ahí. El portal muestra: los pasos
("¿Qué tengo que hacer?"), los formularios, los calendarios, la información, y
a quién escribirle si hay dudas. No tiene sesión ni muestra datos de chicos.

### Formularios: se cargan desde la app, sin tocar código

Coordinación → pestaña **Familias** → botón **Formularios de la página del
básquet**. Ahí la coordinación:

- **Agrega** un formulario: título, una línea de "para qué es y qué tienen que
  tener a mano" (la familia la lee antes de abrirlo) y el enlace de Google
  Forms. Ejemplo: *"hay que pagar las rifas"* → se suma "Comprobante de
  rifas", se escribe qué tener a mano (la foto del comprobante) y se pega el
  enlace. La familia lo ve en el portal al toque.
- **Edita** tocando el formulario; **sube o baja** con las flechas; **oculta**
  cuando ya no corresponde (por ejemplo, al cerrar la inscripción). **No se
  borra**: queda oculto y se puede volver a mostrar.
- El enlace tiene que ser de Google Forms (`https://docs.google.com/forms/…` o
  `https://forms.gle/…`); la app y la base rechazan cualquier otro.
- **Esto lo ve cualquiera**, sin entrar con ninguna cuenta: no pongas nombres
  de chicos ni datos personales en el título ni en el texto.
- **Primera vez, después de aplicar la migración 0058:** la lista arranca
  vacía y el portal dice que no hay formularios abiertos. Entrá a esa pantalla
  y tocá **"Agregar el de Inscripción"** (viene precargado) y **Guardar**.
- Para ver cómo lo ven las familias, el enlace "Ver cómo lo ven las familias"
  abre el portal en otra pestaña.

Los formularios y lo que suben las familias (DNI, fotos, datos de salud, 
comprobantes) viven en Google y **nunca pasan por Semillero ni por la base**.
Quién los recibe y cómo se organizan en Drive: ver la guía de inscripción en
Google (rama `claude/inscripcion-google-41cf4e`).

### Calendarios, información y contacto: archivo `src/data/portal.js`

Estos tres sí son cambios de código (se hacen una vez y casi no cambian):

**Calendarios** (dos Google Calendar: partidos y torneos; eventos y
recaudación). Para conectarlos, una sola vez, desde una compu:
1. En Google Calendar → Configuración del calendario → "Permisos de acceso":
   marcar **"Hacer disponible públicamente"**. Sin eso el embed sale vacío.
2. En la misma pantalla, "Integrar el calendario" → copiar el **ID de
   calendario** (termina en `@group.calendar.google.com`). También sirve pegar
   la URL de "Código para insertar": de ahí se toma sólo el ID.
3. Pegarlo en `id:` del calendario que corresponde en `src/data/portal.js`,
   `npm run test:q`, commit y deploy. Mientras sea `null`, se ve "Próximamente".

> ## ⚠️ El calendario es público: NUNCA nombres de chicos
>
> Cualquiera que abra la página ve **todos** los eventos, con su título y su
> descripción. **No escribas nombres de jugadores** ni datos personales en
> ningún evento. Sí: *"U13 vs. Central, 10 h, cancha 2"*. No: *"U13: convocados
> Pérez, Gómez…"*. Si una persona carga eventos, avisale esto antes de darle
> el permiso.

**Que varias personas carguen eventos.** No hace falta que lo cargue todo una
sola persona. Ejemplo: alguien de la subcomisión va a hacer una pollada y la
carga él mismo en el calendario. Cómo se le da permiso (lo hace **el dueño del
calendario**, o sea la cuenta de Google de la subcomisión que lo creó):
1. Abrir **Google Calendar** desde una compu, con la cuenta dueña del calendario.
2. En la lista de la izquierda ("Mis calendarios"), pasar el mouse por el
   calendario, tocar los **tres puntitos** → **Configuración y uso compartido**.
3. Bajar hasta **"Compartir con personas o grupos específicos"** → **Agregar
   personas y grupos** → escribir el mail de la persona.
4. En "Permisos", elegir **"Hacer cambios en los eventos"** → **Enviar**.
5. Esa persona acepta la invitación (le llega por mail) y, desde la **aplicación
   de Google Calendar de su celular**, elige ese calendario al crear un evento.
   El evento aparece **solo** en el portal, sin tocar nada más (a veces tarda unos
   minutos).

**Para sacarle el acceso**, el dueño vuelve a esa misma lista ("Compartir con
personas o grupos específicos") y toca la **X** al lado del mail. Los eventos que
ya cargó quedan; si hay que sacarlos, se borran desde Google Calendar.

**Tres consejos para que no se cuele nada personal.** Lo personal de cada persona
(su turno médico, su cumpleaños) **no aparece en la página**: sólo aparece lo que
se guarda en el calendario del básquet. El riesgo es guardar un evento personal
ahí por error. Para evitarlo:
1. **Ponerle a cada calendario un nombre que avise que es público**, por ejemplo
   *"Básquet NOB · Eventos (PÚBLICO)"*. Se cambia en Configuración y uso
   compartido → Nombre.
2. **Darle un color propio**, distinto del personal, así se nota de un vistazo
   en cuál se está cargando (tres puntitos del calendario → elegir color).
3. **Antes de guardar un evento, mirar en qué calendario queda.** El que viene
   elegido de entrada es el personal de cada uno; hay que cambiarlo al del
   básquet. Si algo personal se cuela igual, cualquiera con permiso para hacer
   cambios en los eventos lo puede borrar.

Esto **no es lo mismo** que "Hacer disponible públicamente" del paso 1 de arriba:
eso es sólo para que el portal pueda **mostrar** el calendario; los permisos de
las personas de acá arriba son los que dejan **cargar** eventos. Dale el permiso
a cada persona por separado y sólo a quien lo necesita.

**Contacto** ("¿Dudas? Escribile al coordinador"): en `contacto:` va un link de
WhatsApp (`https://wa.me/549341…`, con el código de país y de área, sin `+` ni
espacios) o un mail (`mailto:coordinacion@…`). Otro formato no se acepta.

**Información** (categorías, entrenamientos, dónde se entrena): es texto fijo en
`public/portal.html`, marcado con `PENDIENTE`, hasta que el club lo pase.

### Login de Semillero: la URL de retorno

El login vuelve a `https://app-semillero.vercel.app/app`. Lo cubre el comodín
`https://app-semillero.vercel.app/**` de Supabase → Authentication → URL
Configuration (ver `docs/CONFIGURAR-AUTH.md`); alcanza con confirmar que esa
entrada existe. Los mails viejos que apuntan a `/` los reenvía el portal a
`/app`.
