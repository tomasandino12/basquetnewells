-- CONSTANCIA DEL JUGADOR: «Hice mi rutina de hoy» y su propia asistencia.
-- Spec: docs/superpowers/specs/2026-11-22-constancia-y-asistencia-del-jugador-design.md
-- (§1, §2 y §4). Plan: docs/superpowers/plans/2026-11-22-constancia-y-asistencia-del-jugador.md.
--
-- Antes de aplicar: npm run backup (docs/guias/BACKUP.md). Orden: backup,
-- `npx supabase db push`, tests/verificarConstancia.sql y recién después el
-- código que lee estas funciones. Rollback (sólo base local): tests/rollback0068.sql.
--
-- Son datos de menores. Las reglas se hacen cumplir acá, no en la pantalla:
--   * practica_jugador NO tiene grants ni policies: nadie la lee ni la escribe
--     directo, ni el jugador ni el cuerpo técnico (patrón de apertura_recurso, 0034).
--   * El jugador marca por marcar_practica(), que pone la fecha el servidor
--     (hoy en Argentina) y sólo acepta recursos que se le enviaron a él.
--   * El jugador lee por mis_practicas() y mi_asistencia(); las dos arrancan por
--     mi_jugador() (0030) y devuelven null a quien no tiene cuenta de jugador
--     vigente: profe, coordinador y familia (las familias no tienen cuenta, 0057).
--   * El profe lee por practicas_del_plantel(): conteos, ningún id de jugador, y
--     null con menos de 3 cuentas en el plantel (misma regla que resumen_recursos).
--   * mi_asistencia() no devuelve motivo, aviso, lesión ni quién marcó: sólo
--     «vino», «faltó» o «sin tomar» de cada día.
--   * Las marcas se borran cuando el chico se queda sin ninguna pertenencia
--     vigente y cuando se cierra su cuenta de jugador: si no es del club, no
--     nos sirven (decisión de Tomás, 22/11).
--
-- La lista de `tipo` la espeja TIPOS_DE_PRACTICA en src/data/constancia.js:
-- tests/contratoConstancia.test.js las compara. El tipo `fisico` queda listo en
-- la base sin función ni pantalla, hasta que se defina el físico de antes del
-- entrenamiento.

do $$
begin
  if to_regprocedure('public.mi_jugador()') is null then
    raise exception '0068 necesita 0030 aplicada (no existe mi_jugador()).';
  end if;
  if to_regclass('public.apertura_recurso') is null then
    raise exception '0068 necesita 0034 aplicada (no existe apertura_recurso).';
  end if;
  if to_regclass('public.asistencia') is null or to_regclass('public.lesion') is null then
    raise exception '0068 necesita 0064 aplicada (no existen asistencia ni lesion).';
  end if;
  if to_regprocedure('public.puede_ver_plantel(uuid)') is null then
    raise exception '0068 necesita 0016 aplicada (no existe puede_ver_plantel).';
  end if;
end $$;


/* =====================================================================
   1. La tabla: cerrada a todos
   ===================================================================== */

create table practica_jugador (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null,
  club_id uuid not null references club(id),
  -- Hoy en Argentina, puesto por marcar_practica(): no hay mañana ni relleno.
  fecha date not null,
  tipo text not null check (tipo in ('recurso', 'fisico')),
  -- Null en `fisico` (una por día, sin recurso) y en una práctica cuyo recurso
  -- se borró: el día practicado no se le borra al chico de la constancia.
  recurso_id uuid,
  marcado_en timestamptz not null default now(),
  constraint practica_fisico_sin_recurso check (tipo <> 'fisico' or recurso_id is null),
  foreign key (club_id, jugador_id) references jugador (club_id, id),
  -- Sólo anula recurso_id: club_id es not null. Necesita Postgres 15 o más
  -- (el proyecto está en 17, supabase/config.toml).
  foreign key (club_id, recurso_id) references recurso (club_id, id) on delete set null (recurso_id)
);

-- Una marca por recurso y día. Con recurso_id null (recurso borrado) no choca:
-- en un índice único los null son distintos, y dos recursos borrados el mismo
-- día son dos prácticas.
create unique index practica_recurso_por_dia
  on practica_jugador (jugador_id, fecha, recurso_id) where tipo = 'recurso';
-- Una de físico por día.
create unique index practica_fisico_por_dia
  on practica_jugador (jugador_id, fecha) where tipo = 'fisico';
create index practica_jugador_recurso_idx on practica_jugador (recurso_id);

alter table practica_jugador enable row level security;
revoke all on practica_jugador from public, anon, authenticated;
-- Sin grant y sin policy a propósito. Las funciones de abajo corren como
-- dueño de la tabla.

