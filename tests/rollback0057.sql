-- Deshace 0057 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- borra todos los vínculos de familia y los mails de responsables cargados.
-- Las fichas y pertenencias que creó el import de inscriptos NO se borran:
-- son jugadores del club como cualquier otro.
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0057
-- con `npx supabase migration up`.
begin;

drop function if exists importar_inscriptos(jsonb);
drop function if exists vincular_por_mail();
drop function if exists mis_chicos();
drop function if exists vinculos_familia_del_club(uuid);
drop function if exists cerrar_vinculo_familia(uuid);
drop table if exists vinculo_familia;
drop table if exists responsable_jugador;
drop function if exists sellar_cierre_vinculo_familia();

delete from supabase_migrations.schema_migrations where version = '0057';
commit;
