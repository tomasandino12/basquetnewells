-- Dos destinos más para los formularios del portal: inscripción y comprobante.
-- Ver docs/superpowers/plans/2026-10-20-portal-rediseno.md.
--
-- El portal nuevo pone arriba de todo las dos tarjetas que busca un padre:
-- "Inscribir a mi hijo" y "Enviar comprobante". Igual que con consultas y
-- colaboradores (0061), el portal tiene que saber cuál formulario es cuál
-- aunque la coordinación los reordene o les cambie el título: lo dice la fila.
-- Sin formulario activo con ese destino, la tarjeta muestra "abre con la
-- temporada": así la coordinación abre y cierra la inscripción desde el panel.
--
-- Sólo se rehace el check. El índice único parcial de 0061 ya asegura uno por
-- destino y por club, y formularios_publicos ya devuelve `destino`: anon no
-- gana nada. Contrato: tests/contratoDestinoFormulario.test.js.
--
-- ORDEN DE DESPLIEGUE: indistinto. El portal viejo trata un destino que no
-- conoce como formulario común; el panel nuevo, sin esta migración, recibe el
-- rechazo del check al marcar uno de los dos destinos nuevos.

alter table formulario_portal
  drop constraint formulario_portal_destino_valido,
  add constraint formulario_portal_destino_valido
    check (destino in ('consultas', 'colaboradores', 'inscripcion', 'comprobante'));

comment on column formulario_portal.destino is
  'Nulo = formulario común. consultas = "Quiero jugar en Newell''s" (destacado, y destino del QR /consultas). colaboradores = sección de sponsors. inscripcion y comprobante = las dos tarjetas de arriba del portal. Uno por destino y club. v0061, ampliado en v0062.';
