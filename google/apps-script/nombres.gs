/**
 * Nombres de carpetas y archivos. Funciones puras: no tocan Drive ni Forms,
 * así se prueban con node (tests/appsScriptNombres.test.js).
 *
 * Se pega tal cual en el editor de Apps Script: sin import/export, todo global.
 */

var LARGO_MAXIMO_NOMBRE = 80;

// Argentina no tiene horario de verano desde 2009. Si vuelve, esto se corre una hora.
var DESFASE_ARGENTINA_MS = -3 * 60 * 60 * 1000;

function normalizarDni(texto) {
  return String(texto == null ? '' : texto).replace(/[.\s-]/g, '');
}

function dniValido(dni) {
  return typeof dni === 'string' && /^\d{7,8}$/.test(dni);
}

/**
 * Saca lo que rompe un nombre al bajarlo a Windows o al celular (barras, dos
 * puntos, comillas, caracteres de control) y lo recorta: lo escribe un padre.
 */
function limpiarParaNombre(texto) {
  return String(texto == null ? '' : texto)
    .replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO_MAXIMO_NOMBRE)
    .trim();
}

var PARTICULAS_NOMBRE = ['de', 'del', 'la', 'las', 'los', 'y', 'da', 'di', 'van', 'von'];

/**
 * "juan  MARTÍN" → "Juan Martín". Mayúscula al principio de cada palabra (y después de guion o
 * apóstrofe); las partículas ("de", "la") quedan en minúscula salvo la primera palabra.
 * Es la misma regla que src/data/nombres.js (la app no puede importar este archivo).
 */
function nombrePropio(texto) {
  var palabras = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim().toLowerCase().split(' ');
  return palabras.map(function (p, i) {
    if (!p) return p;
    if (i > 0 && PARTICULAS_NOMBRE.indexOf(p) >= 0) return p;
    return p.replace(/(^|[-'])(\S)/g, function (m, pre, letra) { return pre + letra.toUpperCase(); });
  }).join(' ');
}

function nombreCarpeta(apellido, nombre, dni) {
  return limpiarParaNombre(apellido).toUpperCase() + ', ' + nombrePropio(limpiarParaNombre(nombre)) + ' — ' + dni;
}

/** El DNI va al final, después de la raya: es lo único que identifica la carpeta. */
function dniDeCarpeta(nombre) {
  var m = /— (\d{7,8})$/.exec(String(nombre));
  return m ? m[1] : null;
}

function dosDigitos(n) {
  return (n < 10 ? '0' : '') + n;
}

// La fecha va siempre en el nombre: así un reenvío no pisa al anterior.
function selloArgentina(fecha) {
  var d = new Date(fecha.getTime() + DESFASE_ARGENTINA_MS);
  return d.getUTCFullYear() + '-' + dosDigitos(d.getUTCMonth() + 1) + '-' + dosDigitos(d.getUTCDate()) +
    ' ' + dosDigitos(d.getUTCHours()) + '.' + dosDigitos(d.getUTCMinutes());
}

function extensionDe(nombreOriginal) {
  var m = /\.([A-Za-z0-9]{1,5})$/.exec(String(nombreOriginal));
  return m ? m[1].toLowerCase() : '';
}

/**
 * `<título de la pregunta> - [<concepto> - ]<APELLIDO> - <AAAA-MM-DD HH.MM>.<ext>`
 * El título de la pregunta es el tipo de documento: así un formulario nuevo
 * no necesita configuración.
 */
function nombreArchivo(titulo, concepto, apellido, fecha, nombreOriginal) {
  var partes = [limpiarParaNombre(titulo)];
  if (limpiarParaNombre(concepto)) partes.push(limpiarParaNombre(concepto));
  partes.push(limpiarParaNombre(apellido).toUpperCase(), selloArgentina(fecha));
  var ext = extensionDe(nombreOriginal);
  return partes.join(' - ') + (ext ? '.' + ext : '');
}

/** Para comparar títulos de preguntas sin que importen mayúsculas ni espacios de más. */
function claveTitulo(titulo) {
  return String(titulo == null ? '' : titulo).replace(/\s+/g, ' ').trim().toLowerCase();
}
