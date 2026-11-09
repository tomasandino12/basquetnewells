-- Por qué faltó un chico que avisó (09/11/2026). Lo pidió Tomás: a los profes
-- les importa, no es lo mismo faltar sin ganas que por un cumpleaños de la
-- familia o por rendir un examen.
--
-- «Avisó» ya existe: es estado = 'justificada'; «faltó sin avisar» es 'ausente'.
-- Esto suma sólo el motivo, en una lista cerrada y sin texto libre: es un dato
-- de un menor (ley 25.326) y «enfermo» roza lo de salud, así que no se guarda
-- más que la palabra. NULL es «avisó pero no se sabe por qué».
-- La lista la espeja MOTIVOS en src/data/asistencia.js:
-- tests/contratoAsistencia.test.js las compara.
--
-- Antes de aplicar: npm run backup (docs/guias/BACKUP.md). Orden: backup,
-- `npx supabase db push`, recién después el código que lee la columna.

alter table asistencia add column motivo text
  check (motivo in ('estudio', 'familia', 'enfermo', 'viaje', 'otro'));

-- Un motivo sólo tiene sentido si avisó.
alter table asistencia add constraint asistencia_motivo_si_aviso
  check (motivo is null or estado = 'justificada');

-- Misma firma, mismos permisos (create or replace los conserva). Cambia sólo
-- el motivo: si la fila trae la clave «motivo», se guarda lo que diga; si no la
-- trae (la app de siempre no la conoce), queda el que había. Pasar a presente
-- o a ausente lo borra, porque el check de arriba no lo dejaría.
create or replace function guardar_asistencia(p_plantel_id uuid, p_fecha date, p_hubo boolean, p_filas jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_club_id uuid;
  v_id uuid;
  f jsonb;
  v_motivo text;
begin
  if not puede_escribir_plantel(p_plantel_id) then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;
  select pl.club_id into v_club_id from plantel pl where pl.id = p_plantel_id;

  insert into entrenamiento (club_id, plantel_id, fecha, hubo)
  values (v_club_id, p_plantel_id, p_fecha, coalesce(p_hubo, true))
  on conflict (plantel_id, fecha) do update set hubo = excluded.hubo
  returning id into v_id;

  if coalesce(p_hubo, true) then
    for f in select * from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb))
    loop
      if f->>'estado' is null then
        delete from asistencia
        where entrenamiento_id = v_id and jugador_id = (f->>'jugadorId')::uuid;
      else
        v_motivo := case when f->>'estado' = 'justificada' then nullif(f->>'motivo', '') end;
        insert into asistencia (entrenamiento_id, jugador_id, club_id, estado, motivo)
        values (v_id, (f->>'jugadorId')::uuid, v_club_id, f->>'estado', v_motivo)
        on conflict (entrenamiento_id, jugador_id) do update
          set estado = excluded.estado,
              motivo = case
                when excluded.estado <> 'justificada' then null
                when f ? 'motivo' then excluded.motivo
                else asistencia.motivo
              end;
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;
