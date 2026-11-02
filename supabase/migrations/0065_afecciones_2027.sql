-- Lista de afecciones de la inscripción 2027 (reemplaza la de 0059).
--
-- Cambia la lista cerrada de emergencia_jugador.alertas:
--   antes: desmayos, taquicardia, convulsiones, epilepsia, meningitis,
--          diabetes, perdida_conocimiento, asma
--   ahora: desmayos, asma, diabetes, epilepsia_convulsiones, cardiaco,
--          alergia_grave, meningitis, perdida_conocimiento
-- taquicardia pasa a cardiaco; convulsiones y epilepsia se juntan en
-- epilepsia_convulsiones. Las dos listas nuevas (cardiaco, alergia_grave) las
-- marca la familia en el formulario; no se deducen de las alergias en texto.
-- La espeja AFECCIONES en src/data/emergencias.js: tests/contratoEmergencia.test.js
-- las compara.
--
-- Antes de aplicar: npm run backup (docs/guias/BACKUP.md).

-- El trigger de sellado pisa actualizado_por con auth.uid(), que en una
-- migración es NULL (y la columna es not null): se apaga sólo para convertir
-- las filas, así tampoco se pierde quién las cargó por última vez.
alter table emergencia_jugador disable trigger emergencia_sellar;

-- Primero se suelta el check viejo, porque los códigos nuevos no entran.
alter table emergencia_jugador drop constraint emergencia_jugador_alertas_check;

update emergencia_jugador
   set alertas = (
     select coalesce(array_agg(distinct nuevo order by nuevo), '{}'::text[])
       from (
         select case a
                  when 'taquicardia' then 'cardiaco'
                  when 'convulsiones' then 'epilepsia_convulsiones'
                  when 'epilepsia' then 'epilepsia_convulsiones'
                  else a
                end as nuevo
           from unnest(alertas) as a
       ) t
   )
 where alertas <> '{}';

alter table emergencia_jugador add constraint emergencia_jugador_alertas_check
  check (alertas <@ array[
    'desmayos', 'asma', 'diabetes', 'epilepsia_convulsiones', 'cardiaco',
    'alergia_grave', 'meningitis', 'perdida_conocimiento']::text[]);

alter table emergencia_jugador enable trigger emergencia_sellar;
