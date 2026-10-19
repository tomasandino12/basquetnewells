-- Formularios del portal del básquet.
-- Ver docs/superpowers/specs/2026-10-18-portal-v2-design.md §3.
--
-- La coordinación suma, edita, ordena y oculta los formularios de Google
-- (inscripción, pase, rifas, aranceles…) que el portal público le muestra a
-- las familias. Los formularios y lo que suben las familias viven en Google:
-- acá sólo se guarda el título, una línea de ayuda y el enlace.
--
-- ES LA PRIMERA EXCEPCIÓN A 0027 ("anon no tiene nada que hacer con las
-- tablas"), aprobada por Tomás el 18/10: el portal se ve sin sesión. Por eso
-- la superficie es la mínima posible:
-- - La tabla no tiene ningún dato de jugadores, familias ni miembros.
-- - anon NO recibe nada sobre la tabla: sólo `execute` de una función que
--   devuelve título, texto y enlace de las filas activas de un club.
-- - El enlace sólo puede ser de Google Forms (mismo patrón que la página, ver
--   src/data/portal.js; tests/contratoFormularioPortal.test.js los compara).
-- - Escribe sólo la coordinación del club, sin borrar: un formulario viejo se
--   oculta con `activo = false` y queda el rastro de quién y cuándo.

create table formulario_portal (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id),
  titulo text not null check (char_length(titulo) <= 150),
  -- Para qué es y qué tener a mano antes de abrirlo. Obligatorio: la familia
  -- no tiene por qué saberlo.
  texto text not null check (char_length(texto) <= 500),
  enlace text not null check (char_length(enlace) <= 2048),
  -- Posición en la lista, de 1 para arriba. Sin índice único a propósito:
  -- subir uno es cambiar dos filas, y en el medio quedarían repetidos.
  orden integer not null check (orden between 1 and 1000),
  activo boolean not null default true,
  creado_por uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_por uuid not null default auth.uid() references auth.users(id),
  actualizado_en timestamptz not null default now(),
  constraint formulario_portal_titulo_recortado check (titulo = btrim(titulo) and titulo <> ''),
  constraint formulario_portal_texto_recortado check (texto = btrim(texto) and texto <> ''),
  -- Sin usuario ni puerto, sin espacios, comillas ni < >: termina en un href
  -- de una página que ve cualquiera.
  constraint formulario_portal_enlace_google check (enlace ~ '^https://(docs\.google\.com/forms/|forms\.gle/)[^\s"<>]+$')
);

create index formulario_portal_club_orden_idx on formulario_portal (club_id, orden);

-- Quién hizo el último cambio y cuándo. El default sólo actúa en el insert;
-- el trigger cubre también el update. Mismo patrón que material (0026).
create function sellar_formulario_portal()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  new.actualizado_por := auth.uid();
  new.actualizado_en := now();
  return new;
end;
$fn$;

create trigger formulario_portal_sellar
  before insert or update on formulario_portal
  for each row execute function sellar_formulario_portal();

revoke execute on function sellar_formulario_portal() from public, anon, authenticated;


/* ---------- RLS ---------- */

alter table formulario_portal enable row level security;

-- La lista completa (con las ocultas y la autoría) la ve sólo la coordinación
-- del club. Lo público sale por formularios_publicos(), no por acá.
create policy formulario_portal_coordinador_lee on formulario_portal
  for select using (es_coordinador_de(formulario_portal.club_id));

create policy formulario_portal_coordinador_agrega on formulario_portal
  for insert with check (es_coordinador_de(formulario_portal.club_id));

create policy formulario_portal_coordinador_edita on formulario_portal
  for update using (es_coordinador_de(formulario_portal.club_id))
  with check (es_coordinador_de(formulario_portal.club_id));

-- Supabase concede ALL por defecto sobre tablas nuevas (ver 0017 y 0027): se
-- revoca todo y se concede lo mínimo, por columna. El cliente no manda
-- autoría ni fechas, no cambia el club de una fila y no borra.
revoke all on formulario_portal from anon, authenticated;
grant select on formulario_portal to authenticated;
grant insert (club_id, titulo, texto, enlace, orden, activo) on formulario_portal to authenticated;
grant update (titulo, texto, enlace, orden, activo) on formulario_portal to authenticated;


/* ---------- Lectura pública ---------- */

-- Lo único que ve el portal sin sesión: título, texto y enlace de los
-- formularios activos de un club, en orden. security definer porque anon no
-- tiene ningún permiso sobre la tabla; la función no devuelve autoría, fechas
-- ni las filas ocultas. El límite corta una lista absurda, no una real.
create function formularios_publicos(p_club uuid)
returns table (titulo text, texto text, enlace text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select f.titulo, f.texto, f.enlace
  from public.formulario_portal f
  where f.club_id = p_club and f.activo
  order by f.orden, f.titulo
  limit 50;
$fn$;

revoke execute on function formularios_publicos(uuid) from public;
grant execute on function formularios_publicos(uuid) to anon, authenticated;

comment on table formulario_portal is
  'Formularios de Google que el portal público muestra a las familias. Escribe coordinación; lo público sale por formularios_publicos(). Sin datos de personas. v0058.';
comment on function formularios_publicos(uuid) is
  'Título, texto y enlace de los formularios activos de un club, en orden. Única función ejecutable por anon (spec portal v2 §3). v0058.';
