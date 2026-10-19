-- Deshace 0058 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- borra todos los formularios que cargó la coordinación (los formularios en
-- sí viven en Google y no se tocan). El portal sigue andando: sin la función,
-- cae al respaldo de src/data/portal.js.
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0058
-- con `npx supabase migration up`.
begin;

drop function if exists formularios_publicos(uuid);
drop table if exists formulario_portal;
drop function if exists sellar_formulario_portal();

delete from supabase_migrations.schema_migrations where version = '0058';
commit;
