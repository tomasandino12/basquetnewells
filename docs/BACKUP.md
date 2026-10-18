# Backup y restauración de la base

El plan Free de Supabase no guarda backups restaurables. Si una migración mala o
un borrado se lleva datos, lo único que hay es lo que guardemos nosotros. Y la
historia de los jugadores no se puede reconstruir.

**Regla:** backup una vez por semana y **siempre** antes de un `npx supabase db push`.

Todos los comandos son para PowerShell y se corren desde la carpeta del proyecto.

## Qué se guarda

`npm run backup` deja tres archivos en `backups/`, con la fecha del día:

| Archivo | Qué trae |
|---|---|
| `AAAA-MM-DD_roles.sql` | los roles propios de la base (sin contraseñas) |
| `AAAA-MM-DD_esquema.sql` | tablas, funciones, triggers, políticas de RLS y permisos de `public` |
| `AAAA-MM-DD_datos.sql` | los datos de todos los schemas, **incluidos los usuarios de Auth** |

Si ese día ya había un backup, no se pisa: el nuevo sale como `AAAA-MM-DD-2_…`.

La estructura de `auth` y `storage` no se guarda porque la crea Supabase. Lo que
sí importa son los datos de `auth` (usuarios, identidades, sesiones): sin ellos,
`miembro_club` y `asignacion_plantel` apuntarían a usuarios que no existen. La app
no usa Storage, así que no hay archivos aparte para respaldar.

> **Estos archivos son sensibles.** Tienen nombres de menores y además los hashes
> de las contraseñas y las sesiones abiertas. No los mandes por mail ni por WhatsApp,
> y no los subas a GitHub. `backups/` está en `.gitignore` y en `.vercelignore`.

## Antes del primer backup (una sola vez)

1. Tener **Docker Desktop** abierto, con el cartel *Engine running*. La CLI usa
   Docker para correr `pg_dump`.
2. Vincular la carpeta con el proyecto de producción:

```powershell
npx supabase link --project-ref lseqvbtdzebomxwtqhwu
```

Si pide la contraseña de la base, escribila ahí. No la guardes en ningún archivo
ni la pegues en el chat. Si no la tenés, generá una nueva en el panel de Supabase:
**Project Settings → Database → Reset database password**. La app no usa esa
contraseña, así que cambiarla no rompe nada.

## Hacer el backup

```powershell
npm run backup
```

El script:
- avisa y no hace nada si Docker no responde o si la carpeta no está vinculada;
- puede pedir la contraseña de la base: se escribe en la terminal y no se guarda;
- si un paso falla, borra lo de esa corrida para que no quede un backup a medias;
- al final muestra los tres archivos con su tamaño.

Si no querés escribir la contraseña tres veces, podés cargarla sólo en esa ventana
de PowerShell y borrarla al terminar:

```powershell
$env:SUPABASE_DB_PASSWORD = Read-Host "Contraseña de la base"
```

```powershell
Remove-Item Env:SUPABASE_DB_PASSWORD
```

## Dónde guardarlo

1. Subí los tres archivos a la carpeta de backups del **Drive de la cuenta del
   básquet**. Esa carpeta tiene que tener acceso restringido: sin enlace público y
   compartida sólo con quien la necesite.
2. Borrá de `backups/` las copias que ya subiste y dejá sólo la última. Para ver qué hay:

```powershell
Get-ChildItem backups | Sort-Object Name
```

Para borrar un día que ya está en el Drive (cambiá la fecha):

```powershell
Remove-Item backups\2026-10-11_*
```

El script no sube nada: hacerlo le exigiría tener credenciales de Google en la
máquina. Nunca se usa GitHub Actions ni artefactos de CI, porque eso le pasaría los
datos de menores a un tercero.

## Restaurar en local

**Nunca se restaura contra producción.** Esto se hace en la base local de Docker,
para comprobar que un backup sirve o para mirar datos viejos. Probado el 18/10/2026
con el backup de ese día: las filas de `jugador`, `plantel`, `miembro_club`,
`asignacion_plantel`, `auth.users` y `auth.identities` quedaron iguales a las del archivo.

> La base local es una sola para todas las ramas y worktrees. Restaurar la pisa
> entera: avisá antes si otra conversación la está usando.

**1. Levantar la base local y dejarla limpia.** `db reset` aplica las migraciones
del repo y deja la estructura de `auth`. Lo de `public` se tira en el paso 3.

```powershell
npx supabase start
```

```powershell
npx supabase db reset --local
```

