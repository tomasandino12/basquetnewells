/**
 * Lógica pura del envío a Semillero: no toca Sheets ni la red, así se prueba
 * con node (tests/appsScriptSemillero.test.js). Se pega tal cual en el editor
 * de Apps Script: sin import/export, todo global.
 *
 * Regla de oro: a Semillero sólo sale estado. Esta capa descarta todo lo que
 * no lo sea (columnas con links o texto libre, filas con algo que parezca un
 * DNI) antes de armar el envío; la base lo vuelve a controlar.
 */

var MAX_FILAS = 1500;
var MAX_ENCABEZADOS = 25;
var MAX_NOMBRE = 80;
var MAX_ENCABEZADO = 60;

var TILDE_OK = '✅';
var TILDE_NO = '❌';
var CLIP = '📎';

/** Siete dígitos seguidos o más: lo que la base rechaza como DNI. */
function parecePersonal(valor) {
  return /[0-9]{7}/.test(String(valor == null ? '' : valor));
}

function texto(celda) {
  return String(celda == null ? '' : celda).replace(/\s+/g, ' ').trim();
}

/** ✅ → true, ❌ → false, cualquier otra cosa → null (no se sabe). */
function estadoDeDocumento(celda) {
  var t = texto(celda);
  return t === TILDE_OK ? true : (t === TILDE_NO ? false : null);
}

/** ✅ → 'verificado', 📎 → 'subido', ❌ → 'falta', cualquier otra cosa → null. */
function estadoDePago(celda) {
  var t = texto(celda);
  return t === TILDE_OK ? 'verificado' : (t === CLIP ? 'subido' : (t === TILDE_NO ? 'falta' : null));
}

/**
 * ¿La columna es de estado? Sólo si TODO lo que tiene es ✅/❌ (y hay algo).
 * Así una columna de links (Carpeta) o de texto libre nunca sale.
 */
function esColumnaDeEstado(celdas, permitidos) {
  var hay = false;
  for (var i = 0; i < celdas.length; i++) {
    var t = texto(celdas[i]);
    if (t === '') continue;
    if (permitidos.indexOf(t) === -1) return false;
    hay = true;
  }
  return hay;
}

/**
 * Fecha de una celda → 'aaaa-mm-dd' o null. Sheets entrega un objeto fecha
 * (en la zona del script, Argentina) o, si alguien la tipeó, texto dd/mm/aaaa.
 */
