-- Deshace 0063 en el Docker LOCAL. No se corre contra producción sin revisarlo:
-- al formulario marcado como recaudación le saca la marca (queda como común) y
-- vuelve el check de 0062. El portal sigue andando; la tarjeta de eventos de
-- recaudación muestra el botón apagado.
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0063
-- con `npx supabase migration up --local`.
begin;

update formulario_portal set destino = null where destino = 'recaudacion';

alter table formulario_portal
  drop constraint formulario_portal_destino_valido,
  add constraint formulario_portal_destino_valido check (destino in ('consultas', 'colaboradores', 'inscripcion', 'comprobante'));

comment on column formulario_portal.destino is
  'Nulo = formulario común. consultas = "Quiero jugar en Newell''s" (destacado, y destino del QR /consultas). colaboradores = sección de sponsors. inscripcion y comprobante = las dos tarjetas de arriba del portal. Uno por destino y club. v0061, ampliado en v0062.';

delete from supabase_migrations.schema_migrations where version = '0063';
commit;
