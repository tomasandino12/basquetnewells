-- Deshace 0060 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- borra el token del script de Google y todo el estado de papeles y pagos
-- (se recupera solo con el próximo envío del script, tras generar otro token).
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0060
-- con `npx supabase migration up`.
begin;

drop function if exists empujar_estado_google(text, jsonb);
drop function if exists estado_inscripcion_del_club(uuid);
drop function if exists conexion_google_del_club(uuid);
drop function if exists rotar_conexion_google(uuid);
drop function if exists desconectar_google(uuid);
drop table if exists estado_inscripcion;
drop table if exists conexion_google;
drop function if exists sellar_estado_inscripcion();
drop function if exists sellar_conexion_google();
drop function if exists clave_inscripcion(text);

delete from supabase_migrations.schema_migrations where version = '0060';
commit;
