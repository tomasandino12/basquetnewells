# Backup y restauración de la base — spec

Fecha: 16/10/2026 · Rama: `feat/backup` · Tag de partida: `pre-backup`

## Problema

En el plan Free, Supabase no guarda backups que se puedan restaurar. Lo que más
preocupa no es la pausa por inactividad: es perder datos por una migración mala o
por un borrado accidental. La historia de los jugadores menores no se puede
reconstruir, así que este módulo va antes que los otros que agregan migraciones.

## Qué guarda `supabase db dump` (verificado con `--dry-run`, CLI 2.121.0)

| Llamada | Qué incluye | Qué deja afuera |
|---|---|---|
| `db dump` (esquema) | `public` y cualquier schema propio | `auth`, `storage`, `extensions`, `realtime`, `supabase_migrations`, `cron`, `vault` y otros que maneja la plataforma |
| `db dump --data-only` | **los datos de todos los schemas**, incluidos `auth` (usuarios, identidades, sesiones) y `storage` | `supabase_migrations`, `auth.schema_migrations`, `storage.migrations` y los internos (`vault`, `pgsodium`, `realtime`…) |
| `db dump --role-only` | roles propios del cluster, sin contraseñas | los roles reservados (`anon`, `authenticated`, `postgres`, `supabase_*`…) |

Conclusión: **los usuarios de Auth entran en el dump de datos**, así que no se
activa la condición de parada. La estructura de `auth` no hace falta guardarla
porque la crea Supabase (en local, `npx supabase start`). La app no usa Storage
(ninguna migración toca `storage.buckets`), así que no hay archivos aparte que respaldar.

## Diseño

**Comando.** `npm run backup` llama a `node scripts/backup.mjs`, que:
1. Verifica que Docker responda (`docker info`). Si no responde, explica cómo
   levantar Docker Desktop y sale con error, sin escribir nada.
2. Arma los nombres con la fecha local: `backups/AAAA-MM-DD_roles.sql`,
   `_esquema.sql`, `_datos.sql`. Si ya hay un backup de ese día, no lo pisa:
   usa `AAAA-MM-DD-2_…`, `-3_…` (caso típico: backup semanal y después otro antes de un `db push`).
3. Corre tres veces `npx supabase db dump --linked` (roles, esquema y datos con
   `--use-copy`), con la terminal heredada. Si la CLI pide la contraseña de la base,
   la escribe el usuario en ese momento. El script **nunca** la recibe por argumento
   ni la guarda (sí se puede usar `$env:SUPABASE_DB_PASSWORD` sólo en esa sesión de PowerShell).
4. Si un dump falla, borra los archivos de esa corrida (un backup a medias no
   tiene que parecer bueno) y sale con error.
5. Al terminar, comprueba que el de datos tenga `auth.users` y muestra los archivos,
   sus tamaños y el recordatorio: subirlos al Drive del básquet y borrar las copias locales viejas.

La lógica pura (nombres, sufijo del día, ruta) va en `scripts/nombresBackup.mjs`
con su test. El script sólo **lee** de producción: no tiene ningún camino que escriba en ella.

**Lo que no puede llegar a ningún lado.** `backups/` va en `.gitignore` y también
en `.vercelignore`: un `vercel deploy` desde la máquina sube los archivos que no
están en git, y sin esa línea los backups quedarían publicados. Un test verifica las dos.

**Restauración (sólo en local).** En `docs/BACKUP.md`, comandos para PowerShell:
1. Docker Desktop prendido y `npx supabase start`.
2. Se vacía `public` en la base **local** (`drop schema public cascade; create schema public;`),
   porque `start` ya aplicó las migraciones del repo y chocarían con el esquema del backup.
3. Se copian los tres archivos al contenedor con `docker cp` y se aplican con
   `docker exec … psql --single-transaction -v ON_ERROR_STOP=1`: roles, esquema y datos
   (el de datos ya trae `session_replication_role = replica`, que apaga los triggers).
   Se usa `docker cp` y no `Get-Content | docker exec` porque PowerShell 5.1 rompe los acentos al pasar texto por la tubería.
4. La app se apunta a la base local cambiando `public/config.js` por la URL y la
   publishable key que muestra `npx supabase status`, se levanta con `npx esbuild --serve=5173 --servedir=.`
   y al final se vuelve atrás con `git checkout public/config.js`.
5. Se entra con una cuenta existente **de mail y contraseña** (los hashes vienen en el backup;
   Google no está configurado en local).

La guía también anota los errores conocidos de la doc oficial (líneas de
`supabase_admin` o `cli_login_postgres` a comentar) y el riesgo de que la versión
local de Auth no tenga las mismas columnas que producción (solución: actualizar la CLI).

**Dónde se guarda y cada cuánto.** Lo sube el usuario a mano a una carpeta del Drive
de la cuenta del básquet, con acceso restringido. Una vez por semana y siempre antes de
un `npx supabase db push`. Nunca a GitHub, Actions ni artefactos de CI.

**Pausa por inactividad** (doc oficial, *Project Pausing*): un proyecto Free se pausa
si no tiene suficiente actividad en la base durante 7 días. Se reactiva desde el panel
(organización → proyecto pausado → *Resume*) y vuelve con datos y configuración. Hay un
año para hacerlo; pasado ese plazo sólo se puede bajar el backup. La guía lo cuenta con
los pasos del panel, verificados contra la doc al escribirla.

**Regla en CLAUDE.md**, una línea en "Comandos", junto a `db push`: antes de un
`npx supabase db push`, Claude para y pregunta si se corrió `npm run backup`.

## Qué queda afuera

Backups programados, subir archivos desde el script, cifrado propio, planes pagos o
PITR, y cualquier restauración contra producción.

## Riesgos

- **Los archivos son sensibles.** Además de nombres de menores, `_datos.sql` trae los
  hashes de contraseñas y las sesiones de Auth. La guía lo dice y pide borrar las copias locales viejas.
- **Contraseña de la base.** Si la CLI la pide y el usuario no la tiene, se resetea desde
  el panel (Database → Settings). Claude la pide en el momento y nunca la escribe en un archivo.
- **`npx supabase` no está fijado** en `package.json`. Sumarlo como devDependency sería una
  dependencia nueva, y el prompt no la pide. Si un cambio de versión rompe algo, se fija con `npx supabase@<versión>` en el script.

## Criterios de aceptación

- `npm run backup` deja los tres archivos con la fecha del día en `backups/`.
- `git status` no muestra nada de `backups/`.
- Siguiendo `docs/BACKUP.md` paso a paso, el backup se restaura en local, la app
  apuntando a la base local muestra planteles y jugadores, y se entra con una cuenta existente.
- Todos los pasos de la guía son comandos copiables para PowerShell.
- CLAUDE.md tiene la regla del backup antes de cada `db push`.
