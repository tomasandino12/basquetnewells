/**
 * Cola de respuestas para revisar a mano (DNI mal escrito) y aviso por mail.
 * Nada de nombres ni DNI: sólo el formulario, el id de la respuesta y el motivo.
 * Con el id se la encuentra en el formulario (Respuestas → icono de la respuesta).
 */

var CLAVE_REVISAR = 'revisar_dni';
var MAXIMO_REVISAR = 50;

/** El texto del aviso. Pura: se prueba con node. */
function textoAviso(tituloFormulario, idRespuesta, motivo, enlace) {
  return 'Una respuesta de "' + tituloFormulario + '" no se pudo guardar en la carpeta del jugador: el DNI ' +
    motivo + '.\n\nSus archivos siguen en la carpeta de Forms, sin mover. Corregí el DNI en la respuesta ' +
    'o movelos a mano.\nId de la respuesta: ' + idRespuesta + '\nFormulario: ' + enlace + '\n';
}

function leerRevisar(props) {
  try {
    return JSON.parse(props.getProperty(CLAVE_REVISAR) || '[]');
  } catch (e) {
    return [];
  }
}

/** Anota la respuesta en la cola (la más vieja se descarta pasadas 50) y manda el mail si hay dirección. */
function avisarDniInvalido(formulario, respuesta, motivo) {
  var props = PropertiesService.getScriptProperties();
  var cola = leerRevisar(props);
  cola.push({ formulario: formulario.getTitle(), respuesta: respuesta.getId(), motivo: motivo, fecha: new Date().toISOString() });
  props.setProperty(CLAVE_REVISAR, JSON.stringify(cola.slice(-MAXIMO_REVISAR)));
  if (!MAIL_AVISO) return;
  try {
    MailApp.sendEmail(MAIL_AVISO, 'Revisar: DNI mal escrito en un formulario',
      textoAviso(formulario.getTitle(), respuesta.getId(), motivo, formulario.getEditUrl()));
  } catch (e) {
    Logger.log('No se pudo mandar el aviso (queda en la cola): ' + e);
  }
}

/** A mano: muestra lo que está para revisar. */
function verRevisar() {
  var cola = leerRevisar(PropertiesService.getScriptProperties());
  Logger.log(cola.length ? cola.map(function (c) { return c.fecha + ' · ' + c.formulario + ' · ' + c.respuesta + ' · ' + c.motivo; }).join('\n') : 'Nada para revisar.');
}

/** A mano: vacía la cola cuando ya se resolvió todo. */
function vaciarRevisar() {
  PropertiesService.getScriptProperties().deleteProperty(CLAVE_REVISAR);
}
