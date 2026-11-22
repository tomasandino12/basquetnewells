-- Verificación de 0069 (ajustes de la constancia del jugador): mis_recursos()
-- con tipo y frecuencia_semanal, y mi_asistencia() sin los días de antes del
-- alta en el plantel. Spec: docs/superpowers/specs/2026-11-22-constancia-y-asistencia-del-jugador-design.md.
--
-- CÓMO SE CORRE: pegado entero en el SQL Editor de Supabase, como service
-- role, DESPUÉS de aplicar 0068 y 0069. Conviene correr también
-- tests/verificarConstancia.sql: sus casos de mi_asistencia tienen que seguir
-- en OK con la versión nueva.
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK, FALLA o "no corrió".
--
-- NO DEJA NADA. Todo lo que crea (ZZTEST, dominio .invalid) queda dentro de un
-- sub-bloque que al final se deshace a propósito con un SQLSTATE reservado.
-- Ningún dato real de ningún menor entra ni sale de acá.

drop table if exists verificacion_0069;
create temporary table verificacion_0069 (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_club uuid := '20000000-0000-0000-0000-000000000001';   -- club del piloto (como verificarConstancia)
  v_rol_previo text := current_setting('role');
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_t uuid;

  v_pl uuid := gen_random_uuid();   -- plantel de A y B
  v_p  uuid := gen_random_uuid();   -- profe del plantel
  v_s  uuid := gen_random_uuid();   -- cuenta sin ningún vínculo
  v_k  uuid := gen_random_uuid();   -- cuenta de jugador de A
  v_ja uuid := gen_random_uuid();   -- A: entró al plantel hace 30 días
  v_jb uuid := gen_random_uuid();   -- B: sin cuenta
  v_r1 uuid; v_r2 uuid; v_r3 uuid;  -- r1 (lectura, 3 por semana) y r2 (tiro) a A; r3 sólo a B

  v_res jsonb;
  v_vino jsonb;
  n integer;
  r record;
  txt text;

  nombres text[] := array[
    '1. mis_recursos trae tipo y frecuencia, sólo de lo que le mandaron',
    '2. Profe y cuenta sin vínculo no reciben ningún recurso',
    '3. mis_recursos: anon no la ejecuta, authenticated sí',
    '4. mi_asistencia: antes del alta sólo sale el día que el profe tomó'
  ];
  estados  text[] := array_fill('no corrió'::text, array[4]);
  detalles text[] := array_fill(''::text, array[4]);
  falla_setup text := null;
begin

  begin

    /* ---------- setup, como service role ---------- */

    select temporada_id into v_t from plantel where club_id = v_club and categoria = 'U17M';
    if v_t is null then
      raise exception 'No encontré U17M en el club del piloto (de ahí saco la temporada).';
    end if;

    insert into plantel (id, club_id, temporada_id, categoria, categoria_codigo)
      values (v_pl, v_club, v_t, 'ZZTEST 0069', 'U17M');

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
                            raw_user_meta_data)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest0069-' || u.etiqueta || '@verificacion.invalid', now(), now(), now(),
           jsonb_build_object('nombre', 'ZZTEST Nombre ' || u.etiqueta)
    from (values (v_p,'p'), (v_s,'s'), (v_k,'k')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador)
      values (v_p, v_club, true, false);
    insert into asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen)
      values (v_p, v_club, v_pl, 'manual');

    insert into jugador (id, club_id, nombre_clave, nombre_limpio) values
      (v_ja, v_club, 'ZZTEST CERONUEVE UNO', 'ZZTEST, CERONUEVE UNO'),
      (v_jb, v_club, 'ZZTEST CERONUEVE DOS', 'ZZTEST, CERONUEVE DOS');
    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde) values
      (v_club, v_ja, v_pl, v_t, current_date - 30),
      (v_club, v_jb, v_pl, v_t, current_date - 90);
    insert into cuenta_jugador (user_id, club_id, jugador_id, aprobado_por)
      values (v_k, v_club, v_ja, v_p);

    insert into recurso (club_id, titulo, descripcion, creado_por, tipo, frecuencia_semanal)
      values (v_club, 'ZZTEST 0069 lectura', 'ZZTEST', v_p, 'lectura', 3) returning id into v_r1;
    insert into recurso (club_id, titulo, descripcion, creado_por, tipo)
      values (v_club, 'ZZTEST 0069 tiro', 'ZZTEST', v_p, 'tiro') returning id into v_r2;
    insert into recurso (club_id, titulo, descripcion, creado_por, tipo)
      values (v_club, 'ZZTEST 0069 ajeno', 'ZZTEST', v_p, 'manejo') returning id into v_r3;
    insert into envio_recurso (club_id, recurso_id, jugador_id, fecha) values
      (v_club, v_r1, v_ja, v_hoy), (v_club, v_r2, v_ja, v_hoy), (v_club, v_r3, v_jb, v_hoy);


    /* ---------- 1: mis_recursos de A ---------- */

    txt := '';
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_k, 'role', 'authenticated')::text, true);
    select count(*) into n from mis_recursos();
    if n <> 2 then txt := txt || 'A recibe ' || n || ' recursos (esperaba 2); '; end if;
    select count(*) into n from mis_recursos() m where m.recurso_id = v_r3;
    if n <> 0 then txt := txt || 'A recibe el recurso que se le mandó a B; '; end if;
    select count(*) into n from mis_recursos() m
      where m.recurso_id = v_r1 and m.tipo = 'lectura' and m.frecuencia_semanal = 3;
    if n <> 1 then txt := txt || 'r1 no trae tipo lectura y frecuencia 3; '; end if;
    select count(*) into n from mis_recursos() m
      where m.recurso_id = v_r2 and m.tipo = 'tiro' and m.frecuencia_semanal is null;
    if n <> 1 then txt := txt || 'r2 no trae tipo tiro con frecuencia null («no lo dijo»); '; end if;
    perform set_config('role', v_rol_previo, true);
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then 'Dos recursos, con tipo y frecuencia (null cuando no se cargó); nada de B.' else txt end;


    /* ---------- 2: profe y cuenta sin vínculo ---------- */

    txt := '';
    perform set_config('role', 'authenticated', true);
    for r in select * from (values (v_p, 'el profe'), (v_s, 'una cuenta sin vínculo')) as x(u, quien) loop
      perform set_config('request.jwt.claims', json_build_object('sub', r.u, 'role', 'authenticated')::text, true);
      select count(*) into n from mis_recursos();
      if n <> 0 then txt := txt || r.quien || ' recibe ' || n || ' recursos; '; end if;
    end loop;
    perform set_config('role', v_rol_previo, true);
    estados[2] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[2] := case when txt = '' then 'Ninguno de los dos recibe filas.' else txt end;


    /* ---------- 3: permisos tras recrearla ---------- */

    txt := '';
    if has_function_privilege('anon', 'public.mis_recursos()', 'execute') then
      txt := txt || 'anon puede ejecutar mis_recursos; ';
    end if;
    if not has_function_privilege('authenticated', 'public.mis_recursos()', 'execute') then
      txt := txt || 'authenticated perdió el permiso de mis_recursos; ';
    end if;
    estados[3] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[3] := case when txt = '' then 'Los mismos permisos que le dio 0030.' else txt end;


    /* ---------- 4: mi_asistencia y el alta ---------- */

    -- A entró hace 30 días. Días del plantel (hace N días):
    --   60 nadie tomó a A (B presente)   -> no sale (antes del alta)
    --   50 A presente (planilla en papel) -> true    (antes del alta, pero lo tomaron)
    --   45 A ausente                       -> false   (antes del alta, lo tomaron)
    --   20 nadie tomó a A (B presente)   -> null    (ya estaba: sin tomar)
    --   10 A presente                      -> true
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    perform guardar_asistencia(v_pl, current_date - 60, true, jsonb_build_array(jsonb_build_object('jugadorId', v_jb, 'estado', 'presente')));
    perform guardar_asistencia(v_pl, current_date - 50, true, jsonb_build_array(jsonb_build_object('jugadorId', v_ja, 'estado', 'presente')));
    perform guardar_asistencia(v_pl, current_date - 45, true, jsonb_build_array(jsonb_build_object('jugadorId', v_ja, 'estado', 'ausente')));
    perform guardar_asistencia(v_pl, current_date - 20, true, jsonb_build_array(jsonb_build_object('jugadorId', v_jb, 'estado', 'presente')));
    perform guardar_asistencia(v_pl, current_date - 10, true, jsonb_build_array(jsonb_build_object('jugadorId', v_ja, 'estado', 'presente')));
    perform set_config('request.jwt.claims', json_build_object('sub', v_k, 'role', 'authenticated')::text, true);
    v_res := mi_asistencia();
    perform set_config('role', v_rol_previo, true);

    txt := '';
    if jsonb_array_length(v_res) <> 4 then txt := txt || 'salen ' || jsonb_array_length(v_res) || ' días (esperaba 4); '; end if;
    if exists (select 1 from jsonb_array_elements(v_res) x where x->>'fecha' = (current_date - 60)::text) then
      txt := txt || 'sale un día de antes del alta que nadie tomó; ';
    end if;
    for r in select * from (values (50,'true'), (45,'false'), (20,'null'), (10,'true')) as e(dias, esperado) loop
      select x->'vino' into v_vino from jsonb_array_elements(v_res) x where x->>'fecha' = (current_date - r.dias)::text;
      if not found then
        txt := txt || 'falta el día de hace ' || r.dias || '; ';
      elsif v_vino::text <> r.esperado then
        txt := txt || 'hace ' || r.dias || ' días dio ' || v_vino::text || ' (esperaba ' || r.esperado || '); ';
      end if;
    end loop;
    estados[4] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[4] := case when txt = '' then 'Antes del alta sólo salen los días tomados; después, también los sin tomar.' else txt end;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then
      null;  -- salida normal: todo lo escrito arriba quedó deshecho
    when others then
      falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_0069 values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;

  for i in 1..4 loop
    insert into verificacion_0069 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_0069
order by n;
