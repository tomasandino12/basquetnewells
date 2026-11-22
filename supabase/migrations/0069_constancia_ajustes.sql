-- CONSTANCIA DEL JUGADOR, ajustes de 0068 (B-31). Dos cosas que salieron al
-- armar la pantalla Inicio:
--
--   1. mis_recursos() (0030) no devolvía `tipo` ni `frecuencia_semanal` del
--      recurso (0033). Sin ellos, el check «Hice mi rutina de hoy» ofrece
--      también los de lectura de juego (se miran, no se practican) y no puede
--      decir «2 de 3 veces esta semana». Cambian las columnas que devuelve, y
--      Postgres no deja cambiar eso con `create or replace`: se borra y se
--      vuelve a crear, con los mismos permisos que le dio 0030.
--   2. mi_asistencia() (0068) mostraba como «sin tomar» los entrenamientos de
--      antes de que el chico entrara al plantel: uno que llega a mitad de año
--      veía huecos de cuando no estaba. Ahora un día anterior a su `desde`
--      sólo entra si el profe lo tomó igual (planilla en papel de antes del
--      alta, la misma razón por la que asistencia_crear de 0064 no mira
--      `desde`). El resto de la regla no cambia.
--
-- Ninguna tabla cambia y no se abre nada nuevo: siguen sin grants ni policies.
-- Spec: docs/superpowers/specs/2026-11-22-constancia-y-asistencia-del-jugador-design.md.
-- Antes de aplicar: npm run backup (docs/guias/BACKUP.md). Se aplica junto con
-- 0068 en el mismo `db push`. Verificación: tests/verificarConstancia.sql y
-- tests/verificar0069.sql. Rollback (sólo base local): tests/rollback0069.sql.

do $$
begin
  if to_regprocedure('public.mi_asistencia()') is null then
    raise exception '0069 necesita 0068 aplicada (no existe mi_asistencia()).';
  end if;
end $$;


/* =====================================================================
   1. mis_recursos(): ahora con tipo y frecuencia_semanal
   ===================================================================== */

-- Igual que en 0030: únicamente lo que tiene un envio_recurso a este jugador,
-- más nuevo primero. Las dos columnas nuevas son del recurso (las carga el
-- profe) y pueden ser null: «no lo dijo».
drop function mis_recursos();

create function mis_recursos()
returns table (recurso_id uuid, titulo text, descripcion text, enlace text, fecha date,
               tipo text, frecuencia_semanal smallint)
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
    select r.id, r.titulo, r.descripcion, r.enlace, e.fecha, r.tipo, r.frecuencia_semanal
    from public.envio_recurso e
    join public.recurso r on r.id = e.recurso_id
    where e.jugador_id = v_jugador
    order by e.fecha desc, r.creado_en desc;
end;
$fn$;

-- El drop se llevó los permisos de 0030: se vuelven a dar los mismos.
revoke execute on function mis_recursos() from public, anon;
grant execute on function mis_recursos() to authenticated;


/* =====================================================================
   2. mi_asistencia(): sin los días de antes de entrar al plantel
   ===================================================================== */

-- Misma firma, misma salida y misma regla de cada día que 0068 (ver ahí):
--   1. presente en alguno                  -> true
--   2. lesionado ese día                   -> null
--   3. ausente o justificada en alguno     -> false
--   4. nada de lo anterior                 -> null
-- Lo único nuevo es la condición de la pertenencia. `create or replace`
-- conserva los permisos que le dio 0068.
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
                      and (pe.hasta is null or pe.hasta >= e.fecha)
                      -- Antes de su alta, sólo si el profe lo tomó ese día.
                      and (pe.desde <= e.fecha or exists (
                        select 1 from public.asistencia a2
                        where a2.entrenamiento_id = e.id and a2.jugador_id = v_jugador)))
      group by e.fecha
    ) d
  ), '[]'::jsonb);
end;
$fn$;
