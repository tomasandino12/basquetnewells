-- Verificación de 0060 (estado de papeles y pagos que manda el script de Google).
--
-- CÓMO SE CORRE: en la base LOCAL, con 0060 ya aplicada:
--   docker exec -i <contenedor supabase_db_...> psql -U postgres -v ON_ERROR_STOP=1 < tests/verificarEstadoInscripcion.sql
-- Sin aplicarla todavía: sacar la primera línea `begin;` de este archivo y
-- mandar `begin;` + la migración + el resto, en una sola entrada.
--
-- Cada caso es un assert: si algo falla, psql corta con el error. Termina en
-- `TODO OK`. NO DEJA NADA: todo va en una transacción que termina en rollback.
-- Club, usuarios y chicos sintéticos (dominio .test, DNIs inventados).
begin;
-- Datos de prueba (dentro de la transacción).
insert into club(id,nombre) values ('00000000-0000-0000-0000-0000000060c1','Club prueba 0060');
insert into auth.users(id,email,aud,role) values
 ('00000000-0000-0000-0000-0000000060a1','coord0060@x.test','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000060a2','profe0060@x.test','authenticated','authenticated');
insert into miembro_club(user_id,club_id,es_coordinador,es_entrenador) values
 ('00000000-0000-0000-0000-0000000060a1','00000000-0000-0000-0000-0000000060c1',true,false),
 ('00000000-0000-0000-0000-0000000060a2','00000000-0000-0000-0000-0000000060c1',false,true);
insert into temporada(id,club_id,nombre) values ('00000000-0000-0000-0000-0000000060e1','00000000-0000-0000-0000-0000000060c1','2026');
insert into plantel(id,club_id,temporada_id,categoria,categoria_codigo) values
 ('00000000-0000-0000-0000-0000000060b1','00000000-0000-0000-0000-0000000060c1','00000000-0000-0000-0000-0000000060e1','U13M','U13M');
insert into jugador(id,club_id,nombre_clave,nombre_limpio,desambiguador,fecha_nacimiento) values
 ('00000000-0000-0000-0000-000000006001','00000000-0000-0000-0000-0000000060c1','PEREZ JUAN','Pérez, Juan','', '2013-05-01'),
 ('00000000-0000-0000-0000-000000006002','00000000-0000-0000-0000-0000000060c1','GOMEZ ANA','Gómez, Ana','', null),
 ('00000000-0000-0000-0000-000000006003','00000000-0000-0000-0000-0000000060c1','LOPEZ LEO','López, Leo','', '2013-01-01'),
 ('00000000-0000-0000-0000-000000006004','00000000-0000-0000-0000-0000000060c1','LOPEZ LEO','López, Leo','2013-02-02', '2013-02-02'),
 ('00000000-0000-0000-0000-000000006005','00000000-0000-0000-0000-0000000060c1','RUIZ TOMAS','Ruiz, Tomás','', '2013-07-07');
insert into pertenencia(club_id,jugador_id,plantel_id,temporada_id,desde)
 select '00000000-0000-0000-0000-0000000060c1', j, '00000000-0000-0000-0000-0000000060b1','00000000-0000-0000-0000-0000000060e1','2026-03-01'
 from unnest(array['00000000-0000-0000-0000-000000006001','00000000-0000-0000-0000-000000006002','00000000-0000-0000-0000-000000006003','00000000-0000-0000-0000-000000006004','00000000-0000-0000-0000-000000006005']::uuid[]) j;

-- Clave igual a clavearNombre.
do $$ begin
  assert clave_inscripcion('  Pérez,   Juan ') = 'PEREZ JUAN', clave_inscripcion('  Pérez,   Juan ');
  assert clave_inscripcion('Muñoz, Iñaki Güemes') = 'MUNOZ INAKI GUEMES';
end $$;

