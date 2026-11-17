import { filasDePlanilla, nombreDeHoja } from '@datos/planillaAsistencia.js';
import type { PlantelDelClub, Repositorio } from '../datos/repositorio';

// Un plantel es de una temporada: todo lo que tiene entrenamientos es de ésta.
const DESDE_SIEMPRE = '2000-01-01';

export interface HojaDeAsistencia {
  nombre: string;
  filas: unknown[][];
}

/**
 * Una hoja por categoría del profe, con lo que tomó. Las lesiones van sin `.catch`: una planilla sin
 * ellas saldría sin avisar con los «L» de menos, y el área la procesa.
 */
export async function hojasDeAsistencia(repo: Repositorio, clubId: string, planteles: PlantelDelClub[], hoy: string): Promise<HojaDeAsistencia[]> {
  const [temporadas, datos] = await Promise.all([
    repo.obtenerTemporadasDelClub(clubId),
    Promise.all(planteles.map(async (p) => {
      const [jugadores, entrenamientos, lesiones] = await Promise.all([
        repo.obtenerJugadoresDelPlantel(clubId, p.id),
        repo.obtenerEntrenamientos(p.id, DESDE_SIEMPRE, hoy),
        repo.obtenerLesionesDelPlantel(p.id),
      ]);
      return { jugadores, entrenamientos, lesiones };
    })),
  ]);
  return planteles.map((p, i) => ({
    nombre: nombreDeHoja({ ...p, temporada: temporadas.find((t) => t.id === p.temporadaId)?.nombre ?? null }) as string,
    filas: filasDePlanilla(datos[i]) as unknown[][],
  }));
}

/** Arma el .xlsx y lo baja. El lector de planillas se pide recién acá: no pesa en el resto de la app. */
export async function bajarLibro(hojas: HojaDeAsistencia[], nombreArchivo: string): Promise<void> {
  const XLSX = await import('xlsx');
  const libro = XLSX.utils.book_new();
  for (const h of hojas) XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(h.filas), h.nombre);
  XLSX.writeFile(libro, nombreArchivo);
}
