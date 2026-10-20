-- Cambio de temporada y datos de emergencia del chico.
-- Spec: docs/superpowers/specs/2026-10-19-datos-conectados-design.md (§1 y §3).
--
-- 1. CAMBIO DE TEMPORADA: el coordinador abre la temporada nueva (copia los
--    planteles de la vigente) y pasa a cada chico a su plantel nuevo. No se
--    borra nada: las pertenencias viejas se cierran con el mecanismo de 0040
--    y la historia del jugador (0056) las sigue leyendo por temporada.
--
--    Excepción a 0018 ("el coordinador controla, no decide"): armar quién
--    está en qué plantel es estructura del club, como asignar profes (0017),
--    no contenido de entrenamiento. Por eso escribe por RPC `security
--    definer` con `es_coordinador_de`, sin tocar las policies de pertenencia.
--    Al coordinador se le muestra el AÑO de nacimiento, no la fecha.
--
-- 2. EMERGENCIA: teléfono del adulto, contacto de urgencia, alertas médicas
--    de una lista cerrada y tres textos cortos. Es salud de menores: la ve el
--    profe con el chico en un plantel suyo y el coordinador del club (decisión
--    de Tomás, 19/10; otra excepción a 0018, acotada a esta tabla). Nunca el
--    jugador ni la familia: ninguna función de 0029/0030/0057 la devuelve. Se
--    borra sola cuando el chico se queda sin plantel vigente.
--
-- Verificación: tests/verificar0059.sql. Rollback: tests/rollback0059.sql.

do $$
begin
  if to_regprocedure('public.temporada_vigente_de(uuid)') is null then
    raise exception '0059 necesita 0029 aplicada (no existe temporada_vigente_de).';
  end if;
  if to_regprocedure('public.sellar_cierre_pertenencia()') is null then
    raise exception '0059 necesita 0040 aplicada (no existe sellar_cierre_pertenencia).';
  end if;
end $$;


/* =====================================================================
   1. Cambio de temporada
   ===================================================================== */

