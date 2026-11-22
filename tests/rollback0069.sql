-- Deshace 0069 en el Docker LOCAL. No se corre contra producción sin revisarlo.
-- No borra datos: vuelve mis_recursos() a las columnas de 0030 y mi_asistencia()
-- a la versión de 0068 (con los días de antes del alta como «sin tomar»).
-- Ojo: la pantalla Inicio deja de recibir tipo y frecuencia (vuelven null).
--
-- Borra también la fila de schema_migrations para poder volver a aplicar 0069
-- con `npx supabase migration up`.
begin;

drop function if exists mis_recursos();

create function mis_recursos()
returns table (recurso_id uuid, titulo text, descripcion text, enlace text, fecha date)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_jugador uuid := public.mi_jugador();
begin
  if v_jugador is null then
    return;
  end if;

  return query
    select r.id, r.titulo, r.descripcion, r.enlace, e.fecha
    from public.envio_recurso e
    join public.recurso r on r.id = e.recurso_id
    where e.jugador_id = v_jugador
    order by e.fecha desc, r.creado_en desc;
end;
$fn$;

revoke execute on function mis_recursos() from public, anon;
grant execute on function mis_recursos() to authenticated;

create or replace function mi_asistencia()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_jugador uuid := public.mi_jugador();
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_jugador is null then
    return null;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('fecha', d.fecha, 'vino', d.vino) order by d.fecha)
    from (
      select e.fecha,
             case
               when bool_or(a.estado = 'presente') then true
               when exists (select 1 from public.lesion l
                            where l.jugador_id = v_jugador and l.desde <= e.fecha
                              and (l.hasta is null or e.fecha < l.hasta)) then null
               when bool_or(a.estado in ('ausente', 'justificada')) then false
               else null
             end as vino
      from public.entrenamiento e
      left join public.asistencia a
        on a.entrenamiento_id = e.id and a.jugador_id = v_jugador
      where e.hubo
        and e.fecha <= v_hoy
        and e.fecha >= (v_hoy - interval '12 months')::date
        and exists (select 1 from public.pertenencia pe
                    where pe.jugador_id = v_jugador and pe.plantel_id = e.plantel_id
                      and (pe.hasta is null or pe.hasta >= e.fecha))
      group by e.fecha
    ) d
  ), '[]'::jsonb);
end;
$fn$;

delete from supabase_migrations.schema_migrations where version = '0069';
commit;
