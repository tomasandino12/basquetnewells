-- Misiones del partido: lo que el profe le pide a cada chico y al equipo antes
-- de jugar, y cómo salió. Ver docs/superpowers/specs/2026-10-16-misiones-partido-design.md.
--
-- Número: 0055 porque 0054 es de feat/finanzas. Si se mergea antes que
-- finanzas, se renumera al hacer db push (todavía no está aplicada).
--
-- La previa se carga antes de que exista el partido: el partido nace con el
-- import del .xlsx. Por eso la misión cuelga de previa_partido (plantel +
-- fecha + rival opcional) y no de partido. partido_id queda nulo hasta que el
-- profe evalúa o elige a mano; el emparejamiento por fecha lo calcula
-- src/data/misiones.js (vincularPrevias). Así importar_partido no cambia.
--
-- Las listas de métricas y estados son las de src/data/misiones.js;
-- tests/contratoMisiones.test.js las compara, igual que los largos.

/* ---------- previa_partido ---------- */

create table previa_partido (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  plantel_id uuid not null,
  fecha date not null,
  -- Opcional: sirve para desempatar dos partidos el mismo día. Null, nunca ''.
  rival text check (char_length(rival) <= 120),
  partido_id uuid,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  unique (club_id, id),
  constraint previa_rival_recortado check (rival is null or (rival = btrim(rival) and rival <> '')),
  foreign key (club_id, plantel_id) references plantel (club_id, id),
  -- Si se borra el partido, la previa y sus evaluaciones quedan (sólo se
  -- pierde el vínculo). set null (partido_id): club_id es not null y es parte
  -- de la FK compuesta.
  foreign key (club_id, partido_id) references partido (club_id, id) on delete set null (partido_id)
);

-- Un partido tiene a lo sumo una previa.
create unique index previa_partido_un_partido on previa_partido (partido_id) where partido_id is not null;
create index previa_partido_plantel_idx on previa_partido (plantel_id, fecha);

create function sellar_previa_partido()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_en := now();
  else
    if new.club_id is distinct from old.club_id or new.plantel_id is distinct from old.plantel_id then
      raise exception 'PREVIA_INMUTABLE' using errcode = 'P0001';
    end if;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
  end if;
  -- Sin security definer: si quien escribe no ve el partido, tampoco lo vincula.
  if new.partido_id is not null and not exists (
    select 1 from public.partido p
    where p.id = new.partido_id and p.plantel_id = new.plantel_id
  ) then
    raise exception 'PARTIDO_DE_OTRO_PLANTEL' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger previa_partido_sellar
  before insert or update on previa_partido
  for each row execute function sellar_previa_partido();


/* ---------- mision_jugador y mision_equipo ---------- */

-- Una misión es con número (metrica + valor) o con texto, nunca las dos: las
-- de texto ("defender al base de ellos") valen lo mismo. estado null = el
-- profe todavía no la evaluó; la app nunca lo escribe sola.
create table mision_jugador (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  previa_id uuid not null,
  jugador_id uuid not null,
  orden smallint not null check (orden between 1 and 2),
  -- Sin puntos ni tiro: es el pedido del club (no premiar el goleo).
  metrica text check (metrica in ('reb_of', 'reb_def', 'reb_tot', 'ast', 'rec', 'tap', 'per', 'fal')),
  valor integer check (valor >= 0),
  texto text check (char_length(texto) <= 150),
  estado text check (estado in ('logrado', 'en_proceso', 'no_logrado')),
  comentario text check (char_length(comentario) <= 300),
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  evaluado_por uuid references auth.users(id),
  evaluado_en timestamptz,
  unique (previa_id, jugador_id, orden),
  constraint mision_jugador_forma check (
    (metrica is not null and valor is not null and texto is null)
    or (metrica is null and valor is null and texto is not null and btrim(texto) <> '')),
  constraint mision_jugador_comentario_evaluado check (comentario is null or estado is not null),
  foreign key (club_id, previa_id) references previa_partido (club_id, id) on delete cascade,
  foreign key (club_id, jugador_id) references jugador (club_id, id)
);

