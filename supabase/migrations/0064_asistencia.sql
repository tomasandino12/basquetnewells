-- Asistencia a los entrenamientos y lesiones como períodos con alta.
-- Ver docs/superpowers/specs/2026-10-29-asistencia-lesiones-design.md.
--
-- Tres tablas: entrenamiento (un día de práctica de un plantel), asistencia
-- (un chico en ese día) y lesion (un período del jugador, no del plantel).
-- Las listas cerradas son las de src/data/asistencia.js;
-- tests/contratoAsistencia.test.js las compara.
--
-- Permisos: el profe que tiene el plantel lee y escribe. El coordinador no lee
-- ninguna fila de un chico (regla de 0018): tiene asistencia_del_club, que
-- devuelve sólo el % por categoría. Familias y jugadores, nada.
--
-- No crea ni cambia policies de otras tablas.

/* ---------- entrenamiento ---------- */

create table entrenamiento (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  plantel_id uuid not null,
  fecha date not null,
  -- false es el "SE" de la planilla: no hubo práctica ese día, para todo el
  -- plantel. Un día así no tiene filas de asistencia (trigger de abajo).
  hubo boolean not null default true,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  -- El profe corrige días pasados (una falta pasa a justificada cuando la
  -- familia avisa): queda quién tocó el día por última vez.
  actualizado_por uuid not null default auth.uid() references auth.users(id),
  actualizado_en timestamptz not null default now(),
  -- Un día por plantel: guardar_asistencia hace upsert sobre esto.
  unique (plantel_id, fecha),
  unique (club_id, id),
  foreign key (club_id, plantel_id) references plantel (club_id, id)
);

create function sellar_entrenamiento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- current_date es UTC: va por delante de la fecha argentina, así que nunca
  -- rechaza la toma de hoy y sí la de mañana.
  if new.fecha > current_date then
    raise exception 'FECHA_FUTURA' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_en := now();
  else
    if new.club_id is distinct from old.club_id or new.plantel_id is distinct from old.plantel_id
       or new.fecha is distinct from old.fecha then
      raise exception 'ENTRENAMIENTO_INMUTABLE' using errcode = 'P0001';
    end if;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger entrenamiento_sellar
  before insert or update on entrenamiento
  for each row execute function sellar_entrenamiento();


/* ---------- asistencia ---------- */

-- Sin fila = no se tomó a ese chico ese día. No es "ausente": NULL es "no se
-- sabe". La justificada cuenta como falta (src/data/asistencia.js).
create table asistencia (
  entrenamiento_id uuid not null,
  jugador_id uuid not null,
  club_id uuid not null references club(id),
  estado text not null check (estado in ('presente', 'ausente', 'justificada')),
  marcado_por uuid not null default auth.uid() references auth.users(id),
  marcado_en timestamptz not null default now(),
  primary key (entrenamiento_id, jugador_id),
  foreign key (club_id, entrenamiento_id) references entrenamiento (club_id, id) on delete cascade,
  foreign key (club_id, jugador_id) references jugador (club_id, id)
);

create index asistencia_jugador_idx on asistencia (jugador_id);

-- Sin security definer: quien escribe la asistencia ve su entrenamiento.
create function sellar_asistencia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.entrenamiento e
    where e.id = new.entrenamiento_id and e.hubo
  ) then
    raise exception 'NO_HUBO_ENTRENAMIENTO' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (
       new.entrenamiento_id is distinct from old.entrenamiento_id
       or new.jugador_id is distinct from old.jugador_id
       or new.club_id is distinct from old.club_id) then
    raise exception 'ASISTENCIA_INMUTABLE' using errcode = 'P0001';
  end if;
  new.marcado_por := auth.uid();
  new.marcado_en := now();
  return new;
end;
$$;

create trigger asistencia_sellar
  before insert or update on asistencia
  for each row execute function sellar_asistencia();

-- Pasar un día a "no hubo" borra lo tomado: si quedaran filas, el chico
-- tendría una falta en un día sin práctica. Corre con los permisos de quien
-- cambia el día, que son los mismos que borran asistencia.
create function vaciar_entrenamiento_sin_practica()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.asistencia a where a.entrenamiento_id = new.id;
  return null;
end;
$$;

create trigger entrenamiento_sin_practica
  after update of hubo on entrenamiento
  for each row when (old.hubo and not new.hubo)
  execute function vaciar_entrenamiento_sin_practica();


/* ---------- lesion ---------- */