function fechaIso(valor) {
  function iso(y, m, d) {
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }
  if (valor && typeof valor === 'object' && typeof valor.getFullYear === 'function') {
    var a = valor.getFullYear();
    return a >= 1940 && a <= 2100 ? iso(a, valor.getMonth() + 1, valor.getDate()) : null;
  }
  var t = texto(valor);
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) {
    var f = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (f.getFullYear() === Number(m[3]) && f.getMonth() === Number(m[2]) - 1 && f.getDate() === Number(m[1])) {
      return iso(f.getFullYear(), f.getMonth() + 1, f.getDate());
    }
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function ramaDe(celda) {
  var t = texto(celda).toLowerCase();
  return t === 'masculino' ? 'Masculino' : (t === 'femenino' ? 'Femenino' : null);
}

function recortar(valor, largo) {
  return texto(valor).slice(0, largo);
}

/**
 * Arma el envío.
 * @param {Object} datos
 *   tableroUrl, gidTablero, gidPagos
 *   filas: [{ fila (número de fila de la hoja), apellido, nombre, categoria,
 *             completo (celda), docs: [celda...], pagos: [celda...],
 *             salida: { apellido, nombre, nacimiento, rama } | null }]
 *   docsEncabezados / pagosEncabezados: los títulos de las columnas, en orden;
 *   las columnas de `docs` y `pagos` van alineadas con ellos.
 * @return {{ envio, descartadas, columnasDescartadas, truncadas }}
 */
function armarEnvio(datos) {
  var filas = datos.filas.filter(function (f) {
    var ap = texto(f.apellido), no = texto(f.nombre);
    // '#REF!' y compañía: la fórmula falló; eso no es un chico.
    return ap && no && ap.charAt(0) !== '#' && no.charAt(0) !== '#';
  });

  // Documentos: sólo columnas con todo ✅/❌; "Carpeta" y "Completo" no son documentos.
  var docs = [];
  datos.docsEncabezados.forEach(function (enc, i) {
    var titulo = recortar(enc, MAX_ENCABEZADO);
    var clave = titulo.toLowerCase();
    if (!titulo || clave === 'carpeta' || clave === 'completo' || parecePersonal(titulo)) return;
    var celdas = filas.map(function (f) { return f.docs[i]; });
    if (esColumnaDeEstado(celdas, [TILDE_OK, TILDE_NO])) docs.push({ i: i, titulo: titulo });
  });
  var pagos = [];
  datos.pagosEncabezados.forEach(function (enc, i) {
    var titulo = recortar(enc, MAX_ENCABEZADO);
    if (!titulo || parecePersonal(titulo)) return;
    var celdas = filas.map(function (f) { return f.pagos[i]; });
    if (esColumnaDeEstado(celdas, [TILDE_OK, CLIP, TILDE_NO])) pagos.push({ i: i, titulo: titulo });
  });
  var columnasDescartadas = datos.docsEncabezados.length + datos.pagosEncabezados.length - docs.length - pagos.length;
  var truncadas = 0;
  if (docs.length > MAX_ENCABEZADOS) { truncadas += docs.length - MAX_ENCABEZADOS; docs = docs.slice(0, MAX_ENCABEZADOS); }
  if (pagos.length > MAX_ENCABEZADOS) { truncadas += pagos.length - MAX_ENCABEZADOS; pagos = pagos.slice(0, MAX_ENCABEZADOS); }

  var descartadas = 0;
  var salida = [];
  filas.forEach(function (f) {
    var apellido = recortar(f.apellido, MAX_NOMBRE), nombre = recortar(f.nombre, MAX_NOMBRE);
    var categoria = recortar(f.categoria, MAX_NOMBRE);
    if (parecePersonal(apellido) || parecePersonal(nombre) || parecePersonal(categoria)) { descartadas++; return; }
    // La fecha y la rama salen de "Salida Semillero", fila a fila con el Tablero:
    // sólo se usan si el nombre de esa fila es el mismo (si las hojas se
    // desalinearon, mejor "no se sabe" que el dato de otro chico).
    var s = f.salida;
    var coincide = s && texto(s.apellido) === texto(f.apellido) && texto(s.nombre) === texto(f.nombre);
    var documentos = {}, pagosChico = {};
    docs.forEach(function (c) { var e = estadoDeDocumento(f.docs[c.i]); if (e !== null) documentos[c.titulo] = e; });
    pagos.forEach(function (c) { var e = estadoDePago(f.pagos[c.i]); if (e !== null) pagosChico[c.titulo] = e; });
    salida.push({
      fila: f.fila,
      apellido: apellido,
      nombre: nombre,
      fechaNacimiento: coincide ? fechaIso(s.nacimiento) : null,
      categoria: categoria || null,
      rama: coincide ? ramaDe(s.rama) : null,
      documentos: documentos,
      completo: estadoDeDocumento(f.completo),
      pagos: pagosChico
    });
  });
  if (salida.length > MAX_FILAS) { truncadas += salida.length - MAX_FILAS; salida = salida.slice(0, MAX_FILAS); }

  return {
    envio: {
      tableroUrl: datos.tableroUrl,
      gidTablero: datos.gidTablero,
      gidPagos: datos.gidPagos,
      documentosOrden: docs.map(function (c) { return c.titulo; }),
      conceptosOrden: pagos.map(function (c) { return c.titulo; }),
      filas: salida
    },
    descartadas: descartadas,
    columnasDescartadas: columnasDescartadas,
    truncadas: truncadas
  };
}
