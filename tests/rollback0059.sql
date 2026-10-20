-- Deshace 0059 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- borra todos los datos de emergencia cargados. Las temporadas, planteles y
-- pertenencias que creó el cambio de temporada NO se borran: son historia del
-- club como cualquier otra (si hay que deshacer una apertura, es a mano).
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0059
-- con `npx supabase migration up`.
begin;

drop trigger if exists pertenencia_borra_emergencia on pertenencia;
drop function if exists borrar_emergencia_sin_plantel();
drop function if exists importar_emergencias(jsonb);
drop function if exists emergencias_del_plantel(uuid);
drop table if exists emergencia_jugador;
drop function if exists sellar_emergencia();
drop function if exists abrir_temporada(uuid, text);
drop function if exists pases_de_temporada(uuid);
drop function if exists confirmar_pases(uuid, jsonb);

delete from supabase_migrations.schema_migrations where version = '0059';
commit;
