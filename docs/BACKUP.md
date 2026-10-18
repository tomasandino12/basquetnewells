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

*Esta sección se completa cuando la restauración se pruebe en local (Task 3 del plan
`docs/superpowers/plans/2026-10-16-backup.md`). Hasta entonces, no restaurar
siguiendo pasos que no estén escritos acá.*

Nunca se restaura contra producción.

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
