-- Verificación de 0065 (lista de afecciones 2027): que las alertas viejas se
-- conviertan bien y que el check nuevo quede como debe.
--
-- CÓMO SE CORRE: en la base LOCAL, desde la raíz del repo, ANTES de aplicar
-- 0065 (la corre este mismo archivo adentro de una transacción):
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f tests/verificar0065.sql
-- (con docker exec no sirve: \i busca la migración dentro del contenedor).
-- Si 0065 ya está aplicada, frena de entrada: los códigos viejos no entran.
-- Nunca contra producción: no hay forma de deshacer si la conexión se corta
-- a mitad de camino sin transacción propia.
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA: begin ... rollback, tablas temporales, chicos y usuario
-- sintéticos (ZZTEST, dominio .invalid). Ningún dato real de menores.

\set ON_ERROR_STOP on

begin;

create temporary table verif_0065_ids (clave text primary key, jugador_id uuid not null);
create temporary table verif_0065 (
  n integer primary key, caso text, estado text, detalle text
);

-- Setup: un chico por caso, con las alertas VIEJAS. Mismo club de prueba de 0003.
do $$
declare
  v_club uuid := '00000000-0000-0000-0000-000000000001';
  v_user uuid := gen_random_uuid();
  v_j uuid;
  c record;
begin
  if not exists (select 1 from club where id = v_club) then
    raise exception 'No encontré el club de prueba (0003).';
  end if;
  if exists (select 1 from pg_constraint
              where conname = 'emergencia_jugador_alertas_check'
                and pg_get_constraintdef(oid) like '%alergia_grave%') then
    raise exception '0065 ya está aplicada: esta verificación va ANTES de aplicarla.';
  end if;

  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                          created_at, updated_at, raw_user_meta_data)
  values (v_user, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated',
          'authenticated', 'zztest-carga@0065.invalid', now(), now(), now(),
          jsonb_build_object('nombre', 'ZZTEST carga'));

  -- El trigger de sellado toma auth.uid() de los claims.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  for c in
    select * from (values
      ('taquicardia',  array['taquicardia']),
      ('convulsiones', array['convulsiones']),
      ('epilepsia',    array['epilepsia']),
      ('juntas',       array['convulsiones', 'epilepsia']),
      ('mezcla',       array['taquicardia', 'asma', 'epilepsia']),
      ('sin_cambio',   array['desmayos', 'meningitis', 'diabetes', 'perdida_conocimiento', 'asma']),
      ('vacia',        array[]::text[])
    ) as t(clave, alertas)
  loop
    insert into jugador (club_id, nombre_clave, nombre_limpio)
      values (v_club, 'ZZTEST 0065 ' || c.clave, 'ZZTEST, 0065 ' || c.clave)
      returning id into v_j;
    insert into emergencia_jugador (jugador_id, club_id, alertas)
      values (v_j, v_club, c.alertas);
    insert into verif_0065_ids values (c.clave, v_j);
  end loop;

  -- Foto de quién y cuándo cargó, para comprobar que la migración no lo pisa.
  create temporary table verif_0065_sello as
    select jugador_id, actualizado_por, actualizado_en from emergencia_jugador
     where jugador_id in (select jugador_id from verif_0065_ids);
end $$;

-- La migración de verdad, no una copia.
\i supabase/migrations/0065_afecciones_2027.sql

do $$
declare
  nombres text[] := array[
    '1. taquicardia pasa a cardiaco',
    '2. convulsiones pasa a epilepsia_convulsiones',
    '3. epilepsia pasa a epilepsia_convulsiones',
    '4. convulsiones + epilepsia quedan en una sola, sin repetir',
    '5. una mezcla se convierte y queda ordenada',
    '6. las alertas que no cambian quedan intactas',
    '7. sin alertas sigue sin alertas (no NULL)',
    '8. no se pisa quién ni cuándo cargó, y el trigger vuelve a estar activo',
    '9. el check nuevo acepta los códigos nuevos y rechaza los viejos'
  ];
  estados text[] := array_fill('no corrió'::text, array[9]);
  detalles text[] := array_fill(''::text, array[9]);
  v_alertas text[];
  txt text;
  n integer;
  codigo text;
  v_j uuid;
begin
  -- 1 a 7: comparación exacta del arreglo resultante
  for i in 1..7 loop
    select e.alertas into v_alertas
      from emergencia_jugador e
      join verif_0065_ids x on x.jugador_id = e.jugador_id
     where x.clave = (array['taquicardia','convulsiones','epilepsia','juntas','mezcla','sin_cambio','vacia'])[i];
    -- Se compara como texto: los arreglos de largo distinto no caben en un
    -- arreglo de arreglos.
    estados[i] := case when v_alertas::text = (array[
        '{cardiaco}',
        '{epilepsia_convulsiones}',
        '{epilepsia_convulsiones}',
        '{epilepsia_convulsiones}',
        '{asma,cardiaco,epilepsia_convulsiones}',
        '{asma,desmayos,diabetes,meningitis,perdida_conocimiento}',
        '{}'
      ])[i] then 'OK' else 'FALLA' end;
    detalles[i] := 'Quedó ' || coalesce(v_alertas::text, 'NULL');
  end loop;

  -- 8: sello y trigger
  txt := '';
  select count(*) into n
    from emergencia_jugador e
    join verif_0065_sello s using (jugador_id)
   where e.actualizado_por is distinct from s.actualizado_por
      or e.actualizado_en is distinct from s.actualizado_en;
  if n <> 0 then txt := txt || n || ' filas con el sello cambiado; '; end if;
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'emergencia_jugador'::regclass
                    and tgname = 'emergencia_sellar' and tgenabled = 'O') then
    txt := txt || 'emergencia_sellar quedó apagado; ';
  end if;
  estados[8] := case when txt = '' then 'OK' else 'FALLA' end;
  detalles[8] := case when txt = '' then 'Sello intacto y trigger activo.' else txt end;

  -- 9: el check
  txt := '';
  select jugador_id into v_j from verif_0065_ids where clave = 'vacia';
  foreach codigo in array array['taquicardia', 'convulsiones', 'epilepsia'] loop
    begin
      update emergencia_jugador set alertas = array[codigo] where jugador_id = v_j;
      txt := txt || 'aceptó ' || codigo || '; ';
    exception when check_violation then null;
    end;
  end loop;
  foreach codigo in array array['cardiaco', 'alergia_grave', 'epilepsia_convulsiones'] loop
    begin
      update emergencia_jugador set alertas = array[codigo] where jugador_id = v_j;
    exception when check_violation then
      txt := txt || 'rechazó ' || codigo || '; ';
    end;
  end loop;
  estados[9] := case when txt = '' then 'OK' else 'FALLA' end;
  detalles[9] := case when txt = '' then 'Viejos rechazados, nuevos aceptados.' else txt end;

  for i in 1..9 loop
    insert into verif_0065 values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle from verif_0065 order by n;

rollback;
