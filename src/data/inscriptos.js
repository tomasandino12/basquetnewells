/*
 * Lógica pura del import de inscriptos: de las filas de la planilla "Para
 * Semillero" a lo que el profe revisa y confirma. Sin red ni DOM.
 * Spec: docs/superpowers/specs/2026-10-18-cuentas-familia-design.md §3.
 */
import { clavearNombre } from './claveNombre.js';
import { categoriaPorNacimiento } from './categorias.js';

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

const GRUPO_DE_CODIGO = (codigo) => (codigo.startsWith('MAY_') ? 'MAYORES' : codigo.slice(0, -1));

/**
 * Si el año de nacimiento no cae en la categoría que eligió la familia, un
 * texto para que el profe lo vea antes de tildar; null si coincide o no se
 * puede saber. Sólo avisa: la categoría de la CABB también depende de dónde
 * lo cite el profe.
 */
function avisoPorAnio(fechaNacimiento, anioTemporada, codigoCategoria) {
  if (anioTemporada == null) return null;
  const r = categoriaPorNacimiento(fechaNacimiento, anioTemporada, codigoCategoria.slice(-1));
  if (!r.grupo || r.grupo === GRUPO_DE_CODIGO(codigoCategoria)) return null;
  return `Por año de nacimiento le corresponde ${r.grupo === 'MAYORES' ? 'Mayores' : r.grupo === 'ESCUELITA' ? 'Escuelita' : r.grupo}.`;
}

/**
 * Filas del parser → inscriptos del plantel `codigoCategoria`.
 * - Junta las filas del mismo chico (apellido + nombre + fecha) y reúne sus
 *   mails: dos responsables son dos filas.
 * - `salteadas` dice qué no es de este plantel y por qué, para avisarlo.
 * - Un mail ilegible no tira la fila: el chico entra sin ese mail. Sin mail
 *   también entra: queda sin vínculo de familia.
 * - U13 es mixto en el formulario: en el plantel U13M las filas sin rama se
 *   ofrecen con `sinRama` (el profe decide) en vez de saltearse.
 * - `anioTemporada` (opcional) suma `aviso` cuando el año de nacimiento no
 *   coincide con la categoría elegida.
 */
export function inscriptosDelPlantel(filas, codigoCategoria, anioTemporada = null) {
  const porChico = new Map();
  const salteadas = [];
  const advertencias = [];
  for (const f of filas) {
    const { codigo, motivo } = mapearCategoria(f.categoriaTexto, f.rama);
    const sinRama = codigoCategoria === 'U13M' && motivo === 'U13 mixto sin rama';
    if (codigo !== codigoCategoria && !sinRama) {
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
        sinRama,
        aviso: avisoPorAnio(f.fechaNacimiento, anioTemporada, codigoCategoria),
      });
    }
  }
  return { inscriptos: [...porChico.values()], salteadas, advertencias };
}

/**
 * Cruza los inscriptos con el padrón del club (`padron`: [{ id, nombreClave,
 * fechaNacimiento? }]; la fecha sólo viene de las fichas que el profe ve).
 * El jugador se reconoce por apellido + nombre + fecha dentro del club:
 * - 'existente': misma clave y la fecha coincide o no se conoce.
 * - 'conflicto': la clave existe pero con otra fecha; puede ser un homónimo.
 *   Queda sin tildar hasta que el profe lo decida.
 * - 'nuevo': no hay nadie con esa clave.
 * La clave es la misma que arma el alta (`clavearNombre` sobre "Apellido,
 * Nombre"): si la CABB lo escribió distinto ("Juan M."), figura como nuevo y
 * el dedup del import de la CABB lo ofrece después, como siempre.
 */
export function cruzarConPadron(inscriptos, padron) {
  const porClave = new Map();
  for (const p of padron) {
    if (!porClave.has(p.nombreClave)) porClave.set(p.nombreClave, []);
    porClave.get(p.nombreClave).push(p);
  }
  return inscriptos.map((i) => {
    const claveNombre = clavearNombre(i.nombreLimpio);
    const candidatos = porClave.get(claveNombre) ?? [];
    if (candidatos.length === 0) return { ...i, estado: 'nuevo', nombreClave: claveNombre };
    const igual = candidatos.find((c) => c.fechaNacimiento === i.fechaNacimiento);
    if (igual) return { ...i, estado: 'existente', jugadorId: igual.id };
    const sinFecha = candidatos.filter((c) => !c.fechaNacimiento);
    if (sinFecha.length === 1 && sinFecha.length === candidatos.length) {
      return { ...i, estado: 'existente', jugadorId: sinFecha[0].id };
    }
    return { ...i, estado: 'conflicto', nombreClave: claveNombre };
  });
}

/**
 * Las filas que se mandan a `importar_inscriptos`, de lo que el profe dejó
 * tildado. Un conflicto aceptado es un chico distinto: se desambigua con su
 * fecha, como el alta manual de homónimos.
 */
export function filasParaImportar(cruzados) {
  return cruzados.map((c) => {
    const base = { fechaNacimiento: c.fechaNacimiento, mails: c.mails };
    if (c.estado === 'existente') return { ...base, jugadorId: c.jugadorId };
    const nueva = { ...base, nombreClave: c.nombreClave, nombreLimpio: c.nombreLimpio };
    return c.estado === 'conflicto' ? { ...nueva, desambiguador: c.fechaNacimiento } : nueva;
  });
}
