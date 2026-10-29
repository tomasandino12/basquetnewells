// La planilla de asistencia que pide el área polideportiva, armada con lo que
// tomó el profe. Lógica pura: arma la matriz y el nombre de la hoja; escribir el
// .xlsx es de la pantalla (asistenciaHistorial.js).
import {
  codigoDelDia, resumenDeAsistencia, semaforo, lesionadoEn, diaMes,
} from './asistencia.js';
import { aniosDeCategoria, textoAnios, temporadaComoAnio } from './categorias.js';

// Los encabezados son los de la planilla original, letra por letra: el área la
// procesa y un encabezado distinto rompería su proceso.
export const ENCABEZADOS_INICIO = ['Jugador', 'DNI', 'SOCIO NUM', '% Asistencia', 'Estado'];
export const ENCABEZADOS_FIN = [
  'Total Entrenamientos', 'Entrenamientos Asistidos', 'Días Sin Entrenamiento',
  'Faltas Justificadas (J)', 'Días de Lesión (L)', '% LESION',
];

const MAX_NOMBRE_HOJA = 31; // límite de Excel
const RAMAS = { M: 'MASCULINO', F: 'FEMENINO' };
const EMOJI_ESTADO = {
  alerta: '🔴 Alerta',
  regular: '🟡 Regular',
  excelente: '🟢 Excelente',
  sin_datos: 'Sin datos',
};

/**
 * "U15 - MASCULINO (2012 y 2011)": categoría, rama y los años de nacimiento que
 * entran (el más nuevo primero, como en el original). `plantel` lleva
 * `categoriaCodigo` ("U15M", "MAY_F") y `temporada` (el nombre, "2026"). Sin
 * temporada que sea un año no se inventan los años. Se recorta a 31 caracteres
 * y se sacan los que Excel no admite en un nombre de hoja.
 */
export function nombreDeHoja({ categoriaCodigo, categoria, temporada }) {
  const m = /^(U\d+|MAY|ESCUELITA)_?([MF])$/.exec(String(categoriaCodigo ?? ''));
  if (!m) return recortar(categoria ?? categoriaCodigo ?? 'Plantel');
  const grupo = m[1] === 'MAY' ? 'MAYORES' : m[1];
  const anios = aniosDeCategoria(grupo, temporada);
  const rango = anios && anios.viejo != null && anios.nuevo != null && anios.nuevo - anios.viejo === 1
    ? `${anios.nuevo} y ${anios.viejo}`
    : textoAnios(anios);
  const sufijo = temporadaComoAnio(temporada) != null && rango ? ` (${rango})` : '';
  return recortar(`${grupo} - ${RAMAS[m[2]]}${sufijo}`);
}

function recortar(nombre) {
  return nombre.replace(/[\\/?*[\]:]/g, ' ').slice(0, MAX_NOMBRE_HOJA).trim();
}

/** 61.7 → "61.70%": el formato de la planilla. null (sin entrenamientos) → vacío. */
const textoPorcentaje = (pct) => (pct == null ? '' : `${pct.toFixed(2)}%`);

/**
 * La matriz de una hoja: encabezados y una fila por jugador. `entrenamientos` es
 * lo que devuelve obtenerEntrenamientos; `lesiones`, obtenerLesionesDelPlantel.
 * Una columna por día, en orden de fecha, con el código de la planilla (P, A,
 * J, A, L, P, L, A, SE). Los días en que no se tomó a ese chico, y los
 * anteriores a que entrara, quedan vacíos: "sin dato" no es "ausente". DNI y
 * SOCIO NUM van vacíos: la app no guarda el DNI a propósito (0060).
 */
export function filasDePlanilla({ jugadores, entrenamientos, lesiones }) {
  const dias = [...entrenamientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const encabezado = [...ENCABEZADOS_INICIO, ...dias.map((d) => diaMes(d.fecha)), ...ENCABEZADOS_FIN];
  const ordenados = [...jugadores].sort((a, b) => a.nombreLimpio.localeCompare(b.nombreLimpio, 'es'));

  const filas = ordenados.map((j) => {
    const suyas = (lesiones ?? []).filter((l) => l.jugadorId === j.id);
    const delChico = dias.map((d) => ({
      hubo: d.hubo,
      estado: d.filas.find((f) => f.jugadorId === j.id)?.estado,
      lesionado: lesionadoEn(suyas, d.fecha),
    }));
    const r = resumenDeAsistencia(delChico);
    return [
      j.nombreLimpio, '', '', textoPorcentaje(r.pctAsistencia), EMOJI_ESTADO[semaforo(r.pctAsistencia)],
      ...delChico.map(codigoDelDia),
      r.total, r.asistidos, r.sinEntrenamiento, r.justificadas, r.diasLesion, textoPorcentaje(r.pctLesion),
    ];
  });
  return [encabezado, ...filas];
}
