-- Verificación de 0056 (historia_del_jugador).
--
-- CÓMO SE CORRE: SÓLO EN LA BASE LOCAL, después de aplicar 0056:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres < tests/verificarHistoria.sql
-- Siembra una temporada 2025 de mentira; aunque se deshaga, en producción no
-- se crean datos de prueba.
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA: todo va dentro de un sub-bloque que se deshace al final. Usa
-- el club de prueba de 0003 (sus dos jugadores no se tocan) y usuarios y
-- chicos sintéticos (ZZTEST).

drop table if exists verificacion_0056;
create temporary table verificacion_0056 (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_club uuid := '00000000-0000-0000-0000-000000000001';
  v_t26  uuid := '00000000-0000-0000-0000-000000000002';
  v_u17_26 uuid := '00000000-0000-0000-0000-000000000004';
  v_rol_previo text := current_setting('role');
  v_t25 uuid := gen_random_uuid();
  v_u15_25 uuid := gen_random_uuid();
  v_u15_26 uuid := gen_random_uuid();
  v_p17  uuid := gen_random_uuid();   -- profe de U17M 2026
  v_p15  uuid := gen_random_uuid();   -- profe que tuvo U15M 2025 (asignación cerrada)
  v_c    uuid := gen_random_uuid();   -- coordinador puro
  v_baja uuid := gen_random_uuid();   -- profe de U17M 2026 dado de baja
  v_sin  uuid := gen_random_uuid();   -- cuenta sin club (como un jugador)
  v_a uuid := gen_random_uuid();      -- viene de U15 2025, hoy en U17 2026
  v_b uuid := gen_random_uuid();      -- sólo en U15 2026
  v_ses uuid := gen_random_uuid();
  v_h jsonb;
  txt text;

  nombres text[] := array[
    '1. El profe de U17 ve la temporada 2025 del chico que viene de U15',
    '2. El mismo profe no ve a un chico de U15 que no está en su plantel',
    '3. El coordinador puro no ve la historia (D1)',
    '4. Una cuenta sin club (un jugador) no la ve',
    '5. Un profe dado de baja no la ve',
    '6. Un jugador que no existe da el mismo error que uno ajeno'
  ];
  estados  text[] := array_fill('no corrió'::text, array[6]);
  detalles text[] := array_fill(''::text, array[6]);
  falla_setup text := null;
begin
  begin

    /* ---------- setup, como service role ---------- */

    insert into temporada (id, club_id, nombre) values (v_t25, v_club, '2025');
    insert into plantel (id, club_id, temporada_id, categoria, categoria_codigo) values
      (v_u15_25, v_club, v_t25, 'U15M', 'U15M'),
      (v_u15_26, v_club, v_t26, 'U15M', 'U15M');

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest-' || u.etiqueta || '@verificacion.invalid', now(), now(), now(),
           jsonb_build_object('nombre', 'ZZTEST ' || u.etiqueta)
    from (values (v_p17,'p17'), (v_p15,'p15'), (v_c,'c'), (v_baja,'baja'), (v_sin,'sin')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_p17, v_club, true, false), (v_p15, v_club, true, false),
      (v_c, v_club, false, true), (v_baja, v_club, true, false);
    insert into asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen, desde, hasta) values
      (v_p17, v_club, v_u17_26, 'manual', now(), null),
      (v_p15, v_club, v_u15_25, 'manual', now() - interval '20 months', now() - interval '10 months'),
      (v_baja, v_club, v_u17_26, 'manual', now(), null);
    -- La baja a mano: con la asignación todavía abierta, para probar que
    -- alcanza con el rol apagado.
    update miembro_club set es_entrenador = false, baja_en = now(), baja_por = v_c
      where user_id = v_baja and club_id = v_club;

    insert into jugador (id, club_id, nombre_clave, nombre_limpio) values
      (v_a, v_club, 'ZZTEST VIENE', 'ZZTEST, VIENE'),
      (v_b, v_club, 'ZZTEST AJENO', 'ZZTEST, AJENO');
    insert into pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde, hasta, cerrado_por) values
      (v_club, v_a, v_u15_25, v_t25, '2025-03-01', '2025-12-15', v_p15),
      (v_club, v_a, v_u17_26, v_t26, '2026-03-01', null, null),
      (v_club, v_b, v_u15_26, v_t26, '2026-03-01', null, null);

    -- Una batería y una medida de 2025. La medida se cargó antes de que
    -- existiera su pertenencia en U17: la ventana de 0039 la escondería.
    insert into sesion_medicion (id, club_id, plantel_id, fecha, tipo) values (v_ses, v_club, v_u15_25, '2025-08-01', 'tiro');
    insert into medicion_tiro (club_id, sesion_id, jugador_id, posicion, anotados, intentos) values
      (v_club, v_ses, v_a, 'frontal', 6, 10);
    alter table medicion_corporal disable trigger medicion_corporal_sellar;
    insert into medicion_corporal (club_id, jugador_id, fecha_medicion, altura_cm, peso_kg, creado_en, creado_por)
      values (v_club, v_a, '2025-10-01', 168, 55, now() - interval '1 year', v_p15);
    alter table medicion_corporal enable trigger medicion_corporal_sellar;

    perform set_config('role', 'authenticated', true);

    /* ---------- 1: el profe de U17 ve 2025 ---------- */

    txt := '';
    perform set_config('request.jwt.claims', json_build_object('sub', v_p17, 'role', 'authenticated')::text, true);
    v_h := historia_del_jugador(v_a);
    if not exists (select 1 from jsonb_array_elements(v_h->'planteles') p where (p->>'id')::uuid = v_u15_25)
      then txt := txt || 'falta el plantel U15M 2025; '; end if;
    if not exists (select 1 from jsonb_array_elements(v_h->'planteles') p
                   where (p->>'id')::uuid = v_u15_25 and p->'profes' ? 'ZZTEST p15')
      then txt := txt || 'falta el profe de U15M 2025; '; end if;
    if jsonb_array_length(v_h->'tiro') <> 1 then txt := txt || 'tiro: ' || (v_h->'tiro')::text || '; '; end if;
    if jsonb_array_length(v_h->'corporales') <> 1 then txt := txt || 'la medida de 2025 no llegó (D2); '; end if;
    if jsonb_array_length(v_h->'pertenencias') <> 2 then txt := txt || 'pertenencias: ' || jsonb_array_length(v_h->'pertenencias') || '; '; end if;
    if (v_h->'planteles')::text like '%' || v_u15_26 || '%' then txt := txt || 'se coló el plantel del otro chico; '; end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end;
    detalles[1] := case when txt = '' then 'Plantel U15M 2025 con su profe, la batería y la medida de 2025.' else txt end;

    /* ---------- 2 a 6: 42501 ---------- */

    for i in 2..6 loop
      begin
        perform set_config('request.jwt.claims', json_build_object('sub',
          case i when 2 then v_p17 when 3 then v_c when 4 then v_sin when 5 then v_baja else v_p17 end,
          'role', 'authenticated')::text, true);
        perform historia_del_jugador(case i when 2 then v_b when 6 then gen_random_uuid() else v_a end);
        estados[i] := 'FALLA';
        detalles[i] := 'devolvió la historia';
      exception when insufficient_privilege then
        estados[i] := 'OK';
        detalles[i] := '42501';
      end;
    end loop;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then null;
    when others then falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_0056 values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;
  for i in 1..6 loop
    insert into verificacion_0056 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_0056
order by n;
