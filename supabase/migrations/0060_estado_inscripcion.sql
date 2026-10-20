-- Estado de papeles y pagos de cada chico, que manda el script de Google del club.
-- Ver docs/superpowers/specs/2026-10-19-panel-docs-pagos-design.md.
--
-- Es lo PRIMERO de afuera que escribe en la base: el Apps Script del club
-- llama a empujar_estado_google con la clave pública (anon) y un token del
-- club. Por eso:
-- - Las dos tablas no tienen ningún grant: sólo se tocan por estas funciones.
-- - El token se guarda hasheado (sha256). Es de 32 bytes al azar: no hace
--   falta un hash lento.
-- - El token sólo reemplaza el estado de SU club. No lee nada ni devuelve datos.
-- - Llega sólo estado (✅/❌, falta/subido/verificado). Un texto con 7 o más
--   dígitos seguidos tira el envío entero: un DNI no entra ni por error.

create table conexion_google (
  club_id uuid primary key references club(id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Quién generó el token vigente y cuándo. Los sella el trigger.
  rotado_por uuid references auth.users(id) on delete set null,
  rotado_en timestamptz not null default now(),
  ultimo_envio_en timestamptz,
  -- Lo manda el script en cada envío: la app arma con esto el link a la fila
  -- de cada chico (…/edit#gid=<gid>&range=A<fila>). Sólo la base de la URL.
  tablero_url text check (char_length(tablero_url) <= 200
    and tablero_url ~ '^https://docs\.google\.com/spreadsheets/d/[A-Za-z0-9_-]{20,100}$'),
  gid_tablero bigint check (gid_tablero >= 0),
  gid_pagos bigint check (gid_pagos >= 0),
  -- Los encabezados del tablero, en su orden: un jsonb no guarda el orden de
  -- sus claves. Un concepto nuevo en Config aparece solo en el panel.
  documentos_orden text[] not null default '{}',
  conceptos_orden text[] not null default '{}'
);

create table estado_inscripcion (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  apellido text not null check (char_length(apellido) <= 80),
  nombre text not null check (char_length(nombre) <= 80),
  -- clave_inscripcion('Apellido, Nombre'): la misma que jugador.nombre_clave.
  clave text not null,
  -- null = el tablero no la tiene (no se sabe). No sale nunca hacia el cliente.
  fecha_nacimiento date,
  categoria_texto text check (char_length(categoria_texto) <= 80),
  rama text check (rama in ('Masculino', 'Femenino')),
  -- Número de fila en las hojas Tablero y Pagos (están alineadas).
  fila integer not null check (fila between 2 and 5000),
  documentos jsonb not null default '{}' check (jsonb_typeof(documentos) = 'object'),
  completo boolean,
  pagos jsonb not null default '{}' check (jsonb_typeof(pagos) = 'object'),
  creado_en timestamptz not null default now(),
  -- Cuándo cambió SU estado (documentos, completo o pagos), no cada envío.
  cambio_en timestamptz not null default now(),
  constraint estado_inscripcion_nombres_no_vacios check (apellido <> '' and nombre <> '')
);

-- nulls not distinct: dos filas del mismo nombre sin fecha son el mismo chico.
create unique index estado_inscripcion_unico
  on estado_inscripcion (club_id, clave, fecha_nacimiento) nulls not distinct;


/* ---------- Sellado ---------- */

create function sellar_conexion_google()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.club_id := old.club_id;
    if new.token_hash is not distinct from old.token_hash then
      new.rotado_por := old.rotado_por;
      new.rotado_en := old.rotado_en;
      return new;
    end if;
  end if;
  new.rotado_por := auth.uid();
  new.rotado_en := now();
  return new;
end;
$$;

create trigger conexion_google_sellar
  before insert or update on conexion_google
  for each row execute function sellar_conexion_google();

create function sellar_estado_inscripcion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.club_id := old.club_id;
  new.creado_en := old.creado_en;
  return new;
end;
$$;

create trigger estado_inscripcion_sellar
  before update on estado_inscripcion
  for each row execute function sellar_estado_inscripcion();


/* ---------- Funciones ---------- */

-- Igual que clavearNombre (src/parser/parserCabb.js): mayúsculas, sin tildes,
-- sin comas, espacios colapsados. translate antes de upper porque upper no
-- garantiza las letras con tilde en todas las configuraciones regionales.
-- tests/contratoEstadoInscripcion.test.js compara las dos letra por letra.
create function clave_inscripcion(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select btrim(regexp_replace(replace(upper(translate(coalesce(p_texto, ''),
    'áàâäãéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')), ',', ''), '\s+', ' ', 'g'));
$fn$;

-- El coordinador genera (o cambia) el token. Se ve UNA vez: en la base queda
-- el hash. Cambiarlo deja al anterior sin efecto en el acto.
create function rotar_conexion_google(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_token text;
begin
  if not public.es_coordinador_de(p_club_id) then
    raise exception 'Sólo coordinación.' using errcode = '42501';
  end if;
  -- 32 bytes en base64 url-safe y sin relleno: 43 caracteres.
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into public.conexion_google (club_id, token_hash)
  values (p_club_id, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  on conflict (club_id) do update set token_hash = excluded.token_hash;
  return v_token;
end;
$fn$;

-- Borra el token y todo el estado del club.
create function desconectar_google(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not public.es_coordinador_de(p_club_id) then
    raise exception 'Sólo coordinación.' using errcode = '42501';
  end if;
  delete from public.estado_inscripcion where club_id = p_club_id;
  delete from public.conexion_google where club_id = p_club_id;
end;
$fn$;

-- La llama el script del club. p_envio:
-- { tableroUrl, gidTablero, gidPagos, documentosOrden: [..], conceptosOrden: [..],
--   filas: [{ fila, apellido, nombre, fechaNacimiento ('aaaa-mm-dd'|null),
--             categoria, rama, documentos: {titulo: bool}, completo, pagos: {concepto: estado} }] }
-- Reemplaza el estado del club: lo que no vino se borra. Una fila repetida
-- (mismo nombre y fecha) se saltea y se cuenta, no pisa a la primera.
create function empujar_estado_google(p_token text, p_envio jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_club uuid;
  v_ultimo timestamptz;
  v_filas jsonb;
  v_f jsonb;
  v_docs text[];
  v_conceptos text[];
  v_texto text;
  v_clave text;
  v_fecha date;
  v_rama text;
  v_id uuid;
  v_vistas text[] := '{}';
  v_ids uuid[] := '{}';
  v_repetidas integer := 0;
begin
  -- Antes de tocar una tabla: un token mal formado no cuesta una búsqueda.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'TOKEN_INVALIDO' using errcode = '28000';
  end if;
  select c.club_id, c.ultimo_envio_en into v_club, v_ultimo
  from public.conexion_google c
  where c.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;
  if v_club is null then
    raise exception 'TOKEN_INVALIDO' using errcode = '28000';
  end if;
  -- El for update de arriba ordena dos envíos simultáneos: el segundo ve la hora del primero.
  if v_ultimo > now() - interval '60 seconds' then
    raise exception 'ENVIO_MUY_SEGUIDO';
  end if;

  if p_envio is null or jsonb_typeof(p_envio) <> 'object' or octet_length(p_envio::text) > 1048576 then
    raise exception 'ENVIO_INVALIDO: no es un objeto o pasa de 1 MB';
  end if;
  v_filas := p_envio->'filas';
  if jsonb_typeof(v_filas) is distinct from 'array' or jsonb_array_length(v_filas) > 1500 then
    raise exception 'ENVIO_INVALIDO: filas tiene que ser una lista de hasta 1500';
  end if;
  if jsonb_typeof(p_envio->'gidTablero') is distinct from 'number'
     or jsonb_typeof(p_envio->'gidPagos') is distinct from 'number' then
    raise exception 'ENVIO_INVALIDO: faltan los gid';
  end if;

  -- Los encabezados: hasta 25 por lista, de hasta 60 caracteres, sin dígitos de DNI.
  foreach v_texto in array array['documentosOrden', 'conceptosOrden'] loop
    if jsonb_typeof(p_envio->v_texto) is distinct from 'array'
       or jsonb_array_length(p_envio->v_texto) > 25
       or exists (select 1 from jsonb_array_elements(p_envio->v_texto) e
                  where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') not between 1 and 60) then
      raise exception 'ENVIO_INVALIDO: % (hasta 25 textos de 1 a 60 caracteres)', v_texto;
    end if;
    if exists (select 1 from jsonb_array_elements_text(p_envio->v_texto) t where t ~ '[0-9]{7}') then
      raise exception 'PARECE_DNI';
    end if;
  end loop;
  select coalesce(array_agg(t), '{}') into v_docs from jsonb_array_elements_text(p_envio->'documentosOrden') t;
  select coalesce(array_agg(t), '{}') into v_conceptos from jsonb_array_elements_text(p_envio->'conceptosOrden') t;

  for v_f in select * from jsonb_array_elements(v_filas) loop
    if jsonb_typeof(v_f) <> 'object'
       or jsonb_typeof(v_f->'apellido') is distinct from 'string'
       or jsonb_typeof(v_f->'nombre') is distinct from 'string'
       or char_length(btrim(v_f->>'apellido')) not between 1 and 80
       or char_length(btrim(v_f->>'nombre')) not between 1 and 80
       or jsonb_typeof(v_f->'fila') is distinct from 'number'
       or (v_f->>'fila') !~ '^[0-9]{1,4}$'
       or coalesce(jsonb_typeof(v_f->'categoria'), 'null') not in ('string', 'null')
       or char_length(v_f->>'categoria') > 80
       or coalesce(jsonb_typeof(v_f->'completo'), 'null') not in ('boolean', 'null')
       or jsonb_typeof(coalesce(v_f->'documentos', '{}')) <> 'object'
       or jsonb_typeof(coalesce(v_f->'pagos', '{}')) <> 'object' then
      raise exception 'ENVIO_INVALIDO: fila %', coalesce(v_f->>'fila', '?');
    end if;
    if concat_ws(' ', v_f->>'apellido', v_f->>'nombre', v_f->>'categoria') ~ '[0-9]{7}' then
      raise exception 'PARECE_DNI';
    end if;
    if exists (select 1 from jsonb_each(coalesce(v_f->'documentos', '{}')) d
               where not (d.key = any(v_docs)) or jsonb_typeof(d.value) <> 'boolean')
       or exists (select 1 from jsonb_each(coalesce(v_f->'pagos', '{}')) p
                  where not (p.key = any(v_conceptos))
                     or coalesce(p.value #>> '{}', '') not in ('falta', 'subido', 'verificado')) then
      raise exception 'ENVIO_INVALIDO: documentos o pagos de la fila %', v_f->>'fila';
    end if;

    v_fecha := null;
    if coalesce(jsonb_typeof(v_f->'fechaNacimiento'), 'null') <> 'null' then
      if (v_f->>'fechaNacimiento') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'ENVIO_INVALIDO: fecha de la fila %', v_f->>'fila';
      end if;
      v_fecha := (v_f->>'fechaNacimiento')::date;
    end if;
    v_rama := nullif(btrim(coalesce(v_f->>'rama', '')), '');
    if v_rama is not null and v_rama not in ('Masculino', 'Femenino') then
      raise exception 'ENVIO_INVALIDO: rama de la fila %', v_f->>'fila';
    end if;

    v_clave := public.clave_inscripcion(btrim(v_f->>'apellido') || ', ' || btrim(v_f->>'nombre'));
    if (v_clave || '|' || coalesce(v_fecha::text, '')) = any(v_vistas) then
      v_repetidas := v_repetidas + 1;
      continue;
    end if;
    v_vistas := v_vistas || (v_clave || '|' || coalesce(v_fecha::text, ''));

    insert into public.estado_inscripcion as e
      (club_id, apellido, nombre, clave, fecha_nacimiento, categoria_texto, rama,
       fila, documentos, completo, pagos)
    values
      (v_club, btrim(v_f->>'apellido'), btrim(v_f->>'nombre'), v_clave, v_fecha,
       nullif(btrim(coalesce(v_f->>'categoria', '')), ''), v_rama,
       (v_f->>'fila')::integer, coalesce(v_f->'documentos', '{}'),
       (v_f->>'completo')::boolean, coalesce(v_f->'pagos', '{}'))
    on conflict (club_id, clave, fecha_nacimiento) do update set
      apellido = excluded.apellido,
      nombre = excluded.nombre,
      categoria_texto = excluded.categoria_texto,
      rama = excluded.rama,
      fila = excluded.fila,
      documentos = excluded.documentos,
      completo = excluded.completo,
      pagos = excluded.pagos,
      cambio_en = case
        when (e.documentos, e.completo, e.pagos) is distinct from
             (excluded.documentos, excluded.completo, excluded.pagos) then now()
        else e.cambio_en end
    returning e.id into v_id;
    v_ids := v_ids || v_id;
  end loop;

  delete from public.estado_inscripcion
  where club_id = v_club and not (id = any(v_ids));

  update public.conexion_google set
    ultimo_envio_en = now(),
    tablero_url = p_envio->>'tableroUrl',
    gid_tablero = (p_envio->>'gidTablero')::bigint,
    gid_pagos = (p_envio->>'gidPagos')::bigint,
    documentos_orden = v_docs,
    conceptos_orden = v_conceptos
  where club_id = v_club;

  return jsonb_build_object('guardadas', cardinality(v_ids), 'repetidas', v_repetidas);
end;
$fn$;

-- El panel del coordinador: una fila por chico, ya emparejada con las fichas
-- del club con el criterio de cruzarConPadron (src/data/inscriptos.js):
-- - 'ok': misma clave y misma fecha, o una sola ficha con esa clave y sin fecha.
-- - 'homonimo': la clave existe pero no se puede decidir cuál es.
-- - 'sin_ficha': nadie con esa clave en el club.
-- - 'sin_tablero': tiene plantel esta temporada y no está en el tablero.
-- Se cruza contra TODAS las fichas del club (un chico de la temporada pasada
-- sigue siendo él); la categoría sale del plantel vigente si tiene.
-- Nunca devuelve la fecha de nacimiento. Ordena por nombre e id para que el
-- cliente pueda paginar sin saltear ni repetir (max-rows de PostgREST).
create function estado_inscripcion_del_club(p_club_id uuid)
returns table (
  id uuid, nombre text, nombre_google text, categoria_codigo text,
  categoria_texto text, rama text, emparejamiento text, fila integer,
  documentos jsonb, completo boolean, pagos jsonb, cambio_en timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_temporada uuid := public.temporada_vigente_de(p_club_id);
begin
  if not public.es_coordinador_de(p_club_id) then
    raise exception 'Sólo coordinación.' using errcode = '42501';
  end if;

  return query
    with fichas as (
      select j.id, j.nombre_clave, j.nombre_limpio, j.fecha_nacimiento,
             (select pl.categoria_codigo
              from public.pertenencia pe
              join public.plantel pl on pl.id = pe.plantel_id
              left join public.categoria ca on ca.codigo = pl.categoria_codigo
              where pe.jugador_id = j.id and pe.hasta is null and pl.temporada_id = v_temporada
              order by ca.orden nulls last
              limit 1) as categoria_codigo
      from public.jugador j
      where j.club_id = p_club_id
    ),
    cruce as (
      select e.*,
        coalesce(
          (select f.id from fichas f
           where f.nombre_clave = e.clave and f.fecha_nacimiento is not distinct from e.fecha_nacimiento
           limit 1),
          (select min(f.id::text)::uuid from fichas f
           where f.nombre_clave = e.clave
           having count(*) = 1 and count(f.fecha_nacimiento) = 0)
        ) as jugador_id,
        exists (select 1 from fichas f where f.nombre_clave = e.clave) as hay_clave
      from public.estado_inscripcion e
      where e.club_id = p_club_id
    )
    select c.id,
           coalesce(f.nombre_limpio, c.apellido || ', ' || c.nombre),
           c.apellido || ', ' || c.nombre,
           f.categoria_codigo,
           c.categoria_texto,
           c.rama,
           case when c.jugador_id is not null then 'ok'
                when c.hay_clave then 'homonimo'
                else 'sin_ficha' end,
           c.fila, c.documentos, c.completo, c.pagos, c.cambio_en
    from cruce c
    left join fichas f on f.id = c.jugador_id
    union all
    -- Sin conexión no hay tablero: nadie "falta" en él.
    select f.id, f.nombre_limpio, null, f.categoria_codigo, null, null, 'sin_tablero',
           null, '{}'::jsonb, null, '{}'::jsonb, null
    from fichas f
    where f.categoria_codigo is not null
      and exists (select 1 from public.conexion_google g
                  where g.club_id = p_club_id and g.ultimo_envio_en is not null)
      and not exists (select 1 from cruce c where c.jugador_id = f.id)
    order by 2, 1;
end;
$fn$;

create function conexion_google_del_club(p_club_id uuid)
returns table (
  conectado boolean, rotado_en timestamptz, ultimo_envio_en timestamptz,
  tablero_url text, gid_tablero bigint, gid_pagos bigint,
  documentos_orden text[], conceptos_orden text[]
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
    select g.club_id is not null, g.rotado_en, g.ultimo_envio_en, g.tablero_url,
           g.gid_tablero, g.gid_pagos,
           coalesce(g.documentos_orden, '{}'), coalesce(g.conceptos_orden, '{}')
    from (select p_club_id as club) x
    left join public.conexion_google g on g.club_id = x.club;
end;
$fn$;


/* ---------- RLS y permisos ---------- */

-- Sin políticas: con RLS activa y sin grants, nadie lee ni escribe directo.
alter table conexion_google enable row level security;
alter table estado_inscripcion enable row level security;

revoke all on conexion_google from anon, authenticated;
revoke all on estado_inscripcion from anon, authenticated;

revoke execute on function clave_inscripcion(text)                 from public, anon, authenticated;
revoke execute on function sellar_conexion_google()                from public, anon, authenticated;
revoke execute on function sellar_estado_inscripcion()             from public, anon, authenticated;
revoke execute on function rotar_conexion_google(uuid)             from public, anon;
revoke execute on function desconectar_google(uuid)                from public, anon;
revoke execute on function empujar_estado_google(text, jsonb)      from public;
revoke execute on function estado_inscripcion_del_club(uuid)       from public, anon;
revoke execute on function conexion_google_del_club(uuid)          from public, anon;

-- La única función que anon puede llamar: la valida el token, no la sesión.
grant execute on function empujar_estado_google(text, jsonb)       to anon, authenticated;
grant execute on function rotar_conexion_google(uuid)              to authenticated;
grant execute on function desconectar_google(uuid)                 to authenticated;
grant execute on function estado_inscripcion_del_club(uuid)        to authenticated;
grant execute on function conexion_google_del_club(uuid)           to authenticated;

comment on table conexion_google is
  'Token del script de Google del club (sólo su sha256) y datos del tablero para armar links. Sin grants: sólo por funciones. v0060.';
comment on table estado_inscripcion is
  'Estado de papeles y pagos por chico, como lo manda el script del club. Sin DNI ni archivos. Sin grants: sólo por funciones. v0060.';
comment on function empujar_estado_google(text, jsonb) is
  'La llama el Apps Script del club con la clave anon y su token. Reemplaza el estado del club. v0060.';