-- Un período del jugador: si está en dos categorías, aparece lesionado en las
-- dos. desde es el primer día lesionado; hasta, el día del alta, que ya no
-- cuenta (lesionadoEn de src/data/asistencia.js). hasta null = sigue.
--
-- Es dato de salud de un menor (sensible, ley 25.326): listas cerradas y
-- nada de texto libre ni diagnóstico. La zona alcanza para los análisis que
-- vengan. Las tres admiten NULL ("no se sabe"): el profe marca la lesión en
-- la cancha y quizás no sabe más.
create table lesion (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  jugador_id uuid not null,
  desde date not null,
  hasta date,
  zona text check (zona in (
    'tobillo', 'pie', 'rodilla', 'pantorrilla', 'muslo', 'cadera',
    'espalda', 'hombro', 'muneca_mano', 'cabeza', 'otra')),
  lado text check (lado in ('izquierdo', 'derecho', 'no_aplica')),
  tipo text check (tipo in ('torcedura', 'golpe', 'sobrecarga_dolor', 'otro')),
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  -- Quien dio el alta o corrigió la zona.
  actualizado_por uuid not null default auth.uid() references auth.users(id),
  actualizado_en timestamptz not null default now(),
  constraint lesion_hasta_despues check (hasta is null or hasta >= desde),
  foreign key (club_id, jugador_id) references jugador (club_id, id)
);

-- A lo sumo una lesión abierta por jugador: dos profes del mismo chico (dos
-- categorías) que marcan "se lesionó" a la vez no duplican el período.
create unique index lesion_abierta_unica on lesion (jugador_id) where hasta is null;
create index lesion_jugador_idx on lesion (jugador_id, desde);

create function sellar_lesion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.desde > current_date or new.hasta > current_date then
    raise exception 'FECHA_FUTURA' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_en := now();
  else
    if new.club_id is distinct from old.club_id or new.jugador_id is distinct from old.jugador_id then
      raise exception 'LESION_INMUTABLE' using errcode = 'P0001';
    end if;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger lesion_sellar
  before insert or update on lesion
  for each row execute function sellar_lesion();


/* ---------- RLS ---------- */

alter table entrenamiento enable row level security;
alter table asistencia enable row level security;
alter table lesion enable row level security;

-- Sin rama del coordinador en ninguna: ni el día (cuántos vinieron se deduce
-- de las filas) ni las filas. Lo agregado sale de asistencia_del_club.
create policy entrenamiento_ver on entrenamiento
  for select using (puede_ver_plantel(plantel_id));
create policy entrenamiento_crear on entrenamiento
  for insert with check (puede_escribir_plantel(plantel_id));
create policy entrenamiento_editar on entrenamiento
  for update using (puede_escribir_plantel(plantel_id))
  with check (puede_escribir_plantel(plantel_id));
create policy entrenamiento_borrar on entrenamiento
  for delete using (puede_escribir_plantel(plantel_id));

create policy asistencia_ver on asistencia
  for select using (exists (
    select 1 from entrenamiento e
    where e.id = asistencia.entrenamiento_id and puede_ver_plantel(e.plantel_id)));
-- El chico tiene que haber estado en el plantel ese día. Sin mirar
-- pertenencia.desde: el profe puede pasar días de la planilla en papel de
-- antes de dar al chico de alta en la app. Sí mira hasta: un chico que se fue
-- de la categoría sigue corrigiéndose en sus días viejos, no en los nuevos.
create policy asistencia_crear on asistencia
  for insert with check (exists (
    select 1 from entrenamiento e
    join pertenencia pe on pe.plantel_id = e.plantel_id
    where e.id = asistencia.entrenamiento_id
      and pe.jugador_id = asistencia.jugador_id
      and (pe.hasta is null or pe.hasta >= e.fecha)
      and puede_escribir_plantel(e.plantel_id)));
create policy asistencia_editar on asistencia
  for update using (exists (
    select 1 from entrenamiento e
    where e.id = asistencia.entrenamiento_id and puede_escribir_plantel(e.plantel_id)))
  with check (exists (
    select 1 from entrenamiento e
    where e.id = asistencia.entrenamiento_id and puede_escribir_plantel(e.plantel_id)));
create policy asistencia_borrar on asistencia
  for delete using (exists (
    select 1 from entrenamiento e
    where e.id = asistencia.entrenamiento_id and puede_escribir_plantel(e.plantel_id)));

-- La lesión es del jugador: la ve y la escribe quien lo tiene hoy en un
-- plantel suyo, como jugador_ver (0016). Un profe que deja de tenerlo deja de
-- verla; el nuevo la ve entera.
create policy lesion_ver on lesion
  for select using (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = lesion.jugador_id and pe.hasta is null
      and puede_ver_plantel(pe.plantel_id)));
create policy lesion_crear on lesion
  for insert with check (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = lesion.jugador_id and pe.hasta is null
      and puede_escribir_plantel(pe.plantel_id)));
create policy lesion_editar on lesion
  for update using (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = lesion.jugador_id and pe.hasta is null
      and puede_escribir_plantel(pe.plantel_id)))
  with check (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = lesion.jugador_id and pe.hasta is null
      and puede_escribir_plantel(pe.plantel_id)));
-- Se borra la marcada por error (otro chico). Un dato de salud equivocado no
-- es memoria del club.
create policy lesion_borrar on lesion
  for delete using (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = lesion.jugador_id and pe.hasta is null
      and puede_escribir_plantel(pe.plantel_id)));

