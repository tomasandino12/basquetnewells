-- Cuentas de familia: el padre queda vinculado con su hijo por el mail
-- verificado con el que llenó la inscripción.
-- Ver docs/superpowers/specs/2026-10-18-cuentas-familia-design.md (§3 y §4).
--
-- Igual que la cuenta de jugador (0029/0030), la familia no recibe `select`
-- sobre ninguna tabla de dominio: todo lo que ve pasa por mis_chicos(). Así
-- estadísticas, mediciones y misiones quedan fuera por construcción, no
-- porque alguien se acordó de cada tabla. `miembro_club` no se toca y ninguna
-- policy existente cambia: el import escribe `jugador` y `pertenencia` con
-- los permisos que el entrenador ya tiene.
--
-- Verificación: tests/verificarCuentasFamilia.sql. Rollback: tests/rollback0057.sql.

do $$
begin
  if to_regprocedure('public.temporada_vigente_de(uuid)') is null then
    raise exception '0057 necesita 0029 aplicada (no existe temporada_vigente_de).';
  end if;
end $$;


/* =====================================================================
   1. responsable_jugador: el mail del adulto que inscribió al chico
   ===================================================================== */

-- Dato del adulto, no del chico. Lo carga el import de inscriptos y lo
-- corrige el profe desde la ficha (borrar y cargar de nuevo: sin update).
-- Varias filas por chico: cada responsable es una.
create table responsable_jugador (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  jugador_id uuid not null,
  email text not null check (char_length(email) <= 254),
  cargado_por uuid not null default auth.uid() references auth.users(id),
  cargado_en timestamptz not null default now(),
  foreign key (club_id, jugador_id) references jugador (club_id, id) on delete cascade,
  -- Se compara contra auth.users.email en minúsculas: guardado de otra forma
  -- no engancharía nunca, y sin avisar.
  constraint responsable_email_normalizado check (email = lower(btrim(email)) and email like '_%@_%._%'),
  unique (jugador_id, email)
);

create index responsable_jugador_email_idx on responsable_jugador (email);

alter table responsable_jugador enable row level security;

-- El staff del chico: el entrenador de un plantel donde está vigente. Misma
-- regla que jugador_editar (0016). Coordinación no lo lee: ve los vínculos ya
-- hechos por vinculos_familia_del_club().
create policy responsable_ver on responsable_jugador
  for select using (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = responsable_jugador.jugador_id and pe.hasta is null
      and puede_escribir_plantel(pe.plantel_id)));

create policy responsable_cargar on responsable_jugador
  for insert with check (
    responsable_jugador.cargado_por = auth.uid()
    and exists (
      select 1 from pertenencia pe
      where pe.jugador_id = responsable_jugador.jugador_id and pe.hasta is null
        and pe.club_id = responsable_jugador.club_id
        and puede_escribir_plantel(pe.plantel_id)));

create policy responsable_quitar on responsable_jugador
  for delete using (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = responsable_jugador.jugador_id and pe.hasta is null
      and puede_escribir_plantel(pe.plantel_id)));

revoke all on responsable_jugador from anon, authenticated;
grant select, delete on responsable_jugador to authenticated;
grant insert (club_id, jugador_id, email) on responsable_jugador to authenticated;

comment on table responsable_jugador is
  'Mail verificado del adulto que inscribió al chico (planilla "Para Semillero"). De acá sale el vínculo de familia. Lo escribe el entrenador del plantel. v0057.';


/* =====================================================================
   2. vinculo_familia: qué cuenta de familia ve a qué chico, con historia
   ===================================================================== */

create table vinculo_familia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  club_id uuid not null references club(id),
  jugador_id uuid not null,
  -- Cómo se hizo. Hoy sólo por mail; existe para que un módulo con datos
  -- sensibles (asistencia, aranceles) pueda exigir otra vía (spec §6.3).
  via text not null default 'mail' check (via in ('mail')),
  desde timestamptz not null default now(),
  hasta timestamptz,
  cerrado_por uuid references auth.users(id),
  foreign key (club_id, jugador_id) references jugador (club_id, id) on delete restrict,
  constraint vinculo_fechas_validas check (hasta is null or hasta >= desde),
  constraint vinculo_cierre_con_fecha check (cerrado_por is null or hasta is not null)
);

create unique index vinculo_familia_vigente
  on vinculo_familia (user_id, jugador_id) where hasta is null;
create index vinculo_familia_jugador_idx on vinculo_familia (jugador_id);
create index vinculo_familia_club_idx on vinculo_familia (club_id) where hasta is null;

-- Dar de baja es cerrar, no borrar (como cuenta_jugador, 0029): tiene que
-- poder saberse quién estuvo vinculado a qué chico. El cierre lo sella el
-- servidor y una fila cerrada no se toca.
create function sellar_cierre_vinculo_familia()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if old.hasta is not null then
    raise exception 'VINCULO_YA_CERRADO' using errcode = 'P0001';
  end if;
  if new.hasta is null then
    raise exception 'SOLO_SE_PUEDE_CERRAR' using errcode = 'P0001';
  end if;
  new := old;
  new.hasta := now();
  new.cerrado_por := auth.uid();
  return new;