-- Coordinador: sin conexión, el panel no inventa "no se inscribió".
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060a1","role":"authenticated"}', true);
do $$ begin assert (select count(*) from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1')) = 0; end $$;
do $$ begin assert (select not conectado from conexion_google_del_club('00000000-0000-0000-0000-0000000060c1')); end $$;
select set_config('prueba.tok_viejo', rotar_conexion_google('00000000-0000-0000-0000-0000000060c1'), true);
select set_config('prueba.tok', rotar_conexion_google('00000000-0000-0000-0000-0000000060c1'), true);
do $$ begin assert char_length(current_setting('prueba.tok')) = 43; assert current_setting('prueba.tok') <> current_setting('prueba.tok_viejo'); end $$;
reset role;
do $$ begin assert (select rotado_por from conexion_google where club_id='00000000-0000-0000-0000-0000000060c1') = '00000000-0000-0000-0000-0000000060a1'; end $$;

-- Entrenador: no lee el panel ni rota.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060a2","role":"authenticated"}', true);
do $$ begin perform * from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1'); raise exception 'NO_FALLO';
exception when insufficient_privilege then null; end $$;
do $$ begin perform rotar_conexion_google('00000000-0000-0000-0000-0000000060c1'); raise exception 'NO_FALLO';
exception when insufficient_privilege then null; end $$;
do $$ begin perform * from estado_inscripcion; raise exception 'NO_FALLO';
exception when insufficient_privilege then null; end $$;
reset role;

-- anon: sin tablas ni lectura; sólo empujar.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin perform * from conexion_google; raise exception 'NO_FALLO'; exception when insufficient_privilege then null; end $$;
do $$ begin perform * from estado_inscripcion; raise exception 'NO_FALLO'; exception when insufficient_privilege then null; end $$;
do $$ begin perform * from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1'); raise exception 'NO_FALLO'; exception when insufficient_privilege then null; end $$;
do $$ begin perform rotar_conexion_google('00000000-0000-0000-0000-0000000060c1'); raise exception 'NO_FALLO'; exception when insufficient_privilege then null; end $$;
do $$ begin perform clave_inscripcion('x'); raise exception 'NO_FALLO'; exception when insufficient_privilege then null; end $$;

-- Tokens malos.
do $$ begin perform empujar_estado_google('corto', '{}'); raise exception 'NO_FALLO';
exception when sqlstate '28000' then null; end $$;
do $$ begin perform empujar_estado_google(current_setting('prueba.tok_viejo'), '{}'); raise exception 'NO_FALLO';
exception when sqlstate '28000' then null; end $$;

-- Un DNI en un nombre o en un encabezado tira el envío.
do $$ begin
  perform empujar_estado_google(current_setting('prueba.tok'), '{"tableroUrl":"https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345","gidTablero":0,"gidPagos":1,"documentosOrden":[],"conceptosOrden":[],"filas":[{"fila":2,"apellido":"PEREZ 40123456","nombre":"Juan"}]}');
  raise exception 'NO_FALLO';
exception when others then if sqlerrm <> 'PARECE_DNI' then raise; end if; end $$;
do $$ begin
  perform empujar_estado_google(current_setting('prueba.tok'), '{"tableroUrl":"https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345","gidTablero":0,"gidPagos":1,"documentosOrden":["DNI 40123456"],"conceptosOrden":[],"filas":[]}');
  raise exception 'NO_FALLO';
exception when others then if sqlerrm <> 'PARECE_DNI' then raise; end if; end $$;
-- Un estado de pago inventado.
do $$ begin
  perform empujar_estado_google(current_setting('prueba.tok'), '{"tableroUrl":"https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345","gidTablero":0,"gidPagos":1,"documentosOrden":[],"conceptosOrden":["Rifa"],"filas":[{"fila":2,"apellido":"A","nombre":"B","pagos":{"Rifa":"pagó"}}]}');
  raise exception 'NO_FALLO';
exception when others then if sqlerrm not like 'ENVIO_INVALIDO%' then raise; end if; end $$;
-- Un concepto que no está en el orden.
do $$ begin
  perform empujar_estado_google(current_setting('prueba.tok'), '{"tableroUrl":"https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345","gidTablero":0,"gidPagos":1,"documentosOrden":[],"conceptosOrden":["Rifa"],"filas":[{"fila":2,"apellido":"A","nombre":"B","pagos":{"Otra":"falta"}}]}');
  raise exception 'NO_FALLO';
exception when others then if sqlerrm not like 'ENVIO_INVALIDO%' then raise; end if; end $$;
-- Una URL que no es de Google Sheets.
do $$ begin
  perform empujar_estado_google(current_setting('prueba.tok'), '{"tableroUrl":"https://malo.example/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345","gidTablero":0,"gidPagos":1,"documentosOrden":[],"conceptosOrden":[],"filas":[]}');
  raise exception 'NO_FALLO';
exception when check_violation then null; end $$;

-- Envío bueno: 5 filas, una repetida.
select set_config('prueba.envio', $j${
 "tableroUrl":"https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345",
 "gidTablero":0, "gidPagos":123456,
 "documentosOrden":["DNI jugador - frente","Foto del jugador"],
 "conceptosOrden":["Arancel octubre 2026","Rifa"],
 "filas":[
  {"fila":2,"apellido":"PÉREZ","nombre":"Juan","fechaNacimiento":"2013-05-01","categoria":"U13 - MIXTO (2014 y 2013)","rama":"Masculino",
   "documentos":{"DNI jugador - frente":true,"Foto del jugador":true},"completo":true,"pagos":{"Arancel octubre 2026":"verificado","Rifa":"subido"}},
  {"fila":3,"apellido":"Gómez","nombre":"Ana","fechaNacimiento":"2013-09-09","categoria":"U13 - MIXTO (2014 y 2013)","rama":"",
   "documentos":{"DNI jugador - frente":false},"completo":false,"pagos":{"Arancel octubre 2026":"falta"}},
  {"fila":4,"apellido":"López","nombre":"Leo","fechaNacimiento":"2013-03-03","categoria":null,"documentos":{},"completo":null,"pagos":{}},
  {"fila":5,"apellido":"Nuevo","nombre":"Nadie","fechaNacimiento":null,"categoria":"U15","documentos":{},"pagos":{}},
  {"fila":6,"apellido":"PEREZ","nombre":"JUAN","fechaNacimiento":"2013-05-01","documentos":{},"pagos":{}}
 ]}$j$, true);
do $$ declare r jsonb; begin
  r := empujar_estado_google(current_setting('prueba.tok'), current_setting('prueba.envio')::jsonb);
  assert r = '{"guardadas":4,"repetidas":1}', r::text;
end $$;
-- Segundo envío inmediato: rechazado.
do $$ begin perform empujar_estado_google(current_setting('prueba.tok'), current_setting('prueba.envio')::jsonb); raise exception 'NO_FALLO';
exception when others then if sqlerrm <> 'ENVIO_MUY_SEGUIDO' then raise; end if; end $$;
reset role;

-- Lectura del coordinador.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060a1","role":"authenticated"}', true);
select nombre, nombre_google, categoria_codigo, categoria_texto, emparejamiento, fila, completo from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1');
do $$ begin
  assert (select emparejamiento from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1') where nombre_google = 'PÉREZ, Juan') = 'ok';
  assert (select categoria_codigo from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1') where nombre_google = 'PÉREZ, Juan') = 'U13M';
  assert (select emparejamiento from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1') where nombre_google = 'Gómez, Ana') = 'ok';
  assert (select emparejamiento from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1') where nombre_google = 'López, Leo') = 'homonimo';
  assert (select emparejamiento from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1') where nombre_google = 'Nuevo, Nadie') = 'sin_ficha';
  -- Ruiz y los dos López (ninguno quedó unido) no están en el tablero.
  assert (select count(*) from estado_inscripcion_del_club('00000000-0000-0000-0000-0000000060c1') where emparejamiento = 'sin_tablero') = 3;
  assert (select gid_pagos from conexion_google_del_club('00000000-0000-0000-0000-0000000060c1')) = 123456;
  assert (select conceptos_orden from conexion_google_del_club('00000000-0000-0000-0000-0000000060c1')) = array['Arancel octubre 2026','Rifa'];
end $$;
reset role;

-- Segundo envío: Gómez subió el comprobante, Nuevo se fue. cambio_en se mueve sólo en Gómez.
update conexion_google set ultimo_envio_en = now() - interval '5 minutes';
update estado_inscripcion set cambio_en = '2020-01-01';
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare r jsonb; begin
  r := empujar_estado_google(current_setting('prueba.tok'), $j${
   "tableroUrl":"https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345","gidTablero":0,"gidPagos":123456,
   "documentosOrden":["DNI jugador - frente","Foto del jugador"],"conceptosOrden":["Arancel octubre 2026","Rifa"],
   "filas":[
    {"fila":2,"apellido":"PÉREZ","nombre":"Juan","fechaNacimiento":"2013-05-01","categoria":"U13 - MIXTO (2014 y 2013)","rama":"Masculino",
     "documentos":{"DNI jugador - frente":true,"Foto del jugador":true},"completo":true,"pagos":{"Arancel octubre 2026":"verificado","Rifa":"subido"}},
    {"fila":4,"apellido":"Gómez","nombre":"Ana","fechaNacimiento":"2013-09-09","categoria":"U13 - MIXTO (2014 y 2013)",
     "documentos":{"DNI jugador - frente":false},"completo":false,"pagos":{"Arancel octubre 2026":"subido"}},
    {"fila":3,"apellido":"López","nombre":"Leo","fechaNacimiento":"2013-03-03","documentos":{},"pagos":{}}
   ]}$j$::jsonb);
  assert r = '{"guardadas":3,"repetidas":0}', r::text;
end $$;
reset role;
do $$ begin
  assert (select cambio_en from estado_inscripcion where apellido = 'PÉREZ') = '2020-01-01';
  assert (select cambio_en from estado_inscripcion where apellido = 'Gómez') = now();
  assert (select fila from estado_inscripcion where apellido = 'Gómez') = 4;
  assert not exists (select 1 from estado_inscripcion where apellido = 'Nuevo');
end $$;

-- Sellado: club_id no cambia.
update estado_inscripcion set club_id = gen_random_uuid() where apellido = 'PÉREZ';
do $$ begin assert (select club_id from estado_inscripcion where apellido = 'PÉREZ') = '00000000-0000-0000-0000-0000000060c1'; end $$;

-- Desconectar borra todo.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060a1","role":"authenticated"}', true);
select desconectar_google('00000000-0000-0000-0000-0000000060c1');
reset role;
do $$ begin
  assert not exists (select 1 from estado_inscripcion where club_id = '00000000-0000-0000-0000-0000000060c1');
  assert not exists (select 1 from conexion_google where club_id = '00000000-0000-0000-0000-0000000060c1');
end $$;

-- Una fila sin fecha que vuelve en el próximo envío es la misma fila (nulls not distinct).
insert into club(id,nombre) values ('00000000-0000-0000-0000-0000000060c2','Club prueba 0060 bis');
insert into conexion_google(club_id, token_hash) values ('00000000-0000-0000-0000-0000000060c2', encode(extensions.digest('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','sha256'),'hex'));
set local role anon;
select empujar_estado_google('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '{"tableroUrl":"https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345","gidTablero":0,"gidPagos":1,"documentosOrden":[],"conceptosOrden":[],"filas":[{"fila":2,"apellido":"Sin","nombre":"Fecha"}]}');
reset role;
update conexion_google set ultimo_envio_en = now() - interval '2 minutes' where club_id = '00000000-0000-0000-0000-0000000060c2';
select set_config('prueba.primero', (select id::text from estado_inscripcion where club_id = '00000000-0000-0000-0000-0000000060c2'), true);
set local role anon;
select empujar_estado_google('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '{"tableroUrl":"https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuvwxyz012345","gidTablero":0,"gidPagos":1,"documentosOrden":[],"conceptosOrden":[],"filas":[{"fila":3,"apellido":"Sin","nombre":"Fecha"}]}');
reset role;
do $$ begin
  assert (select count(*) from estado_inscripcion where club_id = '00000000-0000-0000-0000-0000000060c2') = 1;
  assert (select id::text = current_setting('prueba.primero') and fila = 3 from estado_inscripcion where club_id = '00000000-0000-0000-0000-0000000060c2');
end $$;

select 'TODO OK';
rollback;
