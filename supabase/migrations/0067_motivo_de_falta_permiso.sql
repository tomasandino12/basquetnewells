-- Permiso que le faltó a 0066: guardar_asistencia es security invoker, o sea
-- que corre con los permisos del profe, y 0064 sólo le dio escritura sobre
-- cuatro columnas de asistencia. Sin este grant, Postgres rechaza con
-- «permission denied» cualquier guardado que nombre «motivo» en el INSERT,
-- aunque el valor sea NULL: el profe no podría tomar asistencia.
--
-- Mismo criterio que 0064: columna por columna, nada de anon. El check de 0066
-- (lista cerrada, sólo si estado = 'justificada') sigue mandando.
--
-- Antes de aplicar: npm run backup (docs/guias/BACKUP.md). Si 0066 todavía no
-- se aplicó, conviene aplicar 0066 y 0067 juntas en el mismo `db push`.

grant insert (motivo), update (motivo) on asistencia to authenticated;
