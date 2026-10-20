/**
 * Manda a Semillero el estado de papeles y pagos del Tablero (este script está atado a esa planilla).
 *
 * Primero correr instalarEnvio() una vez (crea el disparador, sin duplicarlo)
 * y pegar el token en Propiedades del script → SEMILLERO_TOKEN. Para probar a
 * mano sin esperar: enviarEstadoAhora().
 *
 * Reglas:
 * - Sólo LEE el Tablero. No escribe nada en ninguna hoja.
 * - Nunca lee la columna DNI (A) ni la de links (N) del Tablero, ni la DNI de
 *   Pagos: arranca en la columna B del Tablero y en la C de Pagos. A Semillero
 *   no puede llegar un DNI porque el script no lo tiene.
 * - En el registro de ejecuciones van sólo cantidades, nunca nombres.
 * - El token sale de las Propiedades del script y nunca se escribe en el registro.
 * Las funciones puras están en estado.gs.
 */

var PROPIEDAD_TOKEN = 'SEMILLERO_TOKEN';

/** Se corre una sola vez a mano: crea el disparador del envío, sin duplicarlo. */
function instalarEnvio() {
  var yaEsta = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'enviarEstado';
  });
  if (!yaEsta) {
    ScriptApp.newTrigger('enviarEstado').timeBased().everyMinutes(MINUTOS_ENTRE_ENVIOS).create();
  }
  Logger.log(yaEsta ? 'El disparador ya estaba instalado.' : 'Disparador instalado.');
}

/** Para probar a mano sin esperar el disparador. */
function enviarEstadoAhora() {
  enviarEstado();
}

function enviarEstado() {
  var token = PropertiesService.getScriptProperties().getProperty(PROPIEDAD_TOKEN);
  if (!token) {
    Logger.log('Falta el token: pegalo en Propiedades del script → ' + PROPIEDAD_TOKEN + ' (se genera en Semillero, Coordinación → Familias → Papeles y pagos).');
    return;
  }
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(30 * 1000)) {
    Logger.log('Hay otro envío en curso: este se saltea.');
    return;
  }
  try {
    var datos = leerTablero(SpreadsheetApp.getActiveSpreadsheet());
    if (!datos) return;
    var armado = armarEnvio(datos);
    // Un Tablero vacío (una fórmula rota, una hoja renombrada) no se manda:
    // Semillero reemplaza todo el estado y borraría lo que ya tenía.
    if (!armado.envio.filas.length) {
      Logger.log('El Tablero no tiene chicos legibles: no se manda nada, para no borrar el estado de Semillero.');
      return;
    }
    enviar(armado, token);
  } finally {
    candado.releaseLock();
  }
}

/**
 * Lee las hojas del Tablero y las deja como las espera armarEnvio. null si
 * falta alguna hoja (se anota y no se manda nada).
 */
