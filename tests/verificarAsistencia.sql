-- Verificación de 0064 (entrenamiento, asistencia, lesion y sus dos RPC).
--
-- CÓMO SE CORRE: SÓLO EN LA BASE LOCAL, después de aplicar 0064:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres < tests/verificarAsistencia.sql
-- Para probar sin dejar la migración aplicada, envolver todo en una transacción:
--   (echo begin; cat supabase/migrations/0064_asistencia.sql tests/verificarAsistencia.sql; echo rollback) | docker exec -i <contenedor> psql -U postgres
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA: todo va dentro de un sub-bloque que se deshace al final. Usa
-- el club de prueba de 0003 y usuarios y chicos sintéticos (ZZTEST).

drop table if exists verificacion_0064;
create temporary table verificacion_0064 (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_club uuid := '00000000-0000-0000-0000-000000000001';
  v_t26  uuid := '00000000-0000-0000-0000-000000000002';
  v_u17  uuid := '00000000-0000-0000-0000-000000000004';
  v_rol_previo text := current_setting('role');
  v_u15  uuid := gen_random_uuid();
  v_p17  uuid := gen_random_uuid();   -- profe de U17M
  v_p15  uuid := gen_random_uuid();   -- profe de otra categoría
  v_sin  uuid := gen_random_uuid();   -- profe sin ningún plantel asignado
  v_c    uuid := gen_random_uuid();   -- coordinador puro
  v_a uuid := gen_random_uuid();      -- en U17
  v_b uuid := gen_random_uuid();      -- en U17
  v_x uuid := gen_random_uuid();      -- en U15
  v_id uuid;
  n integer;
  r record;
  txt text;

  nombres text[] := array[
    '1. El profe toma asistencia de su plantel y reintentar deja lo mismo',
    '2. Corregir un día: lo que no viene queda, estado null borra',
    '3. "No hubo" borra lo tomado y no admite filas',
    '4. Un profe de otro plantel no escribe ni lee',
    '5. Un profe sin plantel no lee nada',
    '6. El coordinador no lee filas y asistencia_del_club le da sólo el %',
    '7. Lesión: una abierta por jugador, alta, listas y fechas',
    '8. La lesión la ve quien tiene al chico, nadie más',
    '9. anon no tiene acceso a nada',
    '10. Fecha futura y chico de otro plantel rechazados',
    '11. asistencia_del_club es sólo del coordinador'
  ];
  estados  text[] := array_fill('no corrió'::text, array[11]);
  detalles text[] := array_fill(''::text, array[11]);
  falla_setup text := null;
begin
  begin

    /* ---------- setup, como service role ---------- */

    insert into plantel (id, club_id, temporada_id, categoria, categoria_codigo)
      values (v_u15, v_club, v_t26, 'U13M', 'U13M');

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest-' || u.etiqueta || '@verificacion.invalid', now(), now(), now(),
           jsonb_build_object('nombre', 'ZZTEST ' || u.etiqueta)
    from (values (v_p17,'p17'), (v_p15,'p15'), (v_sin,'sin'), (v_c,'c')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_p17, v_club, true, false), (v_p15, v_club, true, false),
      (v_sin, v_club, true, false), (v_c, v_club, false, true);
    insert into asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen, desde, hasta) values
      (v_p17, v_club, v_u17, 'manual', now(), null),
      (v_p15, v_club, v_u15, 'manual', now(), null);

    insert into jugador (id, club_id, nombre_clave, nombre_limpio) values
      (v_a, v_club, 'ZZTEST A', 'ZZTEST, A'),
      (v_b, v_club, 'ZZTEST B', 'ZZTEST, B'),
      (v_x, v_club, 'ZZTEST X', 'ZZTEST, X');
    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde) values
      (v_club, v_a, v_u17, v_t26, '2026-03-01'),
      (v_club, v_b, v_u17, v_t26, '2026-03-01'),
      (v_club, v_x, v_u15, v_t26, '2026-03-01');

    perform set_config('role', 'authenticated', true);

    /* ---------- 1: toma y reintento ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_p17, 'role', 'authenticated')::text, true);
    v_id := guardar_asistencia(v_u17, current_date - 5, true,
      jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'estado', 'presente'),
                        jsonb_build_object('jugadorId', v_b, 'estado', 'ausente')));
    if guardar_asistencia(v_u17, current_date - 5, true,
         jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'estado', 'presente'),
                           jsonb_build_object('jugadorId', v_b, 'estado', 'ausente'))) <> v_id
      then txt := txt || 'el reintento creó otro día; '; end if;
    select count(*) into n from asistencia where entrenamiento_id = v_id;
    if n <> 2 then txt := txt || 'filas: ' || n || '; '; end if;
    select count(*) into n from entrenamiento where plantel_id = v_u17 and fecha = current_date - 5;
    if n <> 1 then txt := txt || 'días: ' || n || '; '; end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then 'Un día, dos filas, el reintento no duplica.' else txt end;

    /* ---------- 2: corregir ---------- */

    txt := '';
    perform guardar_asistencia(v_u17, current_date - 5, true,
      jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'estado', 'justificada')));
    if (select estado from asistencia where entrenamiento_id = v_id and jugador_id = v_a) <> 'justificada'
      then txt := txt || 'no corrigió a A; '; end if;
    if (select estado from asistencia where entrenamiento_id = v_id and jugador_id = v_b) is distinct from 'ausente'
      then txt := txt || 'B (que no venía en el payload) cambió; '; end if;
    perform guardar_asistencia(v_u17, current_date - 5, true,
      jsonb_build_array(jsonb_build_object('jugadorId', v_b, 'estado', null)));
    if exists (select 1 from asistencia where entrenamiento_id = v_id and jugador_id = v_b)
      then txt := txt || 'estado null no borró; '; end if;
    estados[2] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[2] := case when txt = '' then 'A pasó a justificada, B quedó, B desmarcado desapareció.' else txt end;

    /* ---------- 3: no hubo ---------- */

    txt := '';
    perform guardar_asistencia(v_u17, current_date - 5, false, '[]'::jsonb);
    select count(*) into n from asistencia where entrenamiento_id = v_id;
    if n <> 0 then txt := txt || 'quedaron ' || n || ' filas; '; end if;
    if (select hubo from entrenamiento where id = v_id) then txt := txt || 'hubo sigue en true; '; end if;
    begin
      insert into asistencia (entrenamiento_id, jugador_id, club_id, estado) values (v_id, v_a, v_club, 'presente');
      txt := txt || 'aceptó asistencia en un día sin entrenamiento; ';
    exception when raise_exception then
      if sqlerrm <> 'NO_HUBO_ENTRENAMIENTO' then txt := txt || 'error inesperado: ' || sqlerrm || '; '; end if;
    end;
    -- Volver a "hubo" y tomar de nuevo funciona.
    perform guardar_asistencia(v_u17, current_date - 5, true,
      jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'estado', 'presente')));
    if (select count(*) from asistencia where entrenamiento_id = v_id) <> 1 then txt := txt || 'no se pudo retomar el día; '; end if;
    estados[3] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[3] := case when txt = '' then 'Filas borradas, insert directo rechazado, el día se retoma.' else txt end;

    -- Datos del caso 6: dos días con números conocidos (3 presentes de 4).
    perform guardar_asistencia(v_u17, current_date - 3, true,
      jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'estado', 'presente'),
                        jsonb_build_object('jugadorId', v_b, 'estado', 'presente')));
    perform guardar_asistencia(v_u17, current_date - 2, true,
      jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'estado', 'presente'),
                        jsonb_build_object('jugadorId', v_b, 'estado', 'ausente')));
    perform guardar_asistencia(v_u17, current_date - 1, false, '[]'::jsonb);

    /* ---------- 4: profe de otro plantel ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_p15, 'role', 'authenticated')::text, true);
    begin
      perform guardar_asistencia(v_u17, current_date - 4, true, '[]'::jsonb);
      txt := txt || 'guardó en un plantel ajeno; ';
    exception when raise_exception then
      if sqlerrm <> 'SIN_PERMISO' then txt := txt || 'error inesperado: ' || sqlerrm || '; '; end if;
    end;
    select count(*) into n from entrenamiento where plantel_id = v_u17;
    if n <> 0 then txt := txt || 've ' || n || ' días ajenos; '; end if;
    select count(*) into n from asistencia where jugador_id in (v_a, v_b);
    if n <> 0 then txt := txt || 've ' || n || ' filas ajenas; '; end if;
    estados[4] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[4] := case when txt = '' then 'SIN_PERMISO y cero filas.' else txt end;

    /* ---------- 5: profe sin plantel ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_sin, 'role', 'authenticated')::text, true);
    select count(*) into n from entrenamiento;
    if n <> 0 then txt := txt || 'entrenamientos: ' || n || '; '; end if;
    select count(*) into n from asistencia;
    if n <> 0 then txt := txt || 'asistencias: ' || n || '; '; end if;
    select count(*) into n from lesion;
    if n <> 0 then txt := txt || 'lesiones: ' || n || '; '; end if;
    estados[5] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[5] := case when txt = '' then 'Cero filas en las tres tablas.' else txt end;

    /* ---------- 6: coordinador ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    select count(*) into n from entrenamiento;
    if n <> 0 then txt := txt || 'lee ' || n || ' días; '; end if;
    select count(*) into n from asistencia;
    if n <> 0 then txt := txt || 'lee ' || n || ' filas; '; end if;
    select count(*) into n from lesion;
    if n <> 0 then txt := txt || 'lee ' || n || ' lesiones; '; end if;
    select * into r from asistencia_del_club(v_club, current_date - 3, current_date - 2) where plantel_id = v_u17;
    if not found then txt := txt || 'falta U17M; '; else
      if r.entrenamientos <> 2 then txt := txt || 'entrenamientos: ' || r.entrenamientos || '; '; end if;
      if r.pct is distinct from 75.0 then txt := txt || 'pct: ' || coalesce(r.pct::text, 'null') || ' (esperaba 75.0); '; end if;
    end if;
    select * into r from asistencia_del_club(v_club, current_date - 3, current_date - 2) where plantel_id = v_u15;
    if not found then txt := txt || 'falta U13M; ';
    elsif r.entrenamientos <> 0 or r.pct is not null then txt := txt || 'U13M sin entrenamientos debería dar 0 y null; '; end if;
    -- El día "no hubo" no cuenta como entrenamiento.
    select * into r from asistencia_del_club(v_club, current_date - 1, current_date - 1) where plantel_id = v_u17;
    if r.entrenamientos <> 0 then txt := txt || 'contó un día SE; '; end if;
    estados[6] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[6] := case when txt = '' then 'Cero filas; U17M 2 entrenamientos y 75.0; U13M 0 y null; el SE no cuenta.' else txt end;

    /* ---------- 7: lesión ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_p17, 'role', 'authenticated')::text, true);
    insert into lesion (club_id, jugador_id, desde, zona, lado, tipo)
      values (v_club, v_a, current_date - 4, 'tobillo', 'derecho', 'torcedura');
    begin
      insert into lesion (club_id, jugador_id, desde) values (v_club, v_a, current_date - 1);
      txt := txt || 'aceptó una segunda abierta; ';
    exception when unique_violation then null; end;
    update lesion set hasta = current_date - 1 where jugador_id = v_a and hasta is null;
    if (select count(*) from lesion where jugador_id = v_a and hasta is null) <> 0 then txt := txt || 'no dio el alta; '; end if;
    insert into lesion (club_id, jugador_id, desde) values (v_club, v_a, current_date);   -- zona/lado/tipo null
    begin
      insert into lesion (club_id, jugador_id, desde, hasta) values (v_club, v_b, current_date - 1, current_date - 2);
      txt := txt || 'aceptó hasta antes de desde; ';
    exception when check_violation then null; end;
    begin
      insert into lesion (club_id, jugador_id, desde, zona) values (v_club, v_b, current_date - 1, 'ojo');
      txt := txt || 'aceptó una zona fuera de la lista; ';
    exception when check_violation then null; end;
    begin
      insert into lesion (club_id, jugador_id, desde) values (v_club, v_b, current_date + 2);
      txt := txt || 'aceptó una lesión futura; ';
    exception when raise_exception then null; end;
    begin
      update lesion set jugador_id = v_b where jugador_id = v_a;
      txt := txt || 'cambió el jugador de una lesión; ';
    exception when insufficient_privilege then null; end;
    estados[7] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[7] := case when txt = '' then 'Segunda abierta rechazada, alta, hasta<desde, zona y fecha futura rechazadas.' else txt end;

    /* ---------- 8: quién ve la lesión ---------- */

    txt := '';
    select count(*) into n from lesion where jugador_id = v_a;
    if n <> 2 then txt := txt || 'el profe del chico ve ' || n || ' (esperaba 2); '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_p15, 'role', 'authenticated')::text, true);
    select count(*) into n from lesion;
    if n <> 0 then txt := txt || 'el profe de otra categoría ve ' || n || '; '; end if;
    begin
      insert into lesion (club_id, jugador_id, desde) values (v_club, v_b, current_date);
      txt := txt || 'el profe de otra categoría marcó una lesión; ';
    exception when insufficient_privilege then null; end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    select count(*) into n from lesion;
    if n <> 0 then txt := txt || 'el coordinador ve ' || n || '; '; end if;
    estados[8] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[8] := case when txt = '' then 'Sólo el profe del chico la ve; la de otro plantel y el coordinador, no.' else txt end;

    /* ---------- 9: anon ---------- */

    txt := '';
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    for r in select t from unnest(array['entrenamiento', 'asistencia', 'lesion']) t loop
      begin
        execute format('select count(*) from %I', r.t);
        txt := txt || 'anon leyó ' || r.t || '; ';
      exception when insufficient_privilege then null; end;
    end loop;
    begin
      perform asistencia_del_club(v_club, current_date - 3, current_date);
      txt := txt || 'anon ejecutó asistencia_del_club; ';
    exception when insufficient_privilege then null; end;
    begin
      perform guardar_asistencia(v_u17, current_date, true, '[]'::jsonb);
      txt := txt || 'anon ejecutó guardar_asistencia; ';
    exception when insufficient_privilege then null; end;
    estados[9] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[9] := case when txt = '' then 'permission denied en las tres tablas y las dos funciones.' else txt end;
    perform set_config('role', 'authenticated', true);

    /* ---------- 10: fecha futura y chico ajeno ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_p17, 'role', 'authenticated')::text, true);
    begin
      perform guardar_asistencia(v_u17, current_date + 2, true, '[]'::jsonb);
      txt := txt || 'aceptó una fecha futura; ';
    exception when raise_exception then
      if sqlerrm <> 'FECHA_FUTURA' then txt := txt || 'error inesperado: ' || sqlerrm || '; '; end if;
    end;
    begin
      perform guardar_asistencia(v_u17, current_date - 6, true,
        jsonb_build_array(jsonb_build_object('jugadorId', v_x, 'estado', 'presente')));
      txt := txt || 'aceptó a un chico de otro plantel; ';
    exception when insufficient_privilege then null; end;
    -- Una falla a mitad de camino no deja el día a medias (la RPC es una transacción).
    if exists (select 1 from entrenamiento where plantel_id = v_u17 and fecha = current_date - 6)
      then txt := txt || 'quedó un día a medias; '; end if;
    estados[10] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[10] := case when txt = '' then 'FECHA_FUTURA, RLS al chico ajeno y nada a medias.' else txt end;

    /* ---------- 11: asistencia_del_club sólo coordinador ---------- */

    txt := '';
    begin
      perform asistencia_del_club(v_club, current_date - 3, current_date);
      txt := txt || 'un profe la ejecutó; ';
    exception when insufficient_privilege then null; end;
    estados[11] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[11] := case when txt = '' then '42501 para el profe.' else txt end;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then null;
    when others then falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_0064 values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;
  for i in 1..11 loop
    insert into verificacion_0064 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_0064
order by n;