-- Crea la temporada `p_nombre` (un año, mayor que la vigente) con los mismos
-- planteles que la vigente. Desde ese momento es la vigente para todo lo que
-- usa temporada_vigente_de y temporadaMasReciente.
create function abrir_temporada(p_club_id uuid, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_vigente uuid := public.temporada_vigente_de(p_club_id);
  v_nombre_vigente text;
  v_nueva uuid := gen_random_uuid();
begin
  if not public.es_coordinador_de(p_club_id) then
    raise exception 'SOLO_COORDINACION' using errcode = '42501';
  end if;
  if p_nombre is null or p_nombre !~ '^\d{4}$' then
    raise exception 'TEMPORADA_NO_ES_UN_ANIO' using errcode = 'P0001';
  end if;
  if v_vigente is null then
    raise exception 'SIN_TEMPORADA_VIGENTE' using errcode = 'P0001';
  end if;
  select t.nombre into v_nombre_vigente from public.temporada t where t.id = v_vigente;
  if p_nombre <= v_nombre_vigente then
    raise exception 'TEMPORADA_NO_ES_POSTERIOR' using errcode = 'P0001';
  end if;

  insert into public.temporada (id, club_id, nombre) values (v_nueva, p_club_id, p_nombre);
  insert into public.plantel (club_id, temporada_id, categoria, categoria_codigo, codigo_cabb)
  select pl.club_id, v_nueva, pl.categoria, pl.categoria_codigo, pl.codigo_cabb
  from public.plantel pl
  where pl.temporada_id = v_vigente;
  return v_nueva;
end;
$fn$;

-- Los chicos que siguen con pertenencia vigente en una temporada anterior a
-- la vigente: los que falta pasar. Año de nacimiento y no la fecha; los
-- códigos de categoría para deducir la rama (U15M → M).
create function pases_de_temporada(p_club_id uuid)
returns table (jugador_id uuid, nombre_limpio text, anio_nacimiento integer, codigos text[])
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if not public.es_coordinador_de(p_club_id) then
    raise exception 'SOLO_COORDINACION' using errcode = '42501';
  end if;
  return query
    select j.id, j.nombre_limpio,
           extract(year from j.fecha_nacimiento)::integer,
           array_agg(distinct pl.categoria_codigo order by pl.categoria_codigo)
    from public.pertenencia pe
    join public.jugador j on j.id = pe.jugador_id
    join public.plantel pl on pl.id = pe.plantel_id
    where pe.club_id = p_club_id
      and pe.hasta is null
      and pe.temporada_id <> public.temporada_vigente_de(p_club_id)
    group by j.id, j.nombre_limpio, j.fecha_nacimiento
    order by j.nombre_limpio;
end;
$fn$;

-- filas: [{ jugadorId, plantelId | null }]. plantelId null = "no sigue".
-- Todo o nada. Primero la pertenencia nueva y después el cierre de las
-- viejas: así el chico nunca queda sin plantel vigente en el medio y el
-- trigger de §2 no le borra la emergencia a quien sigue.
create function confirmar_pases(p_club_id uuid, p_filas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_nueva uuid := public.temporada_vigente_de(p_club_id);
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_fila jsonb;
  v_jugador uuid;
  v_plantel uuid;
  v_n integer := 0;
  v_pasados integer := 0;
  v_cerradas integer := 0;
  v_filas integer;
begin
  if not public.es_coordinador_de(p_club_id) then
    raise exception 'SOLO_COORDINACION' using errcode = '42501';
  end if;

  for v_fila in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) loop
    v_n := v_n + 1;
    v_jugador := (v_fila->>'jugadorId')::uuid;
    v_plantel := (v_fila->>'plantelId')::uuid;
    if not exists (select 1 from public.jugador j where j.id = v_jugador and j.club_id = p_club_id) then
      raise exception 'JUGADOR_DE_OTRO_CLUB (fila %)', v_n using errcode = 'P0001';
    end if;

    if v_plantel is not null then
      if not exists (select 1 from public.plantel pl
                     where pl.id = v_plantel and pl.club_id = p_club_id and pl.temporada_id = v_nueva) then
        raise exception 'PLANTEL_FUERA_DE_LA_TEMPORADA (fila %)', v_n using errcode = 'P0001';
      end if;
      insert into public.pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde)
      values (p_club_id, v_jugador, v_plantel, v_nueva, v_hoy)
      on conflict (jugador_id, plantel_id) where hasta is null do nothing;
      get diagnostics v_filas = row_count;
      v_pasados := v_pasados + v_filas;
    end if;

    -- El valor de hasta lo pisa sellar_cierre_pertenencia (0040) con la fecha
    -- de hoy y auth.uid() de quien confirma.
    update public.pertenencia pe set hasta = v_hoy
    where pe.jugador_id = v_jugador and pe.club_id = p_club_id
      and pe.hasta is null and pe.temporada_id <> v_nueva;
    get diagnostics v_filas = row_count;
    v_cerradas := v_cerradas + v_filas;
  end loop;

  return jsonb_build_object('pasados', v_pasados, 'cerradas', v_cerradas);
end;
$fn$;


/* =====================================================================
   2. Datos de emergencia
   ===================================================================== */

create table emergencia_jugador (
  jugador_id uuid primary key,
  club_id uuid not null references club(id),
  -- NULL = no se sabe. Texto libre: el formulario no valida el formato.
  telefono_adulto text check (char_length(telefono_adulto) <= 30),
  contacto_urgencia text check (char_length(contacto_urgencia) <= 80),
  -- Lista cerrada: las casillas del formulario del club. '{}' = ninguna
  -- marcada en la inscripción (la pregunta no es obligatoria, así que no
  -- prueba que no tenga nada). Sumar una es una migración: tests/contratoEmergencia.test.js.
  alertas text[] not null default '{}' check (alertas <@ array[
    'desmayos', 'taquicardia', 'convulsiones', 'epilepsia', 'meningitis',
    'diabetes', 'perdida_conocimiento', 'asma']::text[]),
  alergias text check (char_length(alergias) <= 300),
  medicacion text check (char_length(medicacion) <= 300),
  indicacion text check (char_length(indicacion) <= 300),
  obra_social text check (char_length(obra_social) <= 60),
  actualizado_por uuid not null default auth.uid() references auth.users(id),
  actualizado_en timestamptz not null default now(),
  foreign key (club_id, jugador_id) references jugador (club_id, id)
);

