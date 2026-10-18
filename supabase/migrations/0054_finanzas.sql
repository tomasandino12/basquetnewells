-- Finanzas del básquet: rubros y movimientos de plata, carga interna.
-- Ver docs/superpowers/specs/2026-10-16-finanzas-design.md.
--
-- Lee y escribe sólo coordinación (es_coordinador_de, 0017), tenga o no
-- también el rol de entrenador. Un profe sin rol de coordinador no ve ni una
-- fila de estas tres tablas: es otro dominio y no le toca. No se toca ninguna
-- policy de lo deportivo.
--
-- Es plata: nada se borra de verdad. Un rubro se desactiva; un movimiento se
-- marca borrado, y cada edición o baja deja una copia de cómo estaba la fila
-- en movimiento_cambio.

create table rubro (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  -- Genérico ("Arbitrajes", "Patrocinios"), nunca una persona: lo que hoy es
  -- interno mañana puede publicarse como resumen.
  nombre text not null check (char_length(nombre) <= 60),
  -- El signo de cada movimiento sale de acá: el monto siempre es positivo.
  -- No tiene grant de update: cambiarlo daría vuelta el signo de todo lo
  -- cargado con ese rubro.
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  -- Desactivado: no se ofrece al cargar, pero sigue sumando en los meses
  -- donde se usó.
  activo boolean not null default true,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_por uuid not null default auth.uid() references auth.users(id),
  actualizado_en timestamptz not null default now(),
  constraint rubro_nombre_recortado check (nombre = btrim(nombre) and nombre <> ''),
  -- Destino de la FK compuesta de movimiento.
  constraint rubro_club_id_unico unique (club_id, id)
);

-- "Arbitrajes" y "arbitrajes" son el mismo rubro.
create unique index rubro_nombre_unico on rubro (club_id, lower(nombre));

create table movimiento (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  rubro_id uuid not null,
  fecha date not null check (fecha >= '2000-01-01'),
  -- numeric y no float: la plata no se redondea. Positivo siempre.
  monto numeric(12,2) not null check (monto > 0),
  descripcion text not null default '' check (char_length(descripcion) <= 300),
  -- Link al comprobante (Drive u otro). La app no aloja archivos.
  comprobante_url text check (char_length(comprobante_url) <= 2048),
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_por uuid not null default auth.uid() references auth.users(id),
  actualizado_en timestamptz not null default now(),
  -- Baja lógica: el cliente manda cualquier borrado_en y el trigger lo pisa
  -- con la hora y el usuario del servidor, como asignacion_plantel.hasta.
  borrado_por uuid references auth.users(id),
  borrado_en timestamptz,
  -- Un movimiento no puede apuntar a un rubro de otro club.
  constraint movimiento_rubro_del_club
    foreign key (club_id, rubro_id) references rubro (club_id, id),
  constraint movimiento_comprobante_https check (comprobante_url ~ '^https://'),
  constraint movimiento_descripcion_recortada check (descripcion = btrim(descripcion)),
  constraint movimiento_borrado_completo check ((borrado_en is null) = (borrado_por is null))
);

create index movimiento_club_fecha_idx on movimiento (club_id, fecha);
create index movimiento_rubro_idx on movimiento (rubro_id);

-- El rastro: cómo estaba la fila antes de cada edición o baja. Lo escribe
-- sólo el trigger de abajo; el cliente no tiene ningún grant de escritura.
create table movimiento_cambio (
  id bigint generated always as identity primary key,
  movimiento_id uuid not null references movimiento(id),
  club_id uuid not null references club(id),
  accion text not null check (accion in ('edicion', 'baja')),
  antes jsonb not null,
  cambiado_por uuid not null references auth.users(id),
  cambiado_en timestamptz not null default now()
);

create index movimiento_cambio_movimiento_idx on movimiento_cambio (movimiento_id);


/* ---------- Sellado y rastro ---------- */

create function sellar_rubro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger rubro_sellar
  before insert or update on rubro
  for each row execute function sellar_rubro();

