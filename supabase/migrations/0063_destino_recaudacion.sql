-- Un destino más para los formularios del portal: eventos de recaudación.
--
-- Pizzas, rifas, comidas: la gente que quiere comprar y colaborar deja su mail
-- en un formulario propio ("Eventos de recaudación", sin login y con su propia
-- planilla), que NO es el de sponsors: una empresa que quiere ayudar no tiene
-- nada que ver con alguien que quiere comprar una pizza. El portal tiene que
-- encontrarlo aunque la coordinación lo reordene o le cambie el título: lo dice
-- la fila. Igual que con 0061 y 0062, sin formulario activo con este destino la
-- tarjeta "Enterate de los eventos de recaudación del club" (debajo del
-- calendario) muestra el botón apagado.
--
-- Sólo se rehace el check. El índice único parcial de 0061 ya asegura uno por
-- destino y por club, y formularios_publicos ya devuelve `destino`: anon no
-- gana nada. Contrato: tests/contratoDestinoFormulario.test.js.
--
-- ORDEN DE DESPLIEGUE: indistinto. El portal viejo trata un destino que no
-- conoce como formulario común; el panel nuevo, sin esta migración, recibe el
-- rechazo del check al marcar el destino nuevo.

alter table formulario_portal
  drop constraint formulario_portal_destino_valido,
  add constraint formulario_portal_destino_valido
    check (destino in ('consultas', 'colaboradores', 'inscripcion', 'comprobante', 'recaudacion'));

comment on column formulario_portal.destino is
  'Nulo = formulario común. consultas = "Quiero jugar en Newell''s" (destacado, y destino del QR /consultas). colaboradores = sección de sponsors. inscripcion y comprobante = las dos tarjetas de arriba del portal. recaudacion = aviso por mail de los eventos de recaudación (tarjeta de abajo del calendario). Uno por destino y club. v0061, ampliado en v0062 y v0063.';
