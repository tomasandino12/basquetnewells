-- Deshace 0055 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- borra todas las previas, misiones y evaluaciones cargadas.
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0055
-- con `npx supabase migration up`.
begin;

drop function if exists guardar_previa(jsonb);
drop function if exists evaluar_misiones(jsonb);
drop table if exists mision_jugador;
drop table if exists mision_equipo;
drop table if exists previa_partido;
drop function if exists sellar_mision();
drop function if exists sellar_previa_partido();

delete from supabase_migrations.schema_migrations where version = '0055';
commit;