end;
$fn$;

create trigger vinculo_familia_sellar_cierre
  before update on vinculo_familia
  for each row execute function sellar_cierre_vinculo_familia();

-- Sin policies y sin grants: nadie lee ni escribe la tabla directo. Lo hacen
-- las funciones de abajo, que corren como dueño y chequean quién llama.
alter table vinculo_familia enable row level security;
revoke all on vinculo_familia from anon, authenticated;

comment on table vinculo_familia is
  'Qué cuenta de familia ve a qué jugador. Nace por mail (vincular_por_mail), se cierra (hasta), no se borra. Sin acceso directo: sólo por funciones. v0057.';


/* =====================================================================
   3. Import de inscriptos (entrenador del plantel)
   ===================================================================== */

-- Toda la planilla de un plantel en una transacción: si una fila falla, no
-- queda nada a medias. security invoker: corre con los permisos del profe,
-- sujeta a la RLS de siempre (jugador_crear, pertenencia_crear,
-- jugador_editar, responsable_cargar).
--
-- payload: { plantelId, filas: [{ jugadorId? | nombreClave + nombreLimpio,
--            fechaNacimiento, mails: [] }] }
-- Con jugadorId: el chico ya existe en el club (reinscripto o vino de la
-- CABB). Se le suma la pertenencia a este plantel si no la tiene; la de otra
-- temporada queda como historia. La fecha se completa sólo si faltaba.
create function importar_inscriptos(payload jsonb)
returns jsonb
language plpgsql
security invoker
as $fn$
declare
  v_plantel record;
  v_fila jsonb;
  v_jugador uuid;
  v_fecha date;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_n integer := 0;
  v_creados integer := 0;
  v_existentes integer := 0;
  v_mails integer := 0;
  v_filas integer;
begin
  select pl.id, pl.club_id, pl.temporada_id into v_plantel
  from plantel pl where pl.id = (payload->>'plantelId')::uuid;
  if not found or not puede_escribir_plantel(v_plantel.id) then
    raise exception 'PLANTEL_NO_PERMITIDO' using errcode = '42501';
  end if;

  for v_fila in select * from jsonb_array_elements(coalesce(payload->'filas', '[]'::jsonb)) loop
    v_n := v_n + 1;
    v_fecha := (v_fila->>'fechaNacimiento')::date;

    if v_fila->>'jugadorId' is not null then
      v_jugador := (v_fila->>'jugadorId')::uuid;
      -- jugadores_del_club_para_dedup lista todo el club: se vuelve a
      -- chequear acá que el id sea de este club y no de otro.
      if not exists (
        select 1 from public.jugadores_del_club_para_dedup(v_plantel.club_id) d where d.id = v_jugador
      ) then
        raise exception 'JUGADOR_DE_OTRO_CLUB (fila %)', v_n using errcode = 'P0001';
      end if;
      v_existentes := v_existentes + 1;
    else
      if v_fecha is null then
        raise exception 'FECHA_NACIMIENTO_REQUERIDA (fila %)', v_n using errcode = 'P0001';
      end if;
      -- Sin `returning`: ver 0029 y 0036.
      v_jugador := gen_random_uuid();
      begin
        insert into jugador (id, club_id, nombre_clave, nombre_limpio, desambiguador, fecha_nacimiento)
        values (v_jugador, v_plantel.club_id, v_fila->>'nombreClave', v_fila->>'nombreLimpio',
                coalesce(v_fila->>'desambiguador', ''), v_fecha);
      exception when unique_violation then
        raise exception 'JUGADOR_YA_EXISTE (fila %)', v_n using errcode = 'P0001';
      end;
      v_creados := v_creados + 1;
    end if;

    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde)
    values (v_plantel.club_id, v_jugador, v_plantel.id, v_plantel.temporada_id, v_hoy)
    on conflict (jugador_id, plantel_id) where hasta is null do nothing;

    if v_fecha is not null then
      update jugador set fecha_nacimiento = v_fecha
      where id = v_jugador and fecha_nacimiento is null;
    end if;

    insert into responsable_jugador (club_id, jugador_id, email)
    select v_plantel.club_id, v_jugador, m
    from jsonb_array_elements_text(coalesce(v_fila->'mails', '[]'::jsonb)) as m
    on conflict (jugador_id, email) do nothing;
    get diagnostics v_filas = row_count;
    v_mails := v_mails + v_filas;
  end loop;

  return jsonb_build_object('creados', v_creados, 'existentes', v_existentes, 'mails', v_mails);
end;
$fn$;


/* =====================================================================
   4. Lo de la familia
   ===================================================================== */

