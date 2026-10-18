-- Verificación de 0054 (finanzas del básquet).
--
-- CÓMO SE CORRE: pegado entero en el SQL Editor de Supabase, como service
-- role, después de aplicar 0054.
--
-- LOS RESULTADOS SALEN COMO TABLA, una fila por caso: OK o FALLA.
--
-- NO DEJA NADA. Crea dos clubes, cinco usuarios sintéticos, rubros y
-- movimientos dentro de un sub-bloque que al final se deshace a propósito con
-- un SQLSTATE reservado. Los resultados sobreviven en variables. No lee ni
-- toca ningún dato real.
--
-- La impersonación (role = authenticated + request.jwt.claims) es exactamente
-- como PostgREST evalúa RLS para una sesión real.

drop table if exists verificacion_finanzas;
create temporary table verificacion_finanzas (
  n integer primary key, caso text, estado text, detalle text
);

do $$
declare
  v_rol_previo text := current_setting('role');
  v_club  uuid := gen_random_uuid();
  v_otro  uuid := gen_random_uuid();
  v_profe uuid := gen_random_uuid();   -- entrenador, sin rol de coordinador
  v_coord uuid := gen_random_uuid();   -- coordinador
  v_ambos uuid := gen_random_uuid();   -- entrenador + coordinador
  v_coord_otro uuid := gen_random_uuid();  -- coordinador del otro club
  v_sin   uuid := gen_random_uuid();   -- cuenta sin club (como un jugador)

  v_r_ing uuid; v_r_egr uuid; v_r_otro uuid; v_mov uuid; v_mov2 uuid;
  n integer; m integer; k integer;
  pudo boolean; txt text;
  v_borrado_en timestamptz; v_borrado_por uuid; v_monto numeric;
  v_accion text; v_antes jsonb; v_actualizado_por uuid;

  nombres text[] := array[
    '1. Profe sin rol de coordinador: cero filas y no escribe',
    '2. Coordinador de otro club: cero filas de este club',
    '3. Coordinador carga rubros y movimientos',
    '4. Entrenador + coordinador ve todo',
    '5. Editar deja rastro con la fila anterior',
    '6. Borrar es lógico y lo sella el servidor',
    '7. Un movimiento borrado no se edita ni se desborra',
    '8. Columnas y operaciones cerradas al cliente',
    '9. La base rechaza datos inválidos',
    '10. Cuenta sin club: cero filas'
  ];
  estados  text[] := array_fill('no corrió'::text, array[10]);
  detalles text[] := array_fill(''::text, array[10]);
  falla_setup text := null;