function leerTablero(planilla) {
  var tablero = planilla.getSheetByName(HOJA_TABLERO);
  var pagos = planilla.getSheetByName(HOJA_PAGOS);
  var salida = planilla.getSheetByName(HOJA_SALIDA);
  if (!tablero || !pagos || !salida) {
    Logger.log('Faltan hojas: hacen falta "' + HOJA_TABLERO + '", "' + HOJA_PAGOS + '" y "' + HOJA_SALIDA + '".');
    return null;
  }
  var ultima = tablero.getLastRow();
  if (ultima < 2) {
    Logger.log('El Tablero está vacío.');
    return null;
  }
  var n = ultima - 1;

  // Tablero: B a D (apellido, nombre, categoría) y G hasta ULTIMA_COLUMNA (documentos, Completo, extras). Nunca A ni N.
  var datosBasicos = tablero.getRange(2, 2, n, 3).getValues();
  var colDocs = 7;
  var anchoDocs = ULTIMA_COLUMNA - colDocs + 1;
  var encabezadosDocs = tablero.getRange(1, colDocs, 1, anchoDocs).getValues()[0];
  var valoresDocs = tablero.getRange(2, colDocs, n, anchoDocs).getValues();
  // Pagos: C hasta ULTIMA_COLUMNA, alineada fila a fila con el Tablero. Nunca A (DNI).
  var colPagos = 3;
  var anchoPagos = ULTIMA_COLUMNA - colPagos + 1;
  var encabezadosPagos = pagos.getRange(1, colPagos, 1, anchoPagos).getValues()[0];
  var valoresPagos = pagos.getRange(2, colPagos, n, anchoPagos).getValues();
  // Salida Semillero: apellido, nombre y fecha (A a C) y rama (F). Las filas del padrón van primero y en el mismo orden.
  var filasSalida = Math.max(0, Math.min(n, salida.getLastRow() - 1));
  var salidaAC = filasSalida ? salida.getRange(2, 1, filasSalida, 3).getValues() : [];
  var salidaF = filasSalida ? salida.getRange(2, 6, filasSalida, 1).getValues() : [];

  // La columna "Completo" no es un documento: se saca del rango de documentos y viaja aparte.
  var colCompleto = -1;
  encabezadosDocs.forEach(function (e, i) { if (texto(e).toLowerCase() === 'completo') colCompleto = i; });

  var filas = [];
  for (var i = 0; i < n; i++) {
    filas.push({
      fila: i + 2,
      apellido: datosBasicos[i][0],
      nombre: datosBasicos[i][1],
      categoria: datosBasicos[i][2],
      completo: colCompleto >= 0 ? valoresDocs[i][colCompleto] : '',
      docs: valoresDocs[i],
      pagos: valoresPagos[i],
      salida: i < filasSalida ? { apellido: salidaAC[i][0], nombre: salidaAC[i][1], nacimiento: salidaAC[i][2], rama: salidaF[i][0] } : null
    });
  }
  return {
    tableroUrl: urlBase(planilla.getUrl()),
    gidTablero: tablero.getSheetId(),
    gidPagos: pagos.getSheetId(),
    docsEncabezados: encabezadosDocs,
    pagosEncabezados: encabezadosPagos,
    filas: filas
  };
}

/** `…/spreadsheets/d/<id>/edit?…` → `…/spreadsheets/d/<id>`: la base para los links a una fila. */
function urlBase(url) {
  var m = /^(https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+)/.exec(String(url));
  return m ? m[1] : '';
}

function enviar(armado, token) {
  var respuesta = UrlFetchApp.fetch(SEMILLERO_URL + '/rest/v1/rpc/empujar_estado_google', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SEMILLERO_CLAVE_PUBLICA, Authorization: 'Bearer ' + SEMILLERO_CLAVE_PUBLICA },
    payload: JSON.stringify({ p_token: token, p_envio: armado.envio }),
    muteHttpExceptions: true
  });
  var codigo = respuesta.getResponseCode();
  var resumen = 'filas: ' + armado.envio.filas.length + ' · documentos: ' + armado.envio.documentosOrden.length +
    ' · conceptos: ' + armado.envio.conceptosOrden.length + ' · filas descartadas por parecer un DNI: ' + armado.descartadas +
    ' · columnas descartadas: ' + armado.columnasDescartadas + ' · de más (por los límites): ' + armado.truncadas;
  if (codigo === 200) {
    Logger.log('Enviado. ' + resumen + ' · ' + respuesta.getContentText());
    return;
  }
  // Los errores de la base traen un código (TOKEN_INVALIDO, ENVIO_MUY_SEGUIDO, PARECE_DNI…) y nada de los datos.
  var mensaje = '';
  try { mensaje = String(JSON.parse(respuesta.getContentText()).message || ''); } catch (e) { mensaje = ''; }
  Logger.log('Semillero rechazó el envío (' + codigo + '): ' + mensaje.slice(0, 120) + '. ' + resumen);
  if (mensaje === 'TOKEN_INVALIDO') {
    Logger.log('El token ya no sirve: generá uno nuevo en Semillero y pegalo en Propiedades del script.');
  }
}
