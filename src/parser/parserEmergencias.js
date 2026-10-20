import * as XLSX from 'xlsx';
import { leerFecha } from './parserInscriptos.js';

// Planilla "Emergencias para Semillero" (google/PRECARGA-2026.md): una fila por
// chico, SIN DNI, domicilio ni número de afiliado. Va aparte de la de "Para
// Semillero" para que esa nunca lleve salud. Sólo lee y tipa; quién es cada
// chico y qué se guarda lo decide src/data/emergencias.js.
export const COLUMNAS = [
  'Apellido y nombre', 'Fecha de nacimiento', 'Teléfono del adulto', 'Contacto de urgencia',
  'Afecciones', 'Alergias', 'Medicación', 'Indicación médica', 'Obra social',
];

function normalizarEncabezado(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bytes de un .xlsx → filas crudas ya tipadas. */
export function parsearEmergencias(datos, nombreArchivo) {
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
    salida.errores.push(`[ENCABEZADOS_INVALIDOS] faltan las columnas: ${faltan.join(', ')}. ¿Es la planilla "Emergencias para Semillero"?`);
    return;
  }
  const texto = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  filas.slice(1).forEach((fila, k) => {
    const n = k + 2;
    const v = indice.map((i) => fila[i]);
    if (!v.some((x) => texto(x))) return; // fila en blanco: sin consentimiento o sin respuesta
    const [nombre, fecha, telefono, urgencia, afecciones, alergias, medicacion, indicacion, obraSocial] = v;
    if (!texto(nombre)) {
      salida.advertencias.push(`fila ${n}: falta el nombre, se saltea.`);
      return;
    }
    const fechaNacimiento = leerFecha(fecha);
    if (!fechaNacimiento) {
      salida.advertencias.push(`fila ${n}: no se entiende la fecha de nacimiento, se saltea.`);
      return;
    }
    salida.filas.push({
      fila: n,
      nombre: texto(nombre),
      fechaNacimiento,
      telefonoAdulto: texto(telefono),
      contactoUrgencia: texto(urgencia),
      afecciones: texto(afecciones),
      alergias: texto(alergias),
      medicacion: texto(medicacion),
      indicacion: texto(indicacion),
      obraSocial: texto(obraSocial),
    });
  });
}