create index mision_jugador_jugador_idx on mision_jugador (jugador_id);

create table mision_equipo (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  previa_id uuid not null,
  orden smallint not null check (orden between 1 and 3),
  -- Totales del equipo propio o el marcador del rival. Nunca datos de
  -- jugadores rivales: el import no los guarda.
  metrica text check (metrica in ('reb_of', 'reb_def', 'reb_tot', 'ast', 'rec', 'tap', 'per', 'fal', 'puntos_rival')),
  valor integer check (valor >= 0),
  texto text check (char_length(texto) <= 150),
  estado text check (estado in ('logrado', 'en_proceso', 'no_logrado')),
  comentario text check (char_length(comentario) <= 300),
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  evaluado_por uuid references auth.users(id),
  evaluado_en timestamptz,
  unique (previa_id, orden),
  constraint mision_equipo_forma check (
    (metrica is not null and valor is not null and texto is null)
    or (metrica is null and valor is null and texto is not null and btrim(texto) <> '')),
  constraint mision_equipo_comentario_evaluado check (comentario is null or estado is not null),
  foreign key (club_id, previa_id) references previa_partido (club_id, id) on delete cascade
);

-- Autoría y evaluación las pone la base. Una misión evaluada ya no cambia de
-- consigna ni se borra: es lo que se le pidió al chico antes del partido, y un
-- logro de equipo borrado es memoria que se pierde. Sólo cambia su estado o su
-- comentario (el profe se puede equivocar al marcar).
create function sellar_mision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.estado is not null then
      raise exception 'MISION_EVALUADA' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado_en := now();
    new.evaluado_por := null;
    new.evaluado_en := null;
    if new.estado is not null or new.comentario is not null then
      raise exception 'MISION_SIN_EVALUAR' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.club_id is distinct from old.club_id or new.previa_id is distinct from old.previa_id
     or (to_jsonb(new) ->> 'jugador_id') is distinct from (to_jsonb(old) ->> 'jugador_id') then
    raise exception 'MISION_INMUTABLE' using errcode = 'P0001';
  end if;
  if old.estado is not null and (
       new.metrica is distinct from old.metrica or new.valor is distinct from old.valor
       or new.texto is distinct from old.texto or new.orden is distinct from old.orden) then
    raise exception 'MISION_EVALUADA' using errcode = 'P0001';
  end if;
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  if new.estado is null then
    new.evaluado_por := null;
    new.evaluado_en := null;
  elsif new.estado is distinct from old.estado or new.comentario is distinct from old.comentario then
    new.evaluado_por := auth.uid();
    new.evaluado_en := now();
  else
    new.evaluado_por := old.evaluado_por;
    new.evaluado_en := old.evaluado_en;
  end if;
  return new;
end;
$$;

create trigger mision_jugador_sellar
  before insert or update or delete on mision_jugador
  for each row execute function sellar_mision();

create trigger mision_equipo_sellar
  before insert or update or delete on mision_equipo
  for each row execute function sellar_mision();


/* ---------- RLS ---------- */

alter table previa_partido enable row level security;
alter table mision_jugador enable row level security;
alter table mision_equipo enable row level security;

-- Escribe quien tiene el plantel a cargo. El coordinador puro lee la previa
-- (fecha y rival, información pública) y las misiones de equipo, para ver los
-- logros en Panorama. Nunca las individuales: desde 0018 no lee datos de
-- ningún chico (opción A de la spec).
create policy previa_partido_ver on previa_partido
  for select using (puede_ver_plantel(plantel_id) or es_coordinador_de(club_id));
create policy previa_partido_crear on previa_partido
  for insert with check (puede_escribir_plantel(plantel_id));
create policy previa_partido_editar on previa_partido
  for update using (puede_escribir_plantel(plantel_id))
  with check (puede_escribir_plantel(plantel_id));
create policy previa_partido_borrar on previa_partido
  for delete using (puede_escribir_plantel(plantel_id));

