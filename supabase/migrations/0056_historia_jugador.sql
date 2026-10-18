-- Historia del jugador: su recorrido temporada por temporada, para el profe
-- que lo tiene hoy (spec docs/superpowers/specs/2026-10-16-historia-jugador-design.md).
--
-- POR QUÉ UNA FUNCIÓN Y NO POLICIES. El profe sólo lee los planteles que tiene
-- asignados (puede_ver_plantel, 0018): si recibe en U17 a un chico que viene de
-- U15, no ve nada de lo que se trabajó con él. Sumar policies de lectura en las
-- tablas cambiaría lo que devuelve cada consulta existente (las policies se
-- suman con OR) y desparramaría el permiso en una docena de lugares. Acá vive
-- en un solo archivo, no toca ninguna policy y se revoca con un revoke execute.
-- tests/contratoHistoria.test.js falla si esta migración toca policies o
-- otorga algo sobre una tabla.
--
-- LA REGLA. Entrenador del club del jugador, con una pertenencia vigente del
-- chico en un plantel que puede ver. Entonces ve TODAS sus temporadas y
-- planteles. De los demás chicos, nada. Decisiones de Tomás (16/10):
--   D1. El coordinador no ve la historia: sigue con el panorama agregado (0018).
--       Quien tiene los dos roles entra por su lado de entrenador.
--   D2. El profe que suma a su plantel a un chico de otra categoría ve toda su
--       historia, peso y altura incluidos. Para LECTURA y sólo acá, se deja de
--       lado a propósito la ventana corporal de 0039 (auditoría #8): el que
--       recibe a un chico tiene que saber cómo viene. Editar y borrar medidas
--       siguen con la ventana. Es una decisión de producto, no un descuido.
--
-- Sólo lectura: no escribe nada. Devuelve datos de ESE jugador y nada más, sin
-- promedios ni filas de otros chicos. La forma de cada clave es la que espera
-- src/data/historiaJugador.js (FUENTES); el contrato compara las claves.
-- Verificación con usuarios sintéticos: tests/verificarHistoria.sql.

create or replace function historia_del_jugador(p_jugador_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_club uuid;
begin
  select j.club_id into v_club from public.jugador j where j.id = p_jugador_id;

  -- Mismo error para "no existe" que para "no podés": no se aprende nada de
  -- un chico ajeno, ni siquiera que existe.
  if v_club is null or not exists (
    select 1
    from public.miembro_club m
    where m.club_id = v_club and m.user_id = auth.uid() and m.es_entrenador
  ) or not exists (
    select 1
    from public.pertenencia p
    where p.jugador_id = p_jugador_id
      and p.hasta is null
      and public.puede_ver_plantel(p.plantel_id)
  ) then
    raise exception 'Sólo el profe de un plantel actual del jugador.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    -- Toda temporada y todo plantel por el que pasó: por pertenencia o porque
    -- tiene un dato ahí (un partido jugado de citado sin pertenencia cuenta).
    'planteles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pl.id,
        'temporadaId', pl.temporada_id,
        'categoria', pl.categoria,
        -- Todos los que lo tuvieron a cargo, vigentes y cerrados. El nombre
        -- sale de Auth, como en nombres_del_club (0019).
        'profes', coalesce((
          select jsonb_agg(distinct u.raw_user_meta_data->>'nombre')
          from public.asignacion_plantel a
          join auth.users u on u.id = a.miembro_club_user_id
          where a.plantel_id = pl.id and u.raw_user_meta_data->>'nombre' is not null
        ), '[]'::jsonb)
      ))
      from public.plantel pl
      where pl.club_id = v_club and pl.id in (
        select p.plantel_id from public.pertenencia p where p.jugador_id = p_jugador_id
        union
        select pa.plantel_id from public.partido pa
          join public.estadistica_jugador_partido e on e.partido_id = pa.id
          where e.jugador_id = p_jugador_id
        union
        select s.plantel_id from public.sesion_medicion s
          where exists (select 1 from public.medicion_tiro x where x.sesion_id = s.id and x.jugador_id = p_jugador_id)
             or exists (select 1 from public.medicion_salto x where x.sesion_id = s.id and x.jugador_id = p_jugador_id)
             or exists (select 1 from public.medicion_sprint x where x.sesion_id = s.id and x.jugador_id = p_jugador_id)
             or exists (select 1 from public.medicion_yoyo x where x.sesion_id = s.id and x.jugador_id = p_jugador_id)
      )
    ), '[]'::jsonb),

    'temporadas', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre))
      from public.temporada t
      where t.club_id = v_club
    ), '[]'::jsonb),

    'pertenencias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plantelId', p.plantel_id, 'temporadaId', p.temporada_id, 'desde', p.desde, 'hasta', p.hasta
      ))
      from public.pertenencia p
      where p.jugador_id = p_jugador_id
    ), '[]'::jsonb),

    -- El plan de la categoría, no lo que hizo él: no hay asistencia todavía.
    -- Uno por plantel en el que estuvo, con las fechas sin repetir (un plan
    -- reimportado no duplica sesiones) y los ejercicios por bloque.
    'planFisico', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plantelId', pf.plantel_id,
        'sesiones', (select count(distinct sf.fecha) from public.sesion_fisico sf
                       join public.plan_fisico x on x.id = sf.plan_id where x.plantel_id = pf.plantel_id),
        'primera', (select min(sf.fecha) from public.sesion_fisico sf
                       join public.plan_fisico x on x.id = sf.plan_id where x.plantel_id = pf.plantel_id),
        'ultima', (select max(sf.fecha) from public.sesion_fisico sf
                       join public.plan_fisico x on x.id = sf.plan_id where x.plantel_id = pf.plantel_id),
        'bloques', coalesce((
          select jsonb_agg(jsonb_build_object('bloque', b.bloque, 'ejercicios', b.ejercicios) order by b.bloque nulls last)
          from (
            select ea.bloque, jsonb_agg(distinct ea.nombre_original) as ejercicios
            from public.ejercicio_asignado ea
            join public.sesion_fisico sf on sf.id = ea.sesion_id
            join public.plan_fisico x on x.id = sf.plan_id
            where x.plantel_id = pf.plantel_id
            group by ea.bloque
          ) b
        ), '[]'::jsonb)
      ))
      from (select distinct x.plantel_id from public.plan_fisico x
            where x.plantel_id in (select p.plantel_id from public.pertenencia p where p.jugador_id = p_jugador_id)) pf
    ), '[]'::jsonb),

    -- Sus cargas de fuerza. La fecha es la del club (Argentina): un peso
    -- anotado a las 22 es de ese día, como en FÍSICO.
    'cargas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'clave', pf.clave, 'nombre', pf.nombre, 'kg', m.kg,
        'fecha', (m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date
      ) order by m.orden)
      from public.movimiento_escalon m
      join public.paso_fuerza pf on pf.id = m.escalera_id
      where m.jugador_id = p_jugador_id
    ), '[]'::jsonb),

    -- El material que le llegó: sólo título y fecha.
    'recursos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', er.fecha, 'titulo', r.titulo) order by er.fecha)
      from public.envio_recurso er
      join public.recurso r on r.id = er.recurso_id
      where er.jugador_id = p_jugador_id
    ), '[]'::jsonb),

    -- Sin la ventana de 0039 (D2).
    'corporales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fechaMedicion', mc.fecha_medicion, 'alturaCm', mc.altura_cm, 'pesoKg', mc.peso_kg
      ) order by mc.fecha_medicion)
      from public.medicion_corporal mc
      where mc.jugador_id = p_jugador_id
    ), '[]'::jsonb),

    -- Salto, sprint y tiro: una fila por intento o posición, como las que
    -- reciben salto.js, sprint.js y estadisticas.js. Un ausente llega con el
    -- dato en null, nunca como 0.
    'saltos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sesionId', s.id, 'plantelId', s.plantel_id, 'fecha', s.fecha, 'testSalto', s.test_salto,
        'intento', ms.intento, 'tiempoVueloMs', ms.tiempo_vuelo_ms
      ) order by s.fecha, ms.intento)
      from public.medicion_salto ms
      join public.sesion_medicion s on s.id = ms.sesion_id
      where ms.jugador_id = p_jugador_id and s.tipo = 'salto'
    ), '[]'::jsonb),

    'sprints', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sesionId', s.id, 'plantelId', s.plantel_id, 'fecha', s.fecha, 'distanciaM', s.distancia_sprint_m,
        'intento', mp.intento, 'tiempoMs', mp.tiempo_ms, 'parcialMs', mp.parcial_ms, 'origen', mp.origen
      ) order by s.fecha, mp.intento)
      from public.medicion_sprint mp
      join public.sesion_medicion s on s.id = mp.sesion_id
      where mp.jugador_id = p_jugador_id and s.tipo = 'sprint'
    ), '[]'::jsonb),

    'yoyos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sesionId', s.id, 'plantelId', s.plantel_id, 'fecha', s.fecha, 'idas', my.idas, 'origen', my.origen
      ) order by s.fecha)
      from public.medicion_yoyo my
      join public.sesion_medicion s on s.id = my.sesion_id
      where my.jugador_id = p_jugador_id and s.tipo = 'yoyo'
    ), '[]'::jsonb),

    'tiro', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sesionId', s.id, 'plantelId', s.plantel_id, 'fecha', s.fecha, 'posicion', mt.posicion,
        'anotados', mt.anotados, 'intentos', mt.intentos
      ) order by s.fecha, mt.posicion)
      from public.medicion_tiro mt
      join public.sesion_medicion s on s.id = mt.sesion_id
      where mt.jugador_id = p_jugador_id and s.tipo = 'tiro'
    ), '[]'::jsonb),

    'partidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'partidoId', pa.id, 'plantelId', pa.plantel_id, 'fecha', pa.fecha, 'rivalNombre', pa.rival_nombre,
        'minSegundos', e.min_segundos, 'pts', e.pts,
        'dosAnotados', e.dos_anotados, 'dosIntentados', e.dos_intentados,
        'tresAnotados', e.tres_anotados, 'tresIntentados', e.tres_intentados,
        'libresAnotados', e.libres_anotados, 'libresIntentados', e.libres_intentados
      ) order by pa.fecha)
      from public.estadistica_jugador_partido e
      join public.partido pa on pa.id = e.partido_id
      where e.jugador_id = p_jugador_id
    ), '[]'::jsonb)
  );
end;
$fn$;

comment on function historia_del_jugador(uuid) is
  'v0056: la historia completa de un jugador para el entrenador de un plantel actual suyo. Sin coordinador (D1); corporales sin la ventana de 0039 (D2).';

revoke execute on function historia_del_jugador(uuid) from public, anon;
grant  execute on function historia_del_jugador(uuid) to authenticated;
