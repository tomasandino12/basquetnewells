-- Deshace 0068 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- borra todas las prácticas que los jugadores marcaron (tabla practica_jugador).
-- La asistencia, las lesiones, los recursos y las cuentas de jugador no se
-- tocan: 0068 no cambió ninguna de esas tablas.
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0068
-- con `npx supabase migration up`.
begin;

drop trigger if exists pertenencia_borra_practicas on pertenencia;
drop trigger if exists cuenta_jugador_borra_practicas on cuenta_jugador;
drop function if exists borrar_practicas_sin_plantel();
drop function if exists borrar_practicas_sin_cuenta();
drop function if exists practicas_del_plantel(uuid);
drop function if exists mi_asistencia();
drop function if exists marcar_practica(uuid, boolean);
drop function if exists mis_practicas();
drop table if exists practica_jugador;
drop function if exists sellar_practica();

delete from supabase_migrations.schema_migrations where version = '0068';
commit;
