/**
 * Barrido: cada MINUTOS_ENTRE_BARRIDOS revisa los formularios de la carpeta
 * "Formularios con archivos" y deja los archivos subidos en la carpeta del
 * chico (Jugadores/APELLIDO, Nombre — DNI/), con nombre legible.
 *
 * Nunca borra nada: ni archivos, ni carpetas, ni respuestas. Procesar dos
 * veces la misma respuesta no rompe nada (lo que ya está en su carpeta se saltea).
 *
 * Primero correr instalar() una vez. Las funciones puras están en nombres.gs.
 */

/** Se corre una sola vez a mano: crea el disparador del barrido, sin duplicarlo. */
function instalar() {
  var yaEsta = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'barrer';
  });
  if (!yaEsta) {
    ScriptApp.newTrigger('barrer').timeBased().everyMinutes(MINUTOS_ENTRE_BARRIDOS).create();
  }
  Logger.log(yaEsta ? 'El disparador ya estaba instalado.' : 'Disparador instalado.');
}

/** Para probar a mano sin esperar los 10 minutos. */
function barrerAhora() {
  barrer();
}

function barrer() {
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(30 * 1000)) {
    Logger.log('Hay otro barrido en curso: este se saltea.');
    return;
  }
  try {
    var inicio = Date.now();
    var jugadores = DriveApp.getFolderById(CARPETA_JUGADORES_ID);
    var archivos = DriveApp.getFolderById(CARPETA_FORMULARIOS_ID).getFilesByType(MimeType.GOOGLE_FORMS);
    while (archivos.hasNext()) {
      if (Date.now() - inicio > MILISEGUNDOS_MAXIMOS_POR_BARRIDO) {
        Logger.log('Se agotó el tiempo del barrido: el resto sigue en el próximo.');
        return;
      }
      var archivo = archivos.next();
      try {
        procesarFormulario(FormApp.openById(archivo.getId()), jugadores, inicio);
      } catch (e) {
        Logger.log('Falló el formulario "' + archivo.getName() + '": ' + e);
      }
    }
  } finally {
    candado.releaseLock();
  }
}

function procesarFormulario(formulario, jugadores, inicio) {
  if (!tienePreguntaDni(formulario)) {
    Logger.log('Se saltea "' + formulario.getTitle() + '": no tiene la pregunta "' + TITULO_DNI + '".');
    return;
  }
  var props = PropertiesService.getScriptProperties();
  var clave = 'ultima_' + formulario.getId();
  var desde = Number(props.getProperty(clave) || 0);
  var respuestas = formulario.getResponses(new Date(desde));

  for (var i = 0; i < respuestas.length; i++) {
    if (Date.now() - inicio > MILISEGUNDOS_MAXIMOS_POR_BARRIDO) return;
    var momento = respuestas[i].getTimestamp().getTime();
    if (momento <= desde) continue;
    try {
      procesarRespuesta(respuestas[i], jugadores);
    } catch (e) {
      // Falla transitoria (Drive caído, cuota): se corta acá y el próximo barrido
      // reintenta desde esta respuesta, sin saltear ninguna.
      Logger.log('Falló una respuesta de "' + formulario.getTitle() + '" (' + respuestas[i].getId() + '): ' + e);
      return;
    }
    props.setProperty(clave, String(momento));
  }
}

function tienePreguntaDni(formulario) {
  var buscada = claveTitulo(TITULO_DNI);
  return formulario.getItems().some(function (item) {
    return claveTitulo(item.getTitle()) === buscada;
  });
}

function procesarRespuesta(respuesta, jugadores) {
  var datos = leerRespuesta(respuesta);
  var dni = normalizarDni(datos.dni);
  if (!dniValido(dni)) {
    // Reintentar no lo arregla: queda anotado y los archivos siguen donde los dejó Forms.
    Logger.log('DNI inválido en la respuesta ' + respuesta.getId() + ': los archivos quedan sin mover.');
    return;
  }
  var carpeta = carpetaDelJugador(jugadores, datos.apellido, datos.nombre, dni);
  var fecha = respuesta.getTimestamp();

  datos.archivos.forEach(function (subida) {
    subida.ids.forEach(function (id) {
      var archivo = DriveApp.getFileById(id);
      if (estaEnCarpeta(archivo, carpeta)) return;
      var nombre = nombreArchivo(subida.titulo, datos.concepto, datos.apellido, fecha, archivo.getName());
      archivo.setName(nombre);
      archivo.moveTo(carpeta);
    });
  });
}

/** Junta DNI, apellido, nombre, concepto y los archivos de una respuesta, buscando por título. */
function leerRespuesta(respuesta) {
  var datos = { dni: '', apellido: '', nombre: '', concepto: '', archivos: [] };
  respuesta.getItemResponses().forEach(function (ir) {
    var titulo = ir.getItem().getTitle();
    var clave = claveTitulo(titulo);
    var valor = ir.getResponse();
    if (ir.getItem().getType() === FormApp.ItemType.FILE_UPLOAD) {
      datos.archivos.push({ titulo: titulo, ids: valor || [] });
    } else if (clave === claveTitulo(TITULO_DNI)) {
      datos.dni = valor;
    } else if (clave === claveTitulo(TITULO_APELLIDO)) {
      datos.apellido = valor;
    } else if (clave === claveTitulo(TITULO_NOMBRE)) {
      datos.nombre = valor;
    } else if (clave === claveTitulo(TITULO_CONCEPTO)) {
      datos.concepto = valor;
    }
  });
  return datos;
}

/**
 * La carpeta del chico se reconoce por el DNI al final del nombre. Si ya existe
 * no se toca (aunque el apellido esté mal escrito: se corrige a mano); si no, se crea.
 */
function carpetaDelJugador(jugadores, apellido, nombre, dni) {
  var candidatas = jugadores.searchFolders("title contains '" + dni + "'");
  while (candidatas.hasNext()) {
    var c = candidatas.next();
    if (dniDeCarpeta(c.getName()) === dni) return c;
  }
  return jugadores.createFolder(nombreCarpeta(apellido, nombre, dni));
}

function estaEnCarpeta(archivo, carpeta) {
  var padres = archivo.getParents();
  while (padres.hasNext()) {
    if (padres.next().getId() === carpeta.getId()) return true;
  }
  return false;
}
