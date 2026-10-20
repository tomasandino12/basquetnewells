-- Deshace 0061 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- borra la marca de destino de todos los formularios (los formularios quedan,
-- sin destino) y devuelve formularios_publicos a como la dejó 0058, con tres
-- columnas. El portal sigue andando; sin destino, el acceso destacado de
-- consultas y la sección de sponsors dicen "Próximamente".
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0061
-- con `npx supabase migration up --local`.
begin;

drop function if exists formularios_publicos(uuid);

create function formularios_publicos(p_club uuid)
returns table (titulo text, texto text, enlace text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select f.titulo, f.texto, f.enlace
  from public.formulario_portal f
  where f.club_id = p_club and f.activo
  order by f.orden, f.titulo
  limit 50;
$fn$;

revoke execute on function formularios_publicos(uuid) from public;
grant execute on function formularios_publicos(uuid) to anon, authenticated;

drop index if exists formulario_portal_destino_unico;
alter table formulario_portal drop constraint if exists formulario_portal_destino_valido;
alter table formulario_portal drop column if exists destino;

delete from supabase_migrations.schema_migrations where version = '0061';
commit;
