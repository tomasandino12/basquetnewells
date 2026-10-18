-- Deshace 0054 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- borra todos los rubros, movimientos y su rastro.
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0054
-- con `npx supabase migration up`.
begin;

drop table if exists movimiento_cambio;
drop table if exists movimiento;
drop table if exists rubro;
drop function if exists registrar_cambio_movimiento();
drop function if exists sellar_movimiento();
drop function if exists sellar_rubro();

delete from supabase_migrations.schema_migrations where version = '0054';
commit;
