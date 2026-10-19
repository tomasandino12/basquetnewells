import * as XLSX from 'xlsx';

// Planilla "Para Semillero" que arma inscripción (prompt 05): una fila por
// chico, sin DNI. Tercer formato de planilla junto a la CABB y el plan
// físico; no comparte código con ellos a propósito (ver el plan, task 1).
export const COLUMNAS = ['Apellido', 'Nombre', 'Fecha de nacimiento', 'Categoría', 'Mail del responsable', 'Rama'];

const EPOCA_1900_MS = Date.UTC(1899, 11, 30);
const MS_POR_DIA = 86400000;

function normalizarEncabezado(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Celda de fecha → 'aaaa-mm-dd' o null. Sheets exporta la fecha como número
 * de serie; si alguien la tipeó como texto llega 'dd/mm/aaaa'. Cualquier otra
 * cosa es "no se sabe": no se adivina el orden de día y mes.
 */
export function leerFecha(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const f = new Date(EPOCA_1900_MS + Math.floor(valor) * MS_POR_DIA);
    const y = f.getUTCFullYear();
    if (y < 1940 || y > 2100) return null;
    return iso(y, f.getUTCMonth() + 1, f.getUTCDate());
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(valor ?? '').trim());
  if (!m) return null;
  const [d, mes, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(y, mes - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null;
  return iso(y, mes, d);
}

/** Bytes de un .xlsx → filas crudas ya tipadas. No decide nada de categorías ni de jugadores. */
export function parsearInscriptos(datos, nombreArchivo) {
  const salida = {
    exito: false,
    origen: { archivo: typeof nombreArchivo === 'string' ? nombreArchivo : null },
    filas: [],
    advertencias: [],
    errores: [],
  };
  try {
    llenar(salida, datos);
  } catch (e) {
    salida.errores.push(`[ERROR_INTERNO] ${e?.message ?? e}`);
  }
  salida.exito = salida.errores.length === 0;
  return salida;
}

function llenar(salida, datos) {
  const libro = XLSX.read(datos, { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = hoja ? XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null }) : [];
  if (filas.length === 0) {
    salida.errores.push('[PLANILLA_VACIA] el archivo no tiene filas.');
    return;
  }
  const encabezado = filas[0].map(normalizarEncabezado);
  const indice = COLUMNAS.map((c) => encabezado.indexOf(normalizarEncabezado(c)));
  const faltan = COLUMNAS.filter((_, i) => indice[i] === -1);
  if (faltan.length) {
    salida.errores.push(`[ENCABEZADOS_INVALIDOS] faltan las columnas: ${faltan.join(', ')}. ¿Es la planilla "Para Semillero"?`);
    return;
  }
  const texto = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  filas.slice(1).forEach((fila, k) => {
    const n = k + 2; // número de fila en la planilla
    const [apellido, nombre, fecha, categoria, mail, rama] = indice.map((i) => fila[i]);
    if (![apellido, nombre, fecha, categoria, mail, rama].some((v) => texto(v))) return; // fila en blanco
    if (!texto(apellido) || !texto(nombre)) {
      salida.advertencias.push(`[SIN_NOMBRE] fila ${n}: falta apellido o nombre, se saltea.`);
      return;
    }
    const fechaNacimiento = leerFecha(fecha);
    if (!fechaNacimiento) {
      salida.advertencias.push(`[FECHA_ILEGIBLE] fila ${n}: no se entiende la fecha de nacimiento, se saltea.`);
      return;
    }
    salida.filas.push({
      fila: n,
      apellido: texto(apellido),
      nombre: texto(nombre),
      fechaNacimiento,
      categoriaTexto: texto(categoria),
      mail: texto(mail),
      rama: texto(rama),
    });
  });
}
