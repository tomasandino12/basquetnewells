-- Verificación de 0068 (constancia del jugador: prácticas de recursos y su
-- propia asistencia). Spec: docs/superpowers/specs/2026-11-22-constancia-y-asistencia-del-jugador-design.md §4.
--
-- CÓMO SE CORRE: pegado entero en el SQL Editor de Supabase, como service
-- role, DESPUÉS de aplicar 0068 (y 0030, 0034, 0057 y 0064, de las que depende).
-- En la base local: docker exec -i <contenedor supabase_db_...> psql -U postgres < tests/verificarConstancia.sql
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK, FALLA o "no corrió".
--
-- NO DEJA NADA. Crea usuarios, planteles, fichas, recursos, asistencia y
-- lesiones sintéticos (ZZTEST, dominio .invalid) dentro de un sub-bloque que al
-- final se deshace a propósito con un SQLSTATE reservado. Ningún dato real de
-- ningún menor entra ni sale de acá. Los planteles son propios (no toca los
-- del club), así que los conteos no dependen de las cuentas reales.
--
-- La impersonación (role = authenticated + request.jwt.claims) es exactamente
-- como PostgREST evalúa RLS para una sesión real.

drop table if exists verificacion_constancia;
create temporary table verificacion_constancia (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_club uuid := '20000000-0000-0000-0000-000000000001';   -- club del piloto (como verificarAperturaRecurso)
  v_rol_previo text := current_setting('role');
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_t uuid;

  v_p1 uuid := gen_random_uuid();   -- plantel de A, B, C, D y el chico sin cuenta
  v_p2 uuid := gen_random_uuid();   -- segundo plantel de A (dos categorías)
  v_p3 uuid := gen_random_uuid();   -- plantel donde A estuvo y ya no

  v_p  uuid := gen_random_uuid();   -- profe de P1, P2 y P3
  v_p2u uuid := gen_random_uuid();  -- profe sólo de P3
  v_c  uuid := gen_random_uuid();   -- coordinador puro
  v_f  uuid := gen_random_uuid();   -- cuenta de familia de A
  v_s  uuid := gen_random_uuid();   -- cuenta sin ningún vínculo
  v_k1 uuid := gen_random_uuid();   -- cuentas de jugador: A, B, C, D
  v_k2 uuid := gen_random_uuid();
  v_k3 uuid := gen_random_uuid();
  v_k4 uuid := gen_random_uuid();

  v_j1 uuid := gen_random_uuid();   -- A (en P1 y P2; estuvo en P3)
  v_j2 uuid := gen_random_uuid();   -- B
  v_j3 uuid := gen_random_uuid();   -- C
  v_j4 uuid := gen_random_uuid();   -- D: con cuenta, sin recursos enviados
  v_j5 uuid := gen_random_uuid();   -- sin cuenta
  v_r1 uuid; v_r2 uuid; v_r3 uuid;  -- r1 a A, B, C y el sin cuenta; r2 sólo a A; r3 a nadie

  v_res jsonb;
  v_vino jsonb;
  v_u uuid;
  n integer;
  r record;
  txt text;

  nombres text[] := array[
    '1. El jugador marca un recurso: una marca por día y la fecha la pone el servidor',
    '2. No marca lo que no le enviaron, no ve lo de otro y lee sólo 12 semanas',
    '3. Nadie lee ni escribe la tabla directo (ni jugador ni entrenador)',
    '4. Profe, coordinador, familia y cuenta sin vínculo reciben null (y no marcan)',
    '5. El profe ve conteos del plantel y ningún id de jugador',
    '6. Otro profe, el coordinador y un jugador no ven el conteo del plantel',
    '7. mi_asistencia: la regla de cada día (presente, lesión, falta, sin tomar)',
    '8. mi_asistencia: sólo fecha y vino, sin motivo ni lesión',
    '9. Desmarcar borra la marca de hoy y no toca otro día',
    '10. Si se borra el recurso, el día practicado queda sin recurso',
    '11. Con menos de 3 cuentas el conteo sale null, y cerrar la cuenta borra las marcas',
    '12. Sin pertenencia vigente se borran las marcas; con otra vigente, quedan',
    '13. Con la cuenta cerrada se borran las marcas y no marca ni lee más'
  ];
  estados  text[] := array_fill('no corrió'::text, array[13]);
  detalles text[] := array_fill(''::text, array[13]);
  falla_setup text := null;
begin

  begin

    /* ---------- setup, como service role ---------- */

    select temporada_id into v_t from plantel where club_id = v_club and categoria = 'U17M';
    if v_t is null then
      raise exception 'No encontré U17M en el club del piloto (de ahí saco la temporada).';
    end if;

    insert into plantel (id, club_id, temporada_id, categoria, categoria_codigo) values
      (v_p1, v_club, v_t, 'ZZTEST CONSTANCIA 1', 'U17M'),
      (v_p2, v_club, v_t, 'ZZTEST CONSTANCIA 2', 'U17M'),
      (v_p3, v_club, v_t, 'ZZTEST CONSTANCIA 3', 'U17M');

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
                            raw_user_meta_data)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest-' || u.etiqueta || '@verificacion.invalid', now(), now(), now(),
           jsonb_build_object('nombre', 'ZZTEST Nombre ' || u.etiqueta)
    from (values (v_p,'p'), (v_p2u,'p2'), (v_c,'c'), (v_f,'f'), (v_s,'s'),
                 (v_k1,'k1'), (v_k2,'k2'), (v_k3,'k3'), (v_k4,'k4')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_p, v_club, true, false), (v_p2u, v_club, true, false), (v_c, v_club, false, true);
    insert into asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen) values
      (v_p, v_club, v_p1, 'manual'), (v_p, v_club, v_p2, 'manual'), (v_p, v_club, v_p3, 'manual'),
      (v_p2u, v_club, v_p3, 'manual');

    insert into jugador (id, club_id, nombre_clave, nombre_limpio) values
      (v_j1, v_club, 'ZZTEST CONSTANCIA UNO',    'ZZTEST, CONSTANCIA UNO'),
      (v_j2, v_club, 'ZZTEST CONSTANCIA DOS',    'ZZTEST, CONSTANCIA DOS'),
      (v_j3, v_club, 'ZZTEST CONSTANCIA TRES',   'ZZTEST, CONSTANCIA TRES'),
      (v_j4, v_club, 'ZZTEST CONSTANCIA CUATRO', 'ZZTEST, CONSTANCIA CUATRO'),
      (v_j5, v_club, 'ZZTEST CONSTANCIA SIN CUENTA', 'ZZTEST, CONSTANCIA SIN CUENTA');

    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde)
    select v_club, j, v_p1, v_t, '2026-03-01' from unnest(array[v_j1, v_j2, v_j3, v_j4, v_j5]) as j;
    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde)
      values (v_club, v_j1, v_p2, v_t, '2026-03-01');
    -- A estuvo en P3 hasta hace 20 días: la pertenencia nace cerrada.
    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde, hasta, cerrado_por)
      values (v_club, v_j1, v_p3, v_t, '2026-01-01', current_date - 20, v_p);

    insert into cuenta_jugador (user_id, club_id, jugador_id, aprobado_por) values
      (v_k1, v_club, v_j1, v_p), (v_k2, v_club, v_j2, v_p), (v_k3, v_club, v_j3, v_p), (v_k4, v_club, v_j4, v_p);
    insert into vinculo_familia (user_id, club_id, jugador_id) values (v_f, v_club, v_j1);

    insert into recurso (club_id, titulo, descripcion, creado_por)
      values (v_club, 'ZZTEST recurso uno', 'ZZTEST', v_p) returning id into v_r1;
    insert into recurso (club_id, titulo, descripcion, creado_por)
      values (v_club, 'ZZTEST recurso dos', 'ZZTEST', v_p) returning id into v_r2;
    insert into recurso (club_id, titulo, descripcion, creado_por)
      values (v_club, 'ZZTEST recurso ajeno', 'ZZTEST', v_p) returning id into v_r3;
    insert into envio_recurso (club_id, recurso_id, jugador_id, fecha)
    select v_club, v_r1, j, v_hoy from unnest(array[v_j1, v_j2, v_j3, v_j5]) as j;
    insert into envio_recurso (club_id, recurso_id, jugador_id, fecha) values (v_club, v_r2, v_j1, v_hoy);


    /* ---------- 1: marcar ---------- */

    txt := '';
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_k1, 'role', 'authenticated')::text, true);
    perform marcar_practica(v_r1, true);
    v_res := marcar_practica(v_r1, true);   -- dos veces el mismo día
    if jsonb_array_length(v_res) <> 1 then txt := txt || 'tras marcar r1 dos veces, mis_practicas trae ' || jsonb_array_length(v_res) || ' (esperaba 1); '; end if;
    v_res := marcar_practica(v_r2, true);
    if jsonb_array_length(v_res) <> 2 then txt := txt || 'tras marcar r2, mis_practicas trae ' || jsonb_array_length(v_res) || ' (esperaba 2); '; end if;

    perform set_config('role', v_rol_previo, true);
    select count(*) into n from practica_jugador where jugador_id = v_j1 and recurso_id = v_r1 and tipo = 'recurso';
    if n <> 1 then txt := txt || 'r1 quedó con ' || n || ' filas (esperaba 1, sin duplicar); '; end if;
    select count(*) into n from practica_jugador where jugador_id = v_j1 and recurso_id = v_r1 and fecha = v_hoy;
    if n <> 1 then txt := txt || 'la fecha de la marca no es hoy en Argentina; '; end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then 'Una fila por recurso y día, aunque marque dos veces; la fecha es hoy (servidor).' else txt end;


    /* ---------- 2: lo que no le enviaron, lo de otro, la ventana ---------- */

    -- Marcas viejas de A (una fuera de las 12 semanas) y de C, como service role.
    insert into practica_jugador (jugador_id, club_id, fecha, tipo, recurso_id) values
      (v_j1, v_club, current_date - 100, 'recurso', v_r1),
      (v_j1, v_club, current_date - 10,  'recurso', v_r1),
      (v_j3, v_club, current_date - 30,  'recurso', v_r1);

    txt := '';
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_k4, 'role', 'authenticated')::text, true);
    perform marcar_practica(v_r1, true);                -- D no recibió r1
    perform set_config('request.jwt.claims', json_build_object('sub', v_k1, 'role', 'authenticated')::text, true);
    perform marcar_practica(v_r3, true);                -- A: r3 no se le envió a nadie
    perform set_config('request.jwt.claims', json_build_object('sub', v_k2, 'role', 'authenticated')::text, true);
    perform marcar_practica(v_r1, true);                -- B sí

    v_res := mis_practicas();
    if jsonb_array_length(v_res) <> 1 then txt := txt || 'B lee ' || jsonb_array_length(v_res) || ' marcas (esperaba 1: la suya); '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_k1, 'role', 'authenticated')::text, true);
    v_res := mis_practicas();
    if jsonb_array_length(v_res) <> 3 then
      txt := txt || 'A lee ' || jsonb_array_length(v_res) || ' marcas (esperaba 3: r1 y r2 de hoy y r1 de hace 10 días); ';
    elsif (v_res->2->>'fecha') <> (current_date - 10)::text then
      txt := txt || 'las marcas no vienen de la más nueva a la más vieja; ';
    end if;
    if v_res::text like '%' || (current_date - 100)::text || '%' then txt := txt || 'A lee una marca de hace más de 12 semanas; '; end if;

    perform set_config('role', v_rol_previo, true);
    select count(*) into n from practica_jugador where jugador_id = v_j4;
    if n <> 0 then txt := txt || 'D anotó un recurso que no le enviaron; '; end if;
    select count(*) into n from practica_jugador where recurso_id = v_r3;
    if n <> 0 then txt := txt || 'A anotó un recurso que no se le envió; '; end if;
    estados[2] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[2] := case when txt = '' then 'Sin envío no hay marca y no da error; cada uno lee las suyas; la lectura corta a 12 semanas.' else txt end;


    /* ---------- 3: la tabla está cerrada ---------- */

    txt := '';
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    begin
      perform 1 from practica_jugador;
      txt := txt || 'el entrenador pudo leer la tabla; ';
    exception when insufficient_privilege then null; end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_k1, 'role', 'authenticated')::text, true);
    begin
      perform 1 from practica_jugador;
      txt := txt || 'el jugador pudo leer la tabla; ';
    exception when insufficient_privilege then null; end;
    begin
      insert into practica_jugador (jugador_id, club_id, fecha, tipo, recurso_id) values (v_j1, v_club, v_hoy - 1, 'recurso', v_r2);
      txt := txt || 'el jugador pudo insertar directo (una fecha de ayer); ';
    exception when insufficient_privilege then null; end;
    begin
      delete from practica_jugador where jugador_id = v_j1;
      txt := txt || 'el jugador pudo borrar directo; ';
    exception when insufficient_privilege then null; end;
    estados[3] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[3] := case when txt = '' then 'select, insert y delete directos dan permiso denegado.' else txt end;


    /* ---------- 4: quien no es jugador recibe null ---------- */

    txt := '';
    foreach v_u in array array[v_p, v_c, v_f, v_s] loop
      perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
      if mis_practicas() is not null then txt := txt || 'mis_practicas no dio null (' || v_u || '); '; end if;
      if mi_asistencia() is not null then txt := txt || 'mi_asistencia no dio null (' || v_u || '); '; end if;
      if marcar_practica(v_r1, true) is not null then txt := txt || 'marcar_practica no dio null (' || v_u || '); '; end if;
    end loop;
    perform set_config('role', v_rol_previo, true);
    -- Marcas de hoy de r1: A y B, nadie más.
    select count(*) into n from practica_jugador where recurso_id = v_r1 and fecha = v_hoy;
    if n <> 2 then txt := txt || 'hay ' || n || ' marcas de hoy de r1 (esperaba 2: A y B); '; end if;
    estados[4] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[4] := case when txt = '' then 'Profe, coordinador, familia (con vínculo a A) y cuenta sin vínculo: null y ninguna marca.' else txt end;


    /* ---------- 5: el conteo del profe ---------- */

    txt := '';
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    v_res := practicas_del_plantel(v_p1);
    perform set_config('role', v_rol_previo, true);
    -- 4 cuentas (A, B, C, D). Hoy marcaron A (r1 y r2) y B (r1); C marcó r1 hace 30 días.
    if (v_res->>'conCuenta')::int is distinct from 4 then txt := txt || 'conCuenta = ' || coalesce(v_res->>'conCuenta', 'null') || ' (esperaba 4); '; end if;
    if (v_res->>'marcaronEstaSemana')::int is distinct from 2 then txt := txt || 'marcaronEstaSemana = ' || coalesce(v_res->>'marcaronEstaSemana', 'null') || ' (esperaba 2); '; end if;
    select count(*) into n from jsonb_array_elements(v_res->'recursos') x
      where x->>'recursoId' = v_r1::text and (x->>'estaSemana')::int = 2 and (x->>'algunaVez')::int = 3;
    if n <> 1 then txt := txt || 'r1 no sale con 2 esta semana y 3 alguna vez; '; end if;
    select count(*) into n from jsonb_array_elements(v_res->'recursos') x
      where x->>'recursoId' = v_r2::text and (x->>'estaSemana')::int = 1 and (x->>'algunaVez')::int = 1;
    if n <> 1 then txt := txt || 'r2 no sale con 1 esta semana y 1 alguna vez; '; end if;
    if jsonb_array_length(v_res->'recursos') <> 2 then txt := txt || 'salen ' || jsonb_array_length(v_res->'recursos') || ' recursos (esperaba 2: r3 no se envió a nadie); '; end if;
    if v_res::text ~* ('(' || v_j1 || '|' || v_j2 || '|' || v_j3 || '|' || v_j4 || '|' || v_j5 || '|' || v_k1 || '|ZZTEST)') then
      txt := txt || 'el conteo contiene un id o un nombre; ';
    end if;
    estados[5] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[5] := case when txt = '' then 'Sólo conteos: 4 cuentas, 2 marcaron esta semana, r1 a 2 (3 alguna vez), r2 a 1.' else txt end;


    /* ---------- 6: quién más lo puede pedir ---------- */

    txt := '';
    perform set_config('role', 'authenticated', true);
    foreach v_u in array array[v_p2u, v_c, v_k1, v_f] loop
      perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
      if practicas_del_plantel(v_p1) is not null then txt := txt || 'devolvió el conteo a ' || v_u || '; '; end if;
    end loop;
    perform set_config('role', v_rol_previo, true);
    estados[6] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[6] := case when txt = '' then 'El profe de otro plantel, el coordinador, un jugador y una familia reciben null.' else txt end;


    /* ---------- 7 y 8: mi_asistencia ---------- */

    -- Días de A (hace N días), tomados por el profe como en la app:
    --   100 presente en P1                        -> true
    --    90 presente en P1, ausente en P2         -> true  (alcanza con uno)
    --    80 ausente en P1 (B presente)            -> false (nada de B se mezcla)
    --    70 justificada con motivo 'familia'      -> false (la justificada es falta)
    --    60 hubo y no se lo tomó                  -> null  (B presente: tampoco)
    --    50 ausente y lesionado                   -> null  (pausa)
    --    40 presente y lesionado                  -> true  (un lesionado que vino cuenta)
    --    39 ausente, es el día del alta           -> false (el alta ya no cuenta como lesión)
    --    30 "no hubo" (SE)                        -> no sale
    --    25 P3 (A todavía estaba), nadie tomado   -> null
    --    20 ausente en P1 y justificada en P2     -> false
    --    10 P3 (A ya no estaba)                   -> no sale
    --   400 presente en P1 (más de 12 meses)      -> no sale
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    perform guardar_asistencia(v_p1, current_date - 400, true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'presente')));
    perform guardar_asistencia(v_p1, current_date - 100, true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'presente')));
    perform guardar_asistencia(v_p1, current_date - 90,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'presente')));
    perform guardar_asistencia(v_p2, current_date - 90,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'ausente')));
    perform guardar_asistencia(v_p1, current_date - 80,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'ausente'),
                                                                                jsonb_build_object('jugadorId', v_j2, 'estado', 'presente')));
    perform guardar_asistencia(v_p1, current_date - 70,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'justificada', 'motivo', 'familia')));
    perform guardar_asistencia(v_p1, current_date - 60,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j2, 'estado', 'presente')));
    perform guardar_asistencia(v_p1, current_date - 50,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'ausente')));
    perform guardar_asistencia(v_p1, current_date - 40,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'presente')));
    perform guardar_asistencia(v_p1, current_date - 39,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'ausente')));
    perform guardar_asistencia(v_p1, current_date - 30,  false, '[]'::jsonb);
    perform guardar_asistencia(v_p3, current_date - 25,  true, '[]'::jsonb);
    perform guardar_asistencia(v_p1, current_date - 20,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'ausente')));
    perform guardar_asistencia(v_p2, current_date - 20,  true, jsonb_build_array(jsonb_build_object('jugadorId', v_j1, 'estado', 'justificada')));
    perform guardar_asistencia(v_p3, current_date - 10,  true, '[]'::jsonb);
    -- Lesión de A: cubre los días 51 a 40 y el alta es el día 39.
    insert into lesion (club_id, jugador_id, desde, hasta, zona)
      values (v_club, v_j1, current_date - 51, current_date - 39, 'tobillo');

    perform set_config('request.jwt.claims', json_build_object('sub', v_k1, 'role', 'authenticated')::text, true);
    v_res := mi_asistencia();
    perform set_config('role', v_rol_previo, true);

    txt := '';
    if jsonb_array_length(v_res) <> 10 then txt := txt || 'salen ' || jsonb_array_length(v_res) || ' días (esperaba 10); '; end if;
    for r in select * from (values (100,'true'), (90,'true'), (80,'false'), (70,'false'), (60,'null'),
                                   (50,'null'), (40,'true'), (39,'false'), (25,'null'), (20,'false')) as e(dias, esperado) loop
      select x->'vino' into v_vino from jsonb_array_elements(v_res) x where x->>'fecha' = (current_date - r.dias)::text;
      if not found then
        txt := txt || 'falta el día de hace ' || r.dias || '; ';
      elsif v_vino::text <> r.esperado then
        txt := txt || 'hace ' || r.dias || ' días dio ' || v_vino::text || ' (esperaba ' || r.esperado || '); ';
      end if;
    end loop;
    if exists (select 1 from jsonb_array_elements(v_res) x
               where x->>'fecha' in ((current_date - 400)::text, (current_date - 30)::text, (current_date - 10)::text)) then
      txt := txt || 'sale un día que no corresponde (más de 12 meses, "no hubo" o ya sin pertenencia); ';
    end if;
    if jsonb_array_length(v_res) > 1 and (v_res->0->>'fecha') > (v_res->(jsonb_array_length(v_res) - 1)->>'fecha') then
      txt := txt || 'los días no vienen de más viejo a más nuevo; ';
    end if;
    estados[7] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[7] := case when txt = '' then 'Diez días con la regla en orden; fuera: >12 meses, SE y sin pertenencia.' else txt end;

    txt := '';
    if exists (select 1 from jsonb_array_elements(v_res) x
               where (select count(*) from jsonb_object_keys(x)) <> 2 or not (x ? 'fecha' and x ? 'vino')) then
      txt := txt || 'algún día trae claves de más; ';
    end if;
    if v_res::text ~* '(familia|motivo|estado|zona|tobillo|lesion|marcado|justificada)' then
      txt := txt || 'la salida contiene un motivo, un estado o una lesión; ';
    end if;
    estados[8] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[8] := case when txt = '' then 'Cada día trae sólo fecha y vino.' else txt end;


    /* ---------- 9: desmarcar ---------- */

    txt := '';
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_k1, 'role', 'authenticated')::text, true);
    v_res := marcar_practica(v_r1, false);
    perform set_config('role', v_rol_previo, true);
    -- A tenía r1 hoy, r2 hoy y r1 hace 10 días: queda r2 hoy y r1 hace 10 días.
    if jsonb_array_length(v_res) <> 2 then txt := txt || 'quedaron ' || jsonb_array_length(v_res) || ' marcas visibles (esperaba 2); '; end if;
    select count(*) into n from practica_jugador where jugador_id = v_j1 and recurso_id = v_r1 and fecha = v_hoy;
    if n <> 0 then txt := txt || 'no borró la de hoy; '; end if;
    select count(*) into n from practica_jugador where jugador_id = v_j1 and recurso_id = v_r1 and fecha = current_date - 10;
    if n <> 1 then txt := txt || 'borró la de otro día; '; end if;
    select count(*) into n from practica_jugador where recurso_id = v_r1 and jugador_id = v_j2 and fecha = v_hoy;
    if n <> 1 then txt := txt || 'tocó la marca de B; '; end if;
    estados[9] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[9] := case when txt = '' then 'Sólo desapareció la de hoy; la de hace 10 días y la de B siguen.' else txt end;


    /* ---------- 10: recurso borrado ---------- */

    txt := '';
    delete from recurso where id = v_r2;
    select count(*) into n from practica_jugador where jugador_id = v_j1 and recurso_id is null and fecha = v_hoy;
    if n <> 1 then txt := txt || 'la marca de hoy no quedó con recurso null (' || n || '); '; end if;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_k1, 'role', 'authenticated')::text, true);
    v_res := mis_practicas();
    perform set_config('role', v_rol_previo, true);
    if jsonb_array_length(v_res) <> 2 then txt := txt || 'A lee ' || jsonb_array_length(v_res) || ' marcas (esperaba 2); '; end if;
    select count(*) into n from jsonb_array_elements(v_res) x where jsonb_typeof(x->'recursoId') = 'null' and x->>'fecha' = v_hoy::text;
    if n <> 1 then txt := txt || 'el día sin recurso no se lee con recursoId null; '; end if;
    estados[10] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[10] := case when txt = '' then 'El día practicado sigue, con recursoId null.' else txt end;


    /* ---------- 11: piso de 3 cuentas y cuenta cerrada ---------- */

    -- Se cierran las cuentas de C y D: quedan A y B (2 cuentas vigentes).
    update cuenta_jugador set hasta = now(), revocado_por = v_p where jugador_id in (v_j3, v_j4) and hasta is null;
    txt := '';
    select count(*) into n from practica_jugador where jugador_id = v_j3;
    if n <> 0 then txt := txt || 'las marcas de C no se borraron al cerrar su cuenta; '; end if;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    v_res := practicas_del_plantel(v_p1);
    perform set_config('role', v_rol_previo, true);
    if (v_res->>'conCuenta')::int is distinct from 2 then txt := txt || 'conCuenta = ' || coalesce(v_res->>'conCuenta', 'null') || ' (esperaba 2); '; end if;
    if jsonb_typeof(v_res->'marcaronEstaSemana') <> 'null' then txt := txt || 'marcaronEstaSemana informa un número; '; end if;
    select count(*) into n from jsonb_array_elements(v_res->'recursos') x
      where jsonb_typeof(x->'estaSemana') <> 'null' or jsonb_typeof(x->'algunaVez') <> 'null';
    if n <> 0 then txt := txt || 'un recurso informa cuántos practicaron; '; end if;
    estados[11] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[11] := case when txt = '' then 'Con 2 cuentas vigentes todo sale null; cerrar la cuenta de C borró sus marcas.' else txt end;


    /* ---------- 12: pertenencia ---------- */

    txt := '';
    -- A deja P2 pero sigue en P1: las marcas quedan. La cierra el profe (el
    -- trigger sella a quién la cierra).
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_p, 'role', 'authenticated')::text, true);
    update pertenencia set hasta = current_date where jugador_id = v_j1 and plantel_id = v_p2 and hasta is null;
    perform set_config('role', v_rol_previo, true);
    select count(*) into n from practica_jugador where jugador_id = v_j1;
    if n <> 3 then txt := txt || 'A quedó con ' || n || ' marcas tras dejar P2 (esperaba 3: sigue en P1); '; end if;

    -- B deja P1 y no tiene otra pertenencia vigente: sus marcas se borran.
    select count(*) into n from practica_jugador where jugador_id = v_j2;
    if n <> 1 then txt := txt || 'B tenía ' || n || ' marcas antes de irse (esperaba 1); '; end if;
    perform set_config('role', 'authenticated', true);
    update pertenencia set hasta = current_date where jugador_id = v_j2 and plantel_id = v_p1 and hasta is null;
    perform set_config('role', v_rol_previo, true);
    select count(*) into n from practica_jugador where jugador_id = v_j2;
    if n <> 0 then txt := txt || 'B quedó con ' || n || ' marcas sin ninguna pertenencia vigente; '; end if;
    estados[12] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[12] := case when txt = '' then 'Con otra pertenencia vigente quedan; con la última cerrada, se borran.' else txt end;


    /* ---------- 13: cuenta cerrada ---------- */

    txt := '';
    update cuenta_jugador set hasta = now(), revocado_por = v_p where jugador_id = v_j1 and hasta is null;
    select count(*) into n from practica_jugador where jugador_id = v_j1;
    if n <> 0 then txt := txt || 'A quedó con ' || n || ' marcas con la cuenta cerrada; '; end if;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_k1, 'role', 'authenticated')::text, true);
    if mis_practicas() is not null then txt := txt || 'una cuenta cerrada lee mis_practicas; '; end if;
    if mi_asistencia() is not null then txt := txt || 'una cuenta cerrada lee mi_asistencia; '; end if;
    if marcar_practica(v_r1, true) is not null then txt := txt || 'una cuenta cerrada marca; '; end if;
    perform set_config('role', v_rol_previo, true);
    select count(*) into n from practica_jugador where jugador_id = v_j1;
    if n <> 0 then txt := txt || 'la cuenta cerrada dejó una marca nueva; '; end if;
    estados[13] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[13] := case when txt = '' then 'Cerrar la cuenta borra las marcas; después no lee ni marca.' else txt end;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then
      null;  -- salida normal: todo lo escrito arriba quedó deshecho
    when others then
      falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_constancia values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;

  for i in 1..13 loop
    insert into verificacion_constancia values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_constancia
order by n;
