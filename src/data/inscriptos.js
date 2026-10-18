/*
 * Lógica pura del import de inscriptos: de las filas de la planilla "Para
 * Semillero" a lo que el profe revisa y confirma. Sin red ni DOM.
 * Spec: docs/superpowers/specs/2026-10-18-cuentas-familia-design.md §3.
 */

// Texto exacto del desplegable del formulario de inscripción (11 opciones).
// `null` = Semillero no tiene esa categoría; se saltea con aviso. U13 mixto
// se resuelve aparte, con la columna Rama.
const CATEGORIAS = new Map([
  ['ESCUELITA - MIXTO', null],
  ['U9 - MIXTO (2017 Y 2018)', null],
  ['U11 - MIXTO (2015 Y 2016)', null],
  ['U13 - MIXTO (2014 Y 2013)', 'U13M'],
  ['U15 - MASCULINO (2012 Y 2011)', 'U15M'],
  ['U15 - FEMENINO (2012 Y 2011)', null],
  ['U17 - MASCULINO (2010 Y 2009)', 'U17M'],
  ['U17 - FEMENINO (2010 Y 2009)', null],
  ['U21 - MASCULINO (2008, 2007, 2006 Y 2005)', 'U21M'],
  ['U21 - FEMENINO (2008, 2007, 2006 Y 2005)', null],
  ['MAYORES FEMENINO', 'MAY_F'],
]);

const clave = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * Categoría del formulario + rama → código de Semillero. Si la categoría ya
 * dice MASCULINO o FEMENINO manda ella; la rama sólo decide en las MIXTO.
 * Devuelve { codigo } o { codigo: null, motivo } si no hay dónde ponerlo.
 */
export function mapearCategoria(categoriaTexto, rama = '') {
  const k = clave(categoriaTexto);
  if (!CATEGORIAS.has(k)) {
    return { codigo: null, motivo: `categoría desconocida: "${String(categoriaTexto ?? '').trim()}"` };
  }
  if (k.startsWith('U13 - MIXTO')) {
    const r = clave(rama);
    if (r === 'MASCULINO') return { codigo: 'U13M' };
    if (r === 'FEMENINO') return { codigo: null, motivo: 'Semillero no tiene U13 femenino' };
    return { codigo: null, motivo: 'U13 mixto sin rama' };
  }
  const codigo = CATEGORIAS.get(k);
  if (codigo) return { codigo };
  return { codigo: null, motivo: 'Semillero no tiene esa categoría' };
}

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minúsculas y recortado. Devuelve null si no parece un mail. */
export function normalizarMail(texto) {
  const m = String(texto ?? '').trim().toLowerCase();
  return MAIL.test(m) ? m : null;
}

/**
 * Filas del parser → inscriptos del plantel `codigoCategoria`.
 * - Junta las filas del mismo chico (apellido + nombre + fecha) y reúne sus
 *   mails: dos responsables son dos filas.
 * - `salteadas` dice qué no es de este plantel y por qué, para avisarlo.
 * - Un mail ilegible no tira la fila: el chico entra sin ese mail.
 */
export function inscriptosDelPlantel(filas, codigoCategoria) {
  const porChico = new Map();
  const salteadas = [];
  const advertencias = [];
  for (const f of filas) {
    const { codigo, motivo } = mapearCategoria(f.categoriaTexto, f.rama);
    if (codigo !== codigoCategoria) {
      salteadas.push({ fila: f.fila, motivo: motivo ?? `es de ${codigo}` });
      continue;
    }
    const k = `${clave(f.apellido)}|${clave(f.nombre)}|${f.fechaNacimiento}`;
    const mail = normalizarMail(f.mail);
    if (f.mail && !mail) advertencias.push(`fila ${f.fila}: el mail "${f.mail}" no es válido.`);
    const previo = porChico.get(k);
    if (previo) {
      if (mail && !previo.mails.includes(mail)) previo.mails.push(mail);
    } else {
      porChico.set(k, {
        apellido: f.apellido,
        nombre: f.nombre,
        nombreLimpio: `${f.apellido}, ${f.nombre}`,
        fechaNacimiento: f.fechaNacimiento,
        mails: mail ? [mail] : [],
      });
    }
  }
  return { inscriptos: [...porChico.values()], salteadas, advertencias };
}