-- Supabase concede ALL por defecto: se revoca todo y se concede lo mínimo,
-- por columna. Autoría y fechas de sellado, nunca. El club, el plantel, la
-- fecha y el chico de una fila no cambian.
revoke all on entrenamiento from anon, authenticated;
grant select, delete on entrenamiento to authenticated;
grant insert (club_id, plantel_id, fecha, hubo) on entrenamiento to authenticated;
grant update (hubo) on entrenamiento to authenticated;

revoke all on asistencia from anon, authenticated;
grant select, delete on asistencia to authenticated;
grant insert (entrenamiento_id, jugador_id, club_id, estado) on asistencia to authenticated;
grant update (estado) on asistencia to authenticated;

revoke all on lesion from anon, authenticated;
grant select, delete on lesion to authenticated;
grant insert (club_id, jugador_id, desde, hasta, zona, lado, tipo) on lesion to authenticated;
grant update (desde, hasta, zona, lado, tipo) on lesion to authenticated;

comment on table entrenamiento is
  'Un día de práctica de un plantel. hubo = false es el SE de la planilla del área: sin filas de asistencia. v0064.';
comment on table asistencia is
  'Un chico en un entrenamiento: presente, ausente o justificada. Sin fila = no se tomó. El coordinador no la lee. v0064.';
comment on table lesion is
  'Período lesionado de un jugador: desde, hasta (día del alta, null = sigue), zona/lado/tipo de listas cerradas. Sin texto libre. v0064.';


/* ---------- RPC: guardar_asistencia ---------- */

-- Guarda el día entero en una transacción: con el wifi del gimnasio, medio
-- plantel guardado le mostraría al profe un día donde algunos chicos están
-- tomados y otros no, sin saber por qué.
--
-- Upsert del día y de cada fila que viene; una fila con estado null se borra
-- (el profe desmarcó). Las que no vienen quedan: así, corregir un día viejo
-- desde la lista de hoy no borra a un chico que ya se fue de la categoría.
-- Reintentar deja lo mismo. Con p_hubo = false las filas se ignoran: el
-- trigger del día borra lo que hubiera.
--
-- security invoker: RLS como un insert directo.
create function guardar_asistencia(p_plantel_id uuid, p_fecha date, p_hubo boolean, p_filas jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_club_id uuid;
  v_id uuid;
  f jsonb;
begin
  -- Explícito y no sólo RLS: sin esto, un payload vacío de alguien sin el
  -- plantel contestaría un error de policy difícil de explicar en pantalla.
  if not puede_escribir_plantel(p_plantel_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;
  select pl.club_id into v_club_id from plantel pl where pl.id = p_plantel_id;

  insert into entrenamiento (club_id, plantel_id, fecha, hubo)
  values (v_club_id, p_plantel_id, p_fecha, coalesce(p_hubo, true))
  on conflict (plantel_id, fecha) do update set hubo = excluded.hubo
  returning id into v_id;

  if coalesce(p_hubo, true) then
    for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb))
    loop
      if f->>'estado' is null then
        delete from asistencia
        where entrenamiento_id = v_id and jugador_id = (f->>'jugadorId')::uuid;
      else
        insert into asistencia (entrenamiento_id, jugador_id, club_id, estado)
        values (v_id, (f->>'jugadorId')::uuid, v_club_id, f->>'estado')
        on conflict (entrenamiento_id, jugador_id) do update set estado = excluded.estado;
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;

revoke execute on function guardar_asistencia(uuid, date, boolean, jsonb) from public, anon;
grant  execute on function guardar_asistencia(uuid, date, boolean, jsonb) to authenticated;


/* ---------- RPC: asistencia_del_club ---------- */

-- Lo único que ve el coordinador: por categoría de la temporada vigente, la
-- cantidad de entrenamientos y el % general de asistencia del rango. Ni
-- jugadores, ni nombres, ni lesiones. Decidido por Tomás el 29/10: la planilla
-- con nombres la baja cada profe de su plantel.
--
-- security definer porque el coordinador no lee las tablas. Una categoría sin
-- entrenamientos en el rango sale con 0 y pct null (la pantalla muestra "—").
create function asistencia_del_club(p_club_id uuid, p_desde date, p_hasta date)
returns table (plantel_id uuid, categoria text, entrenamientos int, pct numeric)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if not public.es_coordinador_de(p_club_id) then
    raise exception 'Sólo coordinación de ese club.' using errcode = '42501';
  end if;

  return query
    select pl.id,
           pl.categoria,
           (select count(*)::int from public.entrenamiento e
             where e.plantel_id = pl.id and e.hubo
               and e.fecha between p_desde and p_hasta),
           (select round(100.0 * count(*) filter (where a.estado = 'presente')
                         / nullif(count(*), 0), 1)
              from public.asistencia a
              join public.entrenamiento e on e.id = a.entrenamiento_id
             where e.plantel_id = pl.id
               and e.fecha between p_desde and p_hasta)
    from public.plantel pl
    where pl.club_id = p_club_id
      and pl.temporada_id = public.temporada_vigente_de(p_club_id)
    order by pl.categoria;
end;
$fn$;

revoke execute on function asistencia_del_club(uuid, date, date) from public, anon;
grant  execute on function asistencia_del_club(uuid, date, date) to authenticated;