**2. Copiar el backup adentro del contenedor.** Cambiá la fecha por la del backup.
Se usa `docker cp` porque, si pasás el archivo por una tubería, PowerShell 5.1 rompe los acentos.

```powershell
$db = "supabase_db_modelo-datos-supabase"
$dia = "2026-10-18"
docker cp "backups\${dia}_roles.sql" "${db}:/tmp/roles.sql"
docker cp "backups\${dia}_esquema.sql" "${db}:/tmp/esquema.sql"
docker cp "backups\${dia}_datos.sql" "${db}:/tmp/datos.sql"
```

El nombre del contenedor sale del `project_id` de `supabase/config.toml`. Si cambia, lo ves con `docker ps`.

**3. Vaciar `public` y aplicar el backup.** Las migraciones que corrió `db reset`
chocarían con el esquema del backup, por eso primero se tira `public`. Los roles
van con `supabase_admin` porque tocan roles del sistema, que `postgres` no puede
cambiar. Esquema y datos van juntos en una sola transacción: si algo falla, no queda nada a medias.

```powershell
docker exec $db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "drop schema public cascade; create schema public;"
docker exec $db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f /tmp/roles.sql
docker exec $db psql -U postgres -d postgres --single-transaction -v ON_ERROR_STOP=1 -f /tmp/esquema.sql -f /tmp/datos.sql
```

El último comando imprime muchas líneas `SET`, `CREATE` y `COPY`. Lo que importa es
que no aparezca ninguna con `ERROR`. Para comprobar que entraron los datos:

```powershell
docker exec $db psql -U postgres -d postgres -c "select (select count(*) from jugador) jugadores, (select count(*) from plantel) planteles, (select count(*) from auth.users) usuarios;"
```

**4. Apuntar la app a la base local.** Mirá los valores locales:

```powershell
npx supabase status
```

Abrí `public/config.js` y cambiá las dos líneas: `SUPABASE_URL` por el *API URL*
(`http://127.0.0.1:54321`) y `SUPABASE_PUBLISHABLE_KEY` por la *Publishable key*
local, que no es secreta. Después levantá la app:

```powershell
npx esbuild --serve=5173 --servedir=.
```

Abrí `http://localhost:5173/public/index.html` y entrá con una cuenta existente de
**mail y contraseña**. Las contraseñas vienen en el backup. Con Google no se puede
entrar, porque en local no está configurado.

**5. Dejar todo como estaba.** Cortá el servidor con `Ctrl+C` y después:

```powershell
git checkout public/config.js
docker exec $db rm /tmp/roles.sql /tmp/esquema.sql /tmp/datos.sql
npx supabase db reset --local
```

El último comando borra los datos de producción de la base local y la deja sólo con
las migraciones del repo. No quedan nombres de menores en la base que usan todas las ramas.

### Errores conocidos

- **`"supabase_admin" is a reserved role, only superusers can modify it`**: aplicaste
  `roles.sql` con `-U postgres`. Usá `-U supabase_admin`, como en el paso 3.
- **`relation "auth.<tabla>" does not exist`** al aplicar los datos: la CLI local es
  más vieja que Auth de producción y le faltan tablas. Actualizá la CLI y volvé a empezar desde el paso 1:
  `npx supabase@latest stop` y después `npx supabase@latest start`.
- **`permission denied ... OWNER TO "supabase_admin"`** en el esquema: la guía oficial
  dice que hay que comentar esas líneas de `esquema.sql`. Con el backup del 18/10 no pasó.

## Si el proyecto se pausó

Un proyecto Free se pausa si su base no tiene suficiente actividad durante **7 días**.
En el receso de verano puede pasar. Según la documentación oficial (*Project
Pausing*, revisada el 18/10/2026):

- Más o menos una semana antes, al dueño del proyecto le llega un **mail de aviso**.
  Para evitar la pausa alcanza con entrar al proyecto en el panel de Supabase o usar la app.
- Cuando se pausa, llega otro mail de confirmación.
- Para reactivarlo: entrá a [supabase.com/dashboard](https://supabase.com/dashboard),
  elegí la organización, después el proyecto pausado, tocá **Resume project** y confirmá.
  Vuelve como estaba, con datos y configuración.
- Hay **un año** desde la pausa para reactivarlo. La documentación no dice qué pasa
  después, y por eso igual hacen falta los backups propios.

Mientras está pausado, la app no puede entrar ni guardar nada. La reactivación no
toca los datos, así que no hace falta restaurar el backup.