-- Defensa en profundidad: nadie la escribe directo, pero si algún día alguien
-- lo hace por error, el sello lo pone el servidor, no se mueve una fila ya
-- hecha (se marca o se desmarca, no se edita) y no hay días de mañana. La
-- única edición que pasa es la del FK `on delete set null (recurso_id)`:
-- el recurso se borró y el día practicado queda sin recurso.
create function sellar_practica()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'UPDATE' then
    if new.recurso_id is not null
       or (new.id, new.jugador_id, new.club_id, new.fecha, new.tipo, new.marcado_en)
          is distinct from (old.id, old.jugador_id, old.club_id, old.fecha, old.tipo, old.marcado_en) then
      raise exception 'PRACTICA_INMUTABLE' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.fecha > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'FECHA_FUTURA' using errcode = 'P0001';
  end if;
  new.marcado_en := now();
  return new;
end;
$fn$;

create trigger practica_sellar
  before insert or update on practica_jugador
  for each row execute function sellar_practica();

comment on table practica_jugador is
  'Un día en que el jugador practicó un recurso (o hizo el físico). Cerrada a todos: se escribe por marcar_practica y la ve el profe sólo como conteo (practicas_del_plantel, mínimo 3 cuentas). Se borra al quedar el chico sin pertenencia o sin cuenta. v0068.';


/* =====================================================================
   2. Borrado: si no es jugador del club, no nos sirve
   ===================================================================== */

-- Mismo disparador y misma regla que la emergencia (0059): cuando el chico se
-- queda sin ninguna pertenencia vigente. Es definer porque quien cierra la
-- pertenencia no tiene delete sobre la tabla.
create function borrar_practicas_sin_plantel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if (tg_op = 'DELETE' or new.hasta is not null)
     and not exists (select 1 from public.pertenencia pe
                     where pe.jugador_id = old.jugador_id and pe.hasta is null) then
    delete from public.practica_jugador p where p.jugador_id = old.jugador_id;
  end if;
  return null;
end;
$fn$;

create trigger pertenencia_borra_practicas
  after update or delete on pertenencia
  for each row execute function borrar_practicas_sin_plantel();

-- Y al cerrarse la cuenta: sin cuenta, nadie vería esas marcas. Si el chico
-- vuelve con una cuenta nueva, empieza de cero.
create function borrar_practicas_sin_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  delete from public.practica_jugador p where p.jugador_id = old.jugador_id;
  return null;
end;
$fn$;

create trigger cuenta_jugador_borra_practicas
  after update on cuenta_jugador
  for each row when (old.hasta is null and new.hasta is not null)
  execute function borrar_practicas_sin_cuenta();


/* =====================================================================
   3. mis_practicas(): lo que leen el jugador y marcar_practica
   ===================================================================== */

-- Sus marcas de recurso de las últimas 12 semanas (84 días contando hoy), más
-- nuevas primero: [{ fecha, recursoId }]. recursoId es null si el recurso se
-- borró. Null (no []) si quien llama no tiene cuenta de jugador vigente.
create function mis_practicas()
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
    select jsonb_agg(jsonb_build_object('fecha', p.fecha, 'recursoId', p.recurso_id)
                     order by p.fecha desc, p.marcado_en desc)
    from public.practica_jugador p
    where p.jugador_id = v_jugador
      and p.tipo = 'recurso'
      and p.fecha > v_hoy - 84
  ), '[]'::jsonb);
end;
$fn$;


/* =====================================================================
   4. marcar_practica(): lo llama el jugador
   ===================================================================== */

-- La fecha no se recibe: es hoy en Argentina, la pone el servidor. p_hecho
-- false borra la marca de HOY de ese recurso; cualquier otro valor la marca.
-- Un recurso que no se le envió a él, o un chico que ya no tiene plantel
-- vigente, no anota nada y no da error: no debe poder averiguar qué recursos
-- existen (como registrar_apertura). Devuelve lo mismo que mis_practicas().
create function marcar_practica(p_recurso_id uuid, p_hecho boolean)
returns jsonb
language plpgsql
volatile
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

  if p_hecho is false then
    delete from public.practica_jugador p
    where p.jugador_id = v_jugador and p.tipo = 'recurso'
      and p.recurso_id = p_recurso_id and p.fecha = v_hoy;
  else
    insert into public.practica_jugador (jugador_id, club_id, fecha, tipo, recurso_id)
    select e.jugador_id, e.club_id, v_hoy, 'recurso', e.recurso_id
    from public.envio_recurso e
    where e.recurso_id = p_recurso_id and e.jugador_id = v_jugador
      and exists (select 1 from public.pertenencia pe
                  where pe.jugador_id = e.jugador_id and pe.hasta is null)
    on conflict do nothing;
  end if;

  return public.mis_practicas();
end;
$fn$;


/* =====================================================================
   5. mi_asistencia(): su asistencia, un día por fecha
   ===================================================================== */

