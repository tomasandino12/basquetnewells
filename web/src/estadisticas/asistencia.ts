import type { Entrenamiento, EstadoAsistencia } from '../datos/repositorio';

export interface DiaDeAsistencia {
  fecha: string;
  presentes: number;
  /** Los chicos con algo marcado ese día (presente, avisó o faltó). */
  marcados: number;
  pct: number;
}

export interface AsistenciaDeChico {
  jugadorId: string;
  presentes: number;
  avisos: number;
  faltas: number;
  dias: number;
  pct: number;
  /** Entrenamientos seguidos que vino, contando desde el último hacia atrás. */
  racha: number;
}

/** Sólo los días que hubo entrenamiento y alguien quedó marcado, del más viejo al más nuevo. */
export function diasConAsistencia(lista: Entrenamiento[]): Entrenamiento[] {
  return lista.filter((e) => e.hubo && e.filas.length > 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const porciento = (parte: number, total: number) => (total === 0 ? 0 : Math.round((parte / total) * 100));

/** Cuántos vinieron cada día, sobre los que tenían algo marcado. */
export function asistenciaPorDia(lista: Entrenamiento[]): DiaDeAsistencia[] {
  return diasConAsistencia(lista).map((e) => {
    const presentes = e.filas.filter((f) => f.estado === 'presente').length;
    return { fecha: e.fecha, presentes, marcados: e.filas.length, pct: porciento(presentes, e.filas.length) };
  });
}

/** Cada chico contra los días en que estuvo marcado (no contra días en que todavía no estaba en el plantel). */
export function asistenciaPorChico(lista: Entrenamiento[], jugadorIds: string[]): AsistenciaDeChico[] {
  const dias = diasConAsistencia(lista);
  return jugadorIds
    .map((jugadorId) => {
      const estados = dias
        .map((d) => d.filas.find((f) => f.jugadorId === jugadorId)?.estado)
        .filter((e): e is EstadoAsistencia => e !== undefined);
      const presentes = estados.filter((e) => e === 'presente').length;
      const avisos = estados.filter((e) => e === 'justificada').length;
      let racha = 0;
      for (let i = estados.length - 1; i >= 0 && estados[i] === 'presente'; i--) racha++;
      return {
        jugadorId, presentes, avisos, faltas: estados.length - presentes - avisos, dias: estados.length,
        pct: porciento(presentes, estados.length), racha,
      };
    })
    .filter((c) => c.dias > 0)
    .sort((a, b) => b.pct - a.pct || b.racha - a.racha);
}

/** La grilla de los últimos días: una fila por chico, una columna por entrenamiento (null = no estaba marcado). */
export function grillaDeAsistencia(lista: Entrenamiento[], jugadorIds: string[], cuantos: number) {
  const dias = diasConAsistencia(lista).slice(-cuantos);
  return {
    fechas: dias.map((d) => d.fecha),
    filas: jugadorIds.map((jugadorId) => ({
      jugadorId,
      estados: dias.map((d) => d.filas.find((f) => f.jugadorId === jugadorId)?.estado ?? null),
    })),
  };
}
