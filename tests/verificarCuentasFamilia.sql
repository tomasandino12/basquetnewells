-- Verificación de 0057 (cuentas de familia).
--
-- CÓMO SE CORRE: en la base LOCAL después de aplicar 0057:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres < tests/verificarCuentasFamilia.sql
-- En producción, pegado entero en el SQL Editor como service role: no deja
-- nada (ver abajo), pero usa el club de prueba de 0003.
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA: todo va dentro de un sub-bloque que se deshace al final con
-- un SQLSTATE reservado. Usuarios, chicos y mails sintéticos (ZZTEST,
-- dominio .invalid). Ningún dato real de ningún menor entra ni sale de acá.
--
-- La impersonación (role = authenticated + request.jwt.claims) es como
-- PostgREST evalúa RLS para una sesión real.

drop table if exists verificacion_0057;
create temporary table verificacion_0057 (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_club uuid := '00000000-0000-0000-0000-000000000001';   -- club de prueba (0003)
  v_u21  uuid := '00000000-0000-0000-0000-000000000003';
  v_u17  uuid := '00000000-0000-0000-0000-000000000004';
  v_t    uuid := '00000000-0000-0000-0000-000000000002';
  v_otro_club uuid := gen_random_uuid();
  v_rol_previo text := current_setting('role');

  v_pa uuid := gen_random_uuid();   -- entrenador U17M
  v_pb uuid := gen_random_uuid();   -- entrenador U21M
  v_co uuid := gen_random_uuid();   -- coordinador puro
  v_f1 uuid := gen_random_uuid();   -- padre del chico nuevo
  v_f2 uuid := gen_random_uuid();   -- madre del chico nuevo
  v_f3 uuid := gen_random_uuid();   -- padre del reinscripto
  v_sc uuid := gen_random_uuid();   -- mail del chico nuevo, SIN confirmar
  v_ex uuid := gen_random_uuid();   -- confirmado, sin ningún chico
  v_kj uuid := gen_random_uuid();   -- cuenta de jugador

  v_e uuid;          -- reinscripto: viene de U21M, sin fecha
  v_ajeno uuid;      -- ficha de otro club
  v_n uuid;          -- chico nuevo, lo crea el import
  v_vin uuid;
  v_res jsonb;
  v_payload jsonb;
  n integer; m integer;
  txt text;
  r record;
  t text;

  nombres text[] := array[
    '1. Import: crea el chico nuevo, suma al reinscripto y anota los mails',
    '2. Reimportar la misma planilla no duplica nada',
    '3. Un entrenador no importa en un plantel ajeno, ni fichas de otro club',
    '4. Si una fila falla, no queda nada de la planilla',
    '5. La familia se vincula sola con su mail, una sola vez',
    '6. Cada familia ve sólo a sus chicos (A no ve los de B)',
    '7. Una familia no lee ninguna tabla directo ni escribe',
    '8. Mail sin confirmar no vincula; sin chicos no ve nada',
    '9. Staff y cuenta de jugador no pueden vincularse como familia',
    '10. El coordinador ve los vínculos; nadie más',
    '11. Dar de baja cierra, no borra, y no se reabre solo',
    '12. Profes y coordinador ven lo mismo que antes'
  ];
  estados  text[] := array_fill('no corrió'::text, array[12]);
  detalles text[] := array_fill(''::text, array[12]);
  falla_setup text := null;
begin

  begin

    /* ---------- setup, como service role ---------- */

    if not exists (select 1 from plantel where id = v_u17 and club_id = v_club)
       or not exists (select 1 from plantel where id = v_u21 and club_id = v_club) then
      raise exception 'No encontré U17M y U21M del club de prueba (0003).';
    end if;

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
                            raw_user_meta_data)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest-' || u.etiqueta || '@familia.invalid',
           case when u.etiqueta = 'sc' then null else now() end, now(), now(),
           jsonb_build_object('nombre', 'ZZTEST Nombre ' || u.etiqueta)
    from (values (v_pa,'pa'), (v_pb,'pb'), (v_co,'co'), (v_f1,'f1'), (v_f2,'f2'),
                 (v_f3,'f3'), (v_sc,'sc'), (v_ex,'ex'), (v_kj,'kj')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_pa, v_club, true, false), (v_pb, v_club, true, false), (v_co, v_club, false, true);
    insert into asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen) values
      (v_pa, v_club, v_u17, 'manual'), (v_pb, v_club, v_u21, 'manual');

    insert into jugador (club_id, nombre_clave, nombre_limpio)
      values (v_club, 'ZZTEST FAMILIA REINSCRIPTO', 'ZZTEST, FAMILIA REINSCRIPTO') returning id into v_e;
    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde)
      values (v_club, v_e, v_u21, v_t, '2026-03-01');
    insert into club (id, nombre) values (v_otro_club, 'ZZTEST Otro club');
    insert into jugador (club_id, nombre_clave, nombre_limpio)
      values (v_otro_club, 'ZZTEST FAMILIA AJENO', 'ZZTEST, FAMILIA AJENO') returning id into v_ajeno;
    -- La cuenta de jugador del caso 9 (setup directo, sin el flujo).
    insert into cuenta_jugador (user_id, club_id, jugador_id, aprobado_por) values (v_kj, v_club, v_e, v_pb);

    perform set_config('role', 'authenticated', true);

    /* ---------- 1: import ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    v_payload := jsonb_build_object('plantelId', v_u17, 'filas', jsonb_build_array(
      jsonb_build_object('nombreClave', 'ZZTEST FAMILIA NUEVO', 'nombreLimpio', 'ZZTEST, FAMILIA NUEVO',
                         'fechaNacimiento', '2010-05-06',
                         'mails', jsonb_build_array('zztest-f1@familia.invalid', 'zztest-f2@familia.invalid',
                                                    'zztest-sc@familia.invalid')),
      jsonb_build_object('jugadorId', v_e, 'fechaNacimiento', '2009-01-02',
                         'mails', jsonb_build_array('zztest-f3@familia.invalid'))));
    v_res := importar_inscriptos(v_payload);
    txt := '';
    if v_res <> '{"creados": 1, "existentes": 1, "mails": 4}'::jsonb then txt := txt || 'devolvió ' || v_res::text || '; '; end if;
    select id into v_n from jugador where club_id = v_club and nombre_clave = 'ZZTEST FAMILIA NUEVO';
    if v_n is null then txt := txt || 'no creó el chico nuevo; '; end if;
    select count(*) into n from pertenencia where jugador_id in (v_n, v_e) and plantel_id = v_u17 and hasta is null;
    if n <> 2 then txt := txt || n || ' pertenencias en U17M (esperaba 2); '; end if;
    perform set_config('role', v_rol_previo, true);
    select count(*) into n from pertenencia where jugador_id = v_e and plantel_id = v_u21 and hasta is null;
    perform set_config('role', 'authenticated', true);
    if n <> 1 then txt := txt || 'tocó la pertenencia de U21M; '; end if;
    if (select fecha_nacimiento from jugador where id = v_e) is distinct from '2009-01-02' then
      txt := txt || 'no completó la fecha del reinscripto; ';
    end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then '1 creado, 1 existente, 4 mails; U21M intacta.' else txt end;

    /* ---------- 2: reimportar ---------- */

    v_payload := jsonb_set(v_payload, '{filas,0}',
      (v_payload->'filas'->0) - 'nombreClave' - 'nombreLimpio' || jsonb_build_object('jugadorId', v_n));
    v_res := importar_inscriptos(v_payload);
    select count(*) into n from pertenencia where jugador_id in (v_n, v_e) and plantel_id = v_u17;
    select count(*) into m from responsable_jugador where jugador_id in (v_n, v_e);
    estados[2] := case when v_res = '{"creados": 0, "existentes": 2, "mails": 0}'::jsonb and n = 2 and m = 4
                       then 'OK' else 'FALLA' end;
    detalles[2] := 'devolvió ' || v_res::text || ', ' || n || ' pertenencias, ' || m || ' mails.';

    /* ---------- 3: plantel ajeno y ficha de otro club ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pb, 'role', 'authenticated')::text, true);
    begin
      perform importar_inscriptos(jsonb_build_object('plantelId', v_u17, 'filas', '[]'::jsonb));
      txt := txt || 'U21 importó en U17; ';
    exception when insufficient_privilege then null;
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    begin
      perform importar_inscriptos(jsonb_build_object('plantelId', v_u17, 'filas',
        jsonb_build_array(jsonb_build_object('jugadorId', v_ajeno, 'mails', '[]'::jsonb))));
      txt := txt || 'aceptó una ficha de otro club; ';
    exception when others then
      if sqlerrm not like 'JUGADOR_DE_OTRO_CLUB%' then txt := txt || 'otro error: ' || sqlerrm || '; '; end if;
    end;
    estados[3] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[3] := case when txt = '' then '42501 y JUGADOR_DE_OTRO_CLUB.' else txt end;

    /* ---------- 4: atómico ---------- */

    begin
      perform importar_inscriptos(jsonb_build_object('plantelId', v_u17, 'filas', jsonb_build_array(
        jsonb_build_object('nombreClave', 'ZZTEST FAMILIA A MEDIAS', 'nombreLimpio', 'ZZTEST, FAMILIA A MEDIAS',
                           'fechaNacimiento', '2010-01-01', 'mails', '[]'::jsonb),
        jsonb_build_object('nombreClave', 'ZZTEST FAMILIA SIN FECHA', 'nombreLimpio', 'ZZTEST, FAMILIA SIN FECHA',
                           'mails', '[]'::jsonb))));
      estados[4] := 'FALLA'; detalles[4] := 'aceptó una ficha nueva sin fecha';
    exception when others then
      perform set_config('role', v_rol_previo, true);
      select count(*) into n from jugador where nombre_clave = 'ZZTEST FAMILIA A MEDIAS';
      perform set_config('role', 'authenticated', true);
      estados[4] := case when n = 0 and sqlerrm like 'FECHA_NACIMIENTO_REQUERIDA (fila 2)%' then 'OK' else 'FALLA' end;
      detalles[4] := sqlerrm || '; quedaron ' || n || ' fichas de la fila 1.';
    end;

    /* ---------- 5: vincular por mail ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_f1, 'role', 'authenticated')::text, true);
    n := vincular_por_mail();
    m := vincular_por_mail();
    select string_agg(nombre || ' / ' || coalesce(categorias, '-'), '; ') into txt from mis_chicos();
    estados[5] := case when n = 1 and m = 0 and txt = 'ZZTEST, FAMILIA NUEVO / Sub-17 Masculino' then 'OK' else 'FALLA' end;
    detalles[5] := 'primera vez ' || n || ', segunda ' || m || ': ' || coalesce(txt, 'nada');

    /* ---------- 6: cada familia lo suyo ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_f2, 'role', 'authenticated')::text, true);
    perform vincular_por_mail();
    if (select string_agg(nombre, ',') from mis_chicos()) is distinct from 'ZZTEST, FAMILIA NUEVO' then
      txt := txt || 'la madre no ve exactamente al nuevo; ';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_f3, 'role', 'authenticated')::text, true);
    perform vincular_por_mail();
    if (select string_agg(nombre || '/' || categorias, ',') from mis_chicos())
       is distinct from 'ZZTEST, FAMILIA REINSCRIPTO/Sub-17 Masculino, Sub-21 Masculino' then
      txt := txt || 'el padre del reinscripto ve: ' || coalesce((select string_agg(nombre || '/' || coalesce(categorias,'-'), ',') from mis_chicos()), 'nada') || '; ';
    end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_f1, 'role', 'authenticated')::text, true);
    if exists (select 1 from mis_chicos() where nombre = 'ZZTEST, FAMILIA REINSCRIPTO') then
      txt := txt || 'el padre 1 ve al reinscripto; ';
    end if;
    estados[6] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[6] := case when txt = '' then 'Tres familias, cada una con lo suyo.' else txt end;

    /* ---------- 7: tablas directo ---------- */

    txt := '';
    -- Todas las tablas de public, no una lista: una tabla nueva que se olvide
    -- de la familia aparece acá sola. categoria es el catálogo público de
    -- nombres (Sub-17 Masculino…), sin datos de nadie.
    for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'categoria' order by 1 loop
      begin
        execute format('select count(*) from public.%I', t) into n;
        if n > 0 then txt := txt || t || ' devolvió ' || n || '; '; end if;
      exception when insufficient_privilege then null;
      end;
    end loop;
    begin
      insert into vinculo_familia (user_id, club_id, jugador_id) values (v_f1, v_club, v_e);
      txt := txt || 'insertó un vínculo a mano; ';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into responsable_jugador (club_id, jugador_id, email) values (v_club, v_e, 'zztest-f1@familia.invalid');
      txt := txt || 'cargó un mail a mano; ';
    exception when insufficient_privilege then null;
    end;
    begin
      update vinculo_familia set hasta = now() where user_id = v_f1;
      txt := txt || 'tocó vinculo_familia; ';
    exception when insufficient_privilege then null;
    end;
    estados[7] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[7] := case when txt = '' then 'Todas las tablas de public (menos el catálogo de categorías) en cero o sin permiso; no escribe.' else txt end;

    /* ---------- 8: sin confirmar y sin chicos ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_sc, 'role', 'authenticated')::text, true);
    n := vincular_por_mail();
    select count(*) into m from mis_chicos();
    perform set_config('request.jwt.claims', json_build_object('sub', v_ex, 'role', 'authenticated')::text, true);
    perform vincular_por_mail();
    select count(*) + m into m from mis_chicos();
    estados[8] := case when n = 0 and m = 0 then 'OK' else 'FALLA' end;
    detalles[8] := 'sin confirmar vinculó ' || n || '; entre los dos ven ' || m || ' chicos.';

    /* ---------- 9: staff y jugador ---------- */

    txt := '';
    foreach v_vin in array array[v_pa, v_co, v_kj] loop
      perform set_config('request.jwt.claims', json_build_object('sub', v_vin, 'role', 'authenticated')::text, true);
      begin
        perform vincular_por_mail();
        txt := txt || v_vin || ' pudo; ';
      exception when insufficient_privilege then null;
      end;
    end loop;
    estados[9] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[9] := case when txt = '' then 'Profe, coordinador y jugador: 42501.' else txt end;

    /* ---------- 10: lista del coordinador ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    select count(*) into n from vinculos_familia_del_club(v_club) where jugador like 'ZZTEST, FAMILIA%';
    if n <> 3 then txt := txt || 've ' || n || ' vínculos (esperaba 3); '; end if;
    if exists (select 1 from vinculos_familia_del_club(v_club)
               where jugador like 'ZZTEST, FAMILIA%' and email_enmascarado not like 'z***@familia.invalid') then
      txt := txt || 'el mail no sale enmascarado; ';
    end if;
    select v.id into v_vin from vinculos_familia_del_club(v_club) v where v.nombre = 'ZZTEST Nombre f1';
    if v_vin is null then txt := txt || 'no figura quién (nombre de Auth); '; end if;
    for i in 1..2 loop
      perform set_config('request.jwt.claims', json_build_object('sub', case i when 1 then v_pa else v_f1 end,
                         'role', 'authenticated')::text, true);
      begin
        perform vinculos_familia_del_club(v_club);
        txt := txt || case i when 1 then 'el profe' else 'la familia' end || ' ve la lista; ';
      exception when insufficient_privilege then null;
      end;
    end loop;
    estados[10] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[10] := case when txt = '' then '3 vínculos con nombre y mail enmascarado; profe y familia: 42501.' else txt end;

    /* ---------- 11: baja ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    begin
      perform cerrar_vinculo_familia(v_vin);
      txt := txt || 'el profe dio de baja; ';
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    perform cerrar_vinculo_familia(v_vin);
    begin
      perform cerrar_vinculo_familia(v_vin);
      txt := txt || 'cerró dos veces; ';
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_f1, 'role', 'authenticated')::text, true);
    if exists (select 1 from mis_chicos()) then txt := txt || 'la familia sigue viendo al chico; '; end if;
    if vincular_por_mail() <> 0 then txt := txt || 'se reabrió al volver a entrar; '; end if;
    perform set_config('role', v_rol_previo, true);
    select count(*) into n from vinculo_familia
      where id = v_vin and hasta is not null and cerrado_por = v_co;
    perform set_config('role', 'authenticated', true);
    if n <> 1 then txt := txt || 'la fila no quedó cerrada y sellada por el coordinador; '; end if;
    estados[11] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[11] := case when txt = '' then 'Cerrado y sellado; la familia no ve nada y no se reabre.' else txt end;

    /* ---------- 12: lo de antes ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    select count(*) into n from jugador where id in (v_n, v_e);
    if n <> 2 then txt := txt || 'el profe de U17 ve ' || n || ' de sus 2 chicos; '; end if;
    select count(*) into n from responsable_jugador where jugador_id in (v_n, v_e);
    if n <> 4 then txt := txt || 'el profe de U17 ve ' || n || ' mails (esperaba 4); '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_pb, 'role', 'authenticated')::text, true);
    if exists (select 1 from jugador where id = v_n) then txt := txt || 'el profe de U21 ve al chico de U17; '; end if;
    select count(*) into n from responsable_jugador where jugador_id = v_n;
    if n <> 0 then txt := txt || 'el profe de U21 ve mails de U17; '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    select count(*) into n from responsable_jugador;
    if n <> 0 then txt := txt || 'coordinación lee responsable_jugador; '; end if;
    estados[12] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[12] := case when txt = '' then 'Cada profe ve sólo su plantel; coordinación no lee mails.' else txt end;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then null;
    when others then falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_0057 values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;
  for i in 1..12 loop
    insert into verificacion_0057 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_0057
order by n;
