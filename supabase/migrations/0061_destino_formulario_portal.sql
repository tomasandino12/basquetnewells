-- Destino de un formulario del portal: consultas o colaboradores.
-- Ver docs/superpowers/specs/2026-10-18-portal-v2-design.md (§3) y el plan del portal v2.
--
-- La coordinación carga los formularios de Google que el portal le muestra a las
-- familias (0058). Dos son especiales: el de consultas ("Quiero jugar en
-- Newell's"), que va destacado arriba y al que apunta la dirección fija /consultas
-- del QR impreso, y el de colaboradores ("Sumate como sponsor"), que va en su
-- propia sección. Para que el portal sepa cuál es cuál AUNQUE se reordenen las
-- filas o se cambie el título, la fila lo dice en `destino`. Un QR impreso no
-- puede depender de "el primero de la lista".
--
-- A lo sumo un formulario por destino y por club (índice único parcial): cambiar
-- el de consultas es marcar otro, y la app le saca la marca al anterior.
--
-- La superficie para anon no se agranda: sigue ejecutando UNA sola función, que
-- ahora devuelve también `destino` (un dato de la coordinación, sin personas).
-- Como cambia el tipo de retorno hay que rehacerla: drop + create.
-- Contrato: tests/contratoDestinoFormulario.test.js.
--
-- ORDEN DE DESPLIEGUE: aplicar esta migración ANTES de publicar el código nuevo.
-- El portal viejo sigue andando con la función nueva (ignora la columna de más);
-- el panel nuevo pide la columna `destino` y falla si todavía no existe.

alter table formulario_portal
  add column destino text,
  add constraint formulario_portal_destino_valido check (destino in ('consultas', 'colaboradores'));

create unique index formulario_portal_destino_unico
  on formulario_portal (club_id, destino) where destino is not null;

-- Como el resto de la tabla (0058): por columna, sólo la coordinación del club por
-- RLS, y el cliente no toca autoría ni fechas.
grant insert (destino) on formulario_portal to authenticated;
grant update (destino) on formulario_portal to authenticated;


/* ---------- Lectura pública, con destino ---------- */

drop function formularios_publicos(uuid);

create function formularios_publicos(p_club uuid)
returns table (titulo text, texto text, enlace text, destino text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select f.titulo, f.texto, f.enlace, f.destino
  from public.formulario_portal f
  where f.club_id = p_club and f.activo
  order by f.orden, f.titulo
  limit 50;
$fn$;

revoke execute on function formularios_publicos(uuid) from public;
grant execute on function formularios_publicos(uuid) to anon, authenticated;

comment on column formulario_portal.destino is
  'Nulo = formulario común. consultas = "Quiero jugar en Newell''s" (destacado, y destino del QR /consultas). colaboradores = sección de sponsors. Uno por destino y club. v0061.';
comment on function formularios_publicos(uuid) is
  'Título, texto, enlace y destino de los formularios activos de un club, en orden. Única función ejecutable por anon (spec portal v2 §3). v0058, rehecha en v0061.';