create index emergencia_jugador_club_id_idx on emergencia_jugador(club_id);

create function sellar_emergencia()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'UPDATE' then
    new.jugador_id := old.jugador_id;
    new.club_id := old.club_id;
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$fn$;

create trigger emergencia_sellar
  before insert or update on emergencia_jugador
  for each row execute function sellar_emergencia();

-- Minimización: cuando el chico se queda sin ninguna pertenencia vigente (se
-- fue, o "no sigue" en el cambio de temporada), su emergencia se borra. Es
-- definer porque quien cierra la pertenencia no tiene delete sobre la tabla.
create function borrar_emergencia_sin_plantel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if (tg_op = 'DELETE' or new.hasta is not null)
     and not exists (select 1 from public.pertenencia pe
                     where pe.jugador_id = old.jugador_id and pe.hasta is null) then
    delete from public.emergencia_jugador e where e.jugador_id = old.jugador_id;
  end if;
  return null;
end;
$fn$;

create trigger pertenencia_borra_emergencia
  after update or delete on pertenencia
  for each row execute function borrar_emergencia_sin_plantel();

alter table emergencia_jugador enable row level security;

create policy emergencia_ver on emergencia_jugador
  for select using (
    es_coordinador_de(emergencia_jugador.club_id)
    or exists (select 1 from pertenencia pe
               where pe.jugador_id = emergencia_jugador.jugador_id and pe.hasta is null
                 and puede_ver_plantel(pe.plantel_id)));

create policy emergencia_cargar on emergencia_jugador
  for insert with check (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = emergencia_jugador.jugador_id and pe.hasta is null
      and pe.club_id = emergencia_jugador.club_id
      and puede_escribir_plantel(pe.plantel_id)));

create policy emergencia_corregir on emergencia_jugador
  for update using (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = emergencia_jugador.jugador_id and pe.hasta is null
      and puede_escribir_plantel(pe.plantel_id)))
  with check (exists (
    select 1 from pertenencia pe
    where pe.jugador_id = emergencia_jugador.jugador_id and pe.hasta is null
      and puede_escribir_plantel(pe.plantel_id)));

-- Sin delete: la fila se pisa al reimportar y se borra sola (trigger de
-- arriba). El cliente no manda autoría ni fechas.
revoke all on emergencia_jugador from anon, authenticated;
grant select on emergencia_jugador to authenticated;
grant insert (jugador_id, club_id, telefono_adulto, contacto_urgencia, alertas,
              alergias, medicacion, indicacion, obra_social) on emergencia_jugador to authenticated;
grant update (telefono_adulto, contacto_urgencia, alertas,
              alergias, medicacion, indicacion, obra_social) on emergencia_jugador to authenticated;

comment on table emergencia_jugador is
  'Datos de emergencia del chico (salud de menores). Ven el profe del plantel y el coordinador; nunca jugador ni familia. Se borra sin plantel vigente. v0059.';

-- Plantel → "Importar emergencias". payload: { plantelId, filas: [{ jugadorId,
-- telefonoAdulto, contactoUrgencia, alertas[], alergias, medicacion,
-- indicacion, obraSocial }] }. Pisa lo anterior. Invoker: RLS decide; el
-- chequeo de abajo sólo da un error claro y ata cada fila a ESTE plantel.
create function importar_emergencias(payload jsonb)
returns jsonb
language plpgsql
security invoker
as $fn$
declare
  v_plantel record;
  v_fila jsonb;
  v_jugador uuid;
  v_n integer := 0;
