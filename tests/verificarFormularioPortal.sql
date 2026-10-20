-- Verificación de 0058 (formularios del portal).
--
-- CÓMO SE CORRE: en la base LOCAL después de aplicar 0058:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres < tests/verificarFormularioPortal.sql
-- En producción, pegado entero en el SQL Editor como service role: no deja
-- nada (ver abajo), pero usa el club de prueba de 0003.
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA: todo va dentro de un sub-bloque que se deshace al final con
-- un SQLSTATE reservado. Usuarios y clubes sintéticos (ZZTEST, dominio
-- .invalid). La tabla no tiene datos de personas: ningún dato real entra ni
-- sale de acá.
--
-- La impersonación (role = authenticated o anon + request.jwt.claims) es como
-- PostgREST evalúa RLS y permisos para una sesión real o sin sesión.

drop table if exists verificacion_0058;
create temporary table verificacion_0058 (
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

  v_f1 uuid; v_f2 uuid; v_f3 uuid;
  n integer;
  txt text;
  r record;
  lista text;

  nombres text[] := array[
    '1. Coordinación agrega, edita, oculta y reordena; la base sella la autoría',
    '2. Un entrenador del club no lee ni escribe la tabla',
    '3. Coordinación de otro club no ve, no edita ni crea en este club',
    '4. Sin sesión (anon): ningún permiso sobre la tabla, sólo la función',
    '5. formularios_publicos: sólo activos del club pedido, en orden, 3 columnas',
    '6. La base rechaza enlaces que no son de Google Forms y textos mal formados',
    '7. Nadie borra: ni la coordinación',
    '8. El cliente no fija autoría ni cambia el club de una fila'
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

    insert into club (id, nombre) values (v_otro_club, 'ZZTEST Otro club del portal');

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
                            raw_user_meta_data)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest-' || u.etiqueta || '@portal.invalid', now(), now(), now(),
           jsonb_build_object('nombre', 'ZZTEST Nombre ' || u.etiqueta)
    from (values (v_co,'co'), (v_pr,'pr'), (v_co2,'co2')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_co, v_club, false, true), (v_pr, v_club, true, false), (v_co2, v_otro_club, false, true);

    perform set_config('role', 'authenticated', true);

    /* ---------- 1: coordinación escribe ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    insert into formulario_portal (club_id, titulo, texto, enlace, orden)
      values (v_club, 'ZZTEST Inscripción', 'Tené a mano el DNI.', 'https://forms.gle/ZZTEST1', 1) returning id into v_f1;
    insert into formulario_portal (club_id, titulo, texto, enlace, orden)
      values (v_club, 'ZZTEST Pase', 'Para pedir el pase.', 'https://docs.google.com/forms/d/e/ZZTEST2/viewform', 2) returning id into v_f2;
    insert into formulario_portal (club_id, titulo, texto, enlace, orden, activo)
      values (v_club, 'ZZTEST Rifas', 'Subí el comprobante.', 'https://forms.gle/ZZTEST3', 3, true) returning id into v_f3;
    update formulario_portal set texto = 'Tené a mano el DNI del chico y el tuyo.' where id = v_f1;
    update formulario_portal set activo = false where id = v_f2;
    update formulario_portal set orden = 1 where id = v_f3;
    update formulario_portal set orden = 3 where id = v_f1;
    select count(*) into n from formulario_portal where id in (v_f1, v_f2, v_f3);
    if n <> 3 then txt := txt || 'coordinación ve ' || n || ' de 3 (incluida la oculta); '; end if;
    perform set_config('role', v_rol_previo, true);
    select count(*) into n from formulario_portal
      where id in (v_f1, v_f2, v_f3) and creado_por = v_co and actualizado_por = v_co;
    perform set_config('role', 'authenticated', true);
    if n <> 3 then txt := txt || 'autoría sin sellar en ' || (3 - n) || ' filas; '; end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then 'Alta, edición, ocultar y reordenar; autoría sellada por la base.' else txt end;

    /* ---------- 2: entrenador ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_pr, 'role', 'authenticated')::text, true);
    select count(*) into n from formulario_portal;
    if n <> 0 then txt := txt || 'el entrenador lee ' || n || ' filas; '; end if;
    begin
      insert into formulario_portal (club_id, titulo, texto, enlace, orden)
        values (v_club, 'ZZTEST Del profe', 'x', 'https://forms.gle/ZZTEST9', 9);
      txt := txt || 'el entrenador agregó un formulario; ';
    exception when insufficient_privilege then null;
    end;
    update formulario_portal set titulo = 'ZZTEST pisado' where id = v_f1;
    get diagnostics n = row_count;
    if n <> 0 then txt := txt || 'el entrenador editó; '; end if;
    estados[2] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[2] := case when txt = '' then 'No ve filas, no agrega y su update no toca nada.' else txt end;

    /* ---------- 3: coordinación de otro club ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co2, 'role', 'authenticated')::text, true);
    select count(*) into n from formulario_portal where club_id = v_club;
    if n <> 0 then txt := txt || 've ' || n || ' del otro club; '; end if;
    update formulario_portal set enlace = 'https://forms.gle/ZZTESTajeno' where id = v_f1;
    get diagnostics n = row_count;
    if n <> 0 then txt := txt || 'editó uno ajeno; '; end if;
    begin
      insert into formulario_portal (club_id, titulo, texto, enlace, orden)
        values (v_club, 'ZZTEST Intruso', 'x', 'https://forms.gle/ZZTEST8', 8);
      txt := txt || 'creó en el otro club; ';
    exception when insufficient_privilege then null;
    end;
    estados[3] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[3] := case when txt = '' then 'No ve, no edita y no crea fuera de su club.' else txt end;

    /* ---------- 4: anon sobre la tabla ---------- */

    txt := '';
    perform set_config('role', v_rol_previo, true);
    if has_table_privilege('anon', 'public.formulario_portal', 'select')
       or has_table_privilege('anon', 'public.formulario_portal', 'insert')
       or has_table_privilege('anon', 'public.formulario_portal', 'update')
       or has_table_privilege('anon', 'public.formulario_portal', 'delete') then
      txt := txt || 'anon tiene algún permiso sobre la tabla; ';
    end if;
    if not has_function_privilege('anon', 'public.formularios_publicos(uuid)', 'execute') then
      txt := txt || 'anon no puede ejecutar formularios_publicos; ';
    end if;
    if has_function_privilege('anon', 'public.sellar_formulario_portal()', 'execute')
       or has_function_privilege('authenticated', 'public.sellar_formulario_portal()', 'execute') then
      txt := txt || 'el trigger de sellado se puede ejecutar desde el cliente; ';
    end if;
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    begin
      select count(*) into n from formulario_portal;
      txt := txt || 'anon leyó la tabla (' || n || '); ';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into formulario_portal (club_id, titulo, texto, enlace, orden)
        values (v_club, 'ZZTEST Anónimo', 'x', 'https://forms.gle/ZZTEST7', 7);
      txt := txt || 'anon insertó; ';
    exception when insufficient_privilege then null;
    end;
    estados[4] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[4] := case when txt = '' then 'Sin select/insert/update/delete; sólo execute de la función.' else txt end;

    /* ---------- 5: la función pública ---------- */

    txt := '';
    select string_agg(f.titulo, ' | ') into lista
      from public.formularios_publicos(v_club) f
      where f.titulo like 'ZZTEST %';
    if lista is distinct from 'ZZTEST Rifas | ZZTEST Inscripción' then
      txt := txt || 'devolvió "' || coalesce(lista, '(nada)') || '" (esperaba Rifas | Inscripción, sin el Pase oculto); ';
    end if;
    select count(*) into n from public.formularios_publicos(v_otro_club);
    if n <> 0 then txt := txt || 'el otro club devolvió ' || n || '; '; end if;
    select count(*) into n from public.formularios_publicos(gen_random_uuid());
    if n <> 0 then txt := txt || 'un club inexistente devolvió ' || n || '; '; end if;
    perform set_config('role', v_rol_previo, true);
    if pg_get_function_result('public.formularios_publicos(uuid)'::regprocedure)
       <> 'TABLE(titulo text, texto text, enlace text)' then
      txt := txt || 'devuelve otras columnas: ' || pg_get_function_result('public.formularios_publicos(uuid)'::regprocedure) || '; ';
    end if;
    perform set_config('role', 'authenticated', true);
    estados[5] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[5] := case when txt = '' then 'Como anon: Rifas e Inscripción en orden, sin la oculta; nada de otros clubes.' else txt end;

    /* ---------- 6: checks ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_co, 'role', 'authenticated')::text, true);
    for r in select * from (values
        ('ZZTEST', 'x', 'https://evil.com/forms/x', 'host ajeno'),
        ('ZZTEST', 'x', 'http://forms.gle/x', 'http'),
        ('ZZTEST', 'x', 'javascript:alert(1)', 'javascript:'),
        ('ZZTEST', 'x', 'https://forms.gle.evil.com/x', 'subdominio falso'),
        ('ZZTEST', 'x', 'https://evil@forms.gle/x', 'usuario en la URL'),
        ('ZZTEST', 'x', 'https://forms.gle/a"onclick=x', 'comillas'),
        ('ZZTEST', 'x', 'https://docs.google.com/document/d/1', 'un Doc, no un Form'),
        ('', 'x', 'https://forms.gle/x', 'título vacío'),
        (' ZZTEST', 'x', 'https://forms.gle/x', 'título con espacios'),
        ('ZZTEST', '', 'https://forms.gle/x', 'texto vacío'),
        ('ZZTEST', repeat('x', 501), 'https://forms.gle/x', 'texto de 501'),
        (repeat('x', 151), 'x', 'https://forms.gle/x', 'título de 151')
      ) as c(titulo, texto, enlace, que) loop
      begin
        insert into formulario_portal (club_id, titulo, texto, enlace, orden)
          values (v_club, r.titulo, r.texto, r.enlace, 5);
        txt := txt || 'aceptó ' || r.que || '; ';
      exception when check_violation then null;
      end;
    end loop;
    begin
      update formulario_portal set orden = 0 where id = v_f1;
      txt := txt || 'aceptó orden 0; ';
    exception when check_violation then null;
    end;
    estados[6] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[6] := case when txt = '' then '12 altas inválidas y un orden 0, todas rechazadas.' else txt end;

    /* ---------- 7: nadie borra ---------- */

    txt := '';
    begin
      delete from formulario_portal where id = v_f1;
      txt := txt || 'coordinación borró; ';
    exception when insufficient_privilege then null;
    end;
    estados[7] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[7] := case when txt = '' then 'Delete sin permiso: se oculta con activo = false.' else txt end;

    /* ---------- 8: autoría y club ---------- */

    txt := '';
    begin
      update formulario_portal set club_id = v_otro_club where id = v_f1;
      txt := txt || 'cambió el club; ';
    exception when insufficient_privilege then null;
    end;
    begin
      update formulario_portal set actualizado_por = v_pr where id = v_f1;
      txt := txt || 'fijó actualizado_por; ';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into formulario_portal (club_id, titulo, texto, enlace, orden, creado_por)
        values (v_club, 'ZZTEST Falso', 'x', 'https://forms.gle/ZZTEST6', 6, v_pr);
      txt := txt || 'fijó creado_por; ';
    exception when insufficient_privilege then null;
    end;
    estados[8] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[8] := case when txt = '' then 'Club, creado_por y actualizado_por fuera del alcance del cliente.' else txt end;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then null;
    when others then falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_0058 values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;
  for i in 1..8 loop
    insert into verificacion_0058 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_0058
order by n;
