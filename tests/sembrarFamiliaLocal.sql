-- Siembra para probar las cuentas de familia en el navegador (0057).
--
-- SÓLO EN LA BASE LOCAL. No es una migración. Se corre a mano:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres -v ON_ERROR_STOP=1 < tests/sembrarFamiliaLocal.sql
-- Se frena si el club de prueba (0003) no está: así no corre contra producción.
-- Todo es sintético (ZZTEST, dominio .test) y sólo existe en la base local.
--
-- Crea dos cuentas con la contraseña de prueba `familia-local-2026`:
--   zztest-coord@familia.test  coordinador del club de prueba
--   zztest-papa@familia.test   mail CONFIRMADO, sin vínculo todavía
-- El profe de U17M es el de sembrarHistoriaLocal.sql (zztest-profe17@historia.test).
--
-- Para el recorrido: el profe importa una inscripción con el mail del papá
-- (Plantel → Importar inscriptos), y el papá entra y ve al chico.

do $$
declare
  c uuid := '00000000-0000-0000-0000-000000000001';
  coord uuid := '00000000-0000-0057-0000-000000000001';
  papa  uuid := '00000000-0000-0057-0000-000000000002';
begin
  if not exists (select 1 from public.club where id = c) then
    raise exception 'Falta el club de prueba de 0003.';
  end if;

  delete from auth.identities where user_id in (coord, papa);
  delete from public.miembro_club where user_id in (coord, papa);
  delete from public.vinculo_familia where user_id in (coord, papa);
  delete from auth.users where id in (coord, papa);

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (coord, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'zztest-coord@familia.test', extensions.crypt('familia-local-2026', extensions.gen_salt('bf')), now(),
     now(), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"ZZTEST Coordinación"}'),
    (papa, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'zztest-papa@familia.test', extensions.crypt('familia-local-2026', extensions.gen_salt('bf')), now(),
     now(), now(), '{"provider":"email","providers":["email"]}', '{"nombre":"ZZTEST Papá"}');
  -- Auth no acepta NULL en estas columnas (ver sembrarHistoriaLocal.sql).
  update auth.users set confirmation_token = '', recovery_token = '', email_change = '',
         email_change_token_new = '', email_change_token_current = '', reauthentication_token = '',
         phone_change = '', phone_change_token = ''
   where id in (coord, papa);
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, 'email',
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now()
  from auth.users u where u.id in (coord, papa);

  -- Los Términos ya aceptados (VERSION_LEGAL de src/data/legal.js): son cuentas
  -- de prueba y no hay nadie que los acepte. Sin esto la app frena en esa pantalla.
  -- `usuario` lo sella un trigger con auth.uid(): se impersona a cada cuenta.
  perform set_config('request.jwt.claims', json_build_object('sub', coord, 'role', 'authenticated')::text, true);
  insert into public.aceptacion_legal (version) values ('2026-10-18');
  perform set_config('request.jwt.claims', json_build_object('sub', papa, 'role', 'authenticated')::text, true);
  insert into public.aceptacion_legal (version) values ('2026-10-18');

  perform set_config('request.jwt.claims', json_build_object('sub', coord, 'role', 'authenticated')::text, true);
  insert into public.miembro_club (user_id, club_id, es_entrenador, es_coordinador) values (coord, c, false, true);
end $$;
