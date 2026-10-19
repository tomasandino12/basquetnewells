-- Verificación de 0061 (destino de los formularios del portal).
--
-- CÓMO SE CORRE: en la base LOCAL después de aplicar 0058 y 0061:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres < tests/verificarDestinoFormulario.sql
-- En producción, pegado entero en el SQL Editor como service role: no deja
-- nada (ver abajo), pero usa el club de prueba de 0003.
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA: todo va dentro de un sub-bloque que se deshace al final con
-- un SQLSTATE reservado. Usuarios y clubes sintéticos (ZZTEST, dominio
-- .invalid). La tabla no tiene datos de personas.
--
-- La impersonación (role = authenticated o anon + request.jwt.claims) es como
-- PostgREST evalúa RLS y permisos para una sesión real o sin sesión.

drop table if exists verificacion_0061;
create temporary table verificacion_0061 (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_club uuid := '00000000-0000-0000-0000-000000000001';   -- club de prueba (0003)
  v_otro_club uuid := gen_random_uuid();
  v_rol_previo text := current_setting('role');

  v_co  uuid := gen_random_uuid();   -- coordinador del club
  v_pr  uuid := gen_random_uuid();   -- entrenador del club, sin coordinación
  v_co2 uuid := gen_random_uuid();   -- coordinador de OTRO club

  v_a uuid; v_b uuid; v_c uuid; v_o uuid;
  n integer;
  txt text;
  lista text;

  nombres text[] := array[
    '1. Coordinación marca consultas y colaboradores; el resto queda sin destino',
    '2. formularios_publicos (anon) devuelve el destino de cada fila activa',
    '3. Un formulario oculto con destino no aparece en la función pública',
    '4. A lo sumo uno por destino y club; se libera y se reasigna',
    '5. El mismo destino en otro club no choca',
    '6. Un destino inventado lo rechaza la base',
    '7. Entrenador y coordinación de otro club no cambian ningún destino',
    '8. anon no tiene permiso sobre la columna ni sobre la tabla'
  ];
  estados  text[] := array_fill('no corrió'::text, array[8]);
  detalles text[] := array_fill(''::text, array[8]);
  falla_setup text := null;
begin

  begin

    /* ---------- setup, como service role ---------- */

    if not exists (select 1 from club where id = v_club) then
      raise exception 'No encontré el club de prueba (0003).';
    end if;
    if not exists (select 1 from information_schema.columns
                   where table_name = 'formulario_portal' and column_name = 'destino') then
      raise exception 'Falta 0061: formulario_portal no tiene la columna destino.';
    end if;

    insert into club (id, nombre) values (v_otro_club, 'ZZTEST Otro club del portal');

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
                            raw_user_meta_data)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest-' || u.etiqueta || '@destino.invalid', now(), now(), now(),
           jsonb_build_object('nombre', 'ZZTEST Nombre ' || u.etiqueta)
    from (values (v_co,'co'), (v_pr,'pr'), (v_co2,'co2')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_co, v_club, false, true), (v_pr, v_club, true, false), (v_co2, v_otro_club, false, true);

    perform set_config('role', 'authenticated', true);

    /* ---------- 1: coordinación marca ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    insert into formulario_portal (club_id, titulo, texto, enlace, orden, destino)
      values (v_club, 'ZZTEST Quiero jugar', 'Para consultar.', 'https://forms.gle/ZZTESTdest1', 1, 'consultas') returning id into v_a;
    insert into formulario_portal (club_id, titulo, texto, enlace, orden)
      values (v_club, 'ZZTEST Inscripción', 'Para anotarse.', 'https://forms.gle/ZZTESTdest2', 2) returning id into v_b;
    insert into formulario_portal (club_id, titulo, texto, enlace, orden)
      values (v_club, 'ZZTEST Sponsors', 'Para colaborar.', 'https://forms.gle/ZZTESTdest3', 3) returning id into v_c;
    update formulario_portal set destino = 'colaboradores' where id = v_c;
    select count(*) into n from formulario_portal where id in (v_a, v_b, v_c) and destino is not null;
    if n <> 2 then txt := txt || n || ' con destino (esperaba 2); '; end if;
    select count(*) into n from formulario_portal where id = v_b and destino is null;
    if n <> 1 then txt := txt || 'el común quedó con destino; '; end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then 'Alta con destino, update de destino, y el común sin destino.' else txt end;

    /* ---------- 2: la función pública ---------- */

    txt := '';
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    select string_agg(f.titulo || '=' || coalesce(f.destino, '-'), ' | ' order by f.titulo) into lista
      from public.formularios_publicos(v_club) f where f.titulo like 'ZZTEST %';
    if lista is distinct from 'ZZTEST Inscripción=- | ZZTEST Quiero jugar=consultas | ZZTEST Sponsors=colaboradores' then
      txt := txt || 'devolvió "' || coalesce(lista, '(nada)') || '"; ';
    end if;
    perform set_config('role', v_rol_previo, true);
    if pg_get_function_result('public.formularios_publicos(uuid)'::regprocedure)
       <> 'TABLE(titulo text, texto text, enlace text, destino text)' then
      txt := txt || 'columnas distintas: ' || pg_get_function_result('public.formularios_publicos(uuid)'::regprocedure) || '; ';
    end if;
    perform set_config('role', 'authenticated', true);
    estados[2] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[2] := case when txt = '' then 'Como anon: título, texto, enlace y destino de las 3 filas.' else txt end;

    /* ---------- 3: oculto no aparece ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    update formulario_portal set activo = false where id = v_a;
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    select count(*) into n from public.formularios_publicos(v_club) f where f.destino = 'consultas';
    if n <> 0 then txt := txt || 'el oculto con destino consultas sigue saliendo (' || n || '); '; end if;
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    update formulario_portal set activo = true where id = v_a;
    estados[3] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[3] := case when txt = '' then 'Oculto: no sale, aunque conserve su destino.' else txt end;

    /* ---------- 4: uno por destino ---------- */

    txt := '';
    begin
      update formulario_portal set destino = 'consultas' where id = v_b;
      txt := txt || 'dos con destino consultas en el mismo club; ';
    exception when unique_violation then null;
    end;
    begin
      insert into formulario_portal (club_id, titulo, texto, enlace, orden, destino)
        values (v_club, 'ZZTEST Otro jugar', 'x', 'https://forms.gle/ZZTESTdest4', 4, 'colaboradores');
      txt := txt || 'un alta repitió colaboradores; ';
    exception when unique_violation then null;
    end;
    -- La app libera al que lo tenía y después asigna: tiene que alcanzar con dos updates.
    update formulario_portal set destino = null where id = v_a;
    update formulario_portal set destino = 'consultas' where id = v_b;
    select count(*) into n from formulario_portal where club_id = v_club and destino = 'consultas' and id = v_b;
    if n <> 1 then txt := txt || 'no se pudo reasignar el destino; '; end if;
    estados[4] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[4] := case when txt = '' then 'Duplicados rechazados; liberar y reasignar funciona.' else txt end;

    /* ---------- 5: otro club ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co2, 'role', 'authenticated')::text, true);
    insert into formulario_portal (club_id, titulo, texto, enlace, orden, destino)
      values (v_otro_club, 'ZZTEST Del otro club', 'x', 'https://forms.gle/ZZTESTdest5', 1, 'consultas') returning id into v_o;
    select count(*) into n from formulario_portal where id = v_o;
    if n <> 1 then txt := txt || 'no se creó con el mismo destino en otro club; '; end if;
    estados[5] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[5] := case when txt = '' then 'El mismo destino en otro club convive.' else txt end;

    /* ---------- 6: destino inventado ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    begin
      update formulario_portal set destino = 'otra-cosa' where id = v_a;
      txt := txt || 'aceptó un destino inventado; ';
    exception when check_violation then null;
    end;
    begin
      insert into formulario_portal (club_id, titulo, texto, enlace, orden, destino)
        values (v_club, 'ZZTEST Raro', 'x', 'https://forms.gle/ZZTESTdest6', 9, '');
      txt := txt || 'aceptó destino vacío; ';
    exception when check_violation then null;
    end;
    estados[6] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[6] := case when txt = '' then 'Destino inventado y destino vacío rechazados.' else txt end;

    /* ---------- 7: quién no puede ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pr, 'role', 'authenticated')::text, true);
    update formulario_portal set destino = 'colaboradores' where id = v_b;
    get diagnostics n = row_count;
    if n <> 0 then txt := txt || 'el entrenador cambió un destino; '; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_co2, 'role', 'authenticated')::text, true);
    update formulario_portal set destino = null where id = v_b;
    get diagnostics n = row_count;
    if n <> 0 then txt := txt || 'la coordinación de otro club cambió un destino ajeno; '; end if;
    estados[7] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[7] := case when txt = '' then 'Sus updates no tocan ninguna fila.' else txt end;

    /* ---------- 8: anon sin permisos ---------- */

    txt := '';
    perform set_config('role', v_rol_previo, true);
    if has_column_privilege('anon', 'public.formulario_portal', 'destino', 'select')
       or has_column_privilege('anon', 'public.formulario_portal', 'destino', 'update')
       or has_column_privilege('anon', 'public.formulario_portal', 'destino', 'insert') then
      txt := txt || 'anon tiene permisos sobre la columna destino; ';
    end if;
    if has_table_privilege('anon', 'public.formulario_portal', 'select') then
      txt := txt || 'anon lee la tabla; ';
    end if;
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    begin
      perform destino from formulario_portal;
      txt := txt || 'anon leyó la columna; ';
    exception when insufficient_privilege then null;
    end;
    estados[8] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[8] := case when txt = '' then 'Sin permisos sobre la columna ni la tabla; sólo la función.' else txt end;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then null;
    when others then falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_0061 values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;
  for i in 1..8 loop
    insert into verificacion_0061 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_0061
order by n;
