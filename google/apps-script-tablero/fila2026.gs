/**
 * Lógica pura del importador del formulario 2026: no toca Forms ni Sheets,
 * así se prueba con node (tests/appsScriptImportar2026.test.js).
 * Se pega tal cual en el editor de Apps Script: sin import/export.
 */

// Copias de nombres.gs del otro proyecto (este es un proyecto aparte, no comparte archivos).
function normalizarDni(texto) {
  return String(texto == null ? '' : texto).replace(/[.\s-]/g, '');
}

function dniValido(dni) {
  return typeof dni === 'string' && /^\d{7,8}$/.test(dni);
}

/** Sin tildes, minúsculas y hasta el primer paréntesis: "EN CASO DE URGENCIA (Nombre)" → "en caso de urgencia". */
function claveTitulo(titulo) {
  return String(titulo == null ? '' : titulo)
    .split('(')[0]
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

var PARTICULAS_NOMBRE = ['de', 'del', 'la', 'las', 'los', 'y', 'da', 'di', 'van', 'von'];

/** Copia de nombres.gs: Nombre Propio con las partículas en minúscula. */
function nombrePropio(texto) {
  var palabras = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim().toLowerCase().split(' ');
  return palabras.map(function (p, i) {
    if (!p) return p;
    if (i > 0 && PARTICULAS_NOMBRE.indexOf(p) >= 0) return p;
    return p.replace(/(^|[-'])(\S)/g, function (m, pre, letra) { return pre + letra.toUpperCase(); });
  }).join(' ');
}

var PARTICULAS_APELLIDO = ['de', 'del', 'di', 'da', 'la', 'las', 'los', 'van', 'san', 'mac', 'mc'];

/**
 * El formulario 2026 trae "Apellido y Nombre" en un solo campo, con el apellido primero.
 * Se parte en la primera palabra; si hay partícula ("de la Fuente") o tres palabras o más,
 * la partición es dudosa y se marca para revisar a mano.
 */
function separarApellidoNombre(texto) {
  var palabras = String(texto == null ? '' : texto).trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return { apellido: '', nombre: '', revisar: true };
  if (palabras.length === 1) return { apellido: palabras[0], nombre: '', revisar: true };
  var revisar = palabras.length >= 3 || PARTICULAS_APELLIDO.indexOf(palabras[0].toLowerCase()) >= 0;
  return { apellido: palabras[0], nombre: palabras.slice(1).join(' '), revisar: revisar };
}

/** De la categoría sólo sale la rama cuando lo dice; los mixtos quedan vacíos. */
function ramaDeCategoria(categoria) {
  var c = String(categoria == null ? '' : categoria).toUpperCase();
  if (c.indexOf('FEMENINO') >= 0) return 'Femenino';
  if (c.indexOf('MASCULINO') >= 0) return 'Masculino';
  return '';
}

/** Forms entrega las casillas como lista; vacía = sin tildar. También acepta texto. */
function estaTildado(valor) {
  if (Array.isArray(valor)) return valor.length > 0;
  return String(valor == null ? '' : valor).trim() !== '';
}

function listaComoTexto(valor) {
  if (Array.isArray(valor)) return valor.join(', ');
  return String(valor == null ? '' : valor).trim();
}

/** 'yyyy-MM-dd' → {anio, mes, dia}, o null si no es una fecha real. */
function parsearFecha(texto) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto == null ? '' : texto).trim());
  if (!m) return null;
  var anio = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  var d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return { anio: anio, mes: mes, dia: dia };
}

/**
 * Una respuesta cruda ({ momento: Date|número, respuestas: { claveTitulo: valor } })
 * pasa a un registro por chico. Devuelve null si el DNI no sirve (pasaporte, vacío, mal escrito).
 */
function registroDeRespuesta(cruda, titulos) {
  var r = cruda.respuestas;
  var v = function (campo) { return r[claveTitulo(titulos[campo])]; };
  var texto = function (campo) { var x = v(campo); return String(x == null ? '' : x).trim(); };
  var dni = normalizarDni(v('dni'));
  if (!dniValido(dni)) return null;
  var nombre = separarApellidoNombre(v('nombreCompleto'));
  return {
    dni: dni,
    momento: Number(cruda.momento),
    nombreCompleto: texto('nombreCompleto'),
    apellido: nombre.apellido.toUpperCase(),
    nombre: nombrePropio(nombre.nombre),
    revisar: nombre.revisar,
    fechaNacimiento: parsearFecha(v('fechaNacimiento')),
    categoria: texto('categoria'),
    telefonoAdulto: texto('telefonoAdulto'),
    obraSocial: texto('obraSocial'),
    afecciones: listaComoTexto(v('afecciones')),
    alergias: listaComoTexto(v('alergias')),
    indicacion: listaComoTexto(v('indicacion')),
    medicacion: listaComoTexto(v('medicacion')),
    urgencia: listaComoTexto(v('urgencia')),
    consentimiento: estaTildado(v('consentimiento'))
  };
}

/** Un chico que respondió dos veces cuenta una: la respuesta más reciente. */
function ultimaPorDni(registros) {
  var porDni = {};
  registros.forEach(function (reg) {
    var previo = porDni[reg.dni];
    if (!previo || reg.momento >= previo.momento) porDni[reg.dni] = reg;
  });
  return Object.keys(porDni).sort().map(function (dni) { return porDni[dni]; });
}

/** Correcciones a mano: filas [DNI, Apellido, Nombre]. No modifica los registros originales. */
function aplicarCorrecciones(registros, filas) {
  var porDni = {};
  filas.forEach(function (f) {
    var dni = normalizarDni(f[0]);
    if (dniValido(dni) && String(f[1]).trim() && String(f[2]).trim()) {
      porDni[dni] = { apellido: String(f[1]).trim(), nombre: String(f[2]).trim() };
    }
  });
  return registros.map(function (reg) {
    var c = porDni[reg.dni];
    if (!c) return reg;
    var copia = {};
    Object.keys(reg).forEach(function (k) { copia[k] = reg[k]; });
    copia.apellido = c.apellido;
    copia.nombre = c.nombre;
    copia.revisar = false;
    return copia;
  });
}

// Encabezados exactos: son el contrato con el importador de Semillero.
var ENCABEZADOS_SEMILLERO = ['Apellido', 'Nombre', 'Fecha de nacimiento', 'Categoría', 'Mail del responsable', 'Rama'];
var ENCABEZADOS_EMERGENCIAS = ['Apellido y nombre', 'Fecha de nacimiento', 'Teléfono del adulto', 'Contacto de urgencia', 'Afecciones', 'Alergias', 'Medicación', 'Indicación médica', 'Obra social'];

/** El mail del responsable queda vacío: el formulario 2026 no lo pedía. Sin DNI. */
function filaSemillero(reg) {
  return [reg.apellido, reg.nombre, reg.fechaNacimiento, reg.categoria, '', ramaDeCategoria(reg.categoria)];
}

/** Sólo con el consentimiento de datos tildado; si no, null. Sin DNI, afiliado, grupo sanguíneo ni domicilio. */
function filaEmergencias(reg) {
  if (!reg.consentimiento) return null;
  return [reg.nombreCompleto, reg.fechaNacimiento, reg.telefonoAdulto, reg.urgencia, reg.afecciones, reg.alergias, reg.medicacion, reg.indicacion, reg.obraSocial];
}