-- puede_ver_plantel explícito y no "si ve la previa": la previa la ve
-- también el coordinador.
create policy mision_jugador_ver on mision_jugador
  for select using (exists (
    select 1 from previa_partido p
    where p.id = mision_jugador.previa_id and puede_ver_plantel(p.plantel_id)));
-- El chico tiene que estar hoy en el plantel de la previa.
create policy mision_jugador_crear on mision_jugador
  for insert with check (exists (
    select 1 from previa_partido p
    join pertenencia pe on pe.plantel_id = p.plantel_id
    where p.id = mision_jugador.previa_id
      and pe.jugador_id = mision_jugador.jugador_id
      and pe.hasta is null
      and puede_escribir_plantel(p.plantel_id)));
create policy mision_jugador_editar on mision_jugador
  for update using (exists (
    select 1 from previa_partido p
    where p.id = mision_jugador.previa_id and puede_escribir_plantel(p.plantel_id)))
  with check (exists (
    select 1 from previa_partido p
    where p.id = mision_jugador.previa_id and puede_escribir_plantel(p.plantel_id)));
create policy mision_jugador_borrar on mision_jugador
  for delete using (exists (
    select 1 from previa_partido p
    where p.id = mision_jugador.previa_id and puede_escribir_plantel(p.plantel_id)));

create policy mision_equipo_ver on mision_equipo
  for select using (exists (
    select 1 from previa_partido p
    where p.id = mision_equipo.previa_id
      and (puede_ver_plantel(p.plantel_id) or es_coordinador_de(p.club_id))));
create policy mision_equipo_crear on mision_equipo
  for insert with check (exists (
    select 1 from previa_partido p
    where p.id = mision_equipo.previa_id and puede_escribir_plantel(p.plantel_id)));
create policy mision_equipo_editar on mision_equipo
  for update using (exists (
    select 1 from previa_partido p
    where p.id = mision_equipo.previa_id and puede_escribir_plantel(p.plantel_id)))
  with check (exists (
    select 1 from previa_partido p
    where p.id = mision_equipo.previa_id and puede_escribir_plantel(p.plantel_id)));
create policy mision_equipo_borrar on mision_equipo
  for delete using (exists (
    select 1 from previa_partido p
    where p.id = mision_equipo.previa_id and puede_escribir_plantel(p.plantel_id)));

-- Supabase concede ALL por defecto: se revoca todo y se concede lo mínimo,
-- por columna. El id va en el insert porque lo genera el cliente (el
-- reintento de guardar_previa no duplica). Autoría y evaluación, nunca.
revoke all on previa_partido from anon, authenticated;
grant select, delete on previa_partido to authenticated;
grant insert (id, club_id, plantel_id, fecha, rival) on previa_partido to authenticated;
grant update (fecha, rival, partido_id) on previa_partido to authenticated;

revoke all on mision_jugador from anon, authenticated;
grant select, delete on mision_jugador to authenticated;
grant insert (id, club_id, previa_id, jugador_id, orden, metrica, valor, texto) on mision_jugador to authenticated;
grant update (orden, metrica, valor, texto, estado, comentario) on mision_jugador to authenticated;

revoke all on mision_equipo from anon, authenticated;
grant select, delete on mision_equipo to authenticated;
grant insert (id, club_id, previa_id, orden, metrica, valor, texto) on mision_equipo to authenticated;
grant update (orden, metrica, valor, texto, estado, comentario) on mision_equipo to authenticated;

comment on table previa_partido is
  'Las misiones de un partido antes de que exista: plantel + fecha (+ rival). partido_id se fija al evaluar o a mano. v0055.';
comment on table mision_jugador is
  'Hasta 2 misiones por jugador y previa, con número o con texto. Sin puntos ni tiro. Estado lo marca el profe. v0055.';
comment on table mision_equipo is
  'Hasta 3 misiones de equipo por previa: totales propios o puntos del rival. Logrado = logro del plantel. v0055.';
