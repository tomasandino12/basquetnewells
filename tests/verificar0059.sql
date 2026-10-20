-- Verificación de 0059 (cambio de temporada y emergencias).
--
-- CÓMO SE CORRE: en la base LOCAL después de aplicar 0059:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres < tests/verificar0059.sql
-- Para probar sin dejar 0059 aplicada: begin; \i 0059; \i este archivo; rollback;
-- En producción, pegado entero en el SQL Editor como service role: no deja
-- nada, pero usa el club de prueba de 0003.
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA: todo va dentro de un sub-bloque que se deshace al final con
-- un SQLSTATE reservado. Usuarios y chicos sintéticos (ZZTEST, dominio
-- .invalid). Ningún dato real de ningún menor entra ni sale de acá.

drop table if exists verificacion_0059;
create temporary table verificacion_0059 (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_club uuid := '00000000-0000-0000-0000-000000000001';   -- club de prueba (0003)
  v_u21  uuid := '00000000-0000-0000-0000-000000000003';
  v_u17  uuid := '00000000-0000-0000-0000-000000000004';
  v_t    uuid := '00000000-0000-0000-0000-000000000002';   -- temporada 2026
  v_rol_previo text := current_setting('role');

  v_pa uuid := gen_random_uuid();   -- entrenador U17M
  v_pb uuid := gen_random_uuid();   -- entrenador U21M
  v_co uuid := gen_random_uuid();   -- coordinador puro
  v_kj uuid := gen_random_uuid();   -- cuenta de jugador del chico A
  v_ex uuid := gen_random_uuid();   -- cuenta sin club

  v_a uuid;      -- sigue: pasa a U17M 2027
  v_b uuid;      -- no sigue
  v_c uuid;      -- en U21M (otro plantel)
  v_nueva uuid;
  v_u17_nuevo uuid;
  v_u uuid;
  v_res jsonb;
  n integer;
  txt text;
  r record;

  nombres text[] := array[
    '1. El profe importa la emergencia de un chico de su plantel',
    '2. Ni otro profe, ni un chico de otro plantel, ni datos fuera de regla',
    '3. Ven el profe del plantel y el coordinador; nadie más',
    '4. Nadie borra una emergencia a mano',
    '5. Abrir 2027: sólo coordinación, copia los planteles, una vez',
    '6. Pases pendientes: el coordinador ve año y categoría, no la fecha',
    '7. Confirmar pases: abre la nueva, cierra la vieja sellada, todo o nada',
    '8. "No sigue" borra la emergencia; el que pasa la conserva',
    '9. El profe sigue viendo lo de antes'
  ];
  estados  text[] := array_fill('no corrió'::text, array[9]);
  detalles text[] := array_fill(''::text, array[9]);
  falla_setup text := null;
begin

  begin

    /* ---------- setup, como service role ---------- */

    if not exists (select 1 from plantel where id = v_u17 and club_id = v_club)
       or not exists (select 1 from plantel where id = v_u21 and club_id = v_club) then
      raise exception 'No encontré U17M y U21M del club de prueba (0003).';
    end if;
    if (select nombre from temporada where id = public.temporada_vigente_de(v_club)) <> '2026' then
      raise exception 'La temporada vigente del club de prueba no es 2026.';
    end if;

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
                            raw_user_meta_data)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest-' || u.etiqueta || '@0059.invalid', now(), now(), now(),
           jsonb_build_object('nombre', 'ZZTEST Nombre ' || u.etiqueta)
    from (values (v_pa,'pa'), (v_pb,'pb'), (v_co,'co'), (v_kj,'kj'), (v_ex,'ex')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_pa, v_club, true, false), (v_pb, v_club, true, false), (v_co, v_club, false, true);
    insert into asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen) values
      (v_pa, v_club, v_u17, 'manual'), (v_pb, v_club, v_u21, 'manual');

    insert into jugador (club_id, nombre_clave, nombre_limpio, fecha_nacimiento)
      values (v_club, 'ZZTEST 0059 SIGUE', 'ZZTEST, 0059 SIGUE', '2010-05-06') returning id into v_a;
    insert into jugador (club_id, nombre_clave, nombre_limpio, fecha_nacimiento)
      values (v_club, 'ZZTEST 0059 SE VA', 'ZZTEST, 0059 SE VA', '2009-02-03') returning id into v_b;
    insert into jugador (club_id, nombre_clave, nombre_limpio)
      values (v_club, 'ZZTEST 0059 U21', 'ZZTEST, 0059 U21') returning id into v_c;
    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde) values
      (v_club, v_a, v_u17, v_t, '2026-03-01'),
      (v_club, v_b, v_u17, v_t, '2026-03-01'),
      (v_club, v_c, v_u21, v_t, '2026-03-01');
    insert into cuenta_jugador (user_id, club_id, jugador_id, aprobado_por) values (v_kj, v_club, v_a, v_pa);

    perform set_config('role', 'authenticated', true);

    /* ---------- 1: importar ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    v_res := importar_emergencias(jsonb_build_object('plantelId', v_u17, 'filas', jsonb_build_array(
      jsonb_build_object('jugadorId', v_a, 'telefonoAdulto', ' 341 555-0000 ', 'contactoUrgencia', 'ZZTEST tía 341 555-0001',
                         'alertas', jsonb_build_array('asma', 'epilepsia'), 'alergias', '', 'obraSocial', 'ZZTEST OS'),
      jsonb_build_object('jugadorId', v_b, 'telefonoAdulto', '341 555-0002'))));
    txt := '';
    if v_res <> '{"guardados": 2}'::jsonb then txt := txt || 'devolvió ' || v_res::text || '; '; end if;
    select * into r from emergencia_jugador where jugador_id = v_a;
    if r.telefono_adulto is distinct from '341 555-0000' then txt := txt || 'no recortó el teléfono; '; end if;
    if r.alergias is not null then txt := txt || 'texto vacío no quedó NULL; '; end if;
    if r.alertas <> array['asma', 'epilepsia'] then txt := txt || 'alertas: ' || r.alertas::text || '; '; end if;
    if r.actualizado_por <> v_pa then txt := txt || 'no selló actualizado_por; '; end if;
    -- Reimportar pisa lo anterior.
    perform importar_emergencias(jsonb_build_object('plantelId', v_u17, 'filas', jsonb_build_array(
      jsonb_build_object('jugadorId', v_a, 'telefonoAdulto', '341 555-0009', 'alertas', jsonb_build_array('asma')))));
    select * into r from emergencia_jugador where jugador_id = v_a;
    if r.telefono_adulto <> '341 555-0009' or r.alertas <> array['asma'] or r.obra_social is not null then
      txt := txt || 'reimportar no pisó la fila; ';
    end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then '2 guardados, recortados, sellados; reimportar pisa.' else txt end;

    /* ---------- 2: lo que no se puede ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pb, 'role', 'authenticated')::text, true);
    begin
      perform importar_emergencias(jsonb_build_object('plantelId', v_u17, 'filas', '[]'::jsonb));
      txt := txt || 'U21 importó en U17; ';
    exception when others then null;
    end;
    begin
      perform importar_emergencias(jsonb_build_object('plantelId', v_u21, 'filas',
        jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'telefonoAdulto', '1'))));
      txt := txt || 'U21 pisó la emergencia de un chico de U17; ';
    exception when others then null;
    end;
    begin
      update emergencia_jugador set telefono_adulto = 'x' where jugador_id = v_a;
      get diagnostics n = row_count;
      if n > 0 then txt := txt || 'U21 editó directo; '; end if;
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    begin
      perform importar_emergencias(jsonb_build_object('plantelId', v_u17, 'filas',
        jsonb_build_array(jsonb_build_object('jugadorId', v_c))));
      txt := txt || 'cargó a un chico de otro plantel; ';
    exception when others then null;
    end;
    begin
      perform importar_emergencias(jsonb_build_object('plantelId', v_u17, 'filas',
        jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'alertas', jsonb_build_array('gripe')))));
      txt := txt || 'aceptó una alerta fuera de la lista; ';
    exception when others then null;
    end;
    begin
      perform importar_emergencias(jsonb_build_object('plantelId', v_u17, 'filas',
        jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'medicacion', repeat('x', 301)))));
      txt := txt || 'aceptó 301 letras de medicación; ';
    exception when others then null;
    end;
    begin
      update emergencia_jugador set club_id = gen_random_uuid() where jugador_id = v_a;
      txt := txt || 'cambió el club de la fila; ';
    exception when others then null;
    end;
    estados[2] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[2] := case when txt = '' then 'Rechazados: plantel ajeno, chico ajeno, alerta y largo fuera de regla, club.' else txt end;

    /* ---------- 3: quién lee ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    select count(*) into n from emergencia_jugador where jugador_id in (v_a, v_b);
    if n <> 2 then txt := txt || 'el profe de U17 ve ' || n || ' de 2; '; end if;
    select count(*) into n from emergencias_del_plantel(v_u17) where jugador_id in (v_a, v_b);
    if n <> 2 then txt := txt || 'la lista de U17 trae ' || n || ' de 2; '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_pb, 'role', 'authenticated')::text, true);
    select count(*) into n from emergencia_jugador where jugador_id in (v_a, v_b);
    if n <> 0 then txt := txt || 'el profe de U21 ve emergencias de U17; '; end if;
    begin
      perform * from emergencias_del_plantel(v_u17);
      txt := txt || 'el profe de U21 abrió la lista de U17; ';
    exception when others then null;
    end;
    select count(*) into n from emergencias_del_plantel(v_u21) where jugador_id = v_c and telefono_adulto is null;
    if n <> 1 then txt := txt || 'el chico sin datos no sale en la lista de U21; '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    select count(*) into n from emergencia_jugador where jugador_id in (v_a, v_b);
    if n <> 2 then txt := txt || 'el coordinador ve ' || n || ' de 2; '; end if;
    select count(*) into n from emergencias_del_plantel(v_u17) where nombre_limpio like 'ZZTEST, 0059%';
    if n <> 2 then txt := txt || 'la lista del coordinador trae ' || n || '; '; end if;
    foreach v_u in array array[v_kj, v_ex] loop
      perform set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
      select count(*) into n from emergencia_jugador;
      if n <> 0 then txt := txt || 'una cuenta sin plantel ve ' || n || ' filas; '; end if;
      begin
        perform * from emergencias_del_plantel(v_u17);
        txt := txt || 'una cuenta sin plantel abrió la lista; ';
      exception when others then null;
      end;
    end loop;
    perform set_config('role', 'anon', true);
    begin
      perform * from emergencia_jugador;
      txt := txt || 'anon lee la tabla; ';
    exception when others then null;
    end;
    perform set_config('role', 'authenticated', true);
    estados[3] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[3] := case when txt = '' then 'Profe U17 y coordinador sí; profe U21, jugador, cuenta sin club y anon no.' else txt end;

    /* ---------- 4: sin delete ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    begin
      delete from emergencia_jugador where jugador_id = v_a;
      txt := txt || 'el profe borró; ';
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    begin
      delete from emergencia_jugador where jugador_id = v_a;
      txt := txt || 'el coordinador borró; ';
    exception when others then null;
    end;
    estados[4] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[4] := case when txt = '' then 'Sin grant de delete para nadie.' else txt end;

    /* ---------- 5: abrir 2027 ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    begin
      perform abrir_temporada(v_club, '2027');
      txt := txt || 'un entrenador abrió la temporada; ';
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    begin
      perform abrir_temporada(v_club, '2025');
      txt := txt || 'abrió una temporada anterior; ';
    exception when others then null;
    end;
    begin
      perform abrir_temporada(v_club, '2026/27');
      txt := txt || 'abrió una temporada que no es un año; ';
    exception when others then null;
    end;
    v_nueva := abrir_temporada(v_club, '2027');
    begin
      perform abrir_temporada(v_club, '2027');
      txt := txt || 'abrió 2027 dos veces; ';
    exception when others then null;
    end;
    perform set_config('role', v_rol_previo, true);
    if public.temporada_vigente_de(v_club) <> v_nueva then txt := txt || '2027 no quedó vigente; '; end if;
    select count(*) into n from plantel where temporada_id = v_nueva;
    if n <> (select count(*) from plantel where temporada_id = v_t) then
      txt := txt || 'copió ' || n || ' planteles; ';
    end if;
    select id into v_u17_nuevo from plantel where temporada_id = v_nueva and categoria_codigo = 'U17M';
    perform set_config('role', 'authenticated', true);
    estados[5] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[5] := case when txt = '' then '2027 vigente con los mismos planteles; el resto rechazado.' else txt end;

    /* ---------- 6: pases pendientes ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    select * into r from pases_de_temporada(v_club) p where p.jugador_id = v_a;
    if r.anio_nacimiento is distinct from 2010 or r.codigos <> array['U17M'] then
      txt := txt || 'devolvió ' || coalesce(r.anio_nacimiento::text, 'null') || ' ' || coalesce(r.codigos::text, 'null') || '; ';
    end if;
    select count(*) into n from pases_de_temporada(v_club) p where p.jugador_id in (v_a, v_b, v_c);
    if n <> 3 then txt := txt || n || ' pendientes de 3; '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    begin
      perform * from pases_de_temporada(v_club);
      txt := txt || 'un entrenador vio los pases; ';
    exception when others then null;
    end;
    estados[6] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[6] := case when txt = '' then 'Año 2010, U17M; 3 pendientes; el entrenador no los ve.' else txt end;

    /* ---------- 7 y 8: confirmar ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pa, 'role', 'authenticated')::text, true);
    begin
      perform confirmar_pases(v_club, jsonb_build_array(jsonb_build_object('jugadorId', v_a, 'plantelId', v_u17_nuevo)));
      txt := txt || 'un entrenador confirmó pases; ';
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    -- Una fila mala (plantel de 2026) tira toda la tanda.
    begin
      perform confirmar_pases(v_club, jsonb_build_array(
        jsonb_build_object('jugadorId', v_a, 'plantelId', v_u17_nuevo),
        jsonb_build_object('jugadorId', v_b, 'plantelId', v_u17)));
      txt := txt || 'aceptó un plantel de la temporada vieja; ';
    exception when others then null;
    end;
    perform set_config('role', v_rol_previo, true);
    if exists (select 1 from pertenencia where jugador_id = v_a and plantel_id = v_u17_nuevo) then
      txt := txt || 'la tanda fallida dejó una pertenencia; ';
    end if;
    perform set_config('role', 'authenticated', true);

    v_res := confirmar_pases(v_club, jsonb_build_array(
      jsonb_build_object('jugadorId', v_a, 'plantelId', v_u17_nuevo),
      jsonb_build_object('jugadorId', v_b, 'plantelId', null)));
    if v_res <> '{"pasados": 1, "cerradas": 2}'::jsonb then txt := txt || 'devolvió ' || v_res::text || '; '; end if;
    perform set_config('role', v_rol_previo, true);
    select count(*) into n from pertenencia
      where jugador_id = v_a and plantel_id = v_u17_nuevo and hasta is null and temporada_id = v_nueva;
    if n <> 1 then txt := txt || 'A no quedó en U17M 2027; '; end if;
    select count(*) into n from pertenencia
      where jugador_id in (v_a, v_b) and plantel_id = v_u17 and hasta is not null and cerrado_por = v_co;
    if n <> 2 then txt := txt || n || ' pertenencias 2026 cerradas y selladas (esperaba 2); '; end if;
    if exists (select 1 from pertenencia where jugador_id = v_c and hasta is not null) then
      txt := txt || 'cerró a un chico que no estaba en la tanda; ';
    end if;
    estados[7] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[7] := case when txt = '' then '1 pasado, 2 cerradas por el coordinador; la tanda mala no dejó nada.' else txt end;

    txt := '';
    if not exists (select 1 from emergencia_jugador where jugador_id = v_a) then
      txt := txt || 'A perdió la emergencia al pasar; ';
    end if;
    if exists (select 1 from emergencia_jugador where jugador_id = v_b) then
      txt := txt || 'la emergencia de B sigue; ';
    end if;
    perform set_config('role', 'authenticated', true);
    estados[8] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[8] := case when txt = '' then 'B borrada al no seguir; A intacta.' else txt end;

    /* ---------- 9: lo de antes ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pb, 'role', 'authenticated')::text, true);
    if not exists (select 1 from jugador where id = v_c) then txt := txt || 'el profe de U21 dejó de ver a su chico; '; end if;
    if exists (select 1 from jugador where id = v_a) then txt := txt || 'el profe de U21 ve a uno de U17; '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    select count(*) into n from jugador where id in (v_a, v_b, v_c);
    if n <> 0 then txt := txt || 'el coordinador lee jugador; '; end if;
    estados[9] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[9] := case when txt = '' then 'Sin cambios en lo que ve cada uno.' else txt end;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then null;
    when others then falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_0059 values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;
  for i in 1..9 loop
    insert into verificacion_0059 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_0059
order by n;
