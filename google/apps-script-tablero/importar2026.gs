/**
 * Lee las respuestas del formulario 2026 y rearma cuatro hojas de este Tablero.
 * Se corre a mano desde el editor: elegir "actualizar2026" → Ejecutar.
 *
 * Reglas: el formulario sólo se LEE. Se escribe únicamente en esta planilla.
 * En el registro de ejecuciones van sólo cantidades, nunca nombres ni DNIs.
 */
function actualizar2026() {
  var respuestas = FormApp.openById(FORM_2026_ID).getResponses();
  var registros = [];
  var salteadas = 0;

  respuestas.forEach(function (resp) {
    var cruda = { momento: resp.getTimestamp().getTime(), respuestas: {} };
    resp.getItemResponses().forEach(function (ir) {
      cruda.respuestas[claveTitulo(ir.getItem().getTitle())] = ir.getResponse();
    });
    var reg = registroDeRespuesta(cruda, TITULOS_2026);
    if (reg) registros.push(reg); else salteadas++;
  });

  var planilla = SpreadsheetApp.getActiveSpreadsheet();
  var hojaCorr = planilla.getSheetByName(HOJA_CORRECCIONES_2026);
  var correcciones = hojaCorr && hojaCorr.getLastRow() > 1
    ? hojaCorr.getRange(2, 1, hojaCorr.getLastRow() - 1, 3).getValues() : [];
  var chicos = aplicarCorrecciones(ultimaPorDni(registros), correcciones);

  escribirHoja(planilla, HOJA_SEMILLERO_2026, ENCABEZADOS_SEMILLERO, chicos.map(filaSemillero));
  var emergencias = chicos.map(filaEmergencias).filter(function (f) { return f !== null; });
  escribirHoja(planilla, HOJA_EMERGENCIAS_2026, ENCABEZADOS_EMERGENCIAS, emergencias);
  escribirHoja(planilla, HOJA_INSCRIPCION_2026, ['DNI', 'Apellido', 'Nombre', 'Fecha de nacimiento', 'Categoría', 'Consentimiento de datos'],
    chicos.map(function (c) { return [c.dni, c.apellido, c.nombre, c.fechaNacimiento, c.categoria, c.consentimiento ? 'Sí' : 'No']; }));
  var dudosos = chicos.filter(function (c) { return c.revisar; });
  escribirHoja(planilla, HOJA_REVISAR_2026, ['DNI', 'Apellido', 'Nombre', 'Por qué'],
    dudosos.map(function (c) { return [c.dni, c.apellido, c.nombre, 'Apellido y nombre dudosos: corregir en "' + HOJA_CORRECCIONES_2026 + '"']; }));

  Logger.log('Respuestas: ' + respuestas.length + ' · chicos: ' + chicos.length + ' · sin DNI válido (salteadas): ' + salteadas +
    ' · con emergencias: ' + emergencias.length + ' · a revisar: ' + dudosos.length);
}

/** Borra la hoja y la rearma con encabezados + filas. Las fechas se escriben como fechas dd/mm/aaaa. */
function escribirHoja(planilla, nombre, encabezados, filas) {
  var hoja = planilla.getSheetByName(nombre) || planilla.insertSheet(nombre);
  hoja.clear();
  var valores = [encabezados].concat(filas.map(function (f) {
    return f.map(function (celda) {
      return celda && celda.anio ? new Date(celda.anio, celda.mes - 1, celda.dia) : (celda == null ? '' : celda);
    });
  }));
  hoja.getRange(1, 1, valores.length, encabezados.length).setValues(valores);
  hoja.setFrozenRows(1);
  var colFecha = encabezados.indexOf('Fecha de nacimiento');
  if (colFecha >= 0 && filas.length) hoja.getRange(2, colFecha + 1, filas.length, 1).setNumberFormat('dd/mm/yyyy');
}
