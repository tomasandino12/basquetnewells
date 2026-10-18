-- Siembra una temporada 2025 de mentira para probar la historia del jugador
-- en el navegador (Task 6 del plan 2026-10-16-historia-jugador).
--
-- SÓLO EN LA BASE LOCAL. No es una migración. Se corre a mano:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres -v ON_ERROR_STOP=1 < tests/sembrarHistoriaLocal.sql
-- Se frena si encuentra una cuenta que no sea de prueba: así no corre nunca
-- contra producción. Todo es sintético (ZZTEST), en el club de prueba de 0003,
-- y con ids fijos 00000000-0000-0056-... para poder borrarlo.
--
-- Entra como el profe de U17M 2026: zztest-profe17@historia.test, con la
-- contraseña de prueba `historia-local-2025` (sólo existe en la base local).
--
-- Quedan:
--   - Temporada 2025 con U15M; U15M 2026 nuevo (U17M 2026 es el de 0003).
--   - ZZTEST VIENE: U15M 2025 (cerrada) → U17M 2026 (vigente). En 2025 tiene
--     plan físico, cargas, un material, salto, sprint, Yo-Yo, batería, partido
--     y medidas; en 2026, un salto. Un dato sin temporada (una medida de enero).
--   - ZZTEST AJENO: sólo U15M 2026. El profe de U17 no lo tiene que ver.
--   - Un profe ZZTEST con la U15M 2025 cerrada, para la lista de profes.

do $$
declare
  c   uuid := '00000000-0000-0000-0000-000000000001';   -- club de prueba (0003)
  t26 uuid := '00000000-0000-0000-0000-000000000002';
  u17_26 uuid := '00000000-0000-0000-0000-000000000004';
  t25    uuid := '00000000-0000-0056-0000-000000000001';
  u15_25 uuid := '00000000-0000-0056-0000-000000000002';
  u15_26 uuid := '00000000-0000-0056-0000-000000000003';
  p17 uuid := '00000000-0000-0056-0000-000000000011';
  p15 uuid := '00000000-0000-0056-0000-000000000012';
  ja  uuid := '00000000-0000-0056-0000-000000000021';
  jb  uuid := '00000000-0000-0056-0000-000000000022';
  imp uuid := '00000000-0000-0056-0000-000000000031';
  par uuid := '00000000-0000-0056-0000-000000000032';
  pla uuid := '00000000-0000-0056-0000-000000000041';
  sf1 uuid := '00000000-0000-0056-0000-000000000042';
  sf2 uuid := '00000000-0000-0056-0000-000000000043';
  esc uuid := '00000000-0000-0056-0000-000000000051';
  rec uuid := '00000000-0000-0056-0000-000000000061';
  s_tiro   uuid := '00000000-0000-0056-0000-000000000071';
  s_salto  uuid := '00000000-0000-0056-0000-000000000072';
  s_sprint uuid := '00000000-0000-0056-0000-000000000073';
  s_yoyo   uuid := '00000000-0000-0056-0000-000000000074';
  s_salto26 uuid := '00000000-0000-0056-0000-000000000075';
