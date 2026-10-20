-- Deshace 0062 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- a los formularios marcados como inscripción o comprobante les saca la marca
-- (quedan como comunes) y vuelve el check de 0061. El portal sigue andando;
-- las dos tarjetas de arriba muestran "abre con la temporada".
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0062
-- con `npx supabase migration up --local`.
begin;

update formulario_portal set destino = null where destino in ('inscripcion', 'comprobante');

alter table formulario_portal
  drop constraint formulario_portal_destino_valido,
  add constraint formulario_portal_destino_valido check (destino in ('consultas', 'colaboradores'));

delete from supabase_migrations.schema_migrations where version = '0062';
commit;