-- [{ fecha, vino }] de los últimos 12 meses, de más viejo a más nuevo. `vino`
-- es true, false o null (null es «no se tomó» o «pausa por lesión»: no suma ni
-- corta la racha). Ya junta todas sus categorías: una sola racha. La regla de
-- cada día, en orden:
--   1. presente en alguno                  -> true (un lesionado que vino cuenta)
--   2. lesionado ese día                   -> null (hasta es el día del alta: ya no cuenta)
--   3. ausente o justificada en alguno     -> false (avisar está bien, pero no fue)
--   4. nada de lo anterior                 -> null
-- Sólo entran los días con hubo = true de planteles donde el chico tenía
-- pertenencia ese día (misma regla que asistencia_crear de 0064: no mira
-- `desde`, porque el profe puede pasar días de la planilla en papel de antes
-- del alta). No sale el motivo, si avisó, la lesión ni quién marcó.
-- Null si quien llama no tiene cuenta de jugador vigente.
create function mi_asistencia()
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


/* =====================================================================
   6. practicas_del_plantel(): lo lee el entrenador del plantel
   ===================================================================== */

-- Del plantel, sólo entre los chicos con pertenencia vigente y cuenta
-- vigente (de los demás no hay dato): cuántas cuentas hay, cuántos marcaron
-- algo desde el lunes y, por cada recurso enviado a chicos del plantel,
-- cuántos lo practicaron esta semana (lunes a domingo, hora de Argentina) y
-- alguna vez. Ningún id de jugador. Con menos de 3 cuentas los conteos salen
-- null: con 1 o 2, el profe sabe quiénes son y el «conteo» sería un nombre.
-- Null a quien no es entrenador vigente del plantel.
create function practicas_del_plantel(p_plantel_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  c_minimo constant integer := 3;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_lunes date := date_trunc('week', v_hoy::timestamp)::date;
begin
  if not public.puede_ver_plantel(p_plantel_id) then
    return null;
  end if;

  return (
    with en_plantel as (
      select pe.jugador_id
      from public.pertenencia pe
      where pe.plantel_id = p_plantel_id and pe.hasta is null
    ),
    con_cuenta as (
      select p.jugador_id
      from en_plantel p
      join public.cuenta_jugador c on c.jugador_id = p.jugador_id and c.hasta is null
    ),
    marcas as (
      select pj.jugador_id, pj.recurso_id, pj.fecha
      from public.practica_jugador pj
      join con_cuenta cc on cc.jugador_id = pj.jugador_id
      where pj.tipo = 'recurso' and pj.recurso_id is not null
    ),
    cuentas as (
      select count(*)::int as n from con_cuenta
    ),
    esta_semana as (
      select count(distinct m.jugador_id)::int as n from marcas m where m.fecha >= v_lunes
    ),
    por_recurso as (
      select r.recurso_id,
             (select count(distinct m.jugador_id)::int from marcas m
               where m.recurso_id = r.recurso_id and m.fecha >= v_lunes) as esta_semana,
             (select count(distinct m.jugador_id)::int from marcas m
               where m.recurso_id = r.recurso_id) as alguna_vez
      from (
        select distinct e.recurso_id
        from public.envio_recurso e
        join en_plantel p on p.jugador_id = e.jugador_id
      ) r
    )
    select jsonb_build_object(
      'conCuenta', (select n from cuentas),
      'marcaronEstaSemana', case when (select n from cuentas) >= c_minimo then (select n from esta_semana) end,
      'recursos', coalesce((
        select jsonb_agg(jsonb_build_object(
          'recursoId', r.recurso_id,
          'estaSemana', case when (select n from cuentas) >= c_minimo then r.esta_semana end,
          'algunaVez', case when (select n from cuentas) >= c_minimo then r.alguna_vez end
        ))
        from por_recurso r
      ), '[]'::jsonb)
    )
  );
end;
$fn$;


/* =====================================================================
   7. Permisos de ejecución
   ===================================================================== */

-- Las dos de borrado son de los disparadores: nadie las llama.
revoke execute on function sellar_practica()                  from public, anon, authenticated;
revoke execute on function borrar_practicas_sin_plantel()     from public, anon, authenticated;
revoke execute on function borrar_practicas_sin_cuenta()      from public, anon, authenticated;

revoke execute on function mis_practicas()                    from public, anon;
revoke execute on function marcar_practica(uuid, boolean)     from public, anon;
revoke execute on function mi_asistencia()                    from public, anon;
revoke execute on function practicas_del_plantel(uuid)        from public, anon;

grant execute on function mis_practicas()                     to authenticated;
grant execute on function marcar_practica(uuid, boolean)      to authenticated;
grant execute on function mi_asistencia()                     to authenticated;
grant execute on function practicas_del_plantel(uuid)         to authenticated;