begin
  select pl.id, pl.club_id into v_plantel
  from plantel pl where pl.id = (payload->>'plantelId')::uuid;
  if not found or not puede_escribir_plantel(v_plantel.id) then
    raise exception 'PLANTEL_NO_PERMITIDO' using errcode = '42501';
  end if;

  for v_fila in select * from jsonb_array_elements(coalesce(payload->'filas', '[]'::jsonb)) loop
    v_n := v_n + 1;
    v_jugador := (v_fila->>'jugadorId')::uuid;
    if not exists (select 1 from pertenencia pe
                   where pe.jugador_id = v_jugador and pe.plantel_id = v_plantel.id and pe.hasta is null) then
      raise exception 'JUGADOR_FUERA_DEL_PLANTEL (fila %)', v_n using errcode = 'P0001';
    end if;
    insert into emergencia_jugador (jugador_id, club_id, telefono_adulto, contacto_urgencia, alertas,
                                    alergias, medicacion, indicacion, obra_social)
    values (v_jugador, v_plantel.club_id,
            nullif(btrim(v_fila->>'telefonoAdulto'), ''),
            nullif(btrim(v_fila->>'contactoUrgencia'), ''),
            coalesce(array(select jsonb_array_elements_text(v_fila->'alertas')), '{}'),
            nullif(btrim(v_fila->>'alergias'), ''),
            nullif(btrim(v_fila->>'medicacion'), ''),
            nullif(btrim(v_fila->>'indicacion'), ''),
            nullif(btrim(v_fila->>'obraSocial'), ''))
    on conflict (jugador_id) do update set
      telefono_adulto = excluded.telefono_adulto,
      contacto_urgencia = excluded.contacto_urgencia,
      alertas = excluded.alertas,
      alergias = excluded.alergias,
      medicacion = excluded.medicacion,
      indicacion = excluded.indicacion,
      obra_social = excluded.obra_social;
  end loop;

  return jsonb_build_object('guardados', v_n);
end;
$fn$;

-- La lista de emergencia de un plantel, con el nombre de cada chico (el
-- coordinador no lee `jugador` desde 0018). Los chicos sin datos también
-- salen, con todo en NULL: el profe tiene que ver a quién le falta.
create function emergencias_del_plantel(p_plantel_id uuid)
returns table (
  jugador_id uuid, nombre_limpio text,
  telefono_adulto text, contacto_urgencia text, alertas text[],
  alergias text, medicacion text, indicacion text, obra_social text,
  actualizado_en timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_club uuid;
begin
  select pl.club_id into v_club from public.plantel pl where pl.id = p_plantel_id;
  if v_club is null
     or not (public.es_coordinador_de(v_club) or public.puede_ver_plantel(p_plantel_id)) then
    raise exception 'PLANTEL_NO_PERMITIDO' using errcode = '42501';
  end if;
  return query
    select j.id, j.nombre_limpio,
           e.telefono_adulto, e.contacto_urgencia, e.alertas,
           e.alergias, e.medicacion, e.indicacion, e.obra_social,
           e.actualizado_en
    from public.pertenencia pe
    join public.jugador j on j.id = pe.jugador_id
    left join public.emergencia_jugador e on e.jugador_id = j.id
    where pe.plantel_id = p_plantel_id and pe.hasta is null
    order by j.nombre_limpio;
end;
$fn$;


/* =====================================================================
   3. Permisos de ejecución
   ===================================================================== */

revoke execute on function abrir_temporada(uuid, text)           from public, anon;
revoke execute on function pases_de_temporada(uuid)              from public, anon;
revoke execute on function confirmar_pases(uuid, jsonb)          from public, anon;
revoke execute on function importar_emergencias(jsonb)           from public, anon;
revoke execute on function emergencias_del_plantel(uuid)         from public, anon;
revoke execute on function sellar_emergencia()                   from public, anon, authenticated;
revoke execute on function borrar_emergencia_sin_plantel()       from public, anon, authenticated;

grant execute on function abrir_temporada(uuid, text)            to authenticated;
grant execute on function pases_de_temporada(uuid)               to authenticated;
grant execute on function confirmar_pases(uuid, jsonb)           to authenticated;
grant execute on function importar_emergencias(jsonb)            to authenticated;
grant execute on function emergencias_del_plantel(uuid)          to authenticated;