-- Al entrar sin club: crea los vínculos que falten para el mail de quien
-- llama. Sólo con el mail verificado (Google lo trae verificado; con mail y
-- contraseña, después de confirmar). No reabre un vínculo cerrado: si el
-- coordinador lo dio de baja, volver a entrar no lo deshace.
create function vincular_por_mail()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_email text;
  v_nuevos integer;
begin
  if auth.uid() is null
     or exists (select 1 from public.miembro_club m where m.user_id = auth.uid())
     or exists (select 1 from public.cuenta_jugador c where c.user_id = auth.uid() and c.hasta is null) then
    raise exception 'Sólo para cuentas de familia.' using errcode = '42501';
  end if;

  select lower(btrim(u.email::text)) into v_email
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null or v_email = '' then
    return 0;
  end if;

  insert into public.vinculo_familia (user_id, club_id, jugador_id)
  select distinct auth.uid(), r.club_id, r.jugador_id
  from public.responsable_jugador r
  where r.email = v_email
    and not exists (
      select 1 from public.vinculo_familia v
      where v.user_id = auth.uid() and v.jugador_id = r.jugador_id);
  get diagnostics v_nuevos = row_count;
  return v_nuevos;
end;
$fn$;

-- Lo único que ve una familia: nombre y categoría de sus chicos. Ni un dato
-- de partido, medición o misión. Es lo que arranca su pantalla.
create function mis_chicos()
returns table (vinculo_id uuid, nombre text, club_nombre text, categorias text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select v.id, j.nombre_limpio, c.nombre,
         (select string_agg(ca.nombre, ', ' order by ca.orden)
          from public.pertenencia pe
          join public.plantel pl on pl.id = pe.plantel_id
          join public.categoria ca on ca.codigo = pl.categoria_codigo
          where pe.jugador_id = v.jugador_id and pe.hasta is null
            and pl.temporada_id = public.temporada_vigente_de(v.club_id))
  from public.vinculo_familia v
  join public.jugador j on j.id = v.jugador_id
  join public.club c on c.id = v.club_id
  where v.user_id = auth.uid() and v.hasta is null
  order by j.nombre_limpio;
$fn$;

-- Control posterior del coordinador (spec §6.2): los vínculos vigentes del
-- club, con quién y cuándo. Mail enmascarado, como solicitudes_del_plantel.
create function vinculos_familia_del_club(p_club_id uuid)
returns table (
  id uuid, jugador text, categorias text, desde timestamptz, via text,
  nombre text, email_enmascarado text
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if not public.es_coordinador_de(p_club_id) then
    raise exception 'Sólo coordinación.' using errcode = '42501';
  end if;

  return query
    select v.id, j.nombre_limpio,
           (select string_agg(ca.nombre, ', ' order by ca.orden)
            from public.pertenencia pe
            join public.plantel pl on pl.id = pe.plantel_id
            join public.categoria ca on ca.codigo = pl.categoria_codigo
            where pe.jugador_id = v.jugador_id and pe.hasta is null
              and pl.temporada_id = public.temporada_vigente_de(v.club_id)),
           v.desde, v.via,
           left(nullif(btrim(u.raw_user_meta_data->>'nombre'), ''), 80),
           left(u.email::text, 1) || '***@' || split_part(u.email::text, '@', 2)
    from public.vinculo_familia v
    join public.jugador j on j.id = v.jugador_id
    join auth.users u on u.id = v.user_id
    where v.club_id = p_club_id and v.hasta is null
    order by j.nombre_limpio, v.desde;
end;
$fn$;

create function cerrar_vinculo_familia(p_vinculo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_club uuid;
begin
  select v.club_id into v_club
  from public.vinculo_familia v
  where v.id = p_vinculo_id and v.hasta is null;
  if v_club is null or not public.es_coordinador_de(v_club) then
    raise exception 'VINCULO_NO_ENCONTRADO' using errcode = 'P0001';
  end if;
  -- El trigger pone la fecha y quién cerró.
  update public.vinculo_familia set hasta = now() where id = p_vinculo_id;
end;
$fn$;


/* =====================================================================
   5. Permisos de ejecución
   ===================================================================== */

revoke execute on function importar_inscriptos(jsonb)          from public, anon;
revoke execute on function vincular_por_mail()                 from public, anon;
revoke execute on function mis_chicos()                        from public, anon;
revoke execute on function vinculos_familia_del_club(uuid)     from public, anon;
revoke execute on function cerrar_vinculo_familia(uuid)        from public, anon;
revoke execute on function sellar_cierre_vinculo_familia()     from public, anon, authenticated;

grant execute on function importar_inscriptos(jsonb)           to authenticated;
grant execute on function vincular_por_mail()                  to authenticated;
grant execute on function mis_chicos()                         to authenticated;
grant execute on function vinculos_familia_del_club(uuid)      to authenticated;
grant execute on function cerrar_vinculo_familia(uuid)         to authenticated;
