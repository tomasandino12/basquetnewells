-- Verificación de 0055 (misiones del partido): RLS, sellado y las dos RPC,
-- con sus casos de rollback (un error a mitad de payload no deja nada).
--
-- CÓMO SE CORRE: pegado entero en el SQL Editor de Supabase, como service
-- role, después de aplicar 0055. O local:
--   docker exec -i supabase_db_modelo-datos-supabase psql -U postgres < tests/verificarMisiones.sql
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA: todo dentro de un sub-bloque que se deshace al final.

drop table if exists verificacion_0055;
create temporary table verificacion_0055 (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_club uuid := '20000000-0000-0000-0000-000000000001';
  v_rol_previo text := current_setting('role');
  v_u17 uuid; v_u21 uuid; v_t17 uuid; v_t21 uuid;
  v_a uuid := gen_random_uuid();   -- entrenador U17M
  v_b uuid := gen_random_uuid();   -- entrenador U21M
  v_c uuid := gen_random_uuid();   -- coordinador puro
  v_d uuid := gen_random_uuid();   -- cuenta sin club (como un jugador: cero filas)
  v_j1 uuid := gen_random_uuid(); v_j2 uuid := gen_random_uuid(); v_j21 uuid := gen_random_uuid();
  v_previa uuid := gen_random_uuid(); v_previa2 uuid := gen_random_uuid(); v_previa3 uuid := gen_random_uuid();
  v_mj1 uuid := gen_random_uuid(); v_mj2 uuid := gen_random_uuid(); v_mj3 uuid := gen_random_uuid();
  v_me1 uuid := gen_random_uuid();
  v_imp uuid; v_part17 uuid; v_part21 uuid;
  v_payload jsonb; v_res jsonb;
  n integer; m integer; txt text;

  nombres text[] := array[
    '1. El entrenador del plantel guarda la previa entera',
    '2. El mismo guardado dos veces deja lo mismo',
    '3. Rollback: una misión inválida al final no deja ni la previa',
    '4. Un chico de otro plantel no recibe misión (y no queda nada)',
    '5. Entrenador de otro plantel: cero filas y no escribe',
    '6. Coordinador: ve previa y equipo, cero individuales, no escribe',
    '7. Cuenta sin club: cero filas en las tres tablas',
    '8. Evaluar fija el partido, escribe estados y sella quién',
    '9. Rollback: una evaluación de una misión que no existe no deja nada',
    '10. Una misión evaluada no se reemplaza: MISION_EVALUADA',
    '11. PARTIDO_DE_OTRO_PLANTEL',
    '12. PARTIDO_YA_VINCULADO'
  ];
  estados  text[] := array_fill('no corrió'::text, array[12]);
  detalles text[] := array_fill(''::text, array[12]);
  falla_setup text := null;
begin
  begin

    /* ---------- setup, como service role ---------- */

    select id, temporada_id into v_u17, v_t17 from plantel where club_id = v_club and categoria = 'U17M';
    select id, temporada_id into v_u21, v_t21 from plantel where club_id = v_club and categoria = 'U21M';

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
    select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           'zztest-' || u || '@verificacion.invalid', now(), now(), now()
    from unnest(array[v_a, v_b, v_c, v_d]) u;
    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_a, v_club, true, false), (v_b, v_club, true, false), (v_c, v_club, false, true);
    insert into asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen) values
      (v_a, v_club, v_u17, 'manual'), (v_b, v_club, v_u21, 'manual');

    insert into jugador (id, club_id, nombre_clave, nombre_limpio) values
      (v_j1, v_club, 'ZZTEST MISION UNO', 'ZZTEST, MISION UNO'),
      (v_j2, v_club, 'ZZTEST MISION DOS', 'ZZTEST, MISION DOS'),
      (v_j21, v_club, 'ZZTEST MISION U21', 'ZZTEST, MISION U21');
    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde) values
      (v_club, v_j1, v_u17, v_t17, '2026-03-01'),
      (v_club, v_j2, v_u17, v_t17, '2026-03-01'),
      (v_club, v_j21, v_u21, v_t21, '2026-03-01');

    insert into importacion (club_id, hash_archivo, nombre_archivo) values (v_club, 'zztest-mision-17', 'x.xlsx') returning id into v_imp;
    insert into partido (club_id, plantel_id, importacion_id, fecha, condicion_propia, rival_nombre, puntos_propios, puntos_rival)
      values (v_club, v_u17, v_imp, '2026-10-18', 'local', 'ZZTEST RIVAL', 70, 58) returning id into v_part17;
    insert into importacion (club_id, hash_archivo, nombre_archivo) values (v_club, 'zztest-mision-21', 'x.xlsx') returning id into v_imp;
    insert into partido (club_id, plantel_id, importacion_id, fecha, condicion_propia)
      values (v_club, v_u21, v_imp, '2026-10-18', 'local') returning id into v_part21;

    v_payload := jsonb_build_object('previaId', v_previa, 'clubId', v_club, 'plantelId', v_u17,
      'fecha', '2026-10-18', 'rival', 'ZZTEST RIVAL',
      'misionesJugador', jsonb_build_array(
        jsonb_build_object('id', v_mj1, 'jugadorId', v_j1, 'orden', 1, 'metrica', 'reb_tot', 'valor', 5),
        jsonb_build_object('id', v_mj2, 'jugadorId', v_j1, 'orden', 2, 'texto', 'defender al base'),
        jsonb_build_object('id', v_mj3, 'jugadorId', v_j2, 'orden', 1, 'metrica', 'per', 'valor', 2)),
      'misionesEquipo', jsonb_build_array(
        jsonb_build_object('id', v_me1, 'orden', 1, 'metrica', 'puntos_rival', 'valor', 59)));

    perform set_config('role', 'authenticated', true);


    /* ---------- 1: guardar la previa ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    txt := '';
    v_res := guardar_previa(v_payload);
    if (v_res->>'misionesJugador')::int <> 3 or (v_res->>'misionesEquipo')::int <> 1 then txt := txt || 'conteos ' || v_res::text || '; '; end if;
    select count(*) into n from mision_jugador where previa_id = v_previa and creado_por = v_a;
    if n <> 3 then txt := txt || n || ' individuales selladas por el profe; '; end if;
    select count(*) into n from previa_partido where id = v_previa and creado_por = v_a and partido_id is null;
    if n <> 1 then txt := txt || 'la previa no quedó sellada o nació vinculada; '; end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then 'Previa, 3 individuales y 1 de equipo, selladas por el profe.' else txt end;


    /* ---------- 2: reintento ---------- */

    perform guardar_previa(v_payload);
    select count(*) into n from mision_jugador where previa_id = v_previa;
    select count(*) into m from mision_equipo where previa_id = v_previa;
    estados[2] := case when n = 3 and m = 1 then 'OK' else 'FALLA' end;
    detalles[2] := case when estados[2] = 'OK' then 'Sigue 3 + 1.' else n || ' individuales, ' || m || ' de equipo' end;


    /* ---------- 3: rollback de guardar_previa ---------- */

    begin
      perform guardar_previa(jsonb_build_object('previaId', v_previa2, 'clubId', v_club, 'plantelId', v_u17, 'fecha', '2026-10-25',
        'misionesJugador', jsonb_build_array(
          jsonb_build_object('id', gen_random_uuid(), 'jugadorId', v_j1, 'orden', 1, 'metrica', 'ast', 'valor', 2),
          jsonb_build_object('id', gen_random_uuid(), 'jugadorId', v_j2, 'orden', 1, 'metrica', 'pts', 'valor', 10))));
      txt := 'aceptó puntos como métrica';
    exception when others then
      txt := '';
    end;
    select count(*) into n from previa_partido where id = v_previa2;
    if n <> 0 then txt := txt || 'quedó la previa; '; end if;
    estados[3] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[3] := case when txt = '' then 'Falló entera: ni previa ni misiones.' else txt end;


    /* ---------- 4: chico de otro plantel ---------- */

    begin
      perform guardar_previa(jsonb_build_object('previaId', v_previa2, 'clubId', v_club, 'plantelId', v_u17, 'fecha', '2026-10-25',
        'misionesJugador', jsonb_build_array(
          jsonb_build_object('id', gen_random_uuid(), 'jugadorId', v_j21, 'orden', 1, 'texto', 'hablar'))));
      txt := 'le dio misión a un chico de U21M';
    exception when others then
      txt := '';
    end;
    select count(*) into n from previa_partido where id = v_previa2;
    if n <> 0 then txt := txt || 'quedó la previa; '; end if;
    estados[4] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[4] := case when txt = '' then 'Rechazado por RLS, sin previa.' else txt end;


    /* ---------- 5: entrenador de otro plantel ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    txt := '';
    select count(*) into n from previa_partido;
    if n <> 0 then txt := txt || n || ' previas visibles; '; end if;
    select count(*) into n from mision_jugador;
    if n <> 0 then txt := txt || n || ' individuales visibles; '; end if;
    begin
      perform guardar_previa(v_payload);
      txt := txt || 'guardó en U17M; ';
    exception when others then null;
    end;
    begin
      perform evaluar_misiones(jsonb_build_object('previaId', v_previa, 'evaluaciones', '[]'::jsonb));
      txt := txt || 'evaluó en U17M; ';
    exception when others then
      if sqlerrm <> 'PREVIA_NO_ENCONTRADA' then txt := txt || sqlerrm || '; '; end if;
    end;
    estados[5] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[5] := case when txt = '' then 'No ve ni escribe nada de U17M.' else txt end;


    /* ---------- 6: coordinador puro ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
    txt := '';
    select count(*) into n from previa_partido where id = v_previa;
    if n <> 1 then txt := txt || 'no ve la previa; '; end if;
    select count(*) into n from mision_equipo where previa_id = v_previa;
    if n <> 1 then txt := txt || 'no ve la misión de equipo; '; end if;
    select count(*) into n from mision_jugador;
    if n <> 0 then txt := txt || n || ' individuales visibles; '; end if;
    update mision_equipo set estado = 'logrado' where previa_id = v_previa;
    get diagnostics n = row_count;
    if n <> 0 then txt := txt || 'editó la misión de equipo; '; end if;
    begin
      perform guardar_previa(v_payload);
      txt := txt || 'guardó la previa; ';
    exception when others then
      if sqlerrm <> 'SIN_PERMISO' then txt := txt || sqlerrm || '; '; end if;
    end;
    -- Sin evaluaciones no hay fila que falle: tiene que frenarlo el permiso.
    begin
      perform evaluar_misiones(jsonb_build_object('previaId', v_previa, 'partidoId', v_part17));
      txt := txt || 'evaluó (o vinculó) la previa; ';
    exception when others then
      if sqlerrm <> 'SIN_PERMISO' then txt := txt || sqlerrm || '; '; end if;
    end;
    estados[6] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[6] := case when txt = '' then 'Lee lo de equipo; nada individual; no escribe.' else txt end;


    /* ---------- 7: cuenta sin club ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_d, 'role', 'authenticated')::text, true);
    select (select count(*) from previa_partido) + (select count(*) from mision_jugador) + (select count(*) from mision_equipo) into n;
    estados[7] := case when n = 0 then 'OK' else 'FALLA' end;
    detalles[7] := case when n = 0 then 'Cero filas.' else n || ' filas visibles' end;


    /* ---------- 8: evaluar ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    txt := '';
    v_res := evaluar_misiones(jsonb_build_object('previaId', v_previa, 'partidoId', v_part17, 'evaluaciones', jsonb_build_array(
      jsonb_build_object('tipo', 'jugador', 'id', v_mj1, 'estado', 'en_proceso', 'comentario', ' cerca '),
      jsonb_build_object('tipo', 'equipo', 'id', v_me1, 'estado', 'logrado'))));
    if (v_res->>'evaluadas')::int <> 2 then txt := txt || 'evaluadas ' || v_res::text || '; '; end if;
    select count(*) into n from previa_partido where id = v_previa and partido_id = v_part17;
    if n <> 1 then txt := txt || 'no fijó el partido; '; end if;
    select count(*) into n from mision_jugador where id = v_mj1 and estado = 'en_proceso' and comentario = 'cerca' and evaluado_por = v_a;
    if n <> 1 then txt := txt || 'la individual no quedó evaluada y sellada; '; end if;
    -- La que no se mandó sigue sin estado: nada se marca solo.
    select count(*) into n from mision_jugador where id in (v_mj2, v_mj3) and estado is null and evaluado_por is null;
    if n <> 2 then txt := txt || 'cambió una misión que no se evaluó; '; end if;
    estados[8] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[8] := case when txt = '' then 'Partido fijado, 2 evaluadas, las otras sin estado.' else txt end;


    /* ---------- 9: rollback de evaluar ---------- */

    begin
      perform evaluar_misiones(jsonb_build_object('previaId', v_previa, 'evaluaciones', jsonb_build_array(
        jsonb_build_object('tipo', 'jugador', 'id', v_mj3, 'estado', 'logrado'),
        jsonb_build_object('tipo', 'jugador', 'id', gen_random_uuid(), 'estado', 'logrado'))));
      txt := 'aceptó una misión que no existe';
    exception when others then
      txt := case when sqlerrm = 'MISION_NO_ENCONTRADA' then '' else sqlerrm end;
    end;
    select count(*) into n from mision_jugador where id = v_mj3 and estado is null;
    if n <> 1 then txt := txt || '; quedó evaluada la primera'; end if;
    estados[9] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[9] := case when txt = '' then 'MISION_NO_ENCONTRADA y la primera sigue sin estado.' else txt end;


    /* ---------- 10: MISION_EVALUADA ---------- */

    begin
      perform guardar_previa(v_payload);
      txt := 'reemplazó misiones evaluadas';
    exception when others then
      txt := case when sqlerrm = 'MISION_EVALUADA' then '' else sqlerrm end;
    end;
    select count(*) into n from mision_jugador where id = v_mj1 and estado = 'en_proceso';
    if n <> 1 then txt := txt || '; se perdió la evaluación'; end if;
    estados[10] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[10] := case when txt = '' then 'Rechazado; la evaluación sigue.' else txt end;


    /* ---------- 11 y 12: vínculos inválidos ---------- */

    perform guardar_previa(jsonb_build_object('previaId', v_previa3, 'clubId', v_club, 'plantelId', v_u17, 'fecha', '2026-10-18'));
    begin
      perform evaluar_misiones(jsonb_build_object('previaId', v_previa3, 'partidoId', v_part21));
      txt := 'vinculó un partido de U21M';
    exception when others then
      txt := case when sqlerrm = 'PARTIDO_DE_OTRO_PLANTEL' then '' else sqlerrm end;
    end;
    estados[11] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[11] := case when txt = '' then 'Rechazado.' else txt end;

    begin
      perform evaluar_misiones(jsonb_build_object('previaId', v_previa3, 'partidoId', v_part17));
      txt := 'dos previas en el mismo partido';
    exception when others then
      txt := case when sqlerrm = 'PARTIDO_YA_VINCULADO' then '' else sqlerrm end;
    end;
    estados[12] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[12] := case when txt = '' then 'Rechazado.' else txt end;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then null;
    when others then falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_0055 values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;
  for i in 1..12 loop
    insert into verificacion_0055 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_0055
order by n;