begin

  begin

    /* ---------- setup, como service role ---------- */

    insert into club (id, nombre) values (v_club, 'ZZTEST FINANZAS'), (v_otro, 'ZZTEST FINANZAS OTRO');

    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
    select u.id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
           'zztest-fin-' || u.etiqueta || '@verificacion.invalid', now(), now(), now()
    from (values (v_profe,'profe'), (v_coord,'coord'), (v_ambos,'ambos'),
                 (v_coord_otro,'otro'), (v_sin,'sin')) as u(id, etiqueta);

    insert into miembro_club (user_id, club_id, es_entrenador, es_coordinador) values
      (v_profe, v_club, true,  false),
      (v_coord, v_club, false, true),
      (v_ambos, v_club, true,  true),
      (v_coord_otro, v_otro, false, true);

    perform set_config('role', 'authenticated', true);

    /* ---------- 3. el coordinador carga ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    insert into rubro (club_id, nombre, tipo) values (v_club, 'ZZTEST Patrocinios', 'ingreso') returning id into v_r_ing;
    insert into rubro (club_id, nombre, tipo) values (v_club, 'ZZTEST Arbitrajes', 'egreso') returning id into v_r_egr;
    insert into movimiento (club_id, rubro_id, fecha, monto, descripcion)
      values (v_club, v_r_ing, '2026-10-05', 1234.50, 'ZZTEST sponsor') returning id into v_mov;
    insert into movimiento (club_id, rubro_id, fecha, monto, comprobante_url)
      values (v_club, v_r_egr, '2026-10-06', 500, 'https://drive.google.com/zztest') returning id into v_mov2;
    select count(*) into n from movimiento where club_id = v_club;
    select count(*) into m from rubro where club_id = v_club;
    select monto into v_monto from movimiento where id = v_mov;
    if n = 2 and m = 2 and v_monto = 1234.50 then estados[3] := 'OK';
    else estados[3] := 'FALLA'; detalles[3] := format('movimientos=%s rubros=%s monto=%s', n, m, v_monto); end if;

    perform set_config('request.jwt.claims', json_build_object('sub', v_coord_otro, 'role', 'authenticated')::text, true);
    insert into rubro (club_id, nombre, tipo) values (v_otro, 'ZZTEST Otro club', 'ingreso') returning id into v_r_otro;

    /* ---------- 5. editar deja rastro ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    update movimiento set monto = 1300 where id = v_mov;
    select accion, antes into v_accion, v_antes from movimiento_cambio where movimiento_id = v_mov;
    select actualizado_por, monto into v_actualizado_por, v_monto from movimiento where id = v_mov;
    if v_accion = 'edicion' and (v_antes->>'monto')::numeric = 1234.50 and v_monto = 1300
       and v_actualizado_por = v_coord then estados[5] := 'OK';
    else estados[5] := 'FALLA';
      detalles[5] := format('accion=%s antes=%s ahora=%s por=%s', v_accion, v_antes->>'monto', v_monto, v_actualizado_por); end if;

    /* ---------- 6. borrar es lógico ---------- */

    -- Lo borra la persona con los dos roles; manda una fecha falsa y un monto
    -- nuevo, y ninguna de las dos cosas tiene que quedar.
    perform set_config('request.jwt.claims', json_build_object('sub', v_ambos, 'role', 'authenticated')::text, true);
    update movimiento set borrado_en = '1999-01-01', monto = 1 where id = v_mov2;
    select borrado_en, borrado_por, monto into v_borrado_en, v_borrado_por, v_monto from movimiento where id = v_mov2;
    select accion into v_accion from movimiento_cambio where movimiento_id = v_mov2;
    if v_borrado_en > now() - interval '1 minute' and v_borrado_por = v_ambos and v_monto = 500
       and v_accion = 'baja' then estados[6] := 'OK';
    else estados[6] := 'FALLA';
      detalles[6] := format('borrado_en=%s por=%s monto=%s accion=%s', v_borrado_en, v_borrado_por, v_monto, v_accion); end if;

    /* ---------- 7. lo borrado queda como quedó ---------- */

    txt := '';
    pudo := false;
    begin update movimiento set monto = 999 where id = v_mov2; pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'se pudo editar; '; end if;
    pudo := false;
    begin update movimiento set borrado_en = null where id = v_mov2; pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'se pudo desborrar; '; end if;
    select count(*) into n from movimiento where id = v_mov2 and borrado_en is not null and monto = 500;
    if n <> 1 then txt := txt || 'la fila cambió o no está; '; end if;
    estados[7] := case when txt = '' then 'OK' else 'FALLA' end; detalles[7] := txt;

    /* ---------- 8. columnas y operaciones cerradas ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    txt := '';
    pudo := false; begin update rubro set tipo = 'egreso' where id = v_r_ing; pudo := true; exception when others then null; end;
    if pudo then txt := txt || 'cambió el tipo de un rubro; '; end if;
    pudo := false; begin update movimiento set club_id = v_otro where id = v_mov; pudo := true; exception when others then null; end;
    if pudo then txt := txt || 'cambió el club de un movimiento; '; end if;
    pudo := false; begin update movimiento set borrado_por = v_profe where id = v_mov; pudo := true; exception when others then null; end;
    if pudo then txt := txt || 'escribió borrado_por; '; end if;
    pudo := false; begin delete from movimiento where id = v_mov; pudo := true; exception when others then null; end;
    if pudo then txt := txt || 'borró un movimiento de verdad; '; end if;
    pudo := false; begin delete from rubro where id = v_r_egr; pudo := true; exception when others then null; end;
    if pudo then txt := txt || 'borró un rubro de verdad; '; end if;
    pudo := false;
    begin
      insert into movimiento_cambio (movimiento_id, club_id, accion, antes, cambiado_por)
        values (v_mov, v_club, 'edicion', '{}', v_coord);
      pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'escribió en el rastro; '; end if;
    pudo := false; begin delete from movimiento_cambio where movimiento_id = v_mov; get diagnostics n = row_count; pudo := n > 0;
    exception when others then null; end;
    if pudo then txt := txt || 'borró el rastro; '; end if;
    estados[8] := case when txt = '' then 'OK' else 'FALLA' end; detalles[8] := txt;

    /* ---------- 9. datos inválidos ---------- */

    txt := '';
    pudo := false; begin insert into movimiento (club_id, rubro_id, fecha, monto) values (v_club, v_r_ing, '2026-10-07', 0); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'monto 0; '; end if;
    pudo := false; begin insert into movimiento (club_id, rubro_id, fecha, monto) values (v_club, v_r_ing, '2026-10-07', -5); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'monto negativo; '; end if;
    pudo := false; begin insert into movimiento (club_id, rubro_id, fecha, monto) values (v_club, v_r_otro, '2026-10-07', 10); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'rubro de otro club; '; end if;
    pudo := false; begin insert into movimiento (club_id, rubro_id, fecha, monto) values (v_otro, v_r_otro, '2026-10-07', 10); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'cargó en otro club; '; end if;
    pudo := false; begin insert into movimiento (club_id, rubro_id, fecha, monto, comprobante_url)
      values (v_club, v_r_ing, '2026-10-07', 10, 'http://inseguro.invalid'); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'comprobante sin https; '; end if;
    pudo := false; begin insert into rubro (club_id, nombre, tipo) values (v_club, 'zztest patrocinios', 'egreso'); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'rubro repetido en minúsculas; '; end if;
    pudo := false; begin insert into rubro (club_id, nombre, tipo) values (v_club, 'ZZTEST Raro', 'transferencia'); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'tipo fuera de la lista; '; end if;
    estados[9] := case when txt = '' then 'OK' else 'FALLA' end; detalles[9] := txt;

    /* ---------- 4. los dos roles ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_ambos, 'role', 'authenticated')::text, true);
    select count(*) into n from movimiento where club_id = v_club;
    select count(*) into m from rubro where club_id = v_club;
    select count(*) into k from movimiento_cambio where club_id = v_club;
    if n = 2 and m = 2 and k = 2 then estados[4] := 'OK';
    else estados[4] := 'FALLA'; detalles[4] := format('movimientos=%s rubros=%s cambios=%s', n, m, k); end if;

    /* ---------- 1. el profe no ve ni escribe nada ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_profe, 'role', 'authenticated')::text, true);
    txt := '';
    select count(*) into n from rubro;
    select count(*) into m from movimiento;
    select count(*) into k from movimiento_cambio;
    if n + m + k > 0 then txt := format('ve rubros=%s movimientos=%s cambios=%s; ', n, m, k); end if;
    pudo := false; begin insert into rubro (club_id, nombre, tipo) values (v_club, 'ZZTEST Profe', 'ingreso'); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'creó un rubro; '; end if;
    pudo := false; begin insert into movimiento (club_id, rubro_id, fecha, monto) values (v_club, v_r_ing, '2026-10-08', 10); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'cargó un movimiento; '; end if;
    update movimiento set monto = 1 where id = v_mov;
    get diagnostics n = row_count;
    if n > 0 then txt := txt || 'editó un movimiento; '; end if;
    estados[1] := case when txt = '' then 'OK' else 'FALLA' end; detalles[1] := txt;

    /* ---------- 2. coordinador de otro club ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_coord_otro, 'role', 'authenticated')::text, true);
    txt := '';
    select count(*) into n from rubro where club_id = v_club;
    select count(*) into m from movimiento where club_id = v_club;
    select count(*) into k from movimiento_cambio where club_id = v_club;
    if n + m + k > 0 then txt := format('ve rubros=%s movimientos=%s cambios=%s; ', n, m, k); end if;
    pudo := false; begin insert into movimiento (club_id, rubro_id, fecha, monto) values (v_club, v_r_ing, '2026-10-08', 10); pudo := true;
    exception when others then null; end;
    if pudo then txt := txt || 'cargó en el club ajeno; '; end if;
    estados[2] := case when txt = '' then 'OK' else 'FALLA' end; detalles[2] := txt;

    /* ---------- 10. cuenta sin club ---------- */

    perform set_config('request.jwt.claims', json_build_object('sub', v_sin, 'role', 'authenticated')::text, true);
    select count(*) into n from rubro;
    select count(*) into m from movimiento;
    select count(*) into k from movimiento_cambio;
    if n + m + k = 0 then estados[10] := 'OK';
    else estados[10] := 'FALLA'; detalles[10] := format('rubros=%s movimientos=%s cambios=%s', n, m, k); end if;

    raise exception using errcode = 'ZY001', message = 'fin';

  exception
    when sqlstate 'ZY001' then
      null;  -- salida normal: todo lo escrito arriba quedó deshecho
    when others then
      falla_setup := sqlerrm;
  end;

  perform set_config('role', v_rol_previo, true);

  if falla_setup is not null then
    insert into verificacion_finanzas values
      (0, 'SETUP', 'ERROR', falla_setup || '  (los casos que no llegaron a correr dicen "no corrió")');
  end if;

  for i in 1..10 loop
    insert into verificacion_finanzas values (i, nombres[i], estados[i], detalles[i]);
  end loop;
end $$;

select n as "#", caso, estado, detalle
from verificacion_finanzas
order by n;