create function sellar_movimiento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Una fila borrada queda como quedó: ni se edita ni se "desborra".
    if old.borrado_en is not null then
      raise exception 'MOVIMIENTO_BORRADO' using errcode = 'P0001';
    end if;
    if new.borrado_en is not null then
      -- Una baja no cambia nada más: lo que se borra es lo que estaba.
      new.rubro_id := old.rubro_id;
      new.fecha := old.fecha;
      new.monto := old.monto;
      new.descripcion := old.descripcion;
      new.comprobante_url := old.comprobante_url;
      new.borrado_en := now();
      new.borrado_por := auth.uid();
    end if;
  end if;
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger movimiento_sellar
  before insert or update on movimiento
  for each row execute function sellar_movimiento();

-- security definer: escribe en movimiento_cambio, donde el cliente no tiene
-- grant. Corre dentro de la misma sentencia que la edición: o quedan las dos
-- cosas o ninguna.
create function registrar_cambio_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.movimiento_cambio (movimiento_id, club_id, accion, antes, cambiado_por)
  values (old.id, old.club_id,
          case when new.borrado_en is not null then 'baja' else 'edicion' end,
          to_jsonb(old), auth.uid());
  return null;
end;
$$;

create trigger movimiento_registrar_cambio
  after update on movimiento
  for each row execute function registrar_cambio_movimiento();


/* ---------- RLS ---------- */

alter table rubro enable row level security;
alter table movimiento enable row level security;
alter table movimiento_cambio enable row level security;

create policy rubro_coordinador_lee on rubro
  for select using (es_coordinador_de(rubro.club_id));
create policy rubro_coordinador_agrega on rubro
  for insert with check (es_coordinador_de(rubro.club_id));
create policy rubro_coordinador_edita on rubro
  for update using (es_coordinador_de(rubro.club_id))
  with check (es_coordinador_de(rubro.club_id));

-- Lee también los borrados: el rastro es parte de lo que el coordinador
-- puede revisar. La vista del mes los filtra.
create policy movimiento_coordinador_lee on movimiento
  for select using (es_coordinador_de(movimiento.club_id));
create policy movimiento_coordinador_agrega on movimiento
  for insert with check (es_coordinador_de(movimiento.club_id));
create policy movimiento_coordinador_edita on movimiento
  for update using (es_coordinador_de(movimiento.club_id))
  with check (es_coordinador_de(movimiento.club_id));

create policy movimiento_cambio_coordinador_lee on movimiento_cambio
  for select using (es_coordinador_de(movimiento_cambio.club_id));

-- Supabase concede ALL por defecto sobre tablas nuevas (ver 0017): se revoca
-- todo y se concede lo mínimo, por columna. Sin delete en ninguna: es plata.
-- El cliente no manda autoría ni fechas, no cambia el club de nada ni el tipo
-- de un rubro.
revoke all on rubro from anon, authenticated;
revoke all on movimiento from anon, authenticated;
revoke all on movimiento_cambio from anon, authenticated;

grant select on rubro to authenticated;
grant insert (club_id, nombre, tipo) on rubro to authenticated;
grant update (nombre, activo) on rubro to authenticated;

grant select on movimiento to authenticated;
grant insert (club_id, rubro_id, fecha, monto, descripcion, comprobante_url) on movimiento to authenticated;
grant update (rubro_id, fecha, monto, descripcion, comprobante_url, borrado_en) on movimiento to authenticated;

grant select on movimiento_cambio to authenticated;

revoke execute on function registrar_cambio_movimiento() from public, anon, authenticated;

comment on table rubro is
  'Rubros de ingresos y egresos del básquet. El tipo da el signo y no cambia. Sólo coordinación. v0054.';
comment on table movimiento is
  'Movimientos de plata: monto positivo, signo por el rubro, baja lógica sellada por trigger. Sólo coordinación. v0054.';
comment on table movimiento_cambio is
  'Rastro de movimiento: la fila como estaba antes de cada edición o baja. Lo escribe un trigger. v0054.';