begin
  if exists (
    select 1 from auth.users
    where email not like '%.test' and email not like '%.invalid' and email not like '%@example.com'
  ) then
    raise exception 'Hay cuentas reales: esto no es la base local. No se siembra nada.';
  end if;
  if exists (select 1 from public.temporada where id = t25) then
    raise exception 'Ya está sembrado (temporada %).', t25;
  end if;
  if not exists (select 1 from public.plantel where id = u17_26) then
    raise exception 'Falta el club de prueba de 0003.';
  end if;

  /* ---------- temporadas, planteles y profes ---------- */

  insert into public.temporada (id, club_id, nombre) values (t25, c, '2025');
  insert into public.plantel (id, club_id, temporada_id, categoria, categoria_codigo) values
    (u15_25, c, t25, 'U15M', 'U15M'),
    (u15_26, c, t26, 'U15M', 'U15M');

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (p17, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'zztest-profe17@historia.test', extensions.crypt('historia-local-2025', extensions.gen_salt('bf')), now(),
     now(), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"ZZTEST Profe U17"}'),
    (p15, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'zztest-profe15@historia.test', null, now(),
     now(), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"ZZTEST Profe U15 2025"}');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  values (gen_random_uuid(), p17, p17::text, 'email',
          jsonb_build_object('sub', p17::text, 'email', 'zztest-profe17@historia.test', 'email_verified', true),
          now(), now());

  -- Las columnas creado_por toman auth.uid() por default: que lo cargue el
  -- profe de 2025. Vale sólo para esta transacción.
  perform set_config('request.jwt.claims', json_build_object('sub', p15, 'role', 'authenticated')::text, true);

  insert into public.miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
    (p17, c, true, false), (p15, c, true, false);
  insert into public.asignacion_plantel (miembro_club_user_id, miembro_club_club_id, plantel_id, origen, desde, hasta) values
    (p17, c, u17_26, 'manual', now(), null),
    (p15, c, u15_25, 'manual', '2025-03-01', '2025-12-15');

  /* ---------- los chicos ---------- */

  insert into public.jugador (id, club_id, nombre_clave, nombre_limpio) values
    (ja, c, 'ZZTEST VIENE', 'ZZTEST, VIENE'),
    (jb, c, 'ZZTEST AJENO', 'ZZTEST, AJENO');
  insert into public.pertenencia (club_id, jugador_id, plantel_id, temporada_id, desde, hasta, cerrado_por) values
    (c, ja, u15_25, t25, '2025-03-01', '2025-12-15', p15),
    (c, ja, u17_26, t26, '2026-03-01', null, null),
    (c, jb, u15_26, t26, '2026-03-01', null, null);

  /* ---------- 2025: qué se trabajó ---------- */

  insert into public.plan_fisico (id, club_id, plantel_id, nombre_archivo, hash_archivo)
    values (pla, c, u15_25, 'zztest-plan-2025.xlsx', 'zztest-historia-plan');
  insert into public.sesion_fisico (id, club_id, plan_id, fecha) values
    (sf1, c, pla, '2025-05-05'), (sf2, c, pla, '2025-05-12');
  insert into public.ejercicio_asignado (club_id, sesion_id, bloque, nombre_original, series, reps) values
    (c, sf1, 'Fuerza', 'Sentadilla goblet', 3, '8'),
    (c, sf1, 'Movilidad', 'Movilidad de cadera', 2, '10'),
    (c, sf2, 'Fuerza', 'Sentadilla goblet', 3, '8'),
    (c, sf2, 'Fuerza', 'Peso muerto rumano', 3, '8');

  insert into public.paso_fuerza (id, club_id, clave, nombre, paso)
    values (esc, c, 'zztest sentadilla goblet', 'Sentadilla goblet', 2.5);
  insert into public.movimiento_escalon (club_id, jugador_id, escalera_id, kg, creado_en, creado_por) values
    (c, ja, esc, 12, '2025-05-05 18:00-03', p15),
    (c, ja, esc, 14.5, '2025-07-01 18:00-03', p15);

  insert into public.recurso (id, club_id, titulo, descripcion)
    values (rec, c, 'ZZTEST Rutina de movilidad', 'Material de prueba');
  insert into public.envio_recurso (club_id, recurso_id, jugador_id, fecha) values (c, rec, ja, '2025-06-01');

  /* ---------- 2025: mediciones ---------- */

  insert into public.sesion_medicion (id, club_id, plantel_id, fecha, tipo) values (s_tiro, c, u15_25, '2025-08-01', 'tiro');
  insert into public.medicion_tiro (club_id, sesion_id, jugador_id, posicion, anotados, intentos) values
    (c, s_tiro, ja, 'frontal', 6, 10), (c, s_tiro, ja, 'libres', 7, 10);

  insert into public.sesion_medicion (id, club_id, plantel_id, fecha, tipo, test_salto) values
    (s_salto, c, u15_25, '2025-11-01', 'salto', 'cmj'),
    (s_salto26, c, u17_26, '2026-04-01', 'salto', 'cmj');
  insert into public.medicion_salto (club_id, sesion_id, jugador_id, intento, tiempo_vuelo_ms, fps_captura) values
    (c, s_salto, ja, 1, 480, 240), (c, s_salto, ja, 2, 500, 240),
    (c, s_salto26, ja, 1, 520, 240);

  insert into public.sesion_medicion (id, club_id, plantel_id, fecha, tipo, distancia_sprint_m) values
    (s_sprint, c, u15_25, '2025-10-01', 'sprint', 20);
  insert into public.medicion_sprint (club_id, sesion_id, jugador_id, intento, tiempo_ms) values
    (c, s_sprint, ja, 1, 3600), (c, s_sprint, ja, 2, 3500);

  insert into public.sesion_medicion (id, club_id, plantel_id, fecha, tipo) values (s_yoyo, c, u15_25, '2025-09-01', 'yoyo');
  insert into public.medicion_yoyo (club_id, sesion_id, jugador_id, idas) values (c, s_yoyo, ja, 40);

  insert into public.medicion_corporal (club_id, jugador_id, fecha_medicion, altura_cm, peso_kg, creado_por) values
    (c, ja, '2025-04-01', 165, 55, p15),
    (c, ja, '2025-10-01', 168, null, p15),
    -- Entre temporadas: va a "Sin temporada".
    (c, ja, '2026-01-10', 169, 57, p15);

  /* ---------- 2025: un partido ---------- */

  insert into public.importacion (id, club_id, hash_archivo, nombre_archivo)
    values (imp, c, 'zztest-historia-partido', 'zztest-partido-2025.xlsx');
  insert into public.partido (id, club_id, plantel_id, importacion_id, fecha, condicion_propia, rival_nombre, puntos_propios, puntos_rival)
    values (par, c, u15_25, imp, '2025-06-14', 'local', 'ZZTEST Rival', 61, 55);
  insert into public.estadistica_jugador_partido (club_id, partido_id, jugador_id, nombre_crudo, min_segundos, pts,
      dos_anotados, dos_intentados, tres_anotados, tres_intentados, libres_anotados, libres_intentados)
    values (c, par, ja, 'ZZTEST VIENE', 1500, 8, 2, 5, 1, 3, 1, 2);
end $$;
